
import axios from 'axios';
import * as cheerio from 'cheerio';

async function run() {
    // Search for the SKU found via Spillo
    const sku = 'F5603X4';

    // Test both URL variations AND Query variations
    const tests = [
        { name: "SKU Search", url: `https://www.fimacf.com/?s=${encodeURIComponent(sku)}&post_type=product` }
    ];

    console.log(`Starting Fima URL Variation Test...`);

    for (const t of tests) {
        console.log(`\n\n=== Testing: ${t.name} ===`);
        console.log(`URL: ${t.url}`);

        try {
            const response = await axios.get(t.url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                timeout: 20000,
                validateStatus: () => true
            });

            console.log(`Status: ${response.status}`);

            const $ = cheerio.load(response.data);
            const productLinks: string[] = [];
            $('a').each((i, el) => {
                const href = $(el).attr('href');
                if (href && (href.includes('/product/') || href.includes('/prodotto/'))) {
                    productLinks.push(href);
                }
            });

            console.log(`Found ${productLinks.length} product links.`);
            if (productLinks.length > 0) {
                console.log('Sample Link:', productLinks[0]);
            } else {
                const title = $('title').text();
                console.log(`No results. Page Title: ${title}`);
            }

        } catch (e: any) {
            console.error("Failed:", e.message);
        }
    }
}

run();
