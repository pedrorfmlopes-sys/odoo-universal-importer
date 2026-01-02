
import puppeteer from 'puppeteer';

(async () => {
    console.log("🛠️ Launching Basic Puppeteer...");
    try {
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        console.log("✅ Browser Launched! PID:", browser.process()?.pid);

        const page = await browser.newPage();
        console.log("📄 Page Created. Navigating...");

        await page.goto('https://example.com');
        console.log("🌍 Navigated to Example.com");

        const title = await page.title();
        console.log("🏷️ Title:", title);

        await browser.close();
        console.log("🚪 Browser Closed.");
    } catch (e) {
        console.error("❌ Puppeteer Error:", e);
    }
})();
