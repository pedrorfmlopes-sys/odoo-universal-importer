const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'importer.db');
console.log(`Checking database at: ${dbPath}`);
const db = new Database(dbPath);

console.log('\n--- Products with "Error" in Name ---');
const products = db.prepare("SELECT id, product_name, product_url, file_urls_json FROM ce_web_products WHERE product_name = 'Error' OR product_name LIKE '%erro%'").all();
console.log(`Found ${products.length} products.`);
products.forEach(p => {
    console.log(`- ID: ${p.id}, URL: ${p.product_url}`);
});

console.log('\n--- Staging Items with Errors ---');
const stagingItems = db.prepare("SELECT url, error_message FROM ce_crawler_staging WHERE status = 'error' OR error_message IS NOT NULL").all();
console.log(`Found ${stagingItems.length} items in staging with explicit errors.`);
stagingItems.forEach(s => {
    console.log(`- URL: ${s.url}\n  Error: ${s.error_message}`);
});
