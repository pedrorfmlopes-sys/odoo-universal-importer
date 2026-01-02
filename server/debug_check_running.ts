// @ts-nocheck

import { getCeDatabase } from './src/modules/catalogEnricher/db/ceDatabase';

const db = getCeDatabase();
console.log('[Debug] Checking for running jobs...');

const jobs = db.prepare(`
    SELECT id, type, status, progress, counters_json, updated_at, created_at, error_text 
    FROM ce_jobs 
    WHERE id NOT LIKE 'test_%'
    ORDER BY created_at DESC
    LIMIT 20
`).all();

if (jobs.length === 0) {
    console.log('[Debug] No jobs found.');
} else {
    jobs.forEach((job: any) => {
        console.log(`[Job] ID: ${job.id} | Status: ${job.status} | Progress: ${job.progress}%`);
        console.log(`      Updated: ${job.updated_at} | Created: ${job.created_at}`);
        if (job.error_text) console.log(`      ERROR: ${job.error_text}`);
        console.log(`      Counters: ${job.counters_json}`);
        console.log('------------------------------------------------');
    });
}
