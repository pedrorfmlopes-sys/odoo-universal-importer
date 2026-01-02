const puppeteer = require('./server/node_modules/puppeteer');
const fs = require('fs');

(async () => {
    console.log("🚀 Starting Final Fima Verification...");
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        const url = 'https://fimacf.com/collezioni/bagno/';
        console.log(`📡 Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Use evaluate to avoid selector/obscuring issues
        const result = await page.evaluate(async () => {
            const wait = (ms) => new Promise(r => setTimeout(r, ms));

            // 1. Accept Cookies
            const buttons = Array.from(document.querySelectorAll('button, a'));
            const accept = buttons.find(b => b.innerText.toLowerCase().includes('accetta') || b.innerText.toLowerCase().includes('accept'));
            if (accept) {
                accept.click();
                await wait(2000);
            }

            // 2. Initial Count
            const initial = document.querySelectorAll('.product').length;

            // 3. Find and Click Load More
            const selectors = ['.js-show-more', '.lmp_button', '.wp-block-button__link'];
            let loadMoreFound = false;
            for (const sel of selectors) {
                const btn = document.querySelector(sel);
                if (btn && btn.offsetParent !== null) {
                    btn.click();
                    loadMoreFound = true;
                    break;
                }
            }

            if (!loadMoreFound) {
                // Try keyword
                const lmBtn = Array.from(document.querySelectorAll('button, a')).find(b => b.innerText.toLowerCase().includes('more') || b.innerText.toLowerCase().includes('carica'));
                if (lmBtn) {
                    lmBtn.click();
                    loadMoreFound = true;
                }
            }

            if (loadMoreFound) {
                await wait(6000); // Wait for results
            }

            const final = document.querySelectorAll('.product').length;
            return { initial, final, loadMoreFound };
        });

        console.log('Results:', result);

        if (result.final > result.initial) {
            console.log("✅ VERIFIED: Found " + result.final + " items. Expansion SUCCESS!");
        } else if (result.loadMoreFound) {
            console.log("❌ FAILED: Button clicked but count didn't increase.");
            await page.screenshot({ path: 'verify_fima_failed_increase.png' });
        } else {
            console.log("❌ FAILED: Load More button not found.");
            await page.screenshot({ path: 'verify_fima_no_button_final.png' });
        }

    } catch (e) {
        console.error("❌ Error during verification:", e.message);
    } finally {
        await browser.close();
        console.log("🏁 Done.");
    }
})();
