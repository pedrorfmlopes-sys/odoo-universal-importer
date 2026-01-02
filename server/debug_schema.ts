// @ts-nocheck

const db = require('better-sqlite3')('data/importer.db');

console.log("--- ce_jobs Columns ---");
const columns = db.prepare("PRAGMA table_info(ce_jobs)").all();
console.table(columns);

console.log("\n--- Checking for profile_id used in existing records ---");
try {
    const rows = db.prepare("SELECT id, profile_id FROM ce_jobs LIMIT 5").all();
    console.log("Read success:", rows);
} catch (e) {
    console.error("Read failed:", (e as Error).message);
}
