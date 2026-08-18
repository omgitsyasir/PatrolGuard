import { migrate, db, DB_PATH, DATA_DIR, UPLOAD_DIR } from './db.js';

migrate();

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('Database migrated successfully.');
console.log(`  SQLite file : ${DB_PATH}`);
console.log(`  Data dir    : ${DATA_DIR}`);
console.log(`  Uploads dir : ${UPLOAD_DIR}`);
console.log('  Tables      : ' + tables.map((t) => t.name).join(', '));

for (const table of ['sites', 'llm_profiles', 'settings', 'shifts']) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  console.log(`  ${table}: ${cols.join(', ')}`);
}