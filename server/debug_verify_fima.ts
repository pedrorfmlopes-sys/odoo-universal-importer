// @ts-nocheck

import { ceEnrichmentService } from './src/modules/catalogEnricher/services/ceEnrichmentService';
import { getCeDatabase } from './src/modules/catalogEnricher/db/ceDatabase';

// Mock DB Init to avoid errors if lazy loading fails
getCeDatabase();

async function run() {
    console.log("🚀 Verifying Fima Refinements (SKU, Image, Gallery)...");
    const url = "https://fimacf.com/prodotto/f3051wlx8-miscelatore-lavabo-a-parete/";

    try {
        const result = await ceEnrichmentService.enrichProductFamily(url);

        console.log("\n--- RESULT SUMMARY ---");
        console.log(`Name: ${result.name}`);
        console.log(`URL: ${result.url}`);

        console.log("\nChecking Variants (Expected: ~12, Code: F3...):");
        if (result.variants && result.variants.length > 0) {
            console.table(result.variants.map(v => ({
                dim: v.dimension,
                code: v.sku_real,
                imgType: v.image_url?.substring(0, 30) + '...'
            })));

            // Validation
            const hasBaseSKU = result.variants.some(v => v.sku_real && v.sku_real.startsWith('F3'));
            const hasCanvas = result.variants.some(v => v.image_url && v.image_url.startsWith('data:image'));

            if (hasBaseSKU && hasCanvas) console.log("✅ Variants OK: Found Base SKU and Canvas Images.");
            else console.log("❌ Variants FAIL: Missing SKU or Canvas Images.");

        } else {
            console.log("❌ No variants found!");
        }

        console.log("\nChecking Gallery (Expected: Clean, no related products):");
        if (result.galleryImages) {
            console.log(`Gallery Size: ${result.galleryImages.length}`);
            result.galleryImages.forEach(img => console.log(`- ${img.substring(0, 80)}...`));

            if (result.galleryImages.length > 20) {
                console.warn("⚠️ Gallery seems too large! (Possible cut-off failure)");
            } else {
                console.log("✅ Gallery size consistent with Cut-off logic.");
            }
        }

        console.log("\nChecking Necessary Parts (Expected: REQUIRED items):");
        if (result.associated_products_json) {
            const assocs = JSON.parse(result.associated_products_json);
            console.table(assocs);
            const hasRequired = assocs.some((a: any) => a.type === 'REQUIRED');

            if (hasRequired) console.log("✅ Necessary Parts OK: Found REQUIRED items.");
            else console.log("⚠️ No REQUIRED items found. (Ensure page has 'PRODOTTI NECESSARI')");
        } else {
            console.log("ℹ️ No associated products found.");
        }

    } catch (e: any) {
        console.error("💥 Verification Failed:", e);
    }
}

run();
