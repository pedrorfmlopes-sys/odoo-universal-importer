// @ts-nocheck

import { ceEnrichmentService } from './src/modules/catalogEnricher/services/ceEnrichmentService';
import { getCeDatabase } from './src/modules/catalogEnricher/db/ceDatabase';

// Mock DB Init
getCeDatabase();

async function run() {
    console.log("🚀 Debugging 'Description Error' Regression...");
    const url = "https://fimacf.com/prodotto/f3051wlx8-miscelatore-lavabo-a-parete/";

    try {
        const start = Date.now();
        const result = await ceEnrichmentService.enrichProductFamily(url);
        const duration = Date.now() - start;

        console.log(`\n⏱️ Duration: ${duration}ms`);
        console.log("\n--- ENRICHMENT RESULT ---");
        console.log(`Name: '${result.name}'`);
        console.log(`Description: '${(result as any).description?.substring(0, 50)}...'`); // Cast as any if interface not picked up by ts-node immediately

        // Check if description is valid text
        if (!(result as any).description || (result as any).description === 'Error') {
            console.error("❌ CRITICAL: Description is missing or 'Error'.");
        } else {
            console.log("✅ Description found.");
        }
        // Wait, ceEnrichmentService.enrichProductFamily returns a flattened object.
        // Let's check what it returns exactly. The interface might verify this.

        // Actually, looking at ceEnrichmentService.ts logic (viewed previously):
        // It returns: { url, name, heroImage, pdfUrls, namedFiles, galleryImages, itemReference, categoryPath, collections, variants, associated_products_json, ... }
        // It DOES NOT seem to return 'description' field explicitly in the return object in the code I verify in Step 1064 (lines 450-464).

        // WAIT. If ceEnrichmentService doesn't return 'description', then where does the user see it?
        // Maybe the user refers to the "Name" being "Error"?
        // OR the user is looking at the Odoo export or the UI "Description" column which might be pulled from `extracted_data`?

        // I need to check if `extractedData` from Puppeteer survives into the result.
        // ceEnrichmentService uses `puppetData.extracted_data` inside.

        console.log(`Item Ref: '${result.itemReference}'`);
        console.log(`Gallery Count: ${result.galleryImages?.length}`);

        // If Name is 'Error', it failed.
        if (result.name === 'Error') {
            console.error("❌ CRITICAL: Scraper crashed! Name is 'Error'.");
        } else {
            console.log("✅ Scraper finished properly (no crash).");
        }

    } catch (e: any) {
        console.error("💥 SYSTEM ERROR:", e);
    }
}

run();
