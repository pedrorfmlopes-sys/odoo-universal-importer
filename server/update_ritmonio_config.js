
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'importer.db');
const db = new Database(dbPath);

console.log("🛠️ Updating Ritmonio configuration...");

// Set service_url to NULL to force 'Interactive Login' mode in the new crawler logic
const stmt = db.prepare("UPDATE ce_credentials SET service_url = NULL WHERE name = 'Ritmonio'");
const info = stmt.run();

if (info.changes > 0) {
    console.log("✅ Ritmonio service_url cleared. Steps to verify:");
    console.log("1. Run a job.");
    console.log("2. Crawler will skip pre-login.");
    console.log("3. Crawler will navigate to Product.");
    console.log("4. Crawler will see Login Modal and use 'Interactive Login' logic.");
} else {
    console.error("❌ Ritmonio credential not found or no change.");
}
