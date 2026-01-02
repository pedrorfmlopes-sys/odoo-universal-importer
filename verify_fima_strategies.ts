
import { resolveSkuToUrl, analyzePage } from './server/src/modules/catalogEnricher/services/cePuppeteerService';

async function runTests() {
    console.log('🚀 Starting Fima Strategy Verification...');

    const FIMA_PROFILE_ID = 'test_fima_profile'; // Mock or Real ID

    // Setup DB
    const { getCeDatabase } = await import('./server/src/modules/catalogEnricher/db/ceDatabase');
    const db = getCeDatabase();
    db.prepare('INSERT OR REPLACE INTO ce_brand_profiles (id, name, domain_root) VALUES (?, ?, ?)').run(FIMA_PROFILE_ID, 'Test Fima', 'fimacf.com');


    // TEST 1: Code Reducer
    console.log('\n---------------------------------------------------');
    console.log('🧪 TEST 1: Fima Code Reducer Logic');
    console.log('---------------------------------------------------');

    const childSku = 'F3000/1';
    console.log(`Input SKU: ${childSku}`);

    try {
        // We can't easily mock Puppeteer without a lot of setup, so we will attempt a real resolution.
        // This relies on the site being accessible.
        const resolvedUrl = await resolveSkuToUrl(FIMA_PROFILE_ID, childSku);
        console.log(`Resolved URL: ${resolvedUrl}`);

        if (resolvedUrl && !resolvedUrl.includes('F3000/1') && (resolvedUrl.includes('F3000') || resolvedUrl.includes('f3000'))) {
            console.log('✅ PASS: Reducer successfully matched parent product.');
        } else if (resolvedUrl) {
            console.log('⚠️ WARNING: URL resolved but might differ from expectation. Check manually.');
        } else {
            console.log('❌ FAIL: Could not resolve SKU.');
        }

    } catch (e) {
        console.error('❌ ERROR in Test 1:', e);
    }

    // TEST 2: C-Code Logic
    console.log('\n---------------------------------------------------');
    console.log('🧪 TEST 2: Fima C-Code Logic (C111N -> C1N)');
    console.log('---------------------------------------------------');

    const cSku = 'C111N';
    console.log(`Input SKU: ${cSku}`);

    try {
        const resolvedUrl = await resolveSkuToUrl(FIMA_PROFILE_ID, cSku);
        console.log(`Resolved URL: ${resolvedUrl}`);

        if (resolvedUrl && (resolvedUrl.includes('C1N') || resolvedUrl.includes('c1n'))) {
            console.log('✅ PASS: C-Code Logic worked.');
        } else {
            console.log('❌ FAIL: C-Code logic did not resolve to expected parent.');
        }

    } catch (e) {
        console.error('❌ ERROR in Test 2:', e);
    }

    // TEST 3: Image Fallback
    console.log('\n---------------------------------------------------');
    console.log('🧪 TEST 3: Arena Image Fallback');
    console.log('---------------------------------------------------');

    const testUrl = 'https://fimacf.com/product/f3000-chrom/';
    // We need to see if analyzePage adds the Arena URL
    try {
        const { metadata } = await analyzePage(testUrl, 'test_job', { noInteractions: true });

        const gallery = (metadata as any).gallery || [];
        const arenaImage = gallery.find((img: string) => img.includes('arenafurniture.com'));

        if (arenaImage) {
            console.log(`✅ PASS: Found Arena Image in gallery: ${arenaImage}`);
        } else {
            console.log('❌ FAIL: Arena Image NOT found in gallery.');
            console.log('Gallery:', gallery);
        }

    } catch (e) {
        console.error('❌ ERROR in Test 3:', e);
    }

    console.log('\n---------------------------------------------------');
    console.log('🏁 Verification Complete.');
    process.exit(0);
}

// Mock environment variables if needed
process.env.CE_STORAGE_ROOT = './data/test';

runTests();
