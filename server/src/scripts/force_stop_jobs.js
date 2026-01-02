const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'data', 'importer.db');
const db = new Database(dbPath);

console.log('Stopping all running/pending/waiting_commit jobs...');
const info = db.prepare("UPDATE ce_jobs SET status = 'failed', error_text = 'Force stopped by user', updated_at = datetime('now') WHERE status IN ('running', 'pending', 'waiting_commit')").run();

console.log(`Updated ${info.changes} jobs from Running/Pending/Waiting to Failed.`);
