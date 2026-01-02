// @ts-nocheck

import { ceQueueService, initQueueService } from './src/modules/catalogEnricher/services/ceQueueService';
import { getCeDatabase } from './src/modules/catalogEnricher/db/ceDatabase';

// Mock Socket.IO
const mockIO: any = {
    emit: (event: string, data: any) => console.log(`[MockIO] ${event}:`, data)
};

async function run() {
    console.log("🚀 Starting Reproduction Script for Partial Extraction Failure");

    // Init Service
    initQueueService(mockIO);

    const jobId = `debug_partial_${Date.now()}`;
    const profileId = "test_profile_scarabeo";
    const recipeId = "universal";
    const urls = ["https://scarabeoceramiche.it/collezioni/collezione-ceramica/moon/"];

    // Ensure profile exists or insert a temporary one to avoid FK errors (if that's the cause)
    const db = getCeDatabase();
    const profile = db.prepare("SELECT * FROM ce_brand_profiles WHERE id = ?").get(profileId);
    if (!profile) {
        console.log(`[Setup] Profile ${profileId} missing. Creating dummy profile...`);
        db.prepare("INSERT INTO ce_brand_profiles (id, name, domain_root) VALUES (?, ?, ?)").run(profileId, "Scarabeo Debug", "scarabeoceramiche.it");
    }

    try {
        console.log(`[Action] Calling addBulkTask for job ${jobId}...`);
        await ceQueueService.addBulkTask(jobId, profileId, recipeId, urls, { ignore_facets: true });
        console.log("[Result] addBulkTask completed (async queue started).");

        // Wait a moment for queue to process or fail
        await new Promise(r => setTimeout(r, 2000));

        // Check Job Status in DB
        const job = db.prepare("SELECT * FROM ce_jobs WHERE id = ?").get(jobId);
        console.log("[DB Check] Job record:", job);

        // Check Staging
        const staging = db.prepare("SELECT * FROM ce_crawler_staging WHERE job_id = ?").all(jobId);
        console.log(`[DB Check] Staging Items: ${staging.length}`);

        // Check Logs
        try {
            const fs = require('fs');
            if (fs.existsSync('server/debug_partial_log.txt')) {
                console.log("[Log] debug_partial_log.txt content:\n", fs.readFileSync('server/debug_partial_log.txt', 'utf8'));
            } else {
                console.log("[Log] debug_partial_log.txt NOT FOUND.");
            }
        } catch (e) { }

    } catch (e: any) {
        console.error("💥 CRITICAL FAILURE in Reproduction Script:", e);
    }
}

run();
