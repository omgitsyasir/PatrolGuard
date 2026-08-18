import { Router } from 'express';
import { db, getSettings, nowIso } from '../db.js';
import { clampPatrolCount, normalizePatrolNames, defaultPatrolNames } from './sites.js';

const router = Router();

const PATROL_FIELDS = `id, shift_id, slot, label, started_at, completed_at, status, checklist, notes, created_at`;

function parseJsonArray(str) {
  try {
    const v = JSON.parse(str || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function getActiveShift() {
  return db.prepare("SELECT * FROM shifts WHERE status = 'active' ORDER BY started_at DESC LIMIT 1").get();
}

function patrolsForShift(shiftId) {
  return db
    .prepare(`SELECT ${PATROL_FIELDS} FROM patrols WHERE shift_id = ? ORDER BY slot`)
    .all(shiftId)
    .map((p) => ({ ...p, checklist: parseJsonArray(p.checklist) }));
}

function logsForShift(shiftId) {
  return db.prepare('SELECT * FROM shift_logs WHERE shift_id = ? ORDER BY logged_at, id').all(shiftId);
}

function shiftDetail(shift) {
  if (!shift) return null;
  const patrols = patrolsForShift(shift.id);
  const incidents = db
    .prepare('SELECT id, incident_type, location, occurred_at FROM incidents WHERE shift_id = ? ORDER BY occurred_at DESC')
    .all(shift.id);
  const logs = logsForShift(shift.id);
  return { ...shift, patrols, incidents, logs };
}

function isIso(value) {
  return Boolean(value) && !isNaN(new Date(value));
}

// Default checkpoint template for a site (snapshotted into every patrol on shift start).
function checkpointTemplate(site) {
  return parseJsonArray(site?.checkpoints_json)
    .map((name) => ({ name: String(name || '').trim() }))
    .filter((c) => c.name);
}

function siteRequirements(site, phase) {
  const key = phase === 'start' ? 'shift_start_requirements_json' : 'shift_end_requirements_json';
  return parseJsonArray(site?.[key]).map((t) => String(t || '').trim()).filter(Boolean);
}

// Insert standard narrative logs (start/end work order requirements) into the daily record.
function insertShiftLogs(shiftId, phase, texts, when) {
  for (const text of texts) {
    db.prepare('INSERT INTO shift_logs (shift_id, phase, text, logged_at, created_at) VALUES (?, ?, ?, ?, ?)').run(
      shiftId,
      phase,
      text,
      when,
      when
    );
  }
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
  const names = normalizePatrolNames(parseJsonArray(site.patrol_names_json), count) || defaultPatrolNames(count);
  const checklist = checkpointTemplate(site).map((c) => ({ ...c, ok: false, checked_at: null }));

  const info = db
    .prepare(
      'INSERT INTO shifts (date, officer_name, site_id, site_name, started_at, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(date, officer, site.id, site.site_name, now, 'active', now);

  for (let i = 0; i < count; i++) {
    db.prepare('INSERT INTO patrols (shift_id, slot, label, checklist, created_at) VALUES (?, ?, ?, ?, ?)').run(
      info.lastInsertRowid,
      i + 1,
      names[i],
      JSON.stringify(checklist),
      now
    );
  }

  insertShiftLogs(info.lastInsertRowid, 'start', siteRequirements(site, 'start'), now);

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
      log_count: db.prepare('SELECT COUNT(*) c FROM shift_logs WHERE shift_id = ?').get(s.id).c,
    }));
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id);
  if (!shift) return res.status(404).json({ error: 'Shift not found' });
  res.json(shiftDetail(shift));
});

// Timestamp override for the shift itself (started_at / ended_at / notes).
router.put('/:id', (req, res) => {
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id);
  if (!shift) return res.status(404).json({ error: 'Shift not found' });

  const b = req.body || {};
  const startedAt = b.started_at ?? shift.started_at;
  const endedAt = b.ended_at ?? shift.ended_at;
  if (!isIso(startedAt) || (endedAt !== null && endedAt !== undefined && !isIso(endedAt))) {
    return res.status(400).json({ error: 'Timestamps must be valid ISO dates.' });
  }

  const date = new Date(startedAt).toISOString().slice(0, 10);
  db.prepare(
    `UPDATE shifts SET started_at = ?, ended_at = ?, date = ?, notes = ? WHERE id = ?`
  ).run(startedAt, endedAt || null, date, (b.notes ?? shift.notes ?? '').trim(), shift.id);

  res.json(shiftDetail(db.prepare('SELECT * FROM shifts WHERE id = ?').get(shift.id)));
});

