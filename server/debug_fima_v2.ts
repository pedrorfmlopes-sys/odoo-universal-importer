// @ts-nocheck

import puppeteer from 'puppeteer';
import fs from 'fs';

async function run() {
    console.log("🚀 Fima V2 Debug: Code Search & Canvas Capture...");
    const url = "https://fimacf.com/prodotto/f3051wlx8-miscelatore-lavabo-a-parete/";

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait for iframe
        const iframeElement = await page.waitForSelector('iframe[src*="config.fimacf.com"]', { timeout: 10000 });
        if (!iframeElement) throw new Error("Iframe not found");

        const frame = await iframeElement.contentFrame();
        if (!frame) throw new Error("Content frame not accessible");

        console.log("✅ Iframe loaded.");

        // 1. Text Search for likely Code (e.g., F3051)
        console.log("🔍 Searching for text containing 'F3'...");
        const textNodes = await frame.$$eval('*', els => {
            return els
                .filter(el => el.children.length === 0 && el.textContent?.includes('F3'))
                .map(el => ({
                    tag: el.tagName,
                    class: el.className,
                    text: el.textContent?.trim(),
                    parentClass: el.parentElement?.className
                }));
        });
        console.table(textNodes.slice(0, 10));

        // 2. Canvas Test
        const canvas = await frame.$('canvas');
        if (canvas) {
            console.log("🎨 Canvas found. Capturing snapshot...");
            const b64 = await canvas.evaluate((el: any) => el.toDataURL());
            console.log(`Canvas Base64 length: ${b64.length}`);
            console.log(`Canvas Base64 prefix: ${b64.substring(0, 50)}...`);

            // Try clicking a variant and capturing again
            const items = await frame.$$('.item');
            if (items.length > 2) {
                const target = items[2]; // Click 3rd item (e.g. different finish)
                const text = await target.evaluate(el => el.textContent?.trim());
                console.log(`👉 Clicking variant: ${text}`);
                await target.click();
                await new Promise(r => setTimeout(r, 2000)); // Wait for render

                const b64_2 = await canvas.evaluate((el: any) => el.toDataURL());
                console.log(`Canvas Base64 (After Click) length: ${b64_2.length}`);

                if (b64 === b64_2) console.warn("⚠️ Warning: Canvas data did not change after click!");
                else console.log("✅ Canvas updated successfully.");
            }
        } else {
            console.error("❌ No canvas found in iframe.");
        }

    } catch (e: any) {
        console.error("❌ Error:", e.message);
    } finally {
        await browser.close();
    }
}

run();
