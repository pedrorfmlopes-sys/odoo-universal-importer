
const Database = require('better-sqlite3');
const db = new Database('data/importer.db');

try {
    const columns = db.pragma('table_info(ce_jobs)');
    console.log("Columns in ce_jobs:");
    columns.forEach(c => console.log(`- ${c.name} (${c.type})`));
} catch (err) {
    console.error(err);
}
