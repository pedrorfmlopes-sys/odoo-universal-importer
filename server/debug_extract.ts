// @ts-nocheck

import puppeteer from 'puppeteer';
import fs from 'fs';

const targetUrl = process.argv[2];

if (!targetUrl) {
    console.error("Usage: npx ts-node server/debug_extract.ts <URL>");
    process.exit(1);
}

(async () => {
    console.log(`🔍 Analyzing: ${targetUrl}`);
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    const analysis = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a')).map(a => ({
            tag: 'a',
            text: a.innerText.replace(/\s+/g, ' ').trim(),
            href: a.href,
            class: a.className,
            title: a.title,
            rel: a.rel
        }));

        const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
            tag: 'button',
            text: b.innerText.replace(/\s+/g, ' ').trim(),
            onclick: b.getAttribute('onclick'),
            class: b.className
        }));

        return { links, buttons };
    });

    const debugOutput = `
=== ANALYSIS FOR ${targetUrl} ===
Total Links: ${analysis.links.length}
Total Buttons: ${analysis.buttons.length}

--- POTENTIAL DOCUMENT LINKS ---
${analysis.links.filter(l => {
        const txt = (l.text + ' ' + l.title).toLowerCase();
        const href = (l.href || '').toLowerCase();
        return href.includes('.pdf') || txt.includes('download') || txt.includes('sheet') || txt.includes('scheda') || txt.includes('technical');
    }).map(l => JSON.stringify(l, null, 2)).join('\n')}

--- ALL LINKS (Sample first 20) ---
${analysis.links.slice(0, 20).map(l => JSON.stringify(l)).join('\n')}
    `;

    fs.writeFileSync('debug_page_dump.txt', debugOutput);
    console.log("✅ Dump saved to debug_page_dump.txt");
    await browser.close();
})();
