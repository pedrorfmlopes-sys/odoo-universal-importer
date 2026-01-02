
const puppeteer = require('puppeteer');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const PRODUCT_URL = "https://www.ritmonio.it/en/bath-shower/product/?code=068075_RCMB027&family=68052";

// 1. Get Credentials
const dbPath = path.join(__dirname, 'data', 'importer.db');
if (!fs.existsSync(dbPath)) {
    console.error("❌ DB not found at " + dbPath);
    process.exit(1);
}
const db = new Database(dbPath, { readonly: true });
const cred = db.prepare("SELECT * FROM ce_credentials WHERE name = 'Ritmonio' LIMIT 1").get();

if (!cred) {
    console.error("❌ Ritual credential not found in DB.");
    process.exit(1);
}

const password = Buffer.from(cred.password_enc, 'base64').toString('utf-8');
console.log(`🔐 Credentials: ${cred.username} / [HIDDEN]`);

(async () => {
    console.log("🚀 Launching Browser...");
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        // LOGIN
        console.log(`➡️ Navigating to Login: ${cred.service_url}`);
        await page.goto(cred.service_url, { waitUntil: 'networkidle2' });
        await page.screenshot({ path: 'debug_1_login_page.png' });

        console.log("⌨️ Typing credentials...");
        const userInp = await page.$('input[type="text"], input[type="email"], #username, #email');
        if (userInp) await userInp.type(cred.username, { delay: 50 });
        else console.error("❌ User input not found!");

        const passInp = await page.$('input[type="password"]');
        if (passInp) await passInp.type(password, { delay: 50 });
        else console.error("❌ Password input not found!");

        const submitBtn = await page.$('button[type="submit"], input[type="submit"], .login-btn');
        if (submitBtn) {
            console.log("🖱️ Clicking Submit...");
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => console.log("⚠️ Nav timeout, continuing...")),
                submitBtn.click()
            ]);
        } else {
            console.error("❌ Submit button not found!");
        }

        await page.screenshot({ path: 'debug_2_after_login.png' });

        // PRODUCT PAGE
        console.log(`➡️ Navigating to Product: ${PRODUCT_URL}`);
        await page.goto(PRODUCT_URL, { waitUntil: 'networkidle2' });
        await page.screenshot({ path: 'debug_3_product_page.png' });

        // COOKIE BOT HANDLER
        console.log("🍪 Checking for Cookie Content...");
        try {
            const cookieBtn = await page.waitForSelector('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll', { timeout: 5000 });
            if (cookieBtn) {
                console.log("🍪 Clicking Accept All Cookies...");
                await cookieBtn.click();
                await new Promise(r => setTimeout(r, 2000)); // Wait for fade out
                await page.screenshot({ path: 'debug_3_cookies_accepted.png' });
            }
        } catch (e) {
            console.log("🍪 No cookie banner found or timed out (ignoring).");
        }

        // 3D CLICK LOGIC (Replicating Patch)
        console.log("🖱️ Attempting 3D Click...");
        const keywords = ["3D", "Tech", "Sheet", "Model"];

        for (const kw of keywords) {
            const count = await page.evaluate((k) => {
                const xpath = `//*[self::div or self::button or self::a or self::li or self::h5 or self::span][contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${k.toLowerCase()}')]`;
                const res = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                return res.snapshotLength;
            }, kw);

            if (count > 0) {
                console.log(`   Found ${count} candidates for "${kw}"`);
                await page.evaluate((k) => {
                    const xpath = `//*[self::div or self::button or self::a or self::li or self::h5 or self::span][contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${k.toLowerCase()}')]`;
                    const res = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                    // Click the first one (usually the tab)
                    const el = res.snapshotItem(0);
                    if (el) el.click();
                }, kw);
            }
        }

        console.log("⏱️ Waiting for content update...");
        await new Promise(r => setTimeout(r, 2000));
        await page.screenshot({ path: 'debug_4_after_click.png' });

        // DUMP HTML
        const html = await page.content();
        fs.writeFileSync('debug_auth_dump.html', html);
        console.log("✅ Dump saved to debug_auth_dump.html");

        // CHECK RESULTS
        const links = await page.evaluate(() => Array.from(document.querySelectorAll('a')).map(a => a.href));
        const files = links.filter(href => /\.(zip|step|stp|dwg|dxf|pdf)$/i.test(href));
        console.log(`\n=== EXTRACTED FILES (${files.length}) ===`);
        files.forEach(f => console.log(f));
        console.log("============================");

    } catch (e) {
        console.error("💥 Error:", e);
        await page.screenshot({ path: 'debug_crash.png' });
    } finally {
        await browser.close();
    }
})();
