
const puppeteer = require('puppeteer');

async function test() {
    const tests = [
        { sku: 'F3181', aux: 'Slide' },
        { sku: 'F3181CR', aux: 'Slide' },
        { sku: 'F3721', aux: 'Spillo' }
    ];

    const browser = await puppeteer.launch({ headless: true });
    try {
        const page = await browser.newPage();
        for (const t of tests) {
            console.log(`\n🔍 Resolving SKU "${t.sku}" with aux "${t.aux}"...`);

            const query = `${t.aux} ${t.sku}`.trim();
            const searchUrl = `https://fimacf.com/?s=${encodeURIComponent(query)}&post_type=product`;

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

            console.log(`📍 Final URL: ${page.url()}`);
            if (page.url().includes('/prodotto/') || page.url().includes('/product/') || page.url().includes('/serie/')) {
                console.log(`✅ SUCCESS: Resolved to ${page.url()}`);
            } else {
                console.log(`❌ FAILED: Still on ${page.url()}`);
            }
        }
    } finally {
        await browser.close();
    }
}

test();
