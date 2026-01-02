// @ts-nocheck

import puppeteer from 'puppeteer';

async function analyzeFimaConfigurator() {
    console.log("🚀 Launching browser...");
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    const url = "https://fimacf.com/prodotto/f3051wlx8-miscelatore-lavabo-a-parete/";

    console.log(`📡 Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    console.log("🔍 Looking for configurator iframe...");
    const iframeElement = await page.$('iframe#iframe');
    if (!iframeElement) {
        console.log("❌ Iframe not found!");
        await browser.close();
        return;
    }

    const frame = await iframeElement.contentFrame();
    if (!frame) {
        console.log("❌ Could not access iframe content frame!");
        await browser.close();
        return;
    }

    console.log("⏳ Waiting for iframe content to load finishes...");
    try {
        await frame.waitForSelector('.finishing-item, .swatch, [class*="finish"]', { timeout: 10000 });
    } catch (e) {
        console.log("⚠️ Could not find specific finish selectors, dumping all classes in iframe...");
    }

    const classes = await frame.evaluate(() => {
        const all = Array.from(document.querySelectorAll('*'));
        const classSet = new Set();
        all.forEach(el => el.className.split(' ').forEach(c => c && classSet.add(c)));
        return Array.from(classSet);
    });
    console.log("Classes found in iframe:", classes);

    const finishes = await frame.evaluate(() => {
        const items = Array.from(document.querySelectorAll('.finishing-item, [class*="finish-item"], .finitura-item'));
        return items.map(el => ({
            text: el.textContent?.trim(),
            html: el.outerHTML.substring(0, 200)
        }));
    });
    console.log("Found finishes:", JSON.stringify(finishes, null, 2));

    await browser.close();
    console.log("✅ Done.");
}

analyzeFimaConfigurator().catch(console.error);
