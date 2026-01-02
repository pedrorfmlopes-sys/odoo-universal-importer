
const { resolveSkuToUrl } = require('./src/modules/catalogEnricher/services/cePuppeteerService');

async function test() {
    const brandId = 'a56b5943-953d-4879-9936-719cdf35ad29'; // Fima
    const tests = [
        { sku: 'F3111M', aux: 'Snap' },
        { sku: 'F6000/30CR', aux: 'Accessori' },
        { sku: 'F3181', aux: 'Slide' }
    ];

    console.log("🚀 Testing Enhanced Resolution for Fima...");

    for (const t of tests) {
        console.log(`\n🔍 Resolving SKU: "${t.sku}" | Aux: "${t.aux}"`);
        try {
            const url = await resolveSkuToUrl(brandId, t.sku, t.aux);
            if (url) {
                console.log(`✅ SUCCESS: ${t.sku} -> ${url}`);
            } else {
                console.log(`❌ FAILED: ${t.sku} not found`);
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
