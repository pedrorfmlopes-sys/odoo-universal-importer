// @ts-nocheck

import { ceAiService } from './src/modules/catalogEnricher/services/ceAiService';
import { analyzePage } from './src/modules/catalogEnricher/services/cePuppeteerService';

async function verifyFimaStructure() {
    const url = 'https://fimacf.com/en/';
    console.log(`Analyzing ${url}...`);

    try {
        const { html, metadata } = await analyzePage(url);
        console.log(`Page Kind: ${metadata.page_kind}`);
        console.log(`Subcats Found: ${metadata.subcategory_urls_found?.length || 0}`);

        const tree = await ceAiService.scanStructure('fimacf.com', html, false, url);
        console.log('\n--- DETECTED TOP-LEVEL STRUCTURE ---');
        tree.forEach((n: any) => {
            console.log(`- ${n.name} (${n.url}) [${n.type}]`);
            if (n.children) n.children.forEach((c: any) => console.log(`  > ${c.name} (${c.url})`));
        });

    } catch (e: any) {
        console.error("Verification failed:", e.message);
    }
}

verifyFimaStructure();
