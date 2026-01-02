
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.CE_DB_PATH || path.join(__dirname, 'server/data/importer.db');
const db = new Database(dbPath, { readonly: true });

console.log(`📂 Checking DB: ${dbPath}`);

try {
    const rows = db.prepare(`
        SELECT id, product_url, file_urls_json, crawled_at 
        FROM ce_web_products 
        ORDER BY crawled_at DESC 
        LIMIT 5
    `).all();

    if (rows.length === 0) {
        console.log("⚠️ No products found in DB.");
    } else {
        rows.forEach(r => {
            console.log(`\n--- Product ID: ${r.id} ---`);
            console.log(`URL: ${r.product_url}`);
            console.log(`Crawled At: ${r.crawled_at}`);
            console.log(`Files: ${r.file_urls_json}`);
        });
    }
} catch (e) {
    console.error("Error reading DB:", e.message);
}
