
import { ceQueueService, initQueueService } from './services/ceQueueService';
import { ceRecipeService } from './services/ceRecipeService';
import { getCeDatabase } from './db/ceDatabase';

// Mock Socket
const mockIo = {
    emit: (event: string, data: any) => console.log(`[Socket Mock] ${event}:`, JSON.stringify(data).substring(0, 100) + '...')
};

const runTest = async () => {
    console.log("🧪 Starting Recipe Bulk Test...");

    // 1. Create a Dummy Recipe
    const recipeId = 'test-recipe-' + Date.now();
    const recipeSteps = [
        { id: '1', type: 'EXTRACT_PRODUCT', selector: 'h1', field: 'name' }, // Generic extraction
        { id: '2', type: 'EXTRACT_FIELD', selector: 'img', field: 'image' }
    ];

    // Inject recipe into service (mocking DB save or using service if available)
    // For now, we assume we need to save it to DB or mock the service lookup.
    // Let's rely on `ceRecipeService.getRecipe` fetching from DB.

    const db = getCeDatabase();
    db.prepare(`
        INSERT INTO ce_recipes (id, name, domain, steps_json, created_at)
        VALUES (?, 'Test Recipe', 'example.com', ?, CURRENT_TIMESTAMP)
    `).run(recipeId, JSON.stringify(recipeSteps));

    console.log(`✅ Created Test Recipe: ${recipeId}`);

    // 2. Initialize Queue
    initQueueService(mockIo as any);

    // 3. Add Bulk Task
    // Use a safe URL that works (e.g. example.com or a known site)
    // We'll use a dummy URL provided it doesn't crash puppeteer.
    const targetUrl = 'https://example.com';
    const jobId = 'job-test-' + Date.now();
    const profileId = 'test-profile-1'; // Ensure this exists or mock it

    // Ensure profile exists
    db.prepare(`INSERT OR IGNORE INTO ce_brand_profiles (id, name, domain) VALUES (?, 'Test Profile', 'example.com')`).run(profileId);

    try {
        await ceQueueService.addBulkTask(jobId, profileId, recipeId, [targetUrl], { ignore_facets: true });

        console.log("⏳ Task submitted. Waiting for processing...");

        // Wait for queue to drain (simple polling)
        let stats = ceQueueService.getQueueStats();
        while (stats.size > 0 || stats.pending > 0) {
            await new Promise(r => setTimeout(r, 1000));
            stats = ceQueueService.getQueueStats();
            process.stdout.write('.');
        }
        console.log("\n✅ Queue drained.");

        // 4. Verify Staging
        const staged = db.prepare('SELECT * FROM ce_crawler_staging WHERE job_id = ?').all(jobId) as any[];
        console.log(`📋 Staged Items: ${staged.length}`);

        if (staged.length > 0) {
            console.log("Sample Item:", staged[0].data_json);
        }

    } catch (e) {
        console.error("❌ Test Failed:", e);
    }
};

runTest();
