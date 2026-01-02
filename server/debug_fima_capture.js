
const puppeteer = require('puppeteer');

async function test() {
    const sku = 'F6000';
    const browser = await puppeteer.launch({ headless: true });
    try {
        const page = await browser.newPage();
        const searchUrl = `https://fimacf.com/?s=${encodeURIComponent(sku)}&post_type=product`;
        console.log(`Searching: ${searchUrl}`);
        await page.goto(searchUrl, { waitUntil: 'networkidle2' });

        await new Promise(r => setTimeout(r, 2000));

        const html = await page.evaluate(() => document.body.innerHTML);
        require('fs').writeFileSync('fima_search_f6000.html', html);
        console.log("Captured HTML to fima_search_f6000.html");

        const links = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a'));
            return anchors.map(a => ({ href: a.href, text: a.innerText })).filter(a => a.href.includes('/prodotto/') || a.href.includes('/product/'));
        });
        console.log("Product Links Found:", links.slice(0, 10));

    } finally {
        await browser.close();
    }
}

test();
