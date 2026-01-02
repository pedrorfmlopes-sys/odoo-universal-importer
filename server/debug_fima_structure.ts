// @ts-nocheck

import puppeteer from 'puppeteer';

(async () => {
    const url = 'https://fimacf.com/prodotto/f3051wlx8-miscelatore-lavabo-a-parete/';
    console.log(`🕵️‍♀️ Analyzing DOM Structure for: ${url}`);

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        const structure = await page.evaluate(() => {
            const data: any = {};

            // 1. Locate Main Elements
            const h1 = document.querySelector('h1');
            data.h1 = h1 ? h1.textContent?.trim() : 'NOT_FOUND';

            const galleryFirst = document.querySelector('img.gallery-image, .woocommerce-product-gallery__image img');
            data.galleryFirst = galleryFirst ? (galleryFirst as HTMLImageElement).src : 'NOT_FOUND';

            const desc = document.querySelector('.product-desc, #tab-description');
            data.desc = desc ? desc.textContent?.substring(0, 50) : 'NOT_FOUND';

            // 2. Locate Cut-off Elements
            const allHeaders = Array.from(document.querySelectorAll('h2, h3, h4, .title, .related-title'));
            const cutOffCandidates = allHeaders.filter(el => {
                const txt = el.textContent?.trim().toUpperCase() || '';
                return txt === 'PRODOTTI CORRELATI' || txt === 'RELATED PRODUCTS';
            });

            data.cutOffCount = cutOffCandidates.length;
            data.cutOffs = cutOffCandidates.map(el => ({
                tag: el.tagName,
                text: el.textContent?.trim(),
                class: el.className,
                // Check position relative to H1
                isAfterH1: h1 ? (h1.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) > 0 : null,
                // Check position relative to Gallery
                isBeforeGallery: galleryFirst ? (el.compareDocumentPosition(galleryFirst) & Node.DOCUMENT_POSITION_FOLLOWING) > 0 : null
            }));

            // 3. Simulate Logic
            if (cutOffCandidates.length > 0) {
                const effectiveCutOff = cutOffCandidates[0];
                data.effectiveCutOff = effectiveCutOff.textContent;

                // Is Gallery Safe?
                const gallerySafe = galleryFirst && (!(effectiveCutOff.compareDocumentPosition(galleryFirst) & Node.DOCUMENT_POSITION_FOLLOWING));
                data.simulation = {
                    canSeeGallery: gallerySafe,
                    canSeeDesc: desc && (!(effectiveCutOff.compareDocumentPosition(desc) & Node.DOCUMENT_POSITION_FOLLOWING))
                };
            }

            return data;
        });

        console.log("--- DOM STRUCTURE ANALYSIS ---");
        console.log(JSON.stringify(structure, null, 2));

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await browser.close();
    }
})();
