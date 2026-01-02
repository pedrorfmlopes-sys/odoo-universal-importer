const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'server', 'data', 'importer.db');
const db = new Database(dbPath);

console.log('--- CE_WEB_PRODUCTS with "error" ---');
const products = db.prepare("SELECT product_name, product_url, file_urls_json FROM ce_web_products WHERE product_name LIKE '%erro%' OR product_name LIKE '%error%' OR file_urls_json LIKE '%error%'").all();
console.log(JSON.stringify(products, null, 2));

console.log('\n--- CE_CRAWLER_STAGING with "error" ---');
const staging = db.prepare("SELECT url, status, error_message FROM ce_crawler_staging WHERE status = 'error' OR error_message IS NOT NULL LIMIT 50").all();
console.log(JSON.stringify(staging, null, 2));
