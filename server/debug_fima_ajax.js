
const puppeteer = require('puppeteer');

async function test() {
    const sku = 'F6000';
    const browser = await puppeteer.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.goto('https://fimacf.com/', { waitUntil: 'networkidle2' });

        // Handle Cookies
        await page.evaluate(async () => {
            const btn = Array.from(document.querySelectorAll('button, a')).find(b => b.innerText.toLowerCase().includes('accetta') || b.innerText.toLowerCase().includes('accept'));
            if (btn) btn.click();
            await new Promise(r => setTimeout(r, 1000));
        });

        console.log(`Typing SKU: ${sku}`);
        const selector = '.dgwt-wcas-search-input';
        await page.waitForSelector(selector);
        await page.type(selector, sku, { delay: 100 });

        console.log("Waiting for suggestions...");
        const suggestionSelector = '.dgwt-wcas-suggestion';
        try {
            await page.waitForSelector(suggestionSelector, { timeout: 10000 });
            const results = await page.evaluate(() => {
                const items = Array.from(document.querySelectorAll('.dgwt-wcas-suggestion'));
                return items.map(i => {
                    const link = i.querySelector('a') || i.closest('a');
                    return {
                        text: i.innerText.substring(0, 100).replace(/\n/g, ' '),
                        link: link ? link.href : null
                    };
                });
            });
            console.log("Suggestions Found:", JSON.stringify(results, null, 2));
        } catch (e) {
            console.log("No suggestions appeared.");
        }

    } finally {
        await browser.close();
    }
}

test();
