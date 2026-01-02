
import { getCeDatabase } from './src/modules/catalogEnricher/db/ceDatabase';

const db = getCeDatabase();

// 1. Get Last Job
const job = db.prepare("SELECT * FROM ce_jobs ORDER BY created_at DESC LIMIT 1").get() as any;

if (!job) {
    console.log("No jobs found.");
    process.exit(0);
}

console.log("=== Last Job ===");
console.log(`ID: ${job.id}`);
console.log(`Type: ${job.type}`);
console.log(`Status: ${job.status}`);
console.log(`Created: ${job.created_at}`);
console.log(`Updated: ${job.updated_at}`);
console.log(`Params: ${job.params_json}`);
console.log(`Counters: ${job.counters_json}`);

// 2. Get Failed Items (Enrichment)
const failedItems = db.prepare("SELECT * FROM ce_job_items WHERE job_id = ? AND status != 'ok'").all(job.id) as any[];

if (failedItems.length > 0) {
    console.log(`\n=== Failed Items (${failedItems.length}) ===`);
    failedItems.forEach(item => {
        console.log(`Row ID: ${item.row_id} | Key: ${item.key_value} | Status: ${item.status}`);
        console.log(`Evidence: ${item.evidence_json}`);
    });
} else {
    console.log("\nNo explicit failed items in ce_job_items.");
}

// 3. Get Failed Staging (Crawler)
const failedStaging = db.prepare("SELECT * FROM ce_crawler_staging WHERE job_id = ? AND status = 'error'").all(job.id) as any[];

if (failedStaging.length > 0) {
    console.log(`\n=== Failed Staging URLs (${failedStaging.length}) ===`);
    failedStaging.forEach(item => {
        console.log(`URL: ${item.url}`);
        console.log(`Error: ${item.error_message}`);
    });
}

// 4. Get Success Items Sample
const successItems = db.prepare("SELECT * FROM ce_job_items WHERE job_id = ? AND status = 'ok' LIMIT 3").all(job.id) as any[];
console.log(`\n=== Success Items Sample (${successItems.length}) ===`);
successItems.forEach(item => {
    console.log(`Row ID: ${item.row_id} | Name: ${JSON.parse(item.evidence_json || '{}').name}`);
});
