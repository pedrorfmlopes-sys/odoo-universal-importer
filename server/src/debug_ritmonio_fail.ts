
import { ceEnrichmentService } from './modules/catalogEnricher/services/ceEnrichmentService';

async function test() {
    // The problematic URL with %2B
    const url = "https://www.ritmonio.it/en/bath-shower/product/?code=057987_PR50EC204%2BPM0020L&family=57984";
    console.log(`Testing Recursive Discovery for: ${url}`);

    try {
        const result = await ceEnrichmentService.enrichProductFamily(url);

        console.log("------------------------------------------");
        console.log("✅ Enrichment Result:");
        console.log("Name:", result.name);
        console.log("Code:", result.itemReference);
        console.log("Discovered Links Count:", result.discoveredLinks?.length || 0);

        if (result.discoveredLinks && result.discoveredLinks.length > 0) {
            console.log("Discovered Links:");
            result.discoveredLinks.forEach(link => console.log(`  - ${link}`));

            // Verify if PM0020L is in there
            const hasTarget = result.discoveredLinks.some(l => l.includes('PM0020L'));
            console.log(`Contains PM0020L? ${hasTarget ? 'YES ✅' : 'NO ❌'}`);
        }

    } catch (e: any) {
        console.error("❌ Test failed:", e.message);
    }
}

test();
