
const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'server/ce_data.sqlite');
const db = new Database(dbPath);
const profiles = db.prepare('SELECT id, name, domain_root FROM ce_brand_profiles').all();
console.table(profiles);
