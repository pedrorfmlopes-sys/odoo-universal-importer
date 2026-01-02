// @ts-nocheck
import axios from 'axios';
import { load } from 'cheerio';
import { getCeDatabase } from '../db/ceDatabase';

interface AiExtractionRule {
    field: string;
    selector?: string; // CSS selector
    regex?: string;
    type: 'text' | 'image' | 'link' | 'attribute';
    attributeName?: string;
}

interface SiteProfile {
    domain: string;
    rules: AiExtractionRule[];
    mode: 'cheerio' | 'playwright';
}

// Cache for last scan per domain (MVP specific)
const structureCache = new Map<string, any[]>();

export const ceAiService = {
    // Lookup for Bulk Extractor
    getCachedNodeKind(domain: string, url: string): string | null {
        // 1. Memory Cache
        const tree = structureCache.get(domain);
        let foundKind: string | null = null;

        if (tree) {
            const traverse = (nodes: any[]) => {
                for (const node of nodes) {
                    if (node.url === url && node.node_kind) {
                        foundKind = node.node_kind;
                        return;
                    }
                    if (node.children) traverse(node.children);
                    if (foundKind) return;
                }
            };
            traverse(tree);
        }

        if (foundKind) return foundKind;

        // 2. Database Fallback (Resilience)
        try {
            const db = getCeDatabase();
            const product = db.prepare('SELECT id FROM ce_web_products WHERE product_url = ?').get(url);
            if (product) return 'product';

        } catch (e) {
            // Ignore DB errors
        }

        return null;
    },

    // Core function: Learn from sample HTML to generate a profile
    async learnProfile(domain: string, htmlSample: string): Promise<SiteProfile> {
        // Load Config
        const { getOdooConfig } = await import('../../../config/odooConfigStore');
        const config = await getOdooConfig();

        const apiKey = config?.aiApiKey || process.env.CE_OPENAI_API_KEY;
        const provider = config?.aiProvider || 'openai';
        const model = config?.aiModel || process.env.CE_OPENAI_MODEL || 'gpt-4o'; // Prefer 4o

        // 1. Safe Fallback: If no key, run Heuristics (Deterministic Mock)
        if (!apiKey && provider !== 'ollama') {
            console.log('[AI Service] No API Key found. Using heuristic fallback.');
            return this.heuristicLearn(domain, htmlSample);
        }

        // 2. Real AI Call
        try {
            // Compress HTML
            const cleanHtml = this.cleanHtmlForAi(htmlSample);
            const systemPrompt = `
                You are an expert Web Scraper and Data Analyst.
                Analyze the provided HTML snippet from a product catalog page.
                Identify patterns to extract:
1. Product Name(h1, title)
2. Product Reference / SKU(often near title, labeled REF, SKU, or Art.No.)
3. Main Image URL(img tag, often large, inside a gallery container)
4. Datasheet / PDF Link(a href ending in .pdf)
                
                For each field, return a CSS Selector and / or Regex.
                Output JSON format: { "rules": [{ "field": "name", "selector": "...", "type": "text" }, ... ] }
`;

            let content = '';

            if (provider === 'openai') {
                const response = await axios.post(
                    'https://api.openai.com/v1/chat/completions',
                    {
                        model: model, // e.g. gpt-4o, gpt-3.5-turbo
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: `Domain: ${domain} \nHTML: \n${cleanHtml} ` }
                        ],
                        response_format: { type: "json_object" },
                        temperature: 0
                    },
                    {
                        headers: { 'Authorization': `Bearer ${apiKey} ` }
                    }
                );
                content = response.data.choices[0].message.content;

            } else if (provider === 'ollama') {
                /*
         - [x] Bug Fix: Resolve 22 IDE Errors in Problems tab <!-- id: 13 -->
- [/] Bug Fix: Bulk Frontend Cleanup (Accessibility & Styles) <!-- id: 14 -->
    - [x] Resolve errors in `CeProductSheet.tsx`.
    - [x] Resolve errors in `CeCatalogPage.tsx`.
    - [x] Resolve errors in `CeDossiersPage.tsx`.
    - [x] Resolve errors in `CeTeacherTab.tsx`.
    - [x] Resolve errors in `ConnectionPage.tsx`.
    - [x] Resolve errors in `CeJobMonitor.tsx`.
    - [x] Resolve errors in `CeRobotActiveJobs.tsx`.
    - [x] Address Tailwind warnings in `index.css`.
- [/] Resilience & Recipe Mode Implementation <!-- id: 9 -->
                */
                // Basic Ollama implementation pattern
                const response = await axios.post(
                    // Default local ollama, or configurable? Assume default port for now
                    'http://localhost:11434/api/generate',
                    {
                        model: model || 'llama3',
                        prompt: `${systemPrompt} \n\nUser: Domain: ${domain} \nHTML: \n${cleanHtml} \nAssistant: `,
                        format: "json",
                        stream: false
                    }
                );
                content = response.data.response;

            } else {
                console.warn('[AI Service] Provider implementation pending:', provider);
                throw new Error(`Provider ${provider} not supported yet`);
            }

            const result = JSON.parse(content);

            return {
                domain,
                mode: 'cheerio', // Default
                rules: result.rules || []
            };

        } catch (err: any) {
            console.error(`[AI Service] ${provider} request failed: `, err.message);
            // Fallback to heuristics on error to prevent job failure
            return this.heuristicLearn(domain, htmlSample);
        }
    },

    // Deterministic fallback (Mock AI)
    heuristicLearn(domain: string, html: string): SiteProfile {
        const rules: AiExtractionRule[] = [];

        // Simple heuristics
        rules.push({ field: 'name', selector: 'h1', type: 'text' });
        rules.push({ field: 'image', selector: 'img', type: 'image' }); // Too generic but safe

        if (html.includes('.pdf')) {
            rules.push({ field: 'datasheet', selector: 'a[href$=".pdf"]', type: 'link', attributeName: 'href' });
        }

        return {
            domain,
            mode: 'cheerio',
            rules
        };
    },

    async saveProfile(profile: SiteProfile) {
        const db = getCeDatabase();
        const stmt = db.prepare(`
            INSERT INTO ce_site_profiles(id, domain, rules_json, mode, last_validated_at, success_rate)
VALUES(?, ?, ?, ?, datetime('now'), 1.0)
            ON CONFLICT(domain) DO UPDATE SET
rules_json = excluded.rules_json,
    last_validated_at = datetime('now')
        `);

        stmt.run(
            profile.domain, // ID same as domain for simplicity or uuid
            profile.domain,
            JSON.stringify(profile.rules),
            profile.mode
        );
    },

    cleanHtmlForAi(html: string): string {
        // Primitive washer
        let clean = html
            .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
            .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "")
            .replace(/<!--[\s\S]*?-->/g, "");

        // Keep body only if possible
        const bodyMatch = clean.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch) clean = bodyMatch[1];

        // Truncate if too huge (simulating token limit safety for GPT-4o)
        // Set to 250k which is roughly ~60k-80k tokens, well within limits
        if (clean.length > 250000) {
            clean = clean.substring(0, 250000) + '... (truncated)';
        }
        return clean;
    },

    async scanStructure(domain: string, html: string, deep = false, startUrl?: string, metadata?: any, onProgress?: (msg: string) => void): Promise<any[]> {
        // Load Config
        const { getOdooConfig } = await import('../../../config/odooConfigStore');
        const config = await getOdooConfig();

        const apiKey = config?.aiApiKey || process.env.CE_OPENAI_API_KEY;
        const provider = config?.aiProvider || 'openai';
        const model = config?.aiModel || process.env.CE_OPENAI_MODEL || 'gpt-4o';

        // Cache Bypass if Deep Scan or forced
        if (deep) {
            structureCache.delete(domain);
        }

        // Helper to call AI
        const callAiScan = async (pageHtml: string, contextUrl: string, depthLevel: 'ROOT' | 'CATEGORY', metadata?: any) => {
            const cleanHtml = this.cleanHtmlForAi(pageHtml);

            // GROUNDING: Extract real links to prevent hallucination
            const $ = load(pageHtml);
            const foundLinks: { text: string, href: string, parentSig: string, score?: number }[] = [];

            // Helper to add link
            const addLink = (href: string, text: string, pSig: string) => {
                try {
                    const absolute = new URL(href, contextUrl).href;
                    const finalText = (text || 'Item').substring(0, 50);
                    const isMeta = pSig.startsWith('meta.');
                    foundLinks.push({
                        text: finalText,
                        href: absolute,
                        parentSig: pSig,
                        score: isMeta ? 100 : 0 // Basic boost for meta links
                    });
                    return true;
                } catch (e) { }
                return false;
            };

            // 1. Inject links from Metadata (if provided) - These are high-confidence from Harvester
            if (metadata) {
                if (metadata.subcategory_urls_found) {
                    metadata.subcategory_urls_found.forEach((u: string) => addLink(u, '', 'meta.subcategory'));
                }
                if (metadata.product_family_urls_found) {
                    metadata.product_family_urls_found.forEach((u: string) => addLink(u, '', 'meta.product'));
                }
            }

            // 2. Extract from HTML
            $('a').each((_i: number, el: any) => {
                const href = $(el).attr('href');
                let text = $(el).text().trim().replace(/\s+/g, ' ');
                if (!text) text = $(el).attr('title') || $(el).find('img').attr('alt') || '';

                if (href && !href.startsWith('javascript') && !href.startsWith('mailto') && !href.startsWith('tel')) {
                    const parent = $(el).parent();
                    const pTag = parent.prop('tagName').toLowerCase();
                    const pClass = parent.attr('class') || '';
                    const pId = parent.attr('id') || '';
                    const parentSig = `${pTag}.${pClass.replace(/\s+/g, '.')}${pId ? '#' + pId : ''} `;

                    addLink(href, text, parentSig);
                }
            });
            console.log(`[Scan Debug] Combined grounded links: ${foundLinks.length} items for AI context.`);

            // CLUSTER ANALYSIS (Universal Heuristic)
            const clusters = new Map<string, typeof foundLinks>();
            foundLinks.forEach(l => {
                if (!clusters.has(l.parentSig)) clusters.set(l.parentSig, []);
                clusters.get(l.parentSig)?.push(l);
            });

            // Identify "Golden Clusters"
            const structureKeywords = ['series', 'collection', 'collezione', 'tipologia', 'category', 'categoria', 'line', 'range', 'family', 'group'];
            const categoryKeywords = ['outdoor', 'indoor', 'kitchen', 'bathroom', 'bagno', 'cucina', 'living', 'wellness', 'ambiente', 'doccia'];
            const goldenSignatures = new Set<string>();

            for (const [sig, links] of clusters.entries()) {
                if (links.length >= 2) {
                    const hasKey = links.some(l =>
                        [...structureKeywords, ...categoryKeywords].some(k => l.text.toLowerCase().includes(k) || l.href.toLowerCase().includes(k))
                    );
                    if (hasKey) {
                        goldenSignatures.add(sig);
                        console.log(`[Scan Debug] Found Golden Cluster: ${sig} (Size: ${links.length})`);
                    }
                }
            }

            // unique links (by href) to save tokens
            // Using Map to dedup by href
            let uniqueLinks = Array.from(new Map(foundLinks.map(item => [item.href, item])).values());

            // CONTEXT PRIORITIZATION V3 (Weighted)
            const negativeKeywords = ['privacy', 'terms', 'contact', 'about', 'login', 'cart', 'account', 'search'];

            uniqueLinks.sort((a, b) => {
                const aUrl = a.href.toLowerCase();
                const bUrl = b.href.toLowerCase();

                let scoreA = a.score || 0;
                let scoreB = b.score || 0;

                // 1. Cluster Boost
                if (goldenSignatures.has(a.parentSig)) scoreA += 40;
                if (goldenSignatures.has(b.parentSig)) scoreB += 40;

                // 2. Keyword Boost
                if ([...structureKeywords, ...categoryKeywords].some(k => aUrl.includes(k) || a.text.toLowerCase().includes(k))) scoreA += 20;
                if ([...structureKeywords, ...categoryKeywords].some(k => bUrl.includes(k) || b.text.toLowerCase().includes(k))) scoreB += 20;

                // 3. Negative Demotion
                if (negativeKeywords.some(k => aUrl.includes(k))) scoreA -= 50;
                if (negativeKeywords.some(k => bUrl.includes(k))) scoreB -= 50;

                // 4. Sub-Path Boost
                const aPath = new URL(a.href).pathname;
                const bPath = new URL(b.href).pathname;
                const contextPath = new URL(contextUrl).pathname.replace(/\/$/, "");

                if (aPath.startsWith(contextPath + "/")) scoreA += 30; // Reduced from 50 to allow siblings
                if (bPath.startsWith(contextPath + "/")) scoreB += 30;

                // 5. Catalog Pattern Boost (Near Path / Pattern Match)
                const catalogSegments = ['collezione', 'collection', 'tipologia', 'category', 'categoria', 'product', 'prodotto'];
                if (catalogSegments.some(s => aPath.includes(s))) scoreA += 15;
                if (catalogSegments.some(s => bPath.includes(s))) scoreB += 15;

                // 6. Sibling Bonus (If they share the same parent as context siblings)
                if (a.parentSig === 'meta.subcategory') scoreA += 20;
                if (b.parentSig === 'meta.subcategory') scoreB += 20;

                // 7. Shortness Boost
                scoreA -= aUrl.length * 0.1;
                scoreB -= bUrl.length * 0.1;

                return scoreB - scoreA;
            });

            // Limit increased for better coverage (large menus)
            const topLinks = uniqueLinks.slice(0, 800);

            console.log(`[Scan Debug] Top 5 Links for AI: `, topLinks.slice(0, 5).map(l => l.href));
            console.log(`[Scan Debug] Context Length: ${cleanHtml.length} chars.Grounding: ${topLinks.length} URLs.`);

            const linksContext = JSON.stringify(topLinks, null, 2);


            let goalDescription = "";
            let extractionHint = "";
            let dataHints = "";

            if (metadata) {
                dataHints = `
                HARD DATA(Harvester):
- Page Type: ${metadata.page_kind}
- Subcats: ${metadata.subcategory_urls_found?.length || 0}
- Products: ${metadata.product_family_urls_found?.length || 0}
`;
            }

            if (depthLevel === 'ROOT') {
                goalDescription = "Analyze the Homepage/Root to build the MAIN NAVIGATION TREE.";
                extractionHint = "Focus on the Header Menu, and Top-Level Product Categories (Series, Collections).";
            } else {
                goalDescription = "Analyze a specific Category Page.";
                if (metadata?.page_kind === 'product_list' || metadata?.product_family_urls_found?.length > 0) {
                    extractionHint = "This page seems to be a Product List. You MUST extract the INDIVIDUAL PRODUCTS (Articles) and list them as 'children' with type 'product_family'. DO NOT skip products.";
                } else {
                    extractionHint = "This page is a CATEGORY HUB. You MUST extract the SUB-CATEGORIES (Series/Collections). Prioritize links that describe a group/family of products. If no sub-categories exist but products do, list the PRODUCTS instead.";
                }
            }

            const systemPrompt = `
                You are an expert Web Scraper and Information Architect.
    ${goalDescription}

Domain: ${domain}
                Context URL: ${contextUrl}
                ${dataHints}
                
                GROUND TRUTH(VERIFIED LINKS FROM DOM):
                ${linksContext}

INSTRUCTIONS:
1. Extract the navigational hierarchy relevant to PRODUCTS.
                2. ${extractionHint}
3. Ignore irrelevant links(About, Contact, Privacy, News, Careers).
                4. Output JSON with key 'tree'.
                5. CRITICAL: USE ONLY URLs listed in "GROUND TRUTH". 
                6. CRITICAL: FIND ALL sub - collections, series, and typologies(e.g. "Collezioni", "Tipologia"). 
                7. CRITICAL: If the page is a list(e.g. "All Collections"), YOU MUST EXTRACT EVERY SINGLE ITEM from the GROUND TRUTH.If there are 50 items, output 50 items.DO NOT SUMMARIZE AND DO NOT TRUNCATE. 
                8. CRITICAL: If you are at a Category Level, FIND THE CHILDREN(Sub - categories OR Products).Do not just return the parent.
                9. PREFER English names for top - level categories(e.g., "Collections" instead of "Collezioni") to maintain UI consistency.
                10. VERIFY: Ensure no items from the pattern are missing in your JSON.

    FORMAT:
{
    "tree": [
        {
            "name": "Category or Product Name",
            "url": "Absolute URL",
            "type": "category" | "product_family",
            "children": []
        }
    ]
}
`;

            try {
                if (provider === 'openai') {
                    const response = await axios.post(
                        'https://api.openai.com/v1/chat/completions',
                        {
                            model: model,
                            messages: [
                                { role: 'system', content: systemPrompt },
                                { role: 'user', content: `Analyze the structure for ${domain}.` }
                            ],
                            response_format: { type: "json_object" },
                            temperature: 0
                        },
                        { headers: { 'Authorization': `Bearer ${apiKey} ` } }
                    );
                    const content = response.data.choices[0].message.content;
                    const result = JSON.parse(content);
                    return Array.isArray(result.tree) ? result.tree : (Array.isArray(result) ? result : []);
                } else {
                    return [{ name: 'Detected (Mock)', url: `https://${domain}/mock`, type: 'category' }];
                }
            } catch (e: any) {
                console.error("AI Call Failed:", e.message);

                // CRITICAL ERRORS: Re-throw to notify user (Quota, Auth)
                if (e.response && (e.response.status === 429 || e.response.status === 401)) {
                    throw new Error(`AI Service Error: ${e.response.status} - ${e.response.statusText}. Check your API Key/Quota.`);
                }

                // FALLBACK: Use Puppeteer's Heuristic Links if AI fails (e.g. 429)
                if (metadata && metadata.subcategory_urls_found && metadata.subcategory_urls_found.length > 0) {
                    console.log(`[AI Fallback] Using ${metadata.subcategory_urls_found.length} heuristic links from Harvester.`);
                    return metadata.subcategory_urls_found.map((u: string) => {
                        // Extract name from URL slug
                        const name = u.split('/').filter(x => x).pop()?.replace(/-/g, ' ') || "Category";
                        // Capitalize
                        const niceName = name.charAt(0).toUpperCase() + name.slice(1);
                        return {
                            name: niceName,
                            url: u,
                            type: 'category',
                            children: []
                        };
                    });
                }

                return [];
            }
        };

        // 1. Initial Scan (ROOT or Custom Context)
        const contextUrl = startUrl || `https://${domain}`;
        const initialDepth = (startUrl && startUrl !== `https://${domain}` && startUrl !== `https://${domain}/`) ? 'CATEGORY' : 'ROOT';

        console.log(`[Scan] Level 0: Analyzing ${contextUrl} (${initialDepth})...`);
        if (onProgress) onProgress(`Analisando estrutura de: ${contextUrl}...`);
        let rootTree = await callAiScan(html, contextUrl, initialDepth, metadata);

        if (rootTree.length === 1 && rootTree[0].children && rootTree[0].children.length > 0) {
            if (/product|shop|catalog|bathroom/i.test(rootTree[0].name)) {
                rootTree = rootTree[0].children;
            }
        }

        // 1b. HEURISTIC MERGER: If AI missed links found by Harvester, inject them.
        if (html && initialDepth === 'CATEGORY') {
            const { analyzePage } = await import('./cePuppeteerService');
            // Check if we have subcats in metadata that aren't in the tree
            // (Re-extracting or using passed metadata)
            const subcats = metadata?.subcategory_urls_found || [];
            if (subcats.length > 0) {
                const existingUrls = new Set<string>();
                const collectUrls = (nodes: any[]) => nodes.forEach(n => { if (n.url) existingUrls.add(n.url); if (n.children) collectUrls(n.children); });
                collectUrls(rootTree);

                const missing = subcats.filter((u: string) => !existingUrls.has(u));
                if (missing.length > 0) {
                    console.log(`[Heuristic Merger] AI missed ${missing.length} sub-categories. Injecting them...`);
                    missing.forEach((u: string) => {
                        const name = u.split('/').filter(x => x).pop()?.replace(/-/g, ' ') || "Category";
                        const niceName = name.charAt(0).toUpperCase() + name.slice(1);
                        rootTree.push({
                            name: niceName,
                            url: u,
                            type: 'category',
                            children: []
                        });
                    });
                }
            }
        }

        // 1c. PRODUCT MERGER: If we have product refs in metadata, ensures they are in leaf categories
        if (html && initialDepth === 'CATEGORY' && metadata?.product_family_urls_found?.length > 0) {
            const productRefs = metadata.product_family_refs_found || [];
            if (productRefs.length > 0) {
                const existingUrls = new Set<string>();
                const collectUrls = (nodes: any[]) => nodes.forEach(n => { if (n.url) existingUrls.add(n.url); if (n.children) collectUrls(n.children); });
                collectUrls(rootTree);

                const missing = productRefs.filter((r: any) => !existingUrls.has(r.url));
                if (missing.length > 0) {
                    console.log(`[Product Merger] Injecting ${missing.length} missing products into tree.`);
                    missing.forEach((r: any) => {
                        rootTree.push({
                            name: r.name,
                            url: r.url,
                            type: 'product_family',
                            node_kind: 'product_family',
                            children: []
                        });
                    });
                }
            }
        }

        // 2. Deep Scan logic (Recursive discovery)
        if (deep && rootTree.length > 0) {
            const maxDepth = 4;
            const visitedScanUrls = new Set<string>([contextUrl]);
            const { analyzePage } = await import('./cePuppeteerService');

            const processNodeRecursive = async (node: any, currentDepth: number): Promise<any> => {
                if (currentDepth >= maxDepth) return node;
                if (!node.url || !node.url.startsWith('http')) return node;
                if (visitedScanUrls.has(node.url)) return node;

                try {
                    console.log(`${' '.repeat(currentDepth * 3)} > [Scan depth:${currentDepth}] ${node.name} (${node.url})`);
                    visitedScanUrls.add(node.url);

                    // Politeness delay
                    await new Promise(r => setTimeout(r, 600));

                    if (onProgress) onProgress(`Aprofundando em: ${node.name}...`);
                    // IMPORTANT: Enable interactions for deep scan expansion to handle 'Load More' on listing pages
                    const { html: subHtml, metadata } = await analyzePage(node.url, undefined, { noInteractions: false });

                    // STRATEGY: Check if this node is a Leaf (has products) or Branch (has no products but maybe subcats)
                    const productRefs = metadata.product_family_refs_found || [];

                    if (productRefs.length > 0) {
                        console.log(`${' '.repeat(currentDepth * 3)}   [Leaf] Found ${productRefs.length} products. Stopping recursion.`);
                        node.children = productRefs.map((ref: { url: string, name: string }) => ({
                            name: ref.name,
                            url: ref.url,
                            type: 'product_family',
                            node_kind: 'product_family',
                            children: []
                        }));
                        node.type = 'category_leaf';
                    } else {
                        // Branch discovery
                        // If we don't have children already, try to find them
                        if (!node.children || node.children.length === 0) {
                            const subTree = await callAiScan(subHtml, node.url, 'CATEGORY', metadata);
                            if (subTree && subTree.length > 0) {
                                const cleanChildren = subTree.filter((c: any) => c.url !== node.url && !c.url.includes('#'));
                                node.children = cleanChildren;
                                console.log(`${' '.repeat(currentDepth * 3)}   [Branch] Found ${cleanChildren.length} sub-categories.`);
                            }
                        }

                        // Dive into children (whether pre-existing or newly found)
                        if (node.children && node.children.length > 0) {
                            for (let j = 0; j < node.children.length; j++) {
                                node.children[j] = await processNodeRecursive(node.children[j], currentDepth + 1);
                            }
                        }
                    }
                } catch (e: any) {
                    console.error(`     -> Failed scan for ${node.url}: ${e.message}`);
                }
                return node;
            };

            console.log(`[Scan] Deep Scan Enabled (Max Depth: ${maxDepth}). Discovering branches...`);
            for (let i = 0; i < rootTree.length; i++) {
                if (rootTree[i].node_kind === 'facet') continue;
                rootTree[i] = await processNodeRecursive(rootTree[i], 1);
            }
        }

        structureCache.set(domain, rootTree);
        return rootTree;
    },

    // Utils
    async computeOverlap(parentUrl: string, childUrl: string): Promise<number> { return 0; },
    async computeOverlapWithData(parentProducts: string[], childUrl: string): Promise<number> { return 0; }
};
