
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dbPath = process.env.CE_DB_PATH || path.join(__dirname, 'data', 'importer.db');
console.log(`Migrating database at: ${dbPath}`);

if (!fs.existsSync(path.dirname(dbPath))) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

const db = new Database(dbPath);

try {
    console.log("Migrating database: Creating 'credentials' table...");

    db.exec(`
        CREATE TABLE IF NOT EXISTS credentials (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            service_url TEXT,
            username TEXT NOT NULL,
            password_enc TEXT NOT NULL, /* Encrypted (Base64 or reversibly valid for now) */
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Add column to ce_brand_profiles if not exists
    try {
        const check = db.prepare("SELECT credential_id FROM ce_brand_profiles LIMIT 1").get();
        console.log("Column 'credential_id' already exists in ce_brand_profiles.");
    } catch (e) {
        console.log("Adding 'credential_id' to ce_brand_profiles table...");
        // Ensure table exists first? The app should have created it via initSchema.
        // If not, we might fail here, but assuming app ran once, it exists.
        db.exec(`ALTER TABLE ce_brand_profiles ADD COLUMN credential_id TEXT;`);
    }

    console.log("✅ Migration Successful.");
} catch (e) {
    console.error("❌ Migration Failed:", e.message);
}
