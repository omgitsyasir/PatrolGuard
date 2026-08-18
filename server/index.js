import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { migrate, DATA_DIR, DB_PATH, UPLOAD_DIR } from './db.js';
import settingsRouter from './routes/settings.js';
import shiftsRouter from './routes/shifts.js';
import incidentsRouter from './routes/incidents.js';
import uploadsRouter from './routes/uploads.js';
import sitesRouter from './routes/sites.js';
import llmProfilesRouter from './routes/llm-profiles.js';
import reportsRouter from './routes/reports.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

migrate();

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Health / info
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, dataDir: DATA_DIR, db: DB_PATH, uploads: UPLOAD_DIR, time: new Date().toISOString() });
});

// Static uploads (photos + voice memos)
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));

// API routes
app.use('/api/settings', settingsRouter);
app.use('/api/shifts', shiftsRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api/incidents', incidentsRouter);
app.use('/api/sites', sitesRouter);
app.use('/api/llm-profiles', llmProfilesRouter);
app.use('/api/reports', reportsRouter);

// Serve built frontend in production
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api|uploads).*/, (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
  });
}

// JSON error handler
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PatrolGuard API running on http://localhost:${PORT}`);
  console.log(`  Data dir  : ${DATA_DIR}`);
  console.log(`  Uploads   : ${UPLOAD_DIR}`);
});
