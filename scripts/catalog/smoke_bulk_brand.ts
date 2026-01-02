
import * as path from 'path';
import * as fs from 'fs';

async function runSmoke() {
    console.log("🚀 Starting Production-Grade Brand Bulk Smoke Test (Hotfix v3)...");

    const rootDir = process.cwd();
    const tempDbDir = path.join(rootDir, 'tmp');
    if (!fs.existsSync(tempDbDir)) fs.mkdirSync(tempDbDir);
    const tempDbPath = path.join(tempDbDir, `smoke_ce_v3_${Date.now()}.db`);
    process.env.CE_DB_PATH = tempDbPath;

    // Load Modules
    const dbModulePath = path.join(rootDir, 'src', 'modules', 'catalogEnricher', 'db', 'ceDatabase');
    const enrichmentPath = path.join(rootDir, 'src', 'modules', 'catalogEnricher', 'services', 'ceEnrichmentService');
    const scarabeoBulkPath = path.join(rootDir, 'src', 'modules', 'catalogEnricher', 'brands', 'scarabeo', 'bulk');

    // @ts-ignore
    const { getCeDatabase } = require(dbModulePath);
    // @ts-ignore
    const { ceEnrichmentService } = require(enrichmentPath);
    // @ts-ignore
    const { runCrawler: runScarabeoCrawler } = require(scarabeoBulkPath);

    const db: any = getCeDatabase();

    // Support --brand argument
    const args = process.argv.slice(2);
    const brandArgIdx = args.indexOf('--brand');
    const brandArg = (brandArgIdx > -1 && args[brandArgIdx + 1]) ? args[brandArgIdx + 1].toLowerCase() : null;

    const allBrands = ['ritmonio', 'scarabeo', 'bette'];
    const brandsToTest = brandArg ? [brandArg] : allBrands;
    const results: any[] = [];

    for (const brand of brandsToTest) {
        const samplePath = path.join(rootDir, 'src', 'modules', 'catalogEnricher', 'brands', brand, 'golden_samples.json');
        if (!fs.existsSync(samplePath)) {
            console.warn(`⚠️ No golden samples for ${brand}`);
            continue;
        }

        const sample = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
        console.log(`\n🔍 Validating ${sample.brand}...`);

        // 1. Bulk/Crawl Test (Scarabeo only in this script for brevity, but could run others)
        if (brand === 'scarabeo') {
            console.log(`   🕸️ Running Bulk Crawler for ${brand}...`);
            await runScarabeoCrawler(db);
        }

        // 2. Enrichment Test (Golden Variant URL)
        console.log(`   💎 Enriching Golden URL: ${sample.golden_variant_product_url}`);
        const result = await ceEnrichmentService.enrichProductFamily(sample.golden_variant_product_url);

        if (result) {
            // Save to DB
            db.prepare(`
                INSERT OR REPLACE INTO ce_web_products 
                (product_name, product_url, image_url, guessed_code, variants_json, file_urls_json, associated_products_json, features_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                result.name || sample.brand,
                sample.golden_variant_product_url,
                result.heroImage || '',
                result.itemReference || '',
                JSON.stringify(result.variants || []),
                JSON.stringify(result.pdfUrls || []),
                result.associated_products_json || '[]',
                result.features_json || '[]'
            );

            // Deep Validation
            const row = db.prepare(`SELECT * FROM ce_web_products WHERE product_url = ?`).get(sample.golden_variant_product_url);

            const variants = JSON.parse(row.variants_json || '[]');
            const assoc = JSON.parse(row.associated_products_json || '[]');
            const files = JSON.parse(row.file_urls_json || '[]');

            const vCount = Math.max(variants.length, assoc.length);
            const hasVariants = vCount >= sample.min_variants;
            const hasFiles = sample.require_pdf ? (files.length > 0 || row.pdfUrls?.length > 0) : true;
            const hasImage = !!row.image_url;
            // Check SKU in variants
            const hasSKU = variants.length > 0 ? variants.some((v: any) => v.sku_real || v.sku || v.article || v.code) : true;
            const hasFinalCode = hasSKU || !!row.guessed_code;

            const pass = hasVariants && hasFiles && hasImage && hasFinalCode;

            console.log(`   ✅ Extracted: ${row.product_name}`);
            console.log(`      - Variants: ${vCount} (Min: ${sample.min_variants}) -> ${hasVariants ? 'OK' : 'FAIL'}`);
            console.log(`      - Files: ${files.length} (Req: ${sample.require_pdf}) -> ${hasFiles ? 'OK' : 'FAIL'}`);
            console.log(`      - Image: ${hasImage ? 'OK' : 'FAIL'}`);
            console.log(`      - Final Code/SKU: ${hasFinalCode ? 'OK' : 'FAIL'}`);

            results.push({ brand, pass, vCount, fCount: files.length, dbPath: tempDbPath });
        } else {
            console.log(`   ❌ Enrichment failed for ${sample.brand}`);
            results.push({ brand, pass: false, dbPath: tempDbPath });
        }
    }

    console.log("\n🏁 Results Summary:");
    console.table(results);
    console.log(`\n👉 DB_PATH=${tempDbPath}`);
}

runSmoke().catch(console.error);
