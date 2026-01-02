
import { getCeDatabase } from './src/modules/catalogEnricher/db/ceDatabase';
import { cePuppeteerService, resolveSkuToUrl } from './src/modules/catalogEnricher/services/cePuppeteerService';
import { ceEnrichmentService } from './src/modules/catalogEnricher/services/ceEnrichmentService';
import path from 'path';

// Initialize DB
const dbPath = path.join(process.cwd(), 'data', 'importer.db');
process.env.CE_DB_PATH = dbPath;
getCeDatabase(); // Init DB

async function verify() {
    console.log("🚀 STARTING FULL FIMA VERIFICATION");

    // Test SKU known to have variants and documents
    const testSku = 'F6000/30BS';
    const profileId = 'a56b5943-953d-4879-9936-719cdf35ad29'; // Fima Profile ID

    try {

        // 1. URL Creation Verification
        console.log(`\n1️⃣ Resolving SKU: ${testSku}`);
        const url = await resolveSkuToUrl(profileId, testSku, { names: ['Portasalviette 30 cm'] });
        console.log(`   -> Resolved URL: ${url}`);

        if (!url || !url.includes('fimacf.com/prodotto/')) {
            console.error("❌ URL Creation FAILED or invalid format.");
            process.exit(1);
        }

        // 2. Full Enrichment (Images, Docs, Variants)
        console.log(`\n2️⃣ Enriching Product...`);
        // Mock Job ID 'verify-job'
        const enriched = await ceEnrichmentService.enrichProductFamily(url, 'verify-job', { downloadAssets: false });

        // 3. Image Verification
        console.log(`\n3️⃣ Image Verification`);
        console.log(`   -> Hero Image: ${enriched.heroImage}`);
        console.log(`   -> Gallery (${enriched.galleryImages?.length}):`, enriched.galleryImages);

        const hasArena = enriched.galleryImages?.some(img => img.includes('arenafurniture')) || enriched.heroImage?.includes('arenafurniture');
        if (hasArena) {
            console.log("   ✅ Arena Furniture Source detected.");
        } else {
            console.warn("   ⚠️ No Arena Furniture images found. Check fallback logic.");
        }

        // 4. Document Verification
        console.log(`\n4️⃣ Document Verification`);
        console.log(`   -> Named Files (${enriched.namedFiles?.length}):`);
        enriched.namedFiles?.forEach(f => console.log(`      - [${f.format}] ${f.name}: ${f.url}`));

        const hasPdf = enriched.namedFiles?.some(f => f.format === 'pdf' || f.format === 'pdf_link');
        const has3d = enriched.namedFiles?.some(f => f.format === '3d' || f.format === 'cad');

        if (hasPdf) console.log("   ✅ PDF detected.");
        else console.error("   ❌ No PDF found.");

        if (has3d) console.log("   ✅ 3D/CAD detected.");
        else console.warn("   ⚠️ No 3D/CAD found (might be expected for this SKU).");

        // 5. Variant Verification
        console.log(`\n5️⃣ Variant Verification`);
        console.log(`   -> Variants Found: ${enriched.variants?.length}`);
        enriched.variants?.forEach(v => {
            console.log(`      - ${v.dimension} (${v.sku_real || 'No SKU'})`);
        });

        if (enriched.variants && enriched.variants.length > 0) {
            console.log("   ✅ Variants extracted.");
        } else {
            console.warn("   ⚠️ No variants found. (Is this a simple product?)");
        }

    } catch (e) {
        console.error("❌ CRITICAL FAILURE:", e);
    } finally {
        console.log("\n🛑 DONE.");
        process.exit(0);
    }
}

verify();
