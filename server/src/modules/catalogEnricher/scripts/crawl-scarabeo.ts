
import axios from 'axios';
import * as cheerio from 'cheerio';

const TARGET_URL = 'https://scarabeoceramiche.it/categoria-prodotto/tipologie/lavabi/';

async function scanCategory() {
    console.log(`🕷️ Scanning: ${TARGET_URL}`);

    try {
        const { data } = await axios.get(TARGET_URL);
        const $ = cheerio.load(data);

        const products: any[] = [];

        // Valid Link Selector based on debug
        const items = $('a[href*="/prodotto/"]');

        console.log(`Found ${items.length} product cards.`);

        items.each((i, el) => {
            const link = $(el).attr('href');
            const name = $(el).text().trim() || 'Unknown Product';
            const price = '';

            // Try to find code/SKU in the card
            // Often inside a class like .sku or accessible via data attributes
            // Or maybe inside the title
            let sku = '';

            // Debug: print classes to help refine selector
            // console.log($(el).attr('class'));

            products.push({ count: i + 1, name, link, sku });
        });

        console.table(products.slice(0, 10)); // Show top 10

        if (products.length === 0) {
            console.log('⚠️ No products found with .product selector. Dumping body classes to debug...');
            console.log($('body').attr('class'));
        }

    } catch (e: any) {
        console.error('❌ Error:', e.message);
    }
}

scanCategory();
