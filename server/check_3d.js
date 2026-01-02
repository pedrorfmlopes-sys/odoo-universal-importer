
const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

// Try to find the DB in likely locations relative to script or CWD
const candidates = [
    path.join(__dirname, 'server', 'data', 'importer.db'),
    path.join(__dirname, 'data', 'importer.db'),
    path.join(process.cwd(), 'server', 'data', 'importer.db'),
    path.join(process.cwd(), 'data', 'importer.db')
];

let dbPath = candidates.find(p => fs.existsSync(p));

if (!dbPath) {
    console.error("❌ Could not find 'importer.db' in likely locations:", candidates);
    process.exit(1);
}

console.log(`✅ Opening Database: ${dbPath}`);
const db = new Database(dbPath, { readonly: true });

const lastJob = db.prepare('SELECT * FROM ce_jobs ORDER BY created_at DESC LIMIT 1').get();

if (!lastJob) {
    console.log("No jobs found.");
    process.exit();
}

console.log(`Checking Job: ${lastJob.id} (${lastJob.status})`);

const items = db.prepare('SELECT product_name, file_urls_json FROM ce_web_products WHERE job_id = ?').all(lastJob.id);

console.log(`Found ${items.length} products to verify.`);

let model3dCount = 0;
let pdfCount = 0;

items.forEach(i => {
    const files = JSON.parse(i.file_urls_json || '[]');

    const models = files.filter(f => f.format === '3d' || f.type === '3d' || f.name.includes('3D') || f.url.match(/\.(stp|step|igs|iges|stl)$/i));
    if (models.length > 0) {
        // console.log(`   [${i.product_name}] Has 3D:`, models.map(m => m.url));
        model3dCount++;
    }

    const pdfs = files.filter(f => f.format === 'pdf' || f.type === 'pdf' || f.type === 'pdf_link');
    if (pdfs.length > 0) pdfCount++;
});

console.log(`\n=== RESULTS ===`);
console.log(`Total Products: ${items.length}`);
console.log(`Products with PDFs: ${pdfCount}`);
console.log(`Products with 3D Models: ${model3dCount}`);
console.log(`================`);
