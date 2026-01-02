// @ts-nocheck

import puppeteer from 'puppeteer';

async function inspectIframeImages() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    const url = "https://fimacf.com/prodotto/f3051wlx8-miscelatore-lavabo-a-parete/";

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    const iframeElement = await page.$('iframe#iframe');
    const frame = await iframeElement?.contentFrame();

    if (frame) {
        await frame.waitForSelector('.item', { timeout: 10000 });

        const imageData = await frame.evaluate(() => {
            const imgs = Array.from(document.querySelectorAll('img'));
            return imgs.map(img => ({
                src: img.src,
                alt: img.alt,
                className: img.className,
                visible: img.offsetParent !== null
            }));
        });
        console.log("Images found in iframe:", JSON.stringify(imageData, null, 2));
    } else {
        console.log("❌ No frame found.");
    }

    await browser.close();
}

inspectIframeImages().catch(console.error);
