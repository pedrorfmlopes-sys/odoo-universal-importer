
const { Database } = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../data/importer.db');
const db = require('better-sqlite3')(dbPath);

console.log("Checking Live Jobs...");

// 1. Get Active Jobs
try {
    const jobs = db.prepare("SELECT * FROM ce_jobs WHERE status NOT IN ('completed', 'failed', 'stopped')").all();

    if (jobs.length === 0) {
        console.log("No active jobs found running.");
    }

    jobs.forEach(job => {
        console.log(`\n[Job ${job.id}] Status: ${job.status}`);
        console.log(`  Progress: ${job.progress}%`);
        console.log(`  Counters: ${job.counters_json}`);
        console.log(`  Last Update: ${job.updated_at}`);
        console.log(`  Error: ${job.error_text || 'None'}`);
        console.log(`  Keys: ${Object.keys(job).join(', ')}`);

        // Use profile_id directly
        if (job.profile_id) {
            const count = db.prepare("SELECT count(*) as c FROM ce_web_products WHERE brand_profile_id = ?").get(job.profile_id);
            console.log(`  Total Products in DB for Profile (${job.profile_id}): ${count.c}`);

            // Check for recent products (last 5 mins) to see if it's actually alive
            const recent = db.prepare("SELECT count(*) as c FROM ce_web_products WHERE brand_profile_id = ? AND created_at > datetime('now', '-5 minutes')").get(job.profile_id);
            console.log(`  Products Extracted in Last 5 Mins: ${recent.c}`);
        } else {
            console.log("  No profile_id in job record.");
        }
    });

} catch (e) {
    console.log("Error querying jobs: " + e.message);
}
