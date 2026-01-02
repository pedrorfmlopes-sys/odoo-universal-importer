// @ts-nocheck
// Fix paths assuming running from server root
import { fetchPageContent, analyzePage } from './src/modules/catalogEnricher/services/cePuppeteerService';
import { autoDetectSelectors } from './src/modules/catalogEnricher/services/ceCrawlerService';

async function traceHang() {
    console.log("🕵️ STARTING DEEP TRACE FOR RITMONIO...");
    const url = 'https://www.ritmonio.it/en/bath-shower/bath/haptic-s/';

    // 1. Connection/Navigation Trace
    console.log("STEP 1: Fetching Page Content (Basic Connectivity)...");
    try {
        const start = Date.now();
        const html = await fetchPageContent(url);
        console.log(`✅ Page Fetched in ${(Date.now() - start)}ms. Length: ${html.length}`);
    } catch (e: any) {
        console.error(`❌ FATAL: Navigation Failed - ${e.message}`);
        process.exit(1);
    }

    // 2. Selector Auto-Detection Trace
    console.log("\nSTEP 2: Running Auto-Detect Selectors (The likely hang spot)...");
    try {
        const start = Date.now();
        // We wrap this in a timeout promise to detect hangs explicitly
        const detectionPromise = autoDetectSelectors(url);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT_15S")), 15000));

        const selectors = await Promise.race([detectionPromise, timeoutPromise]);
        console.log(`✅ Selectors Detected in ${(Date.now() - start)}ms:`, selectors);
    } catch (e: any) {
        if (e.message === 'TIMEOUT_15S') {
            console.error("❌ HANG DETECTED in Auto-Detect Selectors! It took > 15s.");
        } else {
            console.error(`❌ Detection Error: ${e.message}`);
        }
        // Proceeding anyway
    }

    // 3. Crawler/Analyze Logic Trace
    console.log("\nSTEP 3: Simulating Crawler Analysis...");
    try {
        // This runs the exact logic the bulk crawler uses to find products
        const result: any = await analyzePage(url, 'debug_trace');
        console.log("✅ Analysis Result:", JSON.stringify({
            products: result.metadata?.product_family_urls_found?.length,
            subcats: result.metadata?.subcategory_urls_found?.length,
            nextPage: !!result.metadata?.nextPageUrl,
            debug: result.metadata?.debug_strategy,
            // Dump actual products if found to verify
            sample_products: result.metadata?.product_family_urls_found?.slice(0, 3)
        }, null, 2));
    } catch (e: any) {
        console.error(`❌ Analysis Error: ${e.message}`);
    }

    process.exit(0);
}

traceHang();
