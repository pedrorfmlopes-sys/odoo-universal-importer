// @ts-nocheck

import { analyzePage } from './src/modules/catalogEnricher/services/cePuppeteerService';

async function traceCompound() {
    // URL provided by user showing "Exterior + Interior"
    const url = 'https://www.ritmonio.it/en/bath-shower/product/?code=132466_PR57AL101%2BE0BA0115SX&family=132465';

    console.log(`🕵️ TRACING COMPOUND PRODUCT: ${url}`);

    try {
        const result = await analyzePage(url, 'debug_compound');

        console.log("\n--- EXTRACTED DATA (Current Logic) ---");
        console.log(JSON.stringify(result.metadata.extracted_data, null, 2));

        console.log("\n--- RAW TEXT SEARCH (For Component Codes) ---");
        // We need to see the HTML to find where the secondary code (e.g. E0BA0115SX) is hidden.
        // Since analyzePage returns HTML, we can inspect it here purely via logs or just trust the analysis if I add a 'dump html' flag, 
        // but for now let's just see if our current extraction picked anything up.

        // I will search the HTML for the specific 'interior' code part if known, or general structure.
        // The URL has "PR57AL101+E0BA0115SX".
        // Let's see if "E0BA0115SX" usually appears in the body.

        const html = result.html;
        if (html.includes('E0BA0115SX')) {
            console.log("✅ FOUND 'E0BA0115SX' in HTML!");
            // Minimal context extraction to see where it is
            const regex = /.{0,100}E0BA0115SX.{0,100}/g;
            let match;
            while ((match = regex.exec(html)) !== null) {
                console.log(`   CONTEXT: ...${match[0]}...`);
            }
        } else {
            console.warn("❌ 'E0BA0115SX' NOT found in HTML. Use Teacher Mode?");
        }

        console.log("\n--- ASSETS (PDF/DWG) ---");
        console.log("PDFs Found:", result.metadata.asset_urls_found?.pdf?.length);

        // Check for DWG indicators in HTML even if not extracted
        if (html.includes('.dwg') || html.includes('login') || html.includes('Login')) {
            console.log("⚠️ DWG or Login hints found in HTML.");
        }

    } catch (e: any) {
        console.error(`❌ Trace Failed: ${e.message}`);
    }
}

traceCompound();
