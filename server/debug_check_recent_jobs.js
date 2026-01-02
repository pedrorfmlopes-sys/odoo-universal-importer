
const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.cwd(), 'data', 'importer.db');
const db = new Database(dbPath);

const jobs = db.prepare('SELECT * FROM ce_jobs ORDER BY created_at DESC LIMIT 10').all();
console.log('--- RECENT JOBS ---');
jobs.forEach(j => {
    const params = JSON.parse(j.params_json || '{}');
    const urlsCount = params.urls ? params.urls.length : (params.url ? 1 : 0);
    console.log(`Job: ${j.id} | Type: ${j.type} | Status: ${j.status} | URLs count in Params: ${urlsCount} | Items Count: ${j.result_summary_json ? JSON.parse(j.result_summary_json).totalItems : 'N/A'}`);
});

const recentItems = db.prepare('SELECT count(*) as c, job_id FROM ce_job_items GROUP BY job_id ORDER BY c DESC LIMIT 10').all();
console.log('\n--- JOB ITEMS COUNT ---');
recentItems.forEach(r => console.log(`Job: ${r.job_id} | Items in DB: ${r.c}`));
