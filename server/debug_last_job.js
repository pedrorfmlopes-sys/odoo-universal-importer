
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'data/importer.db');
const db = new Database(dbPath, { readonly: true });

try {
    const job = db.prepare('SELECT * FROM ce_jobs ORDER BY created_at DESC LIMIT 1').get();
    if (job) {
        console.log('Last Job ID:', job.id);
        console.log('Status:', job.status);
        console.log('Progress:', job.progress);
        console.log('Counters:', job.counters_json);
        console.log('Params:', job.params_json);
        console.log('Result:', job.result_summary_json);
    } else {
        console.log('No jobs found.');
    }
} catch (e) {
    console.error('Error:', e);
}
