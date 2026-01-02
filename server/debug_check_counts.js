
const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.cwd(), 'data', 'importer.db');
const db = new Database(dbPath);

const stats = db.prepare('SELECT category_name, count(*) as c FROM ce_web_products GROUP BY category_name ORDER BY c DESC').all();
console.log('--- PRODUCTS PER CATEGORY ---');
stats.forEach(s => console.log(`${s.category_name || 'Uncategorized'}: ${s.c} items`));

const profileStats = db.prepare('SELECT brand_profile_id, count(*) as c FROM ce_web_products GROUP BY brand_profile_id').all();
console.log('\n--- PRODUCTS PER PROFILE ---');
profileStats.forEach(p => console.log(`${p.brand_profile_id}: ${p.c} items`));
