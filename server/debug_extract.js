
const puppeteer = require('puppeteer');
const fs = require('fs');

const targetUrl = process.argv[2];

if (!targetUrl) {
    console.error("Usage: node server/debug_extract.js <URL>");
    process.exit(1);
}

(async () => {
    console.log(`🔍 Analyzing: ${targetUrl}`);
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    const analysis = await page.evaluate(() => {
        // Helper to get all text nodes
        const elements = document.body.querySelectorAll('*');
        const matches = [];

        elements.forEach(el => {
            const txt = (el.innerText || '').trim();
            const cls = (el.className || '').toString();

            // Check for "3D"
            if (txt.toUpperCase().includes('3D') || cls.toUpperCase().includes('3D')) {
                // Ignore big containers
                if (el.tagName === 'BODY' || el.tagName === 'HTML' || el.tagName === 'MAIN' || el.tagName === 'DIV' && el.innerHTML.length > 500) return;

                matches.push({
                    tag: el.tagName,
                    text: txt.substring(0, 50),
                    class: cls,
                    href: (el.tagName === 'A') ? el.href : null,
                    onclick: el.getAttribute('onclick'),
                    role: el.getAttribute('role') || el.getAttribute('type')
                });
            }
        });

        // Also dump "DOWNLOAD" links again just to be sure
        const downloads = Array.from(document.querySelectorAll('a')).filter(a => a.href.includes('download')).map(a => a.href);

        return { matches, downloads };
    });

    const debugOutput = `
=== 3D ANALYSIS FOR ${targetUrl} ===
Potential 3D Triggers found: ${analysis.matches.length}

${analysis.matches.map(m => JSON.stringify(m, null, 2)).join('\n')}

--- KNOWN DOWNLOAD LINKS ---
${analysis.downloads.join('\n')}
    `;

    fs.writeFileSync('debug_3d_dump.txt', debugOutput);
    console.log("✅ Dump saved to debug_3d_dump.txt");
    await browser.close();
})();
