// @ts-nocheck

import { ceAiService } from './src/modules/catalogEnricher/services/ceAiService';
import { fetchPageContent } from './src/modules/catalogEnricher/services/cePuppeteerService';

async function debugFimaScan() {
    const url = 'https://fimacf.com/en/';
    const domain = 'fimacf.com';

    console.log(`[DEBUG] Fetching content for ${url}...`);
    try {
        const html = await fetchPageContent(url);
        console.log(`[DEBUG] Content fetched (${html.length} chars). Running AI Scan (ROOT)...`);

        // Test 1: Standard Scan
        const tree1 = await ceAiService.scanStructure(domain, html, false, url);
        console.log(`\n--- TEST 1: STANDARD SCAN ---`);
        console.log(`Found ${tree1.length} top-level nodes.`);
        tree1.forEach((n: any) => {
            console.log(`- ${n.name} (${n.url}) [${n.type}]`);
        });

        // Check for specific branches the user mentioned
        const hasColl = tree1.some(n => n.name.toLowerCase().includes('collection') || n.name.toLowerCase().includes('collezione'));
        const hasTip = tree1.some(n => n.name.toLowerCase().includes('tipologia') || n.name.toLowerCase().includes('typology'));

        console.log(`\nBranch "Collections": ${hasColl ? 'YES' : 'NO'}`);
        console.log(`Branch "Typologies": ${hasTip ? 'YES' : 'NO'}`);

        if (!hasTip) {
            console.log("\n[DEBUG] TYPOLOGY BRANCH MISSING. Let's look at the raw heuristic categorization patterns in the AI grounding data.");
            // Re-trigger callAiScan with logging if needed (would need to modify service or use a hack)
        }

    } catch (e: any) {
        console.error("Debug Scan Failed:", e.message);
    }
}

debugFimaScan();
