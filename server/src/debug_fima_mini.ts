
import { analyzePage } from './modules/catalogEnricher/services/cePuppeteerService';

async function testFimaMini() {
    const url = "https://fimacf.com/en/tipologia/washbasinmixer_en/basin-mixer_en/bidet_en/";
    console.log(`Analyzing Fima MINI LIST URL: ${url}`);

    try {
        const { metadata } = await analyzePage(url, undefined, { noInteractions: true });

        console.log("------------------------------------------");
        console.log(`Page Kind: ${metadata.page_kind}`);
        console.log(`Products Found: ${metadata.product_family_urls_found?.length || 0}`);

        if (metadata.product_family_urls_found && metadata.product_family_urls_found.length > 0) {
            console.log("Products:");
            console.log(metadata.product_family_urls_found);
        }

    } catch (e: any) {
        console.error("❌ Failed:", e.message);
    }
}

testFimaMini();
