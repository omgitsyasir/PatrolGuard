import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
export const DB_PATH = path.join(DATA_DIR, 'patrols.db');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const BASE_SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  officer_name TEXT NOT NULL DEFAULT '',
  badge_no TEXT NOT NULL DEFAULT '',
  company_name TEXT NOT NULL DEFAULT '',
  hotel_location TEXT NOT NULL DEFAULT '',
  llm_endpoint TEXT NOT NULL DEFAULT '',
  llm_api_key TEXT NOT NULL DEFAULT '',
  llm_model TEXT NOT NULL DEFAULT '',
  theme_mode TEXT NOT NULL DEFAULT 'system',
  color_palette TEXT NOT NULL DEFAULT 'emerald',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL DEFAULT '',
  site_name TEXT NOT NULL,
  patrol_count INTEGER NOT NULL DEFAULT 3,
  patrol_names_json TEXT NOT NULL DEFAULT '[]',
  checkpoints_json TEXT NOT NULL DEFAULT '[]',
  shift_start_requirements_json TEXT NOT NULL DEFAULT '[]',
  shift_end_requirements_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS llm_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  endpoint TEXT NOT NULL DEFAULT '',
  api_key TEXT NOT NULL DEFAULT '',
  model_name TEXT NOT NULL DEFAULT '',
  temperature REAL NOT NULL DEFAULT 0.4,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  officer_name TEXT NOT NULL DEFAULT '',
  site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
  site_name TEXT NOT NULL DEFAULT '',
  started_at TEXT NOT NULL,
  ended_at TEXT,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS patrols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  slot INTEGER NOT NULL,
  label TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  status TEXT CHECK (status IN ('all_clear', 'minor_issues', 'requires_action')),
  checklist TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_id INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
  incident_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  location TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  media TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('dar', 'incident')),
  shift_id INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
  incident_id INTEGER REFERENCES incidents(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shift_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  phase TEXT NOT NULL CHECK (phase IN ('start', 'end', 'manual')),
  text TEXT NOT NULL,
  logged_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

function ensureColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

function needsPatrolsRebuild() {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='patrols'").get();
  return Boolean(row && /slot\s+INTEGER\s+NOT\s+NULL\s+CHECK\s*\(\s*slot\s+IN\s*\(\s*1\s*,\s*2\s*,\s*3\s*\)/i.test(row.sql || ''));
}

// v1 patrols limited slots to 1..3; v2 supports 2..8 custom patrol plans.
function rebuildPatrols() {
  db.exec(`
    CREATE TABLE patrols_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
      slot INTEGER NOT NULL,
      label TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      status TEXT CHECK (status IN ('all_clear', 'minor_issues', 'requires_action')),
      checklist TEXT NOT NULL DEFAULT '[]',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    INSERT INTO patrols_new (id, shift_id, slot, label, started_at, completed_at, status, checklist, notes, created_at)
      SELECT id, shift_id, slot, label, started_at, completed_at, status, checklist, notes, created_at FROM patrols;
    DROP TABLE patrols;
    ALTER TABLE patrols_new RENAME TO patrols;
  `);
}

export function migrate() {
  db.exec(BASE_SCHEMA);
  // Legacy column upgrades for databases created before the v2 schema.
  ensureColumn('settings', 'badge_no', "badge_no TEXT NOT NULL DEFAULT ''");
  ensureColumn('settings', 'theme_mode', "theme_mode TEXT NOT NULL DEFAULT 'system'");
  ensureColumn('settings', 'color_palette', "color_palette TEXT NOT NULL DEFAULT 'emerald'");
  ensureColumn('shifts', 'site_id', 'site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL');
  ensureColumn('shifts', 'site_name', "site_name TEXT NOT NULL DEFAULT ''");
  ensureColumn('sites', 'checkpoints_json', "checkpoints_json TEXT NOT NULL DEFAULT '[]'");
  ensureColumn('sites', 'shift_start_requirements_json', "shift_start_requirements_json TEXT NOT NULL DEFAULT '[]'");
  ensureColumn('sites', 'shift_end_requirements_json', "shift_end_requirements_json TEXT NOT NULL DEFAULT '[]'");
  if (needsPatrolsRebuild()) rebuildPatrols();
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_patrols_shift ON patrols(shift_id);
    CREATE INDEX IF NOT EXISTS idx_incidents_shift ON incidents(shift_id);
    CREATE INDEX IF NOT EXISTS idx_reports_shift ON reports(shift_id);
  `);
  db.prepare('INSERT OR IGNORE INTO settings (id, updated_at) VALUES (1, datetime(\'now\'))').run();
}

export function getSettings() {
  return db.prepare('SELECT * FROM settings WHERE id = 1').get();
}

export function nowIso() {
  return new Date().toISOString();
}