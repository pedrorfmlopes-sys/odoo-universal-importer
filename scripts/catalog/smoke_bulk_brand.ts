
// v1.0.1 - Final Proof
import * as path from 'path';
import * as fs from 'fs';

async function runSmoke() {
    console.log("🚀 Starting Brand Bulk Smoke Test (Final Check v1.0.1)...");

    const rootDir = process.cwd();
    const tempDbPath = path.join(rootDir, 'tmp', `final_proof_ce.db`);
    if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
    process.env.CE_DB_PATH = tempDbPath;

    const dbPath = path.join(rootDir, 'src', 'modules', 'catalogEnricher', 'db', 'ceDatabase');
    const enrichmentPath = path.join(rootDir, 'src', 'modules', 'catalogEnricher', 'services', 'ceEnrichmentService');

    const { getCeDatabase } = require(dbPath);
    const { ceEnrichmentService } = require(enrichmentPath);

    const db: any = getCeDatabase();

    const scenarios = [
        { brand: 'Ritmonio', url: 'https://www.ritmonio.it/it/bagno-doccia/prodotto/?code=PR43MA011' },
        { brand: 'Scarabeo', url: 'https://scarabeoceramiche.it/categoria-prodotto/bagno/lavabi/' },
        { brand: 'Bette', url: 'https://www.my-bette.com/en/products/built-in-bathtubs/bette-starlet' }
    ];

    for (const scenario of scenarios) {
        console.log(`\n🔍 Working on ${scenario.brand}: ${scenario.url}`);
        try {
            const result = await ceEnrichmentService.enrichProductFamily(scenario.url);
            if (result) {
                console.log(`   ✅ Extracted: ${result.name}`);
                const vcount = result.associated_products_json ? JSON.parse(result.associated_products_json).length :
                    (result.variants ? result.variants.length : 0);
                const fcount = result.pdfUrls ? result.pdfUrls.length : 0;
                console.log(`   📊 Stats: Variants=${vcount}, Files=${fcount}`);
                db.prepare(`
                    INSERT INTO ce_web_products 
                    (product_name, product_url, image_url, guessed_code, variants_json, file_urls_json, associated_products_json, features_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    result.name || scenario.brand, scenario.url, result.heroImage || '', result.itemReference || '',
                    JSON.stringify(result.variants || []), JSON.stringify(result.pdfUrls || []),
                    result.associated_products_json || '[]', result.features_json || '[]'
                );
            }
        } catch (e: any) { console.error(`   ❌ Failed:`, e.message); }
    }

    console.log("\n--- FINAL PROOF FOR PRODUCTION ---");
    const products = db.prepare(`
        SELECT product_name as Name, 
               length(variants_json) as vlen, 
               length(file_urls_json) as flen, 
               length(associated_products_json) as alen
        FROM ce_web_products
    `).all();
    console.table(products);
    db.close();
}

runSmoke().catch(console.error);
