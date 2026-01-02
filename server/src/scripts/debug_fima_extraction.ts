
import { ceEnrichmentService } from '../modules/catalogEnricher/services/ceEnrichmentService';
import { initPuppeteerService } from '../modules/catalogEnricher/services/cePuppeteerService';
import { Server } from 'socket.io';

async function testFimaExtraction() {
    console.log("🚀 Testing Fima Extraction (Variants & Interiors)...");

    // Mock Socket.IO
    const mockIo = { emit: (event: string, data: any) => console.log(`[Socket] ${event}`) } as any;
    initPuppeteerService(mockIo);

    const url = "https://fimacf.com/prodotto/f3051wlx8-miscelatore-lavabo-a-parete/";

    try {
        const result = await ceEnrichmentService.enrichProductFamily(url);

        console.log("\n--- EXTRACTION RESULT ---");
        console.log("Name:", result.name);
        console.log("Reference:", result.itemReference);
        console.log("Category Path:", result.categoryPath);
        console.log("Variants found:", result.variants?.length || 0);

        if (result.variants && result.variants.length > 0) {
            console.log("First variant:", {
                name: result.variants[0].dimension,
                hasImage: !!result.variants[0].image_url && result.variants[0].image_url.startsWith('data:image'),
                imagePrefix: result.variants[0].image_url?.substring(0, 50)
            });
        }

        console.log("Discovered Links (Recursion):", result.discoveredLinks);

        if (result.discoveredLinks && result.discoveredLinks.length > 0) {
            console.log("✅ Interior part discovery working!");
        }

    } catch (e: any) {
        console.error("❌ Extraction Failed:", e.message);
    }
}

testFimaExtraction().catch(console.error);
