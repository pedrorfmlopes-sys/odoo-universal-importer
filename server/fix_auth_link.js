
const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

const candidates = [
    path.join(__dirname, 'server', 'data', 'importer.db'),
    path.join(__dirname, 'data', 'importer.db'),
    path.join(process.cwd(), 'server', 'data', 'importer.db'),
    path.join(process.cwd(), 'data', 'importer.db')
];

let dbPath = candidates.find(p => fs.existsSync(p));
const db = new Database(dbPath); // Read-write now

console.log(`Fixing Auth Link for Ritmonio...`);

// 1. Get Credential
const cred = db.prepare("SELECT * FROM ce_credentials WHERE name = 'Ritmonio' LIMIT 1").get();
if (!cred) {
    console.error("❌ Credential 'Ritmonio' not found.");
    process.exit(1);
}

// 2. Get Profile
const profile = db.prepare("SELECT * FROM ce_brand_profiles WHERE domain_root LIKE '%ritmonio%'").get();
if (!profile) {
    console.error("❌ Profile 'Ritmonio' not found.");
    process.exit(1);
}

// 3. Update
const res = db.prepare("UPDATE ce_brand_profiles SET credential_id = ?, auth_required = 1 WHERE id = ?").run(cred.id, profile.id);

if (res.changes > 0) {
    console.log(`✅ SUCCESS: Linked credential "${cred.name}" to profile "${profile.name}"`);
    console.log(`   Updates made: ${res.changes}`);
} else {
    console.log(`⚠️ Update failed or no changes needed.`);
}