router.post('/:id/end', (req, res) => {
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id);
  if (!shift) return res.status(404).json({ error: 'Shift not found' });
  if (shift.status === 'completed') return res.json(shiftDetail(shift));

  const endedAt = req.body?.ended_at || nowIso();
  const site = shift.site_id ? db.prepare('SELECT * FROM sites WHERE id = ?').get(shift.site_id) : null;
  if (site) insertShiftLogs(shift.id, 'end', siteRequirements(site, 'end'), endedAt);

  db.prepare("UPDATE shifts SET status = 'completed', ended_at = ?, notes = ? WHERE id = ?").run(
    endedAt,
    (req.body?.notes || '').trim(),
    shift.id
  );
  res.json(shiftDetail(db.prepare('SELECT * FROM shifts WHERE id = ?').get(shift.id)));
});

function completeShiftWithEndLogs(shift, endedAt) {
  const site = shift.site_id ? db.prepare('SELECT * FROM sites WHERE id = ?').get(shift.site_id) : null;
  if (site) insertShiftLogs(shift.id, 'end', siteRequirements(site, 'end'), endedAt);
  db.prepare("UPDATE shifts SET status = 'completed', ended_at = ? WHERE id = ?").run(endedAt, shift.id);
  return db.prepare('SELECT * FROM shifts WHERE id = ?').get(shift.id);
}

router.post('/:id/patrols/:slot/start', (req, res) => {
  const slot = Number(req.params.slot);
  const patrol = db
    .prepare('SELECT * FROM patrols WHERE shift_id = ? AND slot = ?')
    .get(req.params.id, slot);
  if (!patrol) return res.status(404).json({ error: 'Patrol not found' });
  if (patrol.started_at) return res.json({ ...patrol, checklist: parseJsonArray(patrol.checklist) });

  db.prepare('UPDATE patrols SET started_at = ? WHERE id = ?').run(nowIso(), patrol.id);
  const updated = db.prepare('SELECT * FROM patrols WHERE id = ?').get(patrol.id);
  res.status(201).json({ ...updated, checklist: parseJsonArray(updated.checklist) });
});

// Live checkpoint persistence while a patrol is in progress (add / edit / reorder / delete / check-in times).
router.put('/:id/patrols/:slot/checklist', (req, res) => {
  const patrol = db
    .prepare('SELECT * FROM patrols WHERE shift_id = ? AND slot = ?')
    .get(req.params.id, Number(req.params.slot));
  if (!patrol) return res.status(404).json({ error: 'Patrol not found' });

  const raw = Array.isArray(req.body?.checklist) ? req.body.checklist : [];
  const checklist = raw
    .map((c) => ({
      name: String(c?.name || '').trim(),
      ok: Boolean(c?.ok),
      checked_at: isIso(c?.checked_at) ? c.checked_at : null,
    }))
    .filter((c) => c.name);

  db.prepare('UPDATE patrols SET checklist = ? WHERE id = ?').run(JSON.stringify(checklist), patrol.id);
  res.json({ ...patrol, checklist });
});

// Patrol timestamp override (started_at / completed_at).
router.patch('/:id/patrols/:slot', (req, res) => {
  const patrol = db
    .prepare('SELECT * FROM patrols WHERE shift_id = ? AND slot = ?')
    .get(req.params.id, Number(req.params.slot));
  if (!patrol) return res.status(404).json({ error: 'Patrol not found' });

  const b = req.body || {};
  const startedAt = b.started_at ?? patrol.started_at;
  const completedAt = b.completed_at ?? patrol.completed_at;
  if ((startedAt !== null && startedAt !== undefined && !isIso(startedAt)) || (completedAt !== null && completedAt !== undefined && !isIso(completedAt))) {
    return res.status(400).json({ error: 'Timestamps must be valid ISO dates.' });
  }

  db.prepare('UPDATE patrols SET started_at = ?, completed_at = ?, notes = ? WHERE id = ?').run(
    startedAt || null,
    completedAt || null,
    (b.notes ?? patrol.notes ?? '').trim(),
    patrol.id
  );
  const updated = db.prepare('SELECT * FROM patrols WHERE id = ?').get(patrol.id);
  res.json({ ...updated, checklist: parseJsonArray(updated.checklist) });
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

  const checklist = Array.isArray(req.body?.checklist) ? req.body.checklist : parseJsonArray(patrol.checklist);
  // Preserve a previously backdated completion time unless the client supplies one.
  const completedAt = req.body?.completed_at || patrol.completed_at || nowIso();

  db.prepare('UPDATE patrols SET completed_at = ?, status = ?, checklist = ?, notes = ? WHERE id = ?').run(
    completedAt,
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
    completedShift = completeShiftWithEndLogs(shift, completedAt);
  }

  res.json({ patrol: { ...updated, checklist }, shift: completedShift });
});

export default router;