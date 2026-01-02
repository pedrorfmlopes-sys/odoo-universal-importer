
import { resolveSkuToUrl } from './src/modules/catalogEnricher/services/cePuppeteerService';

async function test() {
    const profileId = 'a56b5943-953d-4879-9936-719cdf35ad29'; // Fima Profile
    const testCases = [
        { sku: 'F6000/30CR', aux: 'Portasalviette 30 cm' },
        { sku: 'F6000/40BS', aux: 'Portasalviette 40 cm' }
    ];

    console.log("🚀 Starting Fima Finish Fix Verification...");

    for (const tc of testCases) {
        console.log(`\n🔍 Testing SKU: "${tc.sku}" | Names: "${tc.aux}"`);
        const url = await resolveSkuToUrl(profileId, tc.sku, { names: [tc.aux, 'Towel holder 30 cm', 'Wall mounted bath spout'] });
        if (url) {
            console.log(`✅ SUCCESS: Resolved to ${url}`);
        } else {
            console.log(`❌ FAILED: ${tc.sku} not found`);
        }
    }
    process.exit(0);
}

test();
