
import { getCeDatabase } from './modules/catalogEnricher/db/ceDatabase';

async function checkLastJob() {
    const db = getCeDatabase();
    const job = db.prepare('SELECT * FROM ce_jobs ORDER BY created_at DESC LIMIT 1').get() as any;

    if (!job) {
        console.log("No jobs found.");
        return;
    }

    console.log("LAST JOB DETAILS:");
    console.log(`ID: ${job.id}`);
    console.log(`Status: ${job.status}`);
    console.log(`Progress: ${job.progress}`);
    console.log("Params:", JSON.parse(job.params_json || '{}'));
    console.log("Counters:", JSON.parse(job.counters_json || '{}'));
}

checkLastJob();
