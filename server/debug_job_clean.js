
const Database = require('better-sqlite3');
const db = new Database('data/importer.db');

try {
    const job = db.prepare(`SELECT * FROM ce_jobs WHERE id = 'bulk_1766571896345'`).get();
    if (job) {
        console.log("Result Summary:");
        console.log(job.result_summary_json);
        console.log("Params:");
        console.log(job.params_json);
    } else {
        console.log("Job not found by ID.");
    }
} catch (err) {
    console.error(err);
}
