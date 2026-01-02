
import { ceEnrichmentService } from './server/src/modules/catalogEnricher/services/ceEnrichmentService';
import * as cheerio from 'cheerio';
import axios from 'axios';

async function test() {
    const url = "https://www.ritmonio.it/en/bath-shower/product/?code=057987_PR50EC204%2BPM0020L&family=57984";
    console.log(`Testing URL: ${url}`);

    try {
        const res = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = res.data;

        // Use the actual service logic
        const result = await ceEnrichmentService.enrichProductFamily(url, html);
        console.log("Result:", JSON.stringify(result, null, 2));

    } catch (e) {
        console.error("Test failed with error:", e);
    }
}

test();
