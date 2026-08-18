import { Router } from 'express';
import { db, getSettings, nowIso } from '../db.js';
import { chatCompletion, resolveProfile, LLMError } from '../llm.js';

const router = Router();

function patrolsForShift(shiftId) {
  return db
    .prepare('SELECT * FROM patrols WHERE shift_id = ? ORDER BY slot')
    .all(shiftId)
    .map((p) => ({ ...p, checklist: JSON.parse(p.checklist || '[]') }));
}

function fmtInstant(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function fmtDuration(start, end) {
  if (!start || !end) return '—';
  const mins = Math.max(0, Math.round(Math.abs(new Date(end) - new Date(start)) / 60000));
  return `${mins} min`;
}

function buildDarContext(shift) {
  const patrols = patrolsForShift(shift.id);
  const incidents = db
    .prepare('SELECT * FROM incidents WHERE shift_id = ? ORDER BY occurred_at')
    .all(shift.id)
    .map((i) => ({ ...i, media: JSON.parse(i.media || '[]') }));
  const logs = db
    .prepare('SELECT * FROM shift_logs WHERE shift_id = ? ORDER BY logged_at, id')
    .all(shift.id);

  const site = shift.site_id ? db.prepare('SELECT * FROM sites WHERE id = ?').get(shift.site_id) : null;
  const settings = getSettings();

  const lines = [];
  lines.push(`Shift ID: ${shift.id}`);
  lines.push(`Shift date: ${shift.date}`);
  lines.push(`Officer: ${shift.officer_name}${settings.badge_no ? ` (Badge #${settings.badge_no})` : ''}`);
  lines.push(`Company: ${site?.company_name || '—'}`);
  lines.push(`Site / Location: ${shift.site_name || site?.site_name || '—'}`);
  lines.push(`Shift started: ${fmtInstant(shift.started_at)}`);
  lines.push(`Shift ended: ${fmtInstant(shift.ended_at)}`);
  lines.push('');
  lines.push('SHIFT LOG / NARRATIVE:');
  if (logs.length === 0) {
    lines.push('(no narrative log entries)');
  } else {
    for (const l of logs) {
      lines.push(`- [${l.phase.toUpperCase()}] ${fmtInstant(l.logged_at)}: ${l.text}`);
    }
  }
  lines.push('');
  lines.push('PATROLS:');
  for (const p of patrols) {
    const checklist = p.checklist
      .map((c) => `${c.name}=${c.ok ? 'OK' : 'ATTENTION'}`)
      .join(', ');
    lines.push(`- ${p.label}: status=${p.status || 'not completed'}, started=${fmtInstant(p.started_at)}, completed=${fmtInstant(p.completed_at)}, duration=${fmtDuration(p.started_at, p.completed_at)}, checklist=[${checklist}]${p.notes ? `, notes="${p.notes}"` : ''}`);
  }
  lines.push('');
  lines.push(`INCIDENTS (${incidents.length}):`);
  for (const inc of incidents) {
    lines.push(`- #${inc.id} ${inc.incident_type} at ${inc.location} on ${fmtInstant(inc.occurred_at)}${inc.details ? `: "${inc.details}"` : ''}`);
  }
  return lines.join('\n');
}

function buildDarPrompt(shift) {
  const context = buildDarContext(shift);
  const system = `You are PatrolGuard, a professional hotel security operations assistant.
Write a concise, professional Daily Activity Report (DAR) for a hotel security officer.
Structure:
HEADER: date, officer name, company, hotel/site location.
SHIFT SUMMARY: start/end times and duration.
SHIFT LOG: include the start/end standard narrative entries (what the officer did at the start and end of shift).
PATROL ACTIVITY: for each patrol, summarize status, checkpoints checked, and anything needing attention.
INCIDENTS: list each incident with type, location, time, and brief detail.
CLOSING: overall assessment and any recommendations.
Use ONLY the facts provided. Do not invent events. Keep it under 350 words. Use plain text with simple labels (no markdown headings, no bullet asterisks).`;
  return { system, user: `Generate a Daily Activity Report for the following shift data:\n\n${context}`, context };
}

function buildIncidentContext(incident) {
  const shift = incident.shift_id
    ? db.prepare('SELECT * FROM shifts WHERE id = ?').get(incident.shift_id)
    : null;
  const settings = getSettings();
  const lines = [];
  lines.push(`Incident #${incident.id}`);
  lines.push(`Type: ${incident.incident_type}`);
  lines.push(`When: ${fmtInstant(incident.occurred_at)}`);
  lines.push(`Where: ${incident.location}`);
  lines.push(`Details: ${incident.details || 'No details provided.'}`);
  lines.push(`Attachments: ${incident.media.length} file(s)`);
  if (shift) {
    lines.push(`Officer on duty: ${shift.officer_name}${settings.badge_no ? ` (Badge #${settings.badge_no})` : ''}`);
    lines.push(`Site: ${shift.site_name || '—'}`);
    lines.push(`Shift: ${shift.date} (started ${fmtInstant(shift.started_at)})`);
  } else {
    lines.push(`Officer on duty: ${settings.officer_name || 'Security Officer'}${settings.badge_no ? ` (Badge #${settings.badge_no})` : ''}`);
  }
  return lines.join('\n');
}

router.post('/dar/preview', (req, res) => {
  const shift = req.body?.shift_id
    ? db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.body.shift_id)
    : db.prepare('SELECT * FROM shifts ORDER BY started_at DESC LIMIT 1').get();
  if (!shift) return res.status(404).json({ error: 'No shift found. Start a shift first.' });
  const { system, user, context } = buildDarPrompt(shift);
  res.json({ system, user, context, shift_id: shift.id });
});

router.post('/dar', async (req, res) => {
  try {
    const profile = resolveProfile(req.body?.llm_profile_id);

    const shift = req.body?.shift_id
      ? db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.body.shift_id)
      : db.prepare('SELECT * FROM shifts ORDER BY started_at DESC LIMIT 1').get();
    if (!shift) return res.status(404).json({ error: 'No shift found. Start a shift first.' });

    const { system, user } = buildDarPrompt(shift);
    const finalSystem = (req.body?.system && String(req.body.system).trim()) || system;
    const finalUser = (req.body?.user && String(req.body.user).trim()) || user;

    const content = await chatCompletion({
      endpoint: profile.endpoint,
      apiKey: profile.api_key,
      model: profile.model_name,
      temperature: profile.temperature,
      system: finalSystem,
      user: finalUser,
    });

    const info = db
      .prepare('INSERT INTO reports (kind, shift_id, title, content, model, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run('dar', shift.id, `DAR – ${shift.date}`, content, profile.model_name, nowIso());

    res.status(201).json(db.prepare('SELECT * FROM reports WHERE id = ?').get(info.lastInsertRowid));
  } catch (err) {
    const status = err instanceof LLMError ? err.status : 500;
    res.status(status).json({ error: err.message });
  }
});

function buildIncidentPrompt(incident) {
  const context = buildIncidentContext(incident);
  const system = `You are PatrolGuard, a professional security report writer.
Write a formal incident report structured by the 5 Ws:
WHO: people involved, guests, staff, or witnesses (use only provided info).
WHAT: a clear factual account of what happened.
WHERE: exact location.
WHEN: date and time.
WHY/HOW: likely cause and how it unfolded.
ACTION TAKEN: the officer's response (note if not provided).
For any unknown element write "Not provided". Use ONLY the facts provided. Do not invent people, statements, or actions. Plain text with simple labels (no markdown headings, no bullet asterisks).`;
  return { system, user: `Write a formal 5W incident report for the following data:\n\n${context}`, context };
}

router.post('/incident/preview', (req, res) => {
  const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(req.body?.incident_id);
  if (!incident) return res.status(404).json({ error: 'Incident not found' });
  incident.media = JSON.parse(incident.media || '[]');
  const { system, user, context } = buildIncidentPrompt(incident);
  res.json({ system, user, context, incident_id: incident.id });
});

router.post('/incident', async (req, res) => {
  try {
    const profile = resolveProfile(req.body?.llm_profile_id);

    const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(req.body?.incident_id);
    if (!incident) return res.status(404).json({ error: 'Incident not found' });
    incident.media = JSON.parse(incident.media || '[]');

    const { system, user } = buildIncidentPrompt(incident);
    const finalSystem = (req.body?.system && String(req.body.system).trim()) || system;
    const finalUser = (req.body?.user && String(req.body.user).trim()) || user;

    const content = await chatCompletion({
      endpoint: profile.endpoint,
      apiKey: profile.api_key,
      model: profile.model_name,
      temperature: profile.temperature,
      system: finalSystem,
      user: finalUser,
    });

    const info = db
      .prepare('INSERT INTO reports (kind, incident_id, title, content, model, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(
        'incident',
        incident.id,
        `Incident Report #${incident.id} – ${incident.incident_type}`,
        content,
        profile.model_name,
        nowIso()
      );

    res.status(201).json(db.prepare('SELECT * FROM reports WHERE id = ?').get(info.lastInsertRowid));
  } catch (err) {
    const status = err instanceof LLMError ? err.status : 500;
    res.status(status).json({ error: err.message });
  }
});

router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM reports ORDER BY created_at DESC LIMIT 200').all();
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id);
  if (!report) return res.status(404).json({ error: 'Report not found' });
  res.json(report);
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM reports WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Report not found' });
  res.json({ ok: true });
});

export default router;