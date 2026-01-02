
const { Database } = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'server/data/importer.db');
const db = require('better-sqlite3')(dbPath);

console.log("Checking Active Jobs...");
const jobs = db.prepare("SELECT id, status, progress, counters_json FROM ce_jobs WHERE status='running'").all();
console.log(JSON.stringify(jobs, null, 2));
