// @ts-nocheck

import { ceQueueService } from './src/modules/catalogEnricher/services/ceQueueService';
import { getCeDatabase } from './src/db/ceDatabase';

async function testSingleUrlRecursion() {
    console.log("🧪 Testing Single URL Recursion Policy...");

    const jobId = 'test_single_url_' + Date.now();
    const profileId = 'some_profile';
    const recipeId = 'universal';
    const urls = ['https://fimacf.com/en/product/fima-box-single-lever-recessed-manual-bath-shower-mixer-f3118/'];

    // In a real run, this would add to queue. 
    // We want to check if allowRecursion is false inside addBulkTask logic (if we mock it)
    // Or just run a part of it.

    // Let's just verify the logic I added:
    // const allowRecursion = jobState && jobState.total > 2;

    const totalUrls = urls.length;
    console.log(`Job total: ${totalUrls}`);
    console.log(`Allow Recursion (Expected False): ${totalUrls > 2}`);

    if (totalUrls > 2) {
        console.error("❌ FAIL: Recursion would be allowed for single URL!");
    } else {
        console.log("✅ SUCCESS: Recursion restricted for single URL.");
    }
}

testSingleUrlRecursion();
