
import { resolveSkuToUrl } from './src/modules/catalogEnricher/services/cePuppeteerService';
import { getCeDatabase } from './src/modules/catalogEnricher/db/ceDatabase';

async function test() {
    const brandId = 'a56b5943-953d-4879-9936-719cdf35ad29'; // Fima
    const skus = ['F3181', 'F3181CR', 'F3721'];

    console.log("🚀 Testing SKU Resolution for Fima...");

    for (const sku of skus) {
        console.log(`\n🔍 Resolving ${sku}...`);
        try {
            const url = await resolveSkuToUrl(brandId, sku);
            console.log(`✅ Result for ${sku}: ${url}`);
        } catch (e: any) {
            console.error(`❌ Error for ${sku}:`, e.message);
        }
    }
}

test().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
