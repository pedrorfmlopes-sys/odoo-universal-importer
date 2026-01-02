
import { ceEnrichmentService } from './server/src/modules/catalogEnricher/services/ceEnrichmentService';

async function testEnrichment() {
    // High-confidence URL from Google Search (Redirect)
    const url = 'https://fimacf.com/it/prodotto/f3061-rubinetto-arresto/';
    // I am guessing the final URL based on the snippet "rubinetto arresto" for F3061, 
    // but to be safe I will use the redirect link if I can copy it, 
    // OR just try the "clean" guess first which is often safer than a long token URL that might expire.

    // Let's try to construct a very clean URL first, based on patterns.
    // F3061 is "Rubinetto arresto".
    // https://fimacf.com/it/prodotto/f3061-rubinetto-arresto/

    // Actually, let's use the one that definitely exists:
    // "F3111/1" search failed.
    // Let's try searching for "F3061/2" which was also found.

    // Plan B: Use the Search Page again but with a broader selector I found in the HTML dump.
    // In the HTML dump, I saw NO results.

    // Plan C: Hardcode the Google Redirect URL directly. Puppeteer handles it.
    const googleRedirect = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGwVrM2UxdWrT2iudTdcWxyEyoiYicZzlGUORxYEweZCiGecjA6nW2ZJR74PPqKF4UgqqqbGXRyKT9xG0ci8e8MtTewd9ZAeBjB2LZiVTMtV5-vZWqNaTbOWBv79i7yCB0wBsMuu6ExHgO7JJ7fDg==';

    console.log(`🧪 Testing Fima Enrichment via Redirect: ${googleRedirect}`);

    try {
        const result = await ceEnrichmentService.enrichProductFamily(googleRedirect, 'debug-job-123', { downloadAssets: true });
        console.log("✅ Results:");
        console.log(JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("❌ Error:", e);
    }
}

testEnrichment().then(() => process.exit(0));
