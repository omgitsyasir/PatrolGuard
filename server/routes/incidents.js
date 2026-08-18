import { Router } from 'express';
import { db, nowIso } from '../db.js';

const router = Router();

function getActiveShiftId() {
  const shift = db.prepare("SELECT id FROM shifts WHERE status = 'active' ORDER BY started_at DESC LIMIT 1").get();
  return shift ? shift.id : null;
}

router.post('/', (req, res) => {
  const b = req.body || {};
  if (!b.incident_type || !b.location || !b.occurred_at) {
    return res.status(400).json({ error: 'incident_type, location, and occurred_at are required.' });
  }
  const media = Array.isArray(b.media) ? b.media.filter((m) => typeof m === 'string') : [];
  const info = db
    .prepare(
      `INSERT INTO incidents (shift_id, incident_type, occurred_at, location, details, media, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      b.shift_id != null ? b.shift_id : getActiveShiftId(),
      b.incident_type.trim(),
      b.occurred_at,
      b.location.trim(),
      (b.details || '').trim(),
      JSON.stringify(media),
      nowIso()
    );
  res.status(201).json(getIncident(info.lastInsertRowid));
});

function getIncident(id) {
  const row = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id);
  if (!row) return null;
  return { ...row, media: JSON.parse(row.media || '[]') };
}

router.get('/', (_req, res) => {
  const rows = db
    .prepare('SELECT * FROM incidents ORDER BY occurred_at DESC LIMIT 500')
    .all()
    .map((i) => ({ ...i, media: JSON.parse(i.media || '[]') }));
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const incident = getIncident(req.params.id);
  if (!incident) return res.status(404).json({ error: 'Incident not found' });
  res.json(incident);
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM incidents WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Incident not found' });
  res.json({ ok: true });
});

export default router;
