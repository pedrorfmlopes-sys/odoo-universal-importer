
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
    console.log("🚀 Launching Browser (Interactive Flow)...");
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        console.log(`➡️ Navigating to Product: ${PRODUCT_URL}`);
        await page.goto(PRODUCT_URL, { waitUntil: 'networkidle2' });
        await page.screenshot({ path: 'interactive_1_product.png' });

        // COOKIE BOT
        try {
            const cookieBtn = await page.waitForSelector('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll', { timeout: 4000 });
            if (cookieBtn) {
                console.log("🍪 Clicking Accept All Cookies...");
                await cookieBtn.click();
                await new Promise(r => setTimeout(r, 2000));
            }
        } catch (e) {
            console.log("🍪 No cookie banner found.");
        }

        // CLICK 3D - EXPECT LOGIN REQUEST
        console.log("🖱️ Clicking 3D Button...");
        const keywords = ["3D", "Tech", "Sheet", "Model"];
        let clicked = false;

        for (const kw of keywords) {
            const result = await page.evaluate((k) => {
                const xpath = `//*[self::div or self::button or self::a or self::li or self::h5 or self::span][contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${k.toLowerCase()}')]`;
                const res = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                if (res.snapshotLength > 0) {
                    res.snapshotItem(0).click();
                    return true;
                }
                return false;
            }, kw);
            if (result) {
                clicked = true;
                console.log(`✅ Clicked "${kw}"`);
                break;
            }
        }

        if (!clicked) {
            console.error("❌ 3D Button not found!");
        }

        console.log("⏱️ Waiting for response (Login Redirect?)...");
        await new Promise(r => setTimeout(r, 3000));
        await page.screenshot({ path: 'interactive_2_after_click.png' });
        console.log("Current URL:", page.url());

        // CHECK IF REDIRECTED TO LOGIN
        if (page.url().includes('login') || (await page.$('input[type="password"]'))) {
            console.log("🔐 Detected Login Page. Logging in...");

            const userInp = await page.$('input[type="text"], input[type="email"], #username, #email');
            if (userInp) await userInp.type(cred.username, { delay: 50 });

            const passInp = await page.$('input[type="password"]');
            if (passInp) await passInp.type(password, { delay: 50 });

            const submitBtn = await page.$('button[type="submit"], input[type="submit"], .login-btn');
            if (submitBtn) {
                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(e => console.log("Nav timeout")),
                    submitBtn.click()
                ]);
            }
            console.log("✅ Login submitted.");
            await page.screenshot({ path: 'interactive_3_after_login.png' });
            console.log("Current URL:", page.url());

            // CLICK 3D AGAIN (Round 2)
            console.log("🖱️ Clicking 3D Button AGAIN (Post-Login)...");
            for (const kw of keywords) {
                const result = await page.evaluate((k) => {
                    const xpath = `//*[self::div or self::button or self::a or self::li or self::h5 or self::span][contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${k.toLowerCase()}')]`;
                    const res = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                    if (res.snapshotLength > 0) {
                        res.snapshotItem(0).click();
                        return true;
                    }
                    return false;
                }, kw);
                if (result) {
                    console.log(`✅ Clicked "${kw}" (Round 2)`);
                    break;
                }
            }
            await new Promise(r => setTimeout(r, 4000));
            await page.screenshot({ path: 'interactive_4_after_second_click.png' });
        }

        // NOW WE SHOULD BE BACK OR ABLE TO DOWNLOAD
        // Check for 3D button again or file links
        console.log("🕵️ Checking for files...");
        const html = await page.content();
        const links = await page.evaluate(() => Array.from(document.querySelectorAll('a')).map(a => a.href));
        const files = links.filter(href => /\.(zip|step|stp|dwg|dxf)$/i.test(href));

        console.log(`\n=== EXTRACTED FILES (${files.length}) ===`);
        files.forEach(f => console.log(f));
        console.log("============================");

        fs.writeFileSync('debug_interactive_dump.html', html);

    } catch (e) {
        console.error("💥 Error:", e);
        await page.screenshot({ path: 'interactive_crash.png' });
    } finally {
        await browser.close();
    }
})();
