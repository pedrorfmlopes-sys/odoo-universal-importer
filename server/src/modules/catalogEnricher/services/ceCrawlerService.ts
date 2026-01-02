
import axios from 'axios';
import * as cheerio from 'cheerio';
import path from 'path';

export interface CrawlerSelectors {
    productCard: string;
    productName: string;
    productLink: string;
    productImage: string;
    navigationCandidates?: { text: string, url: string, score: number }[];
    strategy?: string;
    allowedPath?: string;
    excludedPath?: string;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

import Database from 'better-sqlite3';

export const startCrawlJob = async (jobId: string, url: string | string[], selectors: CrawlerSelectors, profileId: string) => {
    console.log(`[Job:${jobId}] Starting crawl for ${Array.isArray(url) ? url.length + ' URLs' : url} (Profile: ${profileId})`);

    // IMPORTANT: Use the correct DB path relative to execution or env
    const dbPath = process.env.CE_DB_PATH || path.join(process.cwd(), 'data', 'importer.db');
    console.log(`[Crawler] Using DB Path: ${dbPath}`);
    // const Database = require('better-sqlite3'); // Removed
    const db = new Database(dbPath);

    try {
        let currentUrl = Array.isArray(url) ? url[0] : url;
        let visited = new Set<string>();
        let pageCount = 0;
        const limit = selectors.strategy === 'deep' ? 50 : (selectors.strategy === 'pagination' ? 10 : 1);

        const queue = Array.isArray(url) ? [...url] : [url];

        // Ensure table exists (sanity check)
        db.exec(`
            CREATE TABLE IF NOT EXISTS ce_web_products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                brand_profile_id TEXT,
                category_name TEXT,
                product_name TEXT,
                product_url TEXT UNIQUE,
                image_url TEXT,
                guessed_code TEXT,
                crawled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                search_blob TEXT 
            );
        `);

        while (queue.length > 0 && pageCount < limit) {
            const target = queue.shift();
            if (!target || visited.has(target)) continue;

            console.log(`[Job:${jobId}] Crawling ${target}...`);
            visited.add(target);
            pageCount++;

            // Fetch
            let html = '';
            try {
                const { data } = await axios.get(target, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
                });
                html = data;
            } catch (e) {
                console.error(`[Job:${jobId}] Failed to fetch ${target}`, e);
                continue;
            }

            const $ = cheerio.load(html);
            let productsFound = 0;

            // Extract Products
            if (selectors.productCard) {
                $(selectors.productCard).each((_, el) => {
                    const card = $(el);

                    // Name
                    let name = 'Unknown';
                    if (selectors.productName) {
                        name = card.find(selectors.productName).text().trim() || card.filter(selectors.productName).text().trim();
                    }

                    // Link
                    let link = '';
                    if (selectors.productLink) {
                        const linkEl = selectors.productLink === 'self' ? card : (card.find(selectors.productLink).length ? card.find(selectors.productLink) : card.filter(selectors.productLink));
                        link = linkEl.attr('href') || '';
                    }

                    // Image
                    let image = '';
                    if (selectors.productImage) {
                        image = card.find(selectors.productImage).attr('src') || card.find(selectors.productImage).attr('data-src') || card.filter(selectors.productImage).attr('src') || '';
                    }

                    // Normalize Link
                    if (link && !link.startsWith('http')) {
                        try {
                            const u = new URL(target);
                            link = new URL(link, u.origin).href;
                        } catch (e) { }
                    }

                    if (name && link) {
                        // INSERT INTO DB
                        try {
                            const stmt = db.prepare(`
                                INSERT INTO ce_web_products (
                                    brand_profile_id, category_name, product_name, product_url, image_url, crawled_at
                                ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                                ON CONFLICT(product_url) DO UPDATE SET
                                    product_name = excluded.product_name,
                                    image_url = excluded.image_url,
                                    crawled_at = CURRENT_TIMESTAMP
                            `);
                            stmt.run(profileId, 'Uncategorized', name, link, image);
                            productsFound++;
                        } catch (err: any) {
                            console.error(`[Job:${jobId}] DB Error:`, err.message);
                        }
                    }
                });
            }

            console.log(`[Job:${jobId}] Found ${productsFound} products on ${target}`);
            await sleep(1000); // Polite delay

            // TODO: Add logic for pagination/depth if needed later
        }

        console.log(`[Job:${jobId}] Finished. Visited ${pageCount} pages.`);

    } catch (e: any) {
        console.error(`[Job:${jobId}] Critical Error:`, e);
    } finally {
        db.close();
    }
};

