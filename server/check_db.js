
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'data', 'importer.db');
console.log(`Checking DB at: ${dbPath}`);

try {
    const db = new Database(dbPath, { readonly: true });

    // List tables
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log("Tables found:", tables.map(t => t.name));

    // Check row counts for key tables
    tables.forEach(t => {
        try {
            const count = db.prepare(`SELECT count(*) as c FROM ${t.name}`).get();
            console.log(`Table '${t.name}': ${count.c} rows`);
        } catch (e) {
            console.log(`Could not count '${t.name}': ${e.message}`);
        }
    });

} catch (e) {
    console.error("Error opening DB:", e);
}
