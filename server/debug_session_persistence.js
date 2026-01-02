
const puppeteer = require('puppeteer');
const Database = require('better-sqlite3');
const path = require('path');

// Mock helpers
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function run() {
    console.log("🧪 Starting Session Persistence Test...");

    // 1. Get Credentials
    const dbPath = path.join(__dirname, 'data', 'importer.db');
    const db = new Database(dbPath);
    const profile = db.prepare("SELECT * FROM ce_brand_profiles WHERE name LIKE '%Ritmonio%'").get();

    // Manual Creds Override for test if needed, or fetch from DB
    // Assuming we have the creds back or can use the ID
    const credId = profile.credential_id;
    const cred = db.prepare("SELECT * FROM ce_credentials WHERE id = ?").get(credId);

    // Restore Service URL if NULL (from previous step)
    if (!cred.service_url) {
        console.log("🛠️ Restoring Service URL for test...");
        // Use a known login URL for Ritmonio
        cred.service_url = "https://www.ritmonio.it/en/user/login";
    }

    // 2. Launch Browser (Persistent Context)
    const browser = await puppeteer.launch({
        headless: false, // Visual debug
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        // --- STEP 1: INITIAL LOGIN ---
        console.log("\n--- STEP 1: INITIAL LOGIN ---");
        const page1 = await browser.newPage();
        await page1.setViewport({ width: 1280, height: 800 });

        console.log(`Navigating to Login: ${cred.service_url}`);
        await page1.goto(cred.service_url, { waitUntil: 'networkidle2' });

        // Handle Cookiebot?
        try {
            const cookieBtn = await page1.waitForSelector('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll', { timeout: 5000 });
            if (cookieBtn) {
                console.log("🍪 Accepting Cookies...");
                await cookieBtn.click();
                await sleep(1000);
            }
        } catch (e) { }

        // Perform Login
        console.log("Typing credentials...");
        await page1.type('#username', JSON.parse(Buffer.from(cred.username, 'base64').toString()));
        await page1.type('input[type="password"]', JSON.parse(Buffer.from(cred.password_enc, 'base64').toString()));

        const submit = await page1.$('button[name="login"]');
        if (submit) {
            await Promise.all([
                page1.waitForNavigation({ waitUntil: 'networkidle2' }),
                submit.click()
            ]);
            console.log("✅ Logged in (Navigation Complete)");
        }

        // Verify Login
        const content1 = await page1.content();
        if (content1.includes('Logout') || content1.includes('user/logout')) {
            console.log("✅ Verified: Session Active on Page 1");
        } else {
            console.warn("⚠️ Warning: Could not verify login on Page 1");
        }

        // Close Page 1 (Simulate end of 'Setup' or first scraping)
        await page1.close();
        console.log("Closed Page 1.");

        // --- STEP 2: OPEN NEW TAB (PERSISTENCE CHECK) ---
        console.log("\n--- STEP 2: NEW TAB (PERSISTENCE CHECK) ---");
        const page2 = await browser.newPage();
        const PRODUCT_URL = "https://www.ritmonio.it/en/bath-shower/product/?code=068075_RCMB027&family=68052";

        console.log(`Navigating directly to Product: ${PRODUCT_URL}`);
        await page2.goto(PRODUCT_URL, { waitUntil: 'networkidle2' });

        // Check for 3D Download Link immediatley
        const content2 = await page2.content();
        // Look for the download link pattern
        if (content2.includes('download/?code=')) {
            console.log("✅ SUCCESS: Found download link on Page 2 (Session Persisted!)");

            // Check if it's the 3D model specific one?
            // Or check if we can click it without modal?
            const isRestricted = await page2.evaluate(() => {
                // Check if clicking it triggers a modal? 
                // Hard to test without clicking.
                // Let's just check if we see "Login" buttons implying we are logged out.
                return !!document.querySelector('a[href*="login"]');
            });

            if (!isRestricted) { // If no login link, we are effectively logged in?
                // Checks usually 'logout' link presence
                const hasLogout = await page2.evaluate(() => !!document.querySelector('a[href*="logout"]'));
                if (hasLogout) console.log("✅ Verified: Page 2 has 'Logout' link.");
                else console.log("⚠️ Page 2 does NOT have 'Logout' link (might be hidden in menu).");
            }
        } else {
            console.warn("❌ FAILURE: Download link missing or page content empty.");
            // Dump content for analysis
            require('fs').writeFileSync('debug_session_fail.html', content2);
        }

        await page2.close();

    } catch (e) {
        console.error("💥 Error:", e);
    } finally {
        await browser.close();
    }
}

run();
