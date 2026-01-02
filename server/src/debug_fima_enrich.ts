
import { ceEnrichmentService } from './modules/catalogEnricher/services/ceEnrichmentService';

async function testEnrich() {
    const url = "https://fimacf.com/en/product/f3111m-wash-basin-mixer/";
    console.log(`Enriching Fima Product: ${url}`);

    try {
        const result = await ceEnrichmentService.enrichProductFamily(url, "test-job-" + Date.now());
        console.log("------------------------------------------");
        console.log(`Name: ${result.name}`);
        console.log(`SKU: ${result.itemReference}`);
        console.log(`Files found: ${result.namedFiles?.length || 0}`);
        console.log(`Variants: ${result.variants?.length || 0}`);

        if (!result.name || result.name === 'Unknown') {
            console.error("❌ Extraction failed to find name!");
        }

    } catch (e: any) {
        console.error("❌ Failed:", e.message);
    }
}

testEnrich();
