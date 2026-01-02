// @ts-nocheck

import { ceAiService } from './src/modules/catalogEnricher/services/ceAiService';
import { analyzePage } from './src/modules/catalogEnricher/services/cePuppeteerService';

async function testExpansion() {
    // Example: A Rituals/Fima category page that is a product list
    const url = 'https://www.fimacf.com/it/prodotti/bagno/serie-slide/';
    const domain = 'fimacf.com';

    console.log(`🚀 Testing Expansion for: ${url}`);

    try {
        const { html, metadata } = await analyzePage(url, 'test-expand', { noInteractions: true });

        console.log("📊 Metadata Page Kind:", metadata.page_kind);
        console.log("📊 Products Found:", metadata.product_family_urls_found?.length || 0);

        const tree = await ceAiService.scanStructure(domain, html, false, url, metadata);

        console.log("🌳 Tree Result (Depth 0):", JSON.stringify(tree, null, 2));

        const hasProducts = tree.some((n: any) => n.type === 'product_family' || (n.children && n.children.some((c: any) => c.type === 'product_family')));

        if (hasProducts) {
            console.log("✅ SUCCESS: Products are present in the tree.");
        } else {
            console.log("❌ FAILURE: No products found in the tree expansion.");
        }

    } catch (e) {
        console.error("Test failed:", e);
    }
}

testExpansion();
