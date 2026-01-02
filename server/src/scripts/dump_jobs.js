const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'data', 'importer.db');
const db = new Database(dbPath);

console.log(`[Diagnostic] Opening DB at: ${dbPath}`);

const jobs = db.prepare("SELECT id, status, type, created_at FROM ce_jobs ORDER BY created_at DESC LIMIT 20").all();
console.table(jobs);

const counts = db.prepare("SELECT status, count(*) as count FROM ce_jobs GROUP BY status").all();
console.table(counts);
