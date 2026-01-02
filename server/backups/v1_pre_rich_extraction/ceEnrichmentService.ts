
import * as cheerio from 'cheerio';
import { analyzePage } from './cePuppeteerService';
import fs from 'fs';
import path from 'path';
import { ceVariantService, ProductVariant } from './ceVariantService';

export interface EnrichedProduct {
    url: string;
    name: string;
    categoryPath: string[]; // [Root, Sub, Leaf]
    heroImage?: string;
    pdfUrls: string[];
    itemReference?: string;
    collections: string[];
    variants?: ProductVariant[];
}

export const ceEnrichmentService = {

    // 1. Traverse Tree & Collect Product URLs for Leaves
    async collectLeafProducts(tree: any[]): Promise<any[]> {
        console.log("🍃 [Fase 2] Collecting Leaf Products...");

        const traverse = async (node: any, pathName: string[]) => {
            const currentPath = [...pathName, node.name];

            // If it has children, dive deeper FIRST (Depth-First)
            if (node.children && node.children.length > 0) {
                for (let i = 0; i < node.children.length; i++) {
                    node.children[i] = await traverse(node.children[i], currentPath);
                }
                return node;
            }

            // It's a candidate LEAF node (no children in tree)
            // Check if it's a valid category URL
            if (node.url && node.url.startsWith('http')) {
                try {
                    console.log(`🔎 Analyzing Leaf: ${node.name} (${node.url})`);
                    await new Promise(r => setTimeout(r, 500));

                    const { metadata } = await analyzePage(node.url);

                    if (metadata.product_family_urls_found && metadata.product_family_urls_found.length > 0) {
                        console.log(`   -> Found ${metadata.product_family_urls_found.length} products!`);
                        node.product_urls = metadata.product_family_urls_found;
                        node.is_leaf = true;
                    } else {
                        console.log(`   -> No products found. (Might be empty category or hub)`);
                    }
                } catch (e: any) {
                    console.error(`   ❌ Failed to analyze leaf: ${e.message}`);
                }
            }
            return node;
        };

        const enrichedTree = [];
        for (const rootNode of tree) {
            enrichedTree.push(await traverse(rootNode, []));
        }
        return enrichedTree;
    },

    // 2. Enrich a Single Product Family (Visit Detail Page)
    async enrichProductFamily(url: string): Promise<Partial<EnrichedProduct>> {
        console.log(`💎 Enriching Product: ${url}`);

        let variants: ProductVariant[] = [];
        let html = '';

        try {
            // A. Parallel Execution
            const [analysisReq, variantsReq] = await Promise.allSettled([
                analyzePage(url),
                ceVariantService.extractVariantsForProduct(url)
            ]);

            if (analysisReq.status === 'fulfilled') {
                html = analysisReq.value.html;
            } else {
                console.error(`   ⚠️ Metadata analysis failed for ${url}`);
            }

            if (variantsReq.status === 'fulfilled') {
                variants = variantsReq.value;
            } else {
                console.error(`   ⚠️ Variant extraction failed for ${url}`);
            }

            if (!html) throw new Error("No HTML retrieved");

            const $ = cheerio.load(html);

            // --- STRATEGY 1: JSON-LD (Gold Standard) ---
            let jsonLd: any = null;
            try {
                const jsonText = $('script[type="application/ld+json"]').first().html();
                if (jsonText) {
                    jsonLd = JSON.parse(jsonText);
                    console.log(`   ✨ Found JSON-LD Data for ${url}`);
                }
            } catch (e) { console.warn('   ⚠️ JSON-LD Parse Error', e); }

            // A. Hero Image
            let heroImage = $('meta[property="og:image"]').attr('content');

            // Try JSON-LD Image first
            if (jsonLd && jsonLd.image) {
                if (Array.isArray(jsonLd.image) && jsonLd.image.length > 0) heroImage = jsonLd.image[0];
                else if (typeof jsonLd.image === 'string') heroImage = jsonLd.image;
            }

            // Fallback to DOM
            if (!heroImage) {
                const mainImg = $('img#main-image, .product-image img, .gallery img, .gslide-image img').first();
                if (mainImg.length) heroImage = mainImg.attr('src');
            }
            // Normalize
            if (heroImage && !heroImage.startsWith('http')) {
                try { heroImage = new URL(heroImage, url).href; } catch (e) { }
            }

            // B. PDFs (Improved)
            const pdfs = new Set<string>();
            $('a[href]').each((_, el) => {
                const href = $(el).attr('href');
                if (href) {
                    const cleanHref = href.toLowerCase().trim();
                    // Check for .pdf extension OR .pdf inside query strings (rare but possible) or just contains .pdf
                    if (cleanHref.includes('.pdf')) {
                        try {
                            const abs = new URL(href, url).href;
                            pdfs.add(abs);
                        } catch (e) { }
                    }
                }
            });

            // C. Item Reference
            let itemRef = '';
            // Try JSON-LD SKU/MPN
            if (jsonLd) {
                itemRef = jsonLd.sku || jsonLd.mpn || jsonLd.productID || '';
            }
            // Fallback DOM
            if (!itemRef) {
                const bodyText = $('body').text();
                const refMatch = bodyText.match(/(?:Art\.|Ref\.|SKU|No\.|Número de artículo)[:\s]+([A-Z0-9\-\.]+)/i);
                if (refMatch) itemRef = refMatch[1].trim();
            }

            // D. Name
            let name = '';
            if (jsonLd && jsonLd.name) {
                name = jsonLd.name;
            } else {
                name = $('h1').first().text().trim() || $('title').text().trim();
            }

            // E. Real Category Path
            let realCategoryPath: string[] = [];
            // Try JSON-LD Category
            if (jsonLd && jsonLd.category) {
                // Sometime category is a string "Baths", sometimes a path
                realCategoryPath = [jsonLd.category];
            }

            // Fallback Breadcrumbs
            if (realCategoryPath.length === 0) {
                const breadItems = $('.breadcrumb li, nav[aria-label="breadcrumb"] li, .breadcrumbs span, .path a');
                if (breadItems.length > 0) {
                    breadItems.each((_, EL) => {
                        const txt = $(EL).text().trim();
                        if (txt && txt !== '>' && txt !== '/') realCategoryPath.push(txt);
                    });
                }
            }

            // Fallback URLSegments
            if (realCategoryPath.length === 0) {
                try {
                    const u = new URL(url);
                    const segments = u.pathname.split('/').filter(s => s && !['es', 'productos', 'producto', 'product', 'products', 'en', 'de'].includes(s.toLowerCase()));
                    if (segments.length > 1) {
                        segments.pop(); // remove product slug
                        realCategoryPath = segments.map(s => s.replace(/-/g, ' '));
                    }
                } catch (e) { }
            }

            return {
                url,
                name,
                heroImage,
                pdfUrls: Array.from(pdfs),
                itemReference: itemRef,
                categoryPath: realCategoryPath.length > 0 ? realCategoryPath : undefined,
                variants
            };

        } catch (e: any) {
            console.error(`   ❌ Failed enrichment: ${e.message}`);
            return { url, name: 'Error', pdfUrls: [], collections: [], variants: [] };
        }
    },

    // 3. Export Logic (JSON & CSV)
    async exportCatalogV2(tree: any[], productsIndex: EnrichedProduct[]) {
        const outputDir = path.join(__dirname, '../../../../exports');
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        // Save JSON
        const jsonPath = path.join(outputDir, 'catalog.v2.json');
        const data = {
            metadata: { generatedAt: new Date().toISOString(), totalProducts: productsIndex.length },
            tree,
            products: productsIndex
        };
        fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
        console.log(`💾 JSON Export saved to: ${jsonPath}`);

        // Save CSV
        const csvPath = path.join(outputDir, 'catalog.v2.csv');
        const headers = ['Category Path', 'Collection', 'Product Family Name', 'Item Ref', 'URL', 'Hero Image', 'PDFs (Pipe Separated)', 'Variant Count', 'Variants JSON'];

        const rows = [headers.join(';')];

        productsIndex.forEach(p => {
            const cats = p.categoryPath ? p.categoryPath.join(' > ') : '';
            const colls = p.collections ? p.collections.join('|') : '';
            const pdfs = p.pdfUrls ? p.pdfUrls.join('|') : '';
            const vCount = p.variants ? p.variants.length.toString() : '0';
            // Minimal variant dump for CSV check
            const vJson = p.variants ? JSON.stringify(p.variants.map(v => ({ dim: v.dimension, sku: v.sku_real }))) : '[]';

            const safe = (s: string) => (s || '').replace(/;/g, ',');

            rows.push([
                safe(cats),
                safe(colls),
                safe(p.name),
                safe(p.itemReference || ''),
                safe(p.url),
                safe(p.heroImage || ''),
                safe(pdfs),
                vCount,
                safe(vJson)
            ].join(';'));
        });

        fs.writeFileSync(csvPath, '\uFEFF' + rows.join('\n'), { encoding: 'utf8' });
        console.log(`💾 CSV Export saved to: ${csvPath}`);
    }
};
