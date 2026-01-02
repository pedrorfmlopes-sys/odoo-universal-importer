
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.CE_DB_PATH || path.join(__dirname, 'data', 'importer.db');
const db = new Database(dbPath);

console.log("🛠️ Restoring Ritmonio Service URL...");

// Restore service_url to enable Pre-Login logic
const stmt = db.prepare("UPDATE ce_credentials SET service_url = 'https://www.ritmonio.it/en/user/login' WHERE name = 'Ritmonio'");
const info = stmt.run();

if (info.changes > 0) {
    console.log("✅ Ritmonio service_url restored to: https://www.ritmonio.it/en/user/login");
} else {
    console.error("❌ Ritmonio credential not found or no change.");
}
