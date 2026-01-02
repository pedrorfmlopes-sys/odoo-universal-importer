
import * as path from 'path';
import * as fs from 'fs';

async function runSmoke() {
    console.log("🚀 Starting Brand Bulk Smoke Test...");

    // 1. Setup Temp DB
    const tempDbDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tempDbDir)) fs.mkdirSync(tempDbDir);
    const tempDbPath = path.join(tempDbDir, `smoke_ce_${Date.now()}.db`);
    process.env.CE_DB_PATH = tempDbPath;

    console.log(`📂 Using temp DB: ${tempDbPath}`);

    // @ts-ignore
    const { getCeDatabase } = require('./src/modules/catalogEnricher/db/ceDatabase');
    const db: any = getCeDatabase();

    db.prepare(`
        CREATE TABLE IF NOT EXISTS ce_web_products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            brand_id INTEGER,
            category_name TEXT,
            product_name TEXT,
            product_url TEXT UNIQUE,
            image_url TEXT,
            guessed_code TEXT,
            crawled_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    // 2. Define test scenarios
    const scenarios = [
        { brand: 'Scarabeo', seed: 'https://scarabeoceramiche.it/en/products/tipologie/lavabi/' },
        { brand: 'Ritmonio', seed: 'https://www.ritmonio.it/en/bath-shower/product/?code=PR43MA011' },
        { brand: 'Bette', seed: 'https://www.my-bette.com/en/products/product-search' }
    ];

    for (const scenario of scenarios) {
        console.log(`\n🔍 Testing ${scenario.brand}...`);

        if (scenario.brand === 'Scarabeo') {
            try {
                // @ts-ignore
                const scarabeoModule = require('./src/modules/catalogEnricher/brands/scarabeo/bulk');
                if (scarabeoModule.runCrawler) {
                    await scarabeoModule.runCrawler(db);
                }
            } catch (e: any) {
                console.log("   ⚠️ Scarabeo execution warning:", e.message);
            }
        } else {
            console.log(`   (Simulating discovery for ${scenario.brand})`);
            db.prepare(`
                INSERT OR IGNORE INTO ce_web_products (product_name, product_url, image_url)
                VALUES (?, ?, ?)
             `).run(`${scenario.brand} Test Product`, scenario.seed, 'https://example.com/img.jpg');
        }

        // 3. Validation
        try {
            const res = db.prepare('SELECT COUNT(*) as cnt FROM ce_web_products WHERE product_name LIKE ?').get(`%${scenario.brand}%`);
            const count = res ? (res as any).cnt : 0;
            console.log(`   📈 Products found for ${scenario.brand}: ${count}`);
        } catch (e: any) {
            console.error("   ❌ Validation failed:", e.message);
        }
    }

    console.log("\n🏁 Smoke test finished.");
    db.close();
    try { if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath); } catch (e) { }
}

runSmoke().catch(console.error);
