
import { analyzePage } from './modules/catalogEnricher/services/cePuppeteerService';

async function testFimaHub() {
    const url = "https://fimacf.com/en/tipologia/washbasinmixer_en/";
    console.log(`Analyzing Fima HUB URL: ${url}`);

    try {
        const { metadata } = await analyzePage(url, undefined, { noInteractions: true });

        console.log("------------------------------------------");
        console.log(`Page Kind: ${metadata.page_kind}`);
        console.log(`Products Found: ${metadata.product_family_urls_found?.length || 0}`);
        console.log(`Subcats Found: ${metadata.subcategory_urls_found?.length || 0}`);

        if (metadata.subcategory_urls_found && metadata.subcategory_urls_found.length > 0) {
            console.log("Sample Subcats:");
            console.log(metadata.subcategory_urls_found.slice(0, 5));
        }

    } catch (e: any) {
        console.error("❌ Failed:", e.message);
    }
}

testFimaHub();
