
const { resolveSkuToUrl } = require('./src/modules/catalogEnricher/services/cePuppeteerService');

async function test() {
    const brandId = 'a56b5943-953d-4879-9936-719cdf35ad29'; // Fima
    const testCases = [
        { sku: 'F6000/30CR', name: 'Portasalviette 30 cm' },
        { sku: 'F3111M', name: 'Slide' },
        { sku: 'F3181', name: 'Slide' }
    ];

    console.log("🚀 Testing Targeted Resolution for Fima Excel Data...");

    for (const tc of testCases) {
        console.log(`\n🔍 Resolving SKU: "${tc.sku}" | Name: "${tc.name}"`);
        try {
            const url = await resolveSkuToUrl(brandId, tc.sku, tc.name);
            if (url) {
                console.log(`✅ SUCCESS: ${tc.sku} -> ${url}`);
            } else {
                console.log(`❌ FAILED: ${tc.sku} not found`);
            }
        } catch (e) {
            console.error(`💥 ERROR:`, e.message);
        }
    }
}

test().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
