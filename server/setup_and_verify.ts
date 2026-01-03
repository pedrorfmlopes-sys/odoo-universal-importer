
// @ts-nocheck
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'server/data/importer.db');
const db = new Database(dbPath);

// 1. Ensure Ritmonio Profile
const profile = db.prepare("SELECT * FROM ce_brand_profiles WHERE name LIKE '%Ritmonio%'").get();
if (!profile) {
    console.log("Creating Ritmonio profile...");
    const id = 'ritmonio-golden-test-' + Date.now();
    db.prepare(`
        INSERT INTO ce_brand_profiles (id, name, domain_root, auth_required)
        VALUES (?, 'Ritmonio', 'ritmonio.it', 1)
    `).run(id);
    console.log("Created profile:", id);
} else {
    console.log("Ritmonio profile exists:", profile.id);
}

// 2. Query for Ritmonio 3D/Files
const ritRows = db.prepare("select product_url, product_name, length(file_urls_json) flen from ce_web_products where product_url like '%ritmonio%' limit 10").all();
console.log("Ritmonio Data:", ritRows);

// 3. Query for Scarabeo
const scarRows = db.prepare("select product_url, product_name, length(file_urls_json) flen from ce_web_products where product_url like '%scarabeo%' limit 10").all();
console.log("Scarabeo Data:", scarRows);
