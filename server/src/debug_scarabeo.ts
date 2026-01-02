
import { analyzePage } from './modules/catalogEnricher/services/cePuppeteerService';

async function testScarabeo() {
    const url = "https://scarabeoceramiche.it/collezioni/collezione-ceramica/moon/";
    console.log(`Analyzing Scarabeo URL: ${url}`);

    try {
        const { metadata } = await analyzePage(url, undefined, { noInteractions: true });

        console.log("------------------------------------------");
        console.log(`Page Kind: ${metadata.page_kind}`);
        console.log(`Products Found: ${metadata.product_family_urls_found?.length || 0}`);
        console.log(`Subcats Found: ${metadata.subcategory_urls_found?.length || 0}`);

        if (metadata.product_family_urls_found && metadata.product_family_urls_found.length > 0) {
            console.log("Sample Products:");
            console.log(metadata.product_family_urls_found.slice(0, 5));
        }

    } catch (e: any) {
        console.error("❌ Failed:", e.message);
    }
}

testScarabeo();
