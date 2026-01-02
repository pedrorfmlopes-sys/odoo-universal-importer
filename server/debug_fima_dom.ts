// @ts-nocheck

import puppeteer from 'puppeteer';
import fs from 'fs';

async function dumpFima() {
    console.log("🚀 Launching browser...");
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    const url = "https://fimacf.com/prodotto/f3051wlx8-miscelatore-lavabo-a-parete/";

    console.log(`📡 Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    console.log("📸 Page loaded. Dumping HTML...");
    const html = await page.content();
    fs.writeFileSync('fima_dump.html', html);

    // Also log specific sections
    const swatches = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('.fima-product-finishes, .swatch-container, .finishes, [class*="finish"], [class*="config"]'));
        return els.map(el => ({ tag: el.tagName, class: el.className, html: el.outerHTML.substring(0, 500) }));
    });
    console.log("Found variant containers:", JSON.stringify(swatches, null, 2));

    const interiorParts = await page.evaluate(() => {
        const headers = Array.from(document.querySelectorAll('h1, h2, h3, h4'));
        const interiorHeader = headers.find(h => h.textContent?.toLowerCase().includes('separatamente') || h.textContent?.toLowerCase().includes('incasso'));
        if (interiorHeader) {
            const parent = interiorHeader.parentElement;
            return parent?.innerHTML;
        }
        return "Not found";
    });
    console.log("Interior parts section:", interiorParts);

    await browser.close();
    console.log("✅ Done. Check fima_dump.html");
}

dumpFima().catch(console.error);
