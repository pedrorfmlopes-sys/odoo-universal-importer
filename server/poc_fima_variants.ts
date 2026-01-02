// @ts-nocheck

import puppeteer from 'puppeteer';

async function pocFimaVariants() {
    console.log("🚀 Launching browser...");
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    const url = "https://fimacf.com/prodotto/f3051wlx8-miscelatore-lavabo-a-parete/";

    console.log(`📡 Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Get initial image
    const initialImg = await page.evaluate(() => {
        const img = document.querySelector('.woocommerce-product-gallery__image img, .single-product__intro img') as HTMLImageElement;
        return img ? img.src : 'Not found';
    });
    console.log("Initial Image:", initialImg);

    console.log("🔍 Finding iframe...");
    const iframeElement = await page.$('iframe#iframe');
    if (!iframeElement) {
        console.log("❌ Iframe not found!");
        await browser.close();
        return;
    }

    const frame = await iframeElement.contentFrame();

    if (frame) {
        console.log("⏳ Waiting for items in iframe...");
        await frame.waitForSelector('.item', { timeout: 10000 });

        const finishItems = await frame.$$('.item');
        console.log(`Found ${finishItems.length} items in iframe.`);

        if (finishItems.length > 1) {
            console.log("🖱️ Clicking second finish...");
            await finishItems[1].click();
            await new Promise(r => setTimeout(r, 4000)); // Wait for update

            const updatedImg = await page.evaluate(() => {
                const img = document.querySelector('.woocommerce-product-gallery__image img, .single-product__intro img') as HTMLImageElement;
                return img ? img.src : 'Not found';
            });
            console.log("Updated Image:", updatedImg);

            if (updatedImg !== initialImg) {
                console.log("✅ SUCCESS: Image updated after click!");
            } else {
                console.log("❌ FAILURE: Image did not update (or URL is the same).");
            }
        }
    }

    await browser.close();
}

pocFimaVariants().catch(console.error);
