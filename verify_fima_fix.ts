
const { analyzePage, initPuppeteerService } = require('./server/src/modules/catalogEnricher/services/cePuppeteerService');
const { Server } = require('socket.io');

async function test() {
    console.log("🧪 Testing Fima Expansion Fix...");

    // Mock Socket.io
    const io = new Server();
    initPuppeteerService(io);

    const url = 'https://fimacf.com/it/collezioni/bagno/';

    try {
        console.log(`📡 Analyzing ${url}...`);
        const { metadata } = await analyzePage(url, undefined, { noInteractions: false });

        const subcatCount = metadata.subcategory_urls_found.length;
        console.log(`✅ Sub-categories found: ${subcatCount}`);

        if (subcatCount > 16) {
            console.log("🚀 SUCCESS: Found more than 16 items! 'Load More' is working.");
        } else {
            console.log("❌ FAILURE: Still stuck at 16 or fewer items.");
        }

        console.log("URLs sampled:", metadata.subcategory_urls_found.slice(0, 5));

    } catch (e) {
        console.error("💥 Test failed:", e.message);
    }

    process.exit();
}

test();
