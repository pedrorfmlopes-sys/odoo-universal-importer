// @ts-nocheck

import { analyzePage } from './src/modules/catalogEnricher/services/cePuppeteerService';
import { initPuppeteerService } from './src/modules/catalogEnricher/services/cePuppeteerService';

// Mock Socket.IO
const mockIO: any = {
    emit: (event: string, data: any) => console.log(`[MockIO] ${event}:`, data)
};

async function run() {
    console.log("🚀 Starting Deep Analysis for 'Able' Collection");
    const url = "https://scarabeoceramiche.it/collezioni/collezione-arredo/able/";

    // Init Service
    initPuppeteerService(mockIO);

    try {
        console.log(`[Action] Analyzing ${url}...`);
        const { metadata, html } = await analyzePage(url, undefined);

        console.log("--- METADATA ---");
        console.log(JSON.stringify(metadata, null, 2));

        const products = metadata.product_family_urls_found || [];
        console.log(`[Result] Found ${products.length} products.`);

        if (products.length === 0) {
            console.log("[Debug] Dumping HTML to debug_able_dump.html");
            require('fs').writeFileSync('server/debug_able_dump.html', html);
        }

    } catch (e: any) {
        console.error("💥 CRITICAL FAILURE:", e);
    }
}

run();
