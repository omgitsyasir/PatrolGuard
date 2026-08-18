import { Router } from 'express';
import { db, nowIso } from '../db.js';

const router = Router();

export function defaultPatrolNames(n) {
  const names = [];
  for (let i = 0; i < n; i++) {
    if (i === 0) names.push('Start of Shift');
    else if (i === n - 1) names.push('End of Shift');
    else if (n === 3) names.push('Mid-Shift');
    else names.push(`Patrol ${i + 1}`);
  }
  return names;
}

export function clampPatrolCount(n) {
  const v = Math.round(Number(n));
  if (Number.isNaN(v)) return 3;
  return Math.min(8, Math.max(2, v));
}

export function normalizePatrolNames(raw, count) {
  const provided = Array.isArray(raw)
    ? raw.map((x) => String(x || '').trim()).filter(Boolean)
    : [];
  const defaults = defaultPatrolNames(count);
  const names = [];
  for (let i = 0; i < count; i++) names.push(provided[i] || defaults[i]);
  return names;
}

function serialize(site) {
  return { ...site, patrol_names: JSON.parse(site.patrol_names_json || '[]') };
}

router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM sites ORDER BY site_name').all().map(serialize);
  res.json(rows);
});

router.post('/', (req, res) => {
  const b = req.body || {};
  const siteName = (b.site_name || '').trim();
  if (!siteName) return res.status(400).json({ error: 'Site name is required.' });

  const count = clampPatrolCount(b.patrol_count);
  const names = normalizePatrolNames(b.patrol_names, count);

  const info = db
    .prepare('INSERT INTO sites (company_name, site_name, patrol_count, patrol_names_json, created_at) VALUES (?, ?, ?, ?, ?)')
    .run((b.company_name || '').trim(), siteName, count, JSON.stringify(names), nowIso());

  res.status(201).json(serialize(db.prepare('SELECT * FROM sites WHERE id = ?').get(info.lastInsertRowid)));
});

router.put('/:id', (req, res) => {
  const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!site) return res.status(404).json({ error: 'Site not found' });

  const b = req.body || {};
  const siteName = (b.site_name || '').trim();
  if (!siteName) return res.status(400).json({ error: 'Site name is required.' });

  const count = clampPatrolCount(b.patrol_count);
  const names = normalizePatrolNames(b.patrol_names, count);

  db.prepare(
    'UPDATE sites SET company_name = ?, site_name = ?, patrol_count = ?, patrol_names_json = ? WHERE id = ?'
  ).run((b.company_name || '').trim(), siteName, count, JSON.stringify(names), site.id);

  res.json(serialize(db.prepare('SELECT * FROM sites WHERE id = ?').get(site.id)));
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM sites WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Site not found' });
  res.json({ ok: true });
});

export default router;