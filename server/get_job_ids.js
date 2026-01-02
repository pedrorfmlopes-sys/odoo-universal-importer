const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'importer.db');
const db = new Database(dbPath);

console.log('--- Job IDs for products with name "Error" ---');
const rows = db.prepare("SELECT job_id, COUNT(*) as c FROM ce_web_products WHERE product_name = 'Error' GROUP BY job_id").all();
console.log(JSON.stringify(rows, null, 2));
