
const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const url = 'https://www.ritmonio.it/en/bath-shower/bath/haptic-s/'; // Target category

    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href]')).map(a => a.href);
    });

    console.log(`Found ${links.length} links.`);
    links.forEach(l => {
        if (l.includes('ritmonio.it') && !l.includes('javascript')) {
            console.log(l);
        }
    });

    await browser.close();
})();
