// @ts-nocheck

import { initPuppeteerService, analyzePage } from './src/modules/catalogEnricher/services/cePuppeteerService';

// Mock Socket
const mockSocket: any = {
    emit: (event: string, data: any) => console.log(`[Socket] ${event}:`, data?.message || data)
};

const run = async () => {
    try {
        console.log("🚀 Starting Fima Simplification Verification (Raw Mode)...");
        await initPuppeteerService(mockSocket);

        // Test 1: Product Extraction (Speed & Single Image)
        const productUrl = 'https://fimacf.com/prodotto/f3051wlx8-miscelatore-lavabo-a-parete/';
        console.log(`\n💎 Test 1: Testing Product: ${productUrl}`);
        const start = Date.now();

        const result = await analyzePage(productUrl, 'debug-job', { noInteractions: false });
        // result.metadata is PageAnalysisResult
        // extracted data is in result.metadata.extracted_data (typed as any usually or ExtractedData)

        const duration = Date.now() - start;
        console.log(`⏱️ Duration: ${duration}ms`);

        const data = (result.metadata as any).extracted_data || {};
        const variants = data.variants || [];
        const associated = data.associated_products || [];

        // Validation - Variants
        console.log(`🎨 Variants Found: ${variants.length}`);
        if (variants.length === 1 && variants[0].name === 'Chrome') {
            console.log("✅ Variants OK: Single 'Chrome' variant extracted.");
        } else if (variants.length > 1) {
            console.warn("⚠️ Warning: More than 1 variant found. Simplification might have failed.");
            console.table(variants);
        } else {
            console.warn("⚠️ Warning: No variants found (or 0).");
        }

        // Validation - Associated Parts
        console.log(`🔗 Associated Parts: ${associated.length}`);
        const required = associated.filter((a: any) => a.type === 'REQUIRED' || a.is_required);
        if (required.length > 0) {
            console.log(`✅ Associated OK: Found ${required.length} REQUIRED parts.`);
            console.table(required);
            if (required[0].ref || required[0].url) {
                console.log("✅ Metadata OK: Ref/Link present.");
            } else {
                console.log("❌ Metadata MISSING: Ref or Link missing.");
            }
        } else {
            console.log("⚠️ No REQUIRED parts found.");
        }

        // Test 2: Taxonomy (Category Discovery)
        const categoryUrl = 'https://fimacf.com/prodotti/';
        console.log(`\n📂 Test 2: Testing Category Discovery: ${categoryUrl}`);

        const catResult = await analyzePage(categoryUrl, 'debug-job-cat', { noInteractions: true });
        const meta = catResult.metadata;

        console.log(`📄 Kind: ${meta.page_kind}`);
        console.log(`📦 Products Found: ${meta.product_family_urls_found?.length}`);
        console.log(`📂 Subcategories Found: ${meta.subcategory_urls_found?.length}`);

        const subcats = meta.subcategory_urls_found || [];

        if (subcats.length > 0) {
            console.log("Sample Subcats:");
            console.log(subcats.slice(0, 10));

            // Check for 'tipologia' or 'ambiente'
            const hasFimaTerms = subcats.some((u: string) => u.includes('tipologia') || u.includes('ambiente') || u.includes('doccia'));
            if (hasFimaTerms) {
                console.log("✅ Taxonomy OK: Found Fima-specific category terms (tipologia/ambiente).");
            } else {
                console.warn("⚠️ Taxonomy Warning: No 'tipologia' or 'ambiente' found. Check patterns.");
            }
        } else {
            console.warn("❌ Taxonomy FAIL: No subcategories found.");
        }

        process.exit(0);

    } catch (e) {
        console.error("❌ Fatal Error:", e);
        process.exit(1);
    }
};

run();
