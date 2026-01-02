
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

if (!dbPath) {
    console.error("❌ DB not found");
    process.exit(1);
}

const db = new Database(dbPath, { readonly: true });

console.log(`Checking All Credentials...`);
const creds = db.prepare("SELECT * FROM ce_credentials").all();

if (creds.length === 0) {
    console.log("❌ No credentials found in table 'ce_credentials'.");
} else {
    creds.forEach(c => {
        console.log(`🔑 Credential: "${c.name}" (ID: ${c.id}) - User: ${c.username}`);
    });
}

console.log(`\nChecking Ritmonio Profile Link...`);
const profile = db.prepare("SELECT * FROM ce_brand_profiles WHERE domain_root LIKE '%ritmonio%'").get();
if (profile) {
    console.log(`Profile: ${profile.name}`);
    console.log(`Auth Required: ${profile.auth_required}`);
    console.log(`Linked Cred ID: ${profile.credential_id}`);
}
