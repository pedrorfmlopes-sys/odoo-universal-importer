
const puppeteer = require('puppeteer');

async function test() {
    const tests = [
        { sku: 'F3111M', aux: 'Slide' },
        { sku: 'F6000/30CR', aux: 'Accessori' },
        { sku: 'F3181', aux: 'Slide' }
    ];
    const browser = await puppeteer.launch({ headless: true });
    try {
        const page = await browser.newPage();
        for (const t of tests) {
            console.log(`\n🔍 Searching for: "${t.aux} ${t.sku}"`);
            const searchUrl = `https://fimacf.com/?s=${encodeURIComponent(t.aux + ' ' + t.sku)}&post_type=product`;
            await page.goto(searchUrl, { waitUntil: 'networkidle2' });

            // Handle Cookies
            await page.evaluate(async () => {
                const buttons = Array.from(document.querySelectorAll('button, a'));
                const accept = buttons.find(b => {
                    const text = b.innerText.toLowerCase();
                    return text.includes('accetta') || text.includes('accept');
                });
                if (accept) accept.click();
                await new Promise(r => setTimeout(r, 1000));
            });

            console.log(`📍 URL after search: ${page.url()}`);

            const results = await page.evaluate(() => {
                const items = Array.from(document.querySelectorAll('.product, .type-product, article'));
                return items.map(i => {
                    const link = i.querySelector('a');
                    return {
                        text: i.innerText.substring(0, 100).replace(/\n/g, ' '),
                        link: link ? link.href : null
                    };
                });
            });

            if (results.length > 0) {
                console.log(`✅ Found ${results.length} results:`);
                results.slice(0, 3).forEach(r => console.log(`   - [${r.text}] -> ${r.link}`));
            } else {
                console.log(`❌ No results found for "${sku}"`);
            }
        }
    } finally {
        await browser.close();
    }
}

test();
