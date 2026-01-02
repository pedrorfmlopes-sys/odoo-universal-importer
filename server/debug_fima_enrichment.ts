
import { ceEnrichmentService } from './src/modules/catalogEnricher/services/ceEnrichmentService';
import { initPuppeteerService } from './src/modules/catalogEnricher/services/cePuppeteerService';
import { Server } from 'socket.io';

async function testEnrichment() {
    const url = 'https://fimacf.com/it/serie/slide/f6000/';
    console.log(`🧪 Testing Fima Enrichment for: ${url}`);

    // Mock IO if needed, though ceEnrichmentService handles null io

    try {
        const result = await ceEnrichmentService.enrichProductFamily(url);
        console.log("✅ Results:");
        console.log(JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("❌ Error:", e);
    }
}

testEnrichment().then(() => process.exit(0));
