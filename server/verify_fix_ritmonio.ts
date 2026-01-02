// @ts-nocheck

import { analyzePage, initPuppeteerService } from './src/modules/catalogEnricher/services/cePuppeteerService';
import { getCeDatabase } from './src/modules/catalogEnricher/db/ceDatabase';
import { v4 as uuidv4 } from 'uuid';

// Mock Socket
const mockIO: any = {
    emit: (event: string, data: any) => console.log(`[Socket] ${event}:`, data)
};

async function run() {
    console.log("🚀 Starting Verification for Ritmonio Fix...");
    initPuppeteerService(mockIO);

    const db = getCeDatabase();

    // 1. Get Ritmonio Profile
    const profile = db.prepare("SELECT * FROM ce_brand_profiles WHERE name LIKE '%Ritmonio%'").get() as any;
    if (!profile) {
        console.error("❌ Ritmonio profile not found!");
        process.exit(1);
    }
    console.log(`✅ Found Profile: ${profile.name} (ID: ${profile.id}, Cred: ${profile.credential_id})`);

    // 2. Create Dummy Job (Minimal fields)
    const jobId = uuidv4();
    try {
        db.prepare(`
            INSERT INTO ce_jobs (id, type, status, params_json, created_at, updated_at)
            VALUES (?, 'analyze', 'running', ?, datetime('now'), datetime('now'))
        `).run(jobId, JSON.stringify({ profileId: profile.id })); // Storing profileId in params just in case, but assume schema link

        // HACK: If profile_id IS a column, update it separately (in case previous insert failed or ignored it)
        // Or check if column exists first.
        // But better: Try to insert with profile_id if valid.
        // Actually, analyzePage queries 'SELECT profile_id ...'. So it MUST be a column.
        // Let's rely on ALTER TABLE additions that might have happened.
        // Re-writing the query to be safe:

        // Check columns
        const cols = db.prepare("PRAGMA table_info(ce_jobs)").all() as any[];
        const hasProfileId = cols.some(c => c.name === 'profile_id');

        if (hasProfileId) {
            db.prepare(`UPDATE ce_jobs SET profile_id = ? WHERE id = ?`).run(profile.id, jobId);
        } else {
            console.warn("⚠️ ce_jobs has no profile_id column. Analysis might fail to find creds.");
        }

    } catch (e: any) {
        console.error("DB Insert Error:", e.message);
    }
    console.log(`✅ Created Dummy Job: ${jobId}`);

    const PRODUCT_URL = "https://www.ritmonio.it/en/bath-shower/product/?code=068075_RCMB027&family=68052";

    try {
        console.log(`[Action] Analyzing ${PRODUCT_URL}...`);
        const { metadata } = await analyzePage(PRODUCT_URL, jobId);

        console.log("\n=== RESULT METADATA ===");
        console.log("URL:", metadata.url);
        console.log("Kind:", metadata.page_kind);
        console.log("Extracted Data:", JSON.stringify(metadata.extracted_data, null, 2));

        // Validation
        const data = metadata.extracted_data;
        if (data && data.files && data.files.some((f: any) => f.type === '3d' || f.name.toLowerCase().includes('3d'))) {
            console.log("\n✅ SUCCESS: 3D File Extracted!");
        } else {
            console.log("\n❌ FAILURE: No 3D File found.");
        }

    } catch (e: any) {
        console.error("💥 CRITICAL FAILURE:", e);
    }
}

run();
