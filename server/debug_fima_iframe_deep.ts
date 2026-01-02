// @ts-nocheck

import { initPuppeteerService } from './src/modules/catalogEnricher/services/cePuppeteerService';
import puppeteer from 'puppeteer';

// Mock Socket
const mockIo = { emit: () => { } };

async function run() {
    console.log("🚀 Analyzing Fima Iframe Structure...");
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

        console.log("✅ Iframe found. Analyzing content...");

        // 1. Dump all ".item" candidates
        const items = await frame.$$eval('.item', els => els.map(el => ({
            text: el.textContent?.trim(),
            classes: el.className,
            parentClass: el.parentElement?.className,
            hasImg: !!el.querySelector('img'),
            imgSrc: el.querySelector('img')?.src
        })));
        console.log(`\nFound ${items.length} '.item' elements:`);
        console.table(items.slice(0, 20)); // Show top 20

        // 2. Dump specific variant containers if any
        const variantList = await frame.$$eval('.finiture .item, .finishes .item, .variants .item', els => els.map(el => el.textContent?.trim()));
        console.log(`\nPotential Specific Variant List:`, variantList);

        // 3. Search for SKU/Code
        const potentialCodes = await frame.$$eval('*', els => {
            return els
                .filter(el => el.className && (el.className.includes('code') || el.className.includes('sku') || el.className.includes('codice')))
                .map(el => ({ tag: el.tagName, class: el.className, text: el.textContent?.trim() }));
        });
        console.log(`\nPotential Code Elements:`);
        console.table(potentialCodes);

        // 4. Check for related products inside iframe (User suspicion)
        const related = await frame.$$eval('.related, .approfondimenti', els => els.map(e => e.className));
        console.log(`\nRelated sections in iframe:`, related);

    } catch (e: any) {
        console.error("❌ Error:", e.message);
    } finally {
        await browser.close();
    }
}

run();
