
import { resolveSkuToUrl } from './src/modules/catalogEnricher/services/cePuppeteerService';
import { getCeDatabase } from './src/modules/catalogEnricher/db/ceDatabase';
import { closeTeacherBrowser, getSharedCrawlerBrowser } from './src/modules/catalogEnricher/services/cePuppeteerService';

async function run() {
    console.log('--- Fima Reproduction Script ---');

    // 1. Setup Mock Profile if needed (or assume existing)
    // We need a profile id for Fima.
    const db = getCeDatabase();
    let profile = db.prepare("SELECT id FROM ce_brand_profiles WHERE domain_root LIKE '%fimacf%'").get() as any;

    if (!profile) {
        console.log('Creating Mock Profile for Fima...');
        const id = 'fima_test_' + Date.now();
        db.prepare("INSERT INTO ce_brand_profiles (id, name, domain_root) VALUES (?, ?, ?)").run(id, 'Fima Test', 'fimacf.com');
        profile = { id };
    }

    console.log(`Testing with Profile ID: ${profile.id}`);

    try {
        // 3. Run Resolve Logic
        console.log('\n\n1. Testing Valid SKU (Direct): F5603X4');
        const url1 = await resolveSkuToUrl(profile.id, 'F5603X4', {
            names: ["Miscelatore termostatico da incasso Texture Collection Spillo Tech"]
        });
        console.log('Result 1:', url1);

        console.log('\n\n2. Testing Variant SKU (Needs Reduction): F3051TWX8GCN');
        const url2 = await resolveSkuToUrl(profile.id, 'F3051TWX8GCN', {
            names: ["Miscelatore lavabo a parete"]
        });
        console.log('Result 2:', url2);

        if (!url1) console.error("FAILED: Direct SKU returned null");
        if (!url2) console.error("FAILED: Variant SKU returned null");
        if (url2 && !url2.includes('f3051twx8')) console.warn("WARNING: Variant matched unexpected URL");


    } catch (e: any) {
        console.error("CRITICAL ERROR:", e);
    } finally {
        // Debug Dump
        const browser = await getSharedCrawlerBrowser();
        const pages = await browser.pages();
        if (pages.length > 0) {
            const page = pages[pages.length - 1]; // active page
            await page.screenshot({ path: 'debug_fima_repro.png' });
            const html = await page.content();
            const fs = require('fs');
            fs.writeFileSync('debug_fima_repro.html', html);
            console.log('Saved debug_fima_repro.png and .html');
        }
        await browser.close();
        process.exit(0);
    }
}

run();
