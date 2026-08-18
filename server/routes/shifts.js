import { Router } from 'express';
import { db, getSettings, nowIso } from '../db.js';
import { clampPatrolCount, normalizePatrolNames, defaultPatrolNames } from './sites.js';

const router = Router();

const PATROL_FIELDS = `id, shift_id, slot, label, started_at, completed_at, status, checklist, notes, created_at`;

function getActiveShift() {
  return db.prepare("SELECT * FROM shifts WHERE status = 'active' ORDER BY started_at DESC LIMIT 1").get();
}

function patrolsForShift(shiftId) {
  return db
    .prepare(`SELECT ${PATROL_FIELDS} FROM patrols WHERE shift_id = ? ORDER BY slot`)
    .all(shiftId)
    .map((p) => ({ ...p, checklist: JSON.parse(p.checklist || '[]') }));
}

function shiftDetail(shift) {
  if (!shift) return null;
  const patrols = patrolsForShift(shift.id);
  const incidents = db
    .prepare('SELECT id, incident_type, location, occurred_at FROM incidents WHERE shift_id = ? ORDER BY occurred_at DESC')
    .all(shift.id);
  return { ...shift, patrols, incidents };
}

router.post('/', (req, res) => {
  const existing = getActiveShift();
  if (existing) return res.json(shiftDetail(existing));

  const siteId = Number(req.body?.site_id);
  const site = siteId ? db.prepare('SELECT * FROM sites WHERE id = ?').get(siteId) : null;
  if (!site) {
    return res.status(400).json({
      error: 'Select a site/location to start your shift. Add one in Settings → Sites & Locations if none exist.',
    });
  }

  const settings = getSettings();
  const now = nowIso();
  const date = now.slice(0, 10);
  const officer = (settings.officer_name || '').trim() || 'Security Officer';

  const count = clampPatrolCount(site.patrol_count);
  const names = normalizePatrolNames(JSON.parse(site.patrol_names_json || '[]'), count) || defaultPatrolNames(count);

  const info = db
    .prepare(
      'INSERT INTO shifts (date, officer_name, site_id, site_name, started_at, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(date, officer, site.id, site.site_name, now, 'active', now);

  for (let i = 0; i < count; i++) {
    db.prepare('INSERT INTO patrols (shift_id, slot, label, checklist, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(info.lastInsertRowid, i + 1, names[i], JSON.stringify([]), now);
  }

  res.status(201).json(shiftDetail(db.prepare('SELECT * FROM shifts WHERE id = ?').get(info.lastInsertRowid)));
});

router.get('/active', (_req, res) => {
  const shift = getActiveShift();
  if (!shift) return res.json({ shift: null });
  res.json({ shift: shiftDetail(shift) });
});

router.get('/', (_req, res) => {
  const rows = db
    .prepare('SELECT * FROM shifts ORDER BY started_at DESC LIMIT 200')
    .all()
    .map((s) => ({
      ...s,
      patrol_count: db.prepare('SELECT COUNT(*) c FROM patrols WHERE shift_id = ? AND completed_at IS NOT NULL').get(s.id).c,
      patrol_total: db.prepare('SELECT COUNT(*) c FROM patrols WHERE shift_id = ?').get(s.id).c,
      incident_count: db.prepare('SELECT COUNT(*) c FROM incidents WHERE shift_id = ?').get(s.id).c,
    }));
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id);
  if (!shift) return res.status(404).json({ error: 'Shift not found' });
  res.json(shiftDetail(shift));
});

router.post('/:id/end', (req, res) => {
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id);
  if (!shift) return res.status(404).json({ error: 'Shift not found' });
  if (shift.status === 'completed') return res.json(shiftDetail(shift));

  db.prepare("UPDATE shifts SET status = 'completed', ended_at = ?, notes = ? WHERE id = ?").run(
    nowIso(),
    (req.body?.notes || '').trim(),
    shift.id
  );
  res.json(shiftDetail(db.prepare('SELECT * FROM shifts WHERE id = ?').get(shift.id)));
});

router.post('/:id/patrols/:slot/start', (req, res) => {
  const slot = Number(req.params.slot);
  const patrol = db
    .prepare('SELECT * FROM patrols WHERE shift_id = ? AND slot = ?')
    .get(req.params.id, slot);
  if (!patrol) return res.status(404).json({ error: 'Patrol not found' });
  if (patrol.started_at) return res.json({ ...patrol, checklist: JSON.parse(patrol.checklist) });

  db.prepare('UPDATE patrols SET started_at = ?, checklist = ? WHERE id = ?').run(
    nowIso(),
    JSON.stringify([
      { name: 'Fire Exits', ok: true },
      { name: 'Pool Area', ok: true },
      { name: 'Parking Lot', ok: true },
      { name: 'Hallway Noise', ok: true },
    ]),
    patrol.id
  );
  const updated = db.prepare('SELECT * FROM patrols WHERE id = ?').get(patrol.id);
  res.status(201).json({ ...updated, checklist: JSON.parse(updated.checklist) });
});

router.post('/:id/patrols/:slot/complete', (req, res) => {
  const slot = Number(req.params.slot);
  const status = req.body?.status;
  if (!['all_clear', 'minor_issues', 'requires_action'].includes(status)) {
    return res.status(400).json({ error: 'status must be all_clear | minor_issues | requires_action' });
  }

  const patrol = db
    .prepare('SELECT * FROM patrols WHERE shift_id = ? AND slot = ?')
    .get(req.params.id, slot);
  if (!patrol) return res.status(404).json({ error: 'Patrol not found' });

  const checklist = Array.isArray(req.body?.checklist) ? req.body.checklist : JSON.parse(patrol.checklist || '[]');

  db.prepare('UPDATE patrols SET completed_at = ?, status = ?, checklist = ?, notes = ? WHERE id = ?').run(
    nowIso(),
    status,
    JSON.stringify(checklist),
    (req.body?.notes || '').trim(),
    patrol.id
  );

  const updated = db.prepare('SELECT * FROM patrols WHERE id = ?').get(patrol.id);

  // Auto-complete the shift when the final (End of Shift) patrol is completed.
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id);
  const isLastSlot = db
    .prepare('SELECT COUNT(*) c FROM patrols WHERE shift_id = ?')
    .get(shift.id).c === slot;

  let completedShift = null;
  if (isLastSlot && shift && shift.status === 'active') {
    db.prepare("UPDATE shifts SET status = 'completed', ended_at = ? WHERE id = ?").run(nowIso(), shift.id);
    completedShift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(shift.id);
  }

  res.json({ patrol: { ...updated, checklist }, shift: completedShift });
});

export default router;