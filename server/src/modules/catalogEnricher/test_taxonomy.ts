
import { ceAiService } from './services/ceAiService';
import { getCeDatabase } from './db/ceDatabase';

const runTest = async () => {
    console.log("🧪 Starting Taxonomy Persistence Test...");

    const db = getCeDatabase();
    const testUrl = 'https://test-persistence.com/category/product-123';

    // 1. Seed DB with a Web Product (mocking a "known product")
    db.prepare(`
        INSERT OR REPLACE INTO ce_web_products (product_url, product_name, brand_profile_id, category_name)
        VALUES (?, 'Test Persist Product', 'test-prof', 'Test Cat')
    `).run(testUrl);

    console.log("✅ Seeded DB with product.");

    // 2. Clear Memory Cache (Simulate Restart)
    // We can't access `structureCache` directly as it's private in module, 
    // but `getCachedNodeKind` should fallback to DB.

    // 3. Query Service
    const kind = ceAiService.getCachedNodeKind('test-persistence.com', testUrl);

    console.log(`🔍 Result Kind: ${kind}`);

    if (kind === 'product') {
        console.log("✅ SUCCESS: Resolved 'product' from DB fallback.");
    } else {
        console.error("❌ FAILURE: Could not resolve from DB.");
    }
};

runTest();
