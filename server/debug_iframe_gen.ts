// @ts-nocheck

import puppeteer from 'puppeteer';

async function investigateIframeGeneration() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    const url = "https://fimacf.com/prodotto/f3051wlx8-miscelatore-lavabo-a-parete/";

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    const iframeElement = await page.$('iframe#iframe');
    const frame = await iframeElement?.contentFrame();

    if (frame) {
        await frame.waitForSelector('.item', { timeout: 10000 });
        const finishItems = await frame.$$('.item');

        if (finishItems.length > 1) {
            console.log("🖱️ Clicking variant...");
            await finishItems[1].click();
            await new Promise(r => setTimeout(r, 5000));

            const iframeData = await frame.evaluate(() => {
                const canvas = document.querySelector('canvas');
                const images = Array.from(document.querySelectorAll('img')).map(img => img.src);
                return {
                    hasCanvas: !!canvas,
                    canvasData: canvas ? canvas.toDataURL('image/jpeg', 0.5).substring(0, 100) : null,
                    images
                };
            });
            console.log("Iframe Data after click:", JSON.stringify(iframeData, null, 2));
        }
    }

    await browser.close();
}

investigateIframeGeneration().catch(console.error);
