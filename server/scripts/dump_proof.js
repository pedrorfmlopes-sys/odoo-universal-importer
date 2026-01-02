
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbFiles = fs.readdirSync(path.join(__dirname, '..', 'tmp')).filter(f => f.startsWith('smoke_ce_v3_') && f.endsWith('.db'));
if (dbFiles.length === 0) {
    console.log("No DB files found.");
    process.exit(0);
}

// Sort by date and pick the last ones for each brand if possible, or just the very last one.
const lastDb = path.join(__dirname, '..', 'tmp', dbFiles.sort().reverse()[0]);
console.log(`\n--- PROOF FROM DB: ${lastDb} ---\n`);

const db = new Database(lastDb);
const products = db.prepare('SELECT product_name, product_url, image_url, guessed_code, length(file_urls_json) as files_len FROM ce_web_products').all();

console.table(products.map(p => ({
    Name: p.product_name.substring(0, 30),
    Code: p.guessed_code,
    Image: p.image_url ? 'OK' : 'MISSING',
    Files: p.files_len > 2 ? 'OK' : 'EMPTY',
    URL: p.product_url.substring(0, 50) + '...'
})));
