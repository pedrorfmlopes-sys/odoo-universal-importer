// @ts-nocheck

import axios from 'axios';
import { load } from 'cheerio';

const targetUrl = process.argv[2] || 'https://www.fimacf.com/en/products';
const domain = new URL(targetUrl).hostname;

async function debugLinks() {
    console.log(`Analyzing links for: ${targetUrl}`);

    // 1. Fetch HTML
    const res = await axios.get(targetUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
    });
    const html = res.data;
    const $ = load(html);

    // 2. Extract Links (Mimic ceAiService)
    const foundLinks: { text: string, href: string }[] = [];
    $('a').each((_i: number, el: any) => {
        const href = $(el).attr('href');
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        if (href && text && !href.startsWith('javascript')) {
            try {
                const absolute = new URL(href, targetUrl).href;
                if (absolute.includes(domain)) {
                    foundLinks.push({ text: text.substring(0, 50), href: absolute });
                }
            } catch (e) { }
        }
    });

    // 3. Mimic Sorting Logic
    let uniqueLinks = Array.from(new Map(foundLinks.map(item => [item.href, item])).values());
    const contextPath = new URL(targetUrl).pathname.replace(/\/$/, "");

    console.log(`Total Unique Links Found: ${uniqueLinks.length}`);

    // LOGIC PRIOR TO FIX:
    const sortedLinksOld = [...uniqueLinks].sort((a, b) => {
        const aPath = new URL(a.href).pathname;
        const bPath = new URL(b.href).pathname;
        const aIsSub = aPath.startsWith(contextPath + "/");
        const bIsSub = bPath.startsWith(contextPath + "/");
        if (aIsSub && !bIsSub) return -1;
        if (!aIsSub && bIsSub) return 1;
        return 0;
    });

    console.log("\n--- TOP 20 LINKS (OLD LOGIC) ---");
    sortedLinksOld.slice(0, 20).forEach(l => console.log(`[${l.href.startsWith(contextPath + '/') ? 'SUB' : 'EXT'}] ${l.text} -> ${l.href}`));

    // PROPOSED LOGIC: Keyword boosting + Relaxed Subpath
    const keywords = ['series', 'collection', 'category', 'product', 'catalog', 'line'];

    const sortedLinksNew = [...uniqueLinks].sort((a, b) => {
        const aUrl = a.href.toLowerCase();
        const bUrl = b.href.toLowerCase();

        // 1. Boost Keywords
        const aHasKey = keywords.some(k => aUrl.includes(k));
        const bHasKey = keywords.some(k => bUrl.includes(k));
        if (aHasKey && !bHasKey) return -1;
        if (!aHasKey && bHasKey) return 1;

        // 2. Sub-path (Secondary priority)
        const aPath = new URL(a.href).pathname;
        const bPath = new URL(b.href).pathname;
        const aIsSub = aPath.startsWith(contextPath + "/");
        const bIsSub = bPath.startsWith(contextPath + "/");

        if (aIsSub && !bIsSub) return -0.5; // Weaker boost
        if (!aIsSub && bIsSub) return 0.5;

        return 0;
    });

    console.log("\n--- TOP 20 LINKS (NEW LOGIC) ---");
    sortedLinksNew.slice(0, 20).forEach(l => console.log(`[${l.href.includes('collection') ? 'KEY' : '   '}] ${l.text} -> ${l.href}`));

    // Check specifically for known missing items (if user provided examples, usually they don't here)
    // Looking for "Collections"
    const collectionLinks = uniqueLinks.filter(l => l.href.toLowerCase().includes('collection') || l.href.toLowerCase().includes('serie'));
    console.log(`\n--- LINKS MATCHING 'COLLECTION/SERIE' (${collectionLinks.length}) ---`);
    collectionLinks.forEach(l => {
        const indexOld = sortedLinksOld.findIndex(x => x.href === l.href);
        const indexNew = sortedLinksNew.findIndex(x => x.href === l.href);
        console.log(`[Rank Old: ${indexOld} | New: ${indexNew}] ${l.text} -> ${l.href}`);
    });
}

debugLinks();
