
const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.cwd(), 'server', 'data', 'importer.db'); // Wait, check the path!
// ceDatabase.ts says path.join(process.cwd(), 'data', 'importer.db');
// If process.cwd() is the project root, it's root/data/importer.db

const dbRoot = 'C:\\Users\\pedro\\OneDrive\\APPS\\GitHub\\odoo-universal-importer\\server\\data\\importer.db';
console.log(`Checking DB at: ${dbRoot}`);

try {
    const db = new Database(dbRoot);
    const jobs = db.prepare("SELECT id, type, status, created_at FROM ce_jobs ORDER BY created_at DESC LIMIT 5").all();
    console.log("Recent Jobs:", JSON.stringify(jobs, null, 2));

    const pending = db.prepare("SELECT count(*) as c FROM ce_jobs WHERE status = 'pending'").get();
    const running = db.prepare("SELECT count(*) as c FROM ce_jobs WHERE status = 'running'").get();
    console.log(`Stats: Pending=${pending.c}, Running=${running.c}`);

    // Check specific IDs if they exist
    const ids = ['fc89d403-ea40-4ce8-86cb-fb5ce3bb58c5', '2b9f390f-c11d-4539-b7de-d115e69e0843'];
    for (const id of ids) {
        const job = db.prepare("SELECT * FROM ce_jobs WHERE id = ?").get(id);
        console.log(`Job ${id}:`, job ? "EXISTS" : "MISSING");
    }
} catch (e) {
    console.error("Debug Error:", e.message);
}
