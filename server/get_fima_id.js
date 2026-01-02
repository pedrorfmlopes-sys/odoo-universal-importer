
const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'data', 'importer.db');
const db = new Database(dbPath);
const row = db.prepare("SELECT id, name FROM ce_brand_profiles WHERE name LIKE '%Fima%'").get();
console.log(JSON.stringify(row));
db.close();