export const previewCrawl = async (url: string, selectors: CrawlerSelectors) => {
    try {
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });
        const $ = cheerio.load(data);
        const results: any[] = [];

        $(selectors.productCard).each((_, el) => {
            const card = $(el);

            // Extract Name
            let name = 'Unknown';
            if (selectors.productName) {
                name = card.find(selectors.productName).text().trim() ||
                    card.filter(selectors.productName).text().trim();
            }

            // Extract Link
            let link = '';
            if (selectors.productLink) {
                link = card.find(selectors.productLink).attr('href') ||
                    card.filter(selectors.productLink).attr('href') || '';
            }

            // Extract Image
            let image = '';
            if (selectors.productImage) {
                image = card.find(selectors.productImage).attr('src') ||
                    card.find(selectors.productImage).attr('data-src') ||
                    card.filter(selectors.productImage).attr('src') || '';
            }

            // Absolute URL fix
            if (link && !link.startsWith('http')) {
                const urlObj = new URL(url);
                link = `${urlObj.origin}${link.startsWith('/') ? '' : '/'}${link}`;
            }

            if (name || link) {
                results.push({ name, link, image });
            }
        });

        // Limit preview to 10 items
        return {
            totalFound: results.length,
            preview: results.slice(0, 10)
        };

    } catch (e: any) {
        throw new Error(`Failed to fetch page: ${e.message}`);
    }
};

export const autoDetectSelectors = async (url: string): Promise<CrawlerSelectors> => {
    try {
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });
        const $ = cheerio.load(data);

        // --- 1. PRODUCT DETECTION HEURISTIC ---
        let bestCandidate = { selector: '', score: 0 };
        const candidates = ['article', 'li.product', 'div.product', 'div.item', 'div.card', 'div.col', 'div'];

        $('body').find('*').each((_, el) => {
            const parent = $(el).parent();
            const tag = $(el).prop('tagName').toLowerCase();
            const className = $(el).attr('class');

            if (!className) return;

            const signature = `${tag}.${className.trim().split(/\s+/).join('.')}`;
            const siblings = parent.find(`> ${tag}[class="${className}"]`);

            if (siblings.length >= 3) {
                let score = siblings.length * 10;

                const html = $(el).html() || '';
                const hasImg = html.includes('<img');
                const hasLink = html.includes('<a');
                const hasPrice = html.match(/€|\$|£|price/i);

                if (hasImg) score += 50;
                if (hasLink) score += 50;
                if (hasPrice) score += 30;

                const textLen = $(el).text().trim().length;
                if (textLen < 10) score -= 50;

                if (parent.is('nav') || parent.attr('class')?.includes('menu')) score -= 100;

                if (score > bestCandidate.score) {
                    bestCandidate = { selector: signature, score };
                }
            }
        });

        let productCard = '';
        let productName = '';
        let productLink = '';
        let productImage = '';

        if (bestCandidate.score > 0) {
            productCard = bestCandidate.selector;
            const sample = $(bestCandidate.selector).first();

            // Find Link
            if (sample.is('a')) productLink = 'self';
            else if (sample.find('h1 a, h2 a, h3 a, h4 a, .name a, .title a').length) productLink = 'h1 a, h2 a, h3 a, h4 a, .name a, .title a';
            else if (sample.find('a').length) productLink = 'a';

            // Find Image
            if (sample.find('img').length) productImage = 'img';

            // Find Name
            const headings = sample.find('h1, h2, h3, h4, h5, h6');
            if (headings.length) productName = headings.get(0).tagName.toLowerCase();
            else {
                const titleClass = sample.find('[class*="name"], [class*="title"]');
                if (titleClass.length) productName = `.${titleClass.attr('class')?.split(' ')[0]}`;
                else productName = '.x-text, p, span';
            }
        }

        // --- 2. NAVIGATION DISCOVERY ---
        const navCandidates: { text: string, url: string, score: number }[] = [];

        const menuSelectors = ['nav', '.menu', '#menu', '.navigation', '.nav', 'header', '.dropdown', 'ul.sub-menu'];

        const exploreMenu = (selector: string) => {
            $(selector).find('a').each((_, el) => {
                const href = $(el).attr('href');
                let text = $(el).text().trim();

                if (!text) text = $(el).find('img').attr('alt') || '';

                if (href && href.length > 2 && text.length > 2 && !href.startsWith('#') && !href.startsWith('javascript')) {
                    let score = 10;
                    if (href.includes('product') || href.includes('prodotti') || href.includes('collection')) score += 20;
                    if (href.includes('category') || href.includes('categoria')) score += 20;

                    let fullUrl = href;
                    if (!href.startsWith('http')) {
                        try {
                            const urlObj = new URL(url);
                            fullUrl = new URL(href, urlObj.origin).href;
                        } catch (e) { return; }
                    }

                    if (!navCandidates.find(c => c.url === fullUrl)) {
                        navCandidates.push({ text, url: fullUrl, score });
                    }
                }
            });
        };

        menuSelectors.forEach(exploreMenu);

        const relevantNav = navCandidates
            .filter(c => !c.text.match(/home|login|cart|contact|about|privacy|policy|news|blog|terms/i))
            .sort((a, b) => b.score - a.score)
            .slice(0, 30);

        return {
            productCard,
            productName,
            productLink: productLink === 'self' ? '' : productLink,
            productImage,
            navigationCandidates: relevantNav
        };

    } catch (e) {
        return { productCard: '', productName: '', productLink: '', productImage: '' };
    }
};
