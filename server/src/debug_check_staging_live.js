
const { Database } = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../data/importer.db');
const db = require('better-sqlite3')(dbPath);

const jobId = 'bulk_1766494557878';

console.log(`Checking Staging for Job ${jobId}...`);

// Count items
const count = db.prepare('SELECT count(*) as c FROM ce_crawler_staging WHERE job_id = ?').get(jobId);
console.log(`Total Staged Items: ${count.c}`);

// Get last item time
const lastItem = db.prepare('SELECT created_at, url FROM ce_crawler_staging WHERE job_id = ? ORDER BY id DESC LIMIT 1').get(jobId);

if (lastItem) {
    console.log(`Last Item Extracted: ${lastItem.created_at}`);
    console.log(`Last URL: ${lastItem.url}`);

    // Calculate time diff
    const lastTime = new Date(lastItem.created_at + 'Z'); // stored as text usually? assume UTC string
    // If stored as 'YYYY-MM-DD HH:MM:SS', we might need to be careful with timezone.
    // Usually SQLite CURRENT_TIMESTAMP is UTC.

    // SQLite returns string like "2025-12-23 12:45:00"

    console.log(`Time now (System): ${new Date().toISOString()}`);
} else {
    console.log("No items found in staging yet.");
}
