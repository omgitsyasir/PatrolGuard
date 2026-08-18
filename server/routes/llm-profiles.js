import { Router } from 'express';
import { db, nowIso } from '../db.js';
import { testProfile, LLMError } from '../llm.js';

const router = Router();

const MASK = '••••••••';

function serialize(profile) {
  return {
    ...profile,
    api_key: profile.api_key ? MASK : '',
  };
}

function maskAwareApiKey(body, current) {
  if (body.api_key === MASK) return current || '';
  return (body.api_key ?? '').trim();
}

router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM llm_profiles ORDER BY is_default DESC, id').all().map(serialize);
  res.json(rows);
});

router.post('/', (req, res) => {
  const b = req.body || {};
  const name = (b.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Profile name is required.' });

  const hasProfiles = db.prepare('SELECT COUNT(*) c FROM llm_profiles').get().c > 0;
  const makeDefault = Boolean(b.is_default) || !hasProfiles;

  const temperature = Number.isFinite(Number(b.temperature)) ? Math.min(2, Math.max(0, Number(b.temperature))) : 0.4;

  const info = db
    .prepare(
      'INSERT INTO llm_profiles (name, endpoint, api_key, model_name, temperature, is_default, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      name,
      (b.endpoint || '').trim(),
      (b.api_key || '').trim(),
      (b.model_name || '').trim(),
      temperature,
      makeDefault ? 1 : 0,
      nowIso()
    );

  if (makeDefault) {
    db.prepare('UPDATE llm_profiles SET is_default = 0 WHERE id != ?').run(info.lastInsertRowid);
  }

  res.status(201).json(serialize(db.prepare('SELECT * FROM llm_profiles WHERE id = ?').get(info.lastInsertRowid)));
});

router.put('/:id', (req, res) => {
  const profile = db.prepare('SELECT * FROM llm_profiles WHERE id = ?').get(req.params.id);
  if (!profile) return res.status(404).json({ error: 'LLM profile not found' });

  const b = req.body || {};
  const name = (b.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Profile name is required.' });

  const temperature = Number.isFinite(Number(b.temperature)) ? Math.min(2, Math.max(0, Number(b.temperature))) : profile.temperature;

  db.prepare(
    'UPDATE llm_profiles SET name = ?, endpoint = ?, api_key = ?, model_name = ?, temperature = ? WHERE id = ?'
  ).run(
    name,
    (b.endpoint || '').trim(),
    maskAwareApiKey(b, profile.api_key),
    (b.model_name || '').trim(),
    temperature,
    profile.id
  );

  if (b.is_default) {
    db.prepare('UPDATE llm_profiles SET is_default = 0 WHERE id != ?').run(profile.id);
    db.prepare('UPDATE llm_profiles SET is_default = 1 WHERE id = ?').run(profile.id);
  }

  res.json(serialize(db.prepare('SELECT * FROM llm_profiles WHERE id = ?').get(profile.id)));
});

router.delete('/:id', (req, res) => {
  const profile = db.prepare('SELECT * FROM llm_profiles WHERE id = ?').get(req.params.id);
  if (!profile) return res.status(404).json({ error: 'LLM profile not found' });

  db.prepare('DELETE FROM llm_profiles WHERE id = ?').run(profile.id);

  if (profile.is_default) {
    const next = db.prepare('SELECT id FROM llm_profiles ORDER BY id LIMIT 1').get();
    if (next) db.prepare('UPDATE llm_profiles SET is_default = 1 WHERE id = ?').run(next.id);
  }

  res.json({ ok: true });
});

router.post('/:id/default', (req, res) => {
  const profile = db.prepare('SELECT * FROM llm_profiles WHERE id = ?').get(req.params.id);
  if (!profile) return res.status(404).json({ error: 'LLM profile not found' });

  db.prepare('UPDATE llm_profiles SET is_default = 0 WHERE id != ?').run(profile.id);
  db.prepare('UPDATE llm_profiles SET is_default = 1 WHERE id = ?').run(profile.id);

  res.json(serialize(db.prepare('SELECT * FROM llm_profiles WHERE id = ?').get(profile.id)));
});

router.post('/:id/test', async (req, res) => {
  try {
    const profile = db.prepare('SELECT * FROM llm_profiles WHERE id = ?').get(req.params.id);
    if (!profile) return res.status(404).json({ error: 'LLM profile not found' });
    if (!profile.endpoint || !profile.model_name) {
      throw new LLMError('This profile is missing an endpoint or model name.');
    }
    const result = await testProfile(profile);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: err.message });
  }
});

export default router;