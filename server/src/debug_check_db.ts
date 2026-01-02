
import { getCeDatabase } from './modules/catalogEnricher/db/ceDatabase';

async function checkDb() {
    const db = getCeDatabase();

    console.log("--- LATEST JOBS ---");
    const jobs = db.prepare("SELECT id, status, progress, counters_json FROM ce_jobs ORDER BY created_at DESC LIMIT 5").all();
    console.table(jobs);

    console.log("\n--- STAGING DATA (LATEST JOB) ---");
    const latestJob = jobs[0] as any;
    if (latestJob) {
        const staging = db.prepare("SELECT COUNT(*) as count FROM ce_crawler_staging WHERE job_id = ?").get(latestJob.id) as any;
        console.log(`Job ${latestJob.id}: ${staging.count} items in staging.`);

        const samples = db.prepare("SELECT url, status FROM ce_crawler_staging WHERE job_id = ? LIMIT 5").all(latestJob.id);
        console.table(samples);
    }

    console.log("\n--- MAIN CATALOG DATA ---");
    const catalogCount = db.prepare("SELECT COUNT(*) as count FROM ce_web_products").get() as any;
    console.log(`Total items in main catalog: ${catalogCount.count}`);
}

checkDb();
