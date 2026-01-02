
const puppeteer = require('puppeteer');

async function test() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        console.log("📡 Navigating to fimacf.com...");
        await page.goto('https://fimacf.com/', { waitUntil: 'networkidle2' });

        // 1. Accept Cookies
        await page.evaluate(async () => {
            const buttons = Array.from(document.querySelectorAll('button, a'));
            const accept = buttons.find(b => b.innerText.toLowerCase().includes('accetta') || b.innerText.toLowerCase().includes('accept'));
            if (accept) accept.click();
            await new Promise(r => setTimeout(r, 2000));
        });

        // 2. Click Search Icon to reveal input
        console.log("🔍 Clicking search icon...");
        await page.evaluate(() => {
            const searchIcon = Array.from(document.querySelectorAll('a, button')).find(el =>
                el.innerText.toLowerCase().includes('search') ||
                (el.querySelector('svg') && el.getAttribute('aria-label')?.toLowerCase().includes('search'))
            );
            if (searchIcon) searchIcon.click();
        });
        await new Promise(r => setTimeout(r, 1000));

        // 3. Type SKU and Enter
        console.log("⌨️ Typing F3181...");
        await page.keyboard.type('F3181');
        await page.keyboard.press('Enter');

        console.log("⏳ Waiting for navigation...");
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => console.log("Timeout waiting for nav"));

        console.log(`📍 Final URL: ${page.url()}`);
        await page.screenshot({ path: 'fima_search_final.png', fullPage: true });

        const content = await page.evaluate(() => document.body.innerText);
        console.log(`🔍 Found 'F3181' in results? ${content.includes('F3181')}`);

    } finally {
        await browser.close();
    }
}

test();
