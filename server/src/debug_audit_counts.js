
const path = require('path');
const dbPath = path.join(__dirname, '../data/importer.db');
const db = require('better-sqlite3')(dbPath);

console.log("--- AUDIT REPORT ---");

// 1. Check Job History
const jobId = 'bulk_1766494557878';
const job = db.prepare('SELECT * FROM ce_jobs WHERE id = ?').get(jobId);
console.log("\n[Job Status]");
if (job) {
    console.log(`ID: ${job.id}`);
    console.log(`Status: ${job.status}`);
    console.log(`Counters: ${job.counters_json}`);
    console.log(`Updated At: ${job.updated_at}`);
} else {
    console.log("Job not found in DB!");
}

// 2. Check Staging Table
const stagingCount = db.prepare('SELECT count(*) as count FROM ce_crawler_staging WHERE job_id = ?').get(jobId).count;
console.log(`\n[Staging Table] Items for this job: ${stagingCount}`);

// 3. Check Final Products Table
// We filter by 'brand_profile_id' if we can get it from the job, or just check total recent items.
if (job) {
    const profileId = job.profile_id;
    const productsCount = db.prepare('SELECT count(*) as count FROM ce_web_products WHERE brand_profile_id = ?').get(profileId).count;
    console.log(`\n[Web Products Table] Total items for profile '${profileId}': ${productsCount}`);
}

// 4. Check Staging Table Total (All jobs)
const totalStaging = db.prepare('SELECT count(*) as count FROM ce_crawler_staging').get().count;
console.log(`\n[Staging Table] Total items (all jobs): ${totalStaging}`);
