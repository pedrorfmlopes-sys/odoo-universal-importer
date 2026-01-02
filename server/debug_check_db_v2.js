
const Database = require('better-sqlite3');
const path = require('path');

// Correct path relative to server/ directory
const dbPath = process.env.CE_DB_PATH || path.join(__dirname, 'data/importer.db');
const db = new Database(dbPath, { readonly: true });

console.log(`📂 Checking DB: ${dbPath}`);

try {
    const rows = db.prepare(`
        SELECT id, name, auth_required, credential_id 
        FROM ce_brand_profiles 
        WHERE id = '145eff47-d3eb-4082-a846-a047b739e954'
    `).all();

    if (rows.length === 0) {
        console.log("⚠️ No products found in DB.");
    } else {
        rows.forEach(r => {
            console.log(`\n--- Profile: ${r.name} (${r.id}) ---`);
            console.log(`Auth Required: ${r.auth_required}`);
            console.log(`Credential ID: ${r.credential_id}`);
        });
    }
} catch (e) {
    console.error("Error reading DB:", e.message);
}
