// @ts-nocheck

import { ceAiService } from './src/modules/catalogEnricher/services/ceAiService';
import { analyzePage } from './src/modules/catalogEnricher/services/cePuppeteerService';

async function testCollectionsScan() {
    const url = 'https://fimacf.com/en/collezioni/bagno/';
    console.log(`Deep scanning ${url}...`);
    try {
        const { html, metadata } = await analyzePage(url);
        console.log(`Metadata Kind: ${metadata.page_kind}`);
        console.log(`Subcats in metadata: ${metadata.subcategory_urls_found?.length}`);

        const tree = await ceAiService.scanStructure('fimacf.com', html, false, url, metadata);
        console.log(`\n--- COLLECTIONS DISCOVERED BY AI ---`);
        const logNode = (n: any, depth: number = 0) => {
            console.log(`${' '.repeat(depth * 2)}- ${n.name} (${n.url})`);
            if (n.children) n.children.forEach((c: any) => logNode(c, depth + 1));
        };
        tree.forEach((n: any) => logNode(n));

    } catch (e) { console.error(e); }
}
testCollectionsScan();
