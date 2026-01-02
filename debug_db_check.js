
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'server/data/importer.db');
console.log('Opening DB:', dbPath);
const db = new Database(dbPath);

const jobId = 'bulk_1766451109757'; // From user screenshot
const row = db.prepare('SELECT count(*) as count FROM ce_web_products WHERE job_id = ?').get(jobId);

console.log('--- RESULT ---');
console.log(`Job ID: ${jobId}`);
console.log(`Products Found: ${row.count}`);
console.log('--- END ---');
