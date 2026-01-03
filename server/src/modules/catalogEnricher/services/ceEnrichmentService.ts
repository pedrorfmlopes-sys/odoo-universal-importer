
import * as cheerio from 'cheerio';
import { Page } from 'puppeteer';
import { analyzePage, getEnrichmentPage } from './cePuppeteerService';
import fs from 'fs';
import path from 'path';
import { ceVariantService, ProductVariant } from './ceVariantService';

export interface EnrichedProduct {
    url: string;
    name: string;
    description?: string; // Restored
    categoryPath: string[]; // [Root, Sub, Leaf]
    heroImage?: string;
    pdfUrls: string[];
    namedFiles?: { name: string, url: string, format: string }[];
    galleryImages?: string[];
    itemReference?: string;
    collections: string[];
    variants?: ProductVariant[];
    associated_products_json?: string; // JSON String of associated products
    features_json?: string; // JSON String of features/finishes
    discoveredLinks?: string[]; // NEW: For recursive extraction
    specs?: Record<string, string>; // NEW: Technical specifications
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
    async enrichProductFamily(url: string, jobId?: string, options: { downloadAssets?: boolean } = {}): Promise<Partial<EnrichedProduct>> {
        console.log(`💎 Enriching Product: ${url}`);

        let variants: ProductVariant[] = [];
        let html = '';
        let page: Page | null = null;

        try {
            // A. Single Session Execution
            page = await getEnrichmentPage(); // Reuses or launches browser

            // 1. Analyze Page (performs navigation and interactions)
            const analysisReq = await analyzePage(url, jobId, { existingPage: page, downloadAssets: options.downloadAssets });
            html = analysisReq.html;
            const puppetData = analysisReq.metadata?.extracted_data;

            // 2. Extract Interactive Variants (reusing the same page)
            try {
                // Ensure we are STILL on the correct page (analyzePage might have drifted but returns to original)
                variants = await ceVariantService.extractInteractiveVariants(page);
            } catch (ve: any) {
                console.error(`   ⚠️ Interactive variant extraction failed for ${url}: ${ve.message}`);
            }

            if (!html) throw new Error("No HTML retrieved");

            const $ = cheerio.load(html);

            // --- V2 INJECTION: USE PUPPETEER DATA IF AVAILABLE ---
            // puppetData is already extracted from analysisReq.metadata.extracted_data
            let associatedProducts: any[] = [];
            let richFeatures: any = null;

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
            let heroImage = puppetData?.main_image || $('meta[property="og:image"]').attr('content');

            // Try JSON-LD Image first
            if (jsonLd && jsonLd.image) {
                if (Array.isArray(jsonLd.image) && jsonLd.image.length > 0) heroImage = jsonLd.image[0];
                else if (typeof jsonLd.image === 'string') heroImage = jsonLd.image;
            }

            // Fallback to DOM
            if (!heroImage) {
                const mainImg = $('img#main-image, .product-image img, .gallery img, .gslide-image img, .single-product__intro img').first();
                if (mainImg.length) heroImage = mainImg.attr('src');
            }
            // Normalize
            if (heroImage && !heroImage.startsWith('http')) {
                try { heroImage = new URL(heroImage, url).href; } catch (e) { }
            }



            // B. Files (PDFs & 3D) -> Now with Names!
            const namedFiles: { name: string, url: string, format: string }[] = [];
            const seenFiles = new Set<string>();

            $('a[href]').each((_, el) => {
                const href = $(el).attr('href');
                if (!href) return;

                const cleanHref = href.toLowerCase().trim();
                let format = 'unknown';

                // Detection
                if (cleanHref.includes('.pdf')) format = 'pdf';
                else if (cleanHref.includes('.dwg')) format = 'dwg';
                else if (cleanHref.includes('.dxf')) format = 'dxf';
                else if (cleanHref.includes('.stp') || cleanHref.includes('.step')) format = 'step';
                else if (cleanHref.includes('.zip')) format = 'zip';

                if (format !== 'unknown') {
                    try {
                        const absUrl = new URL(href, url).href;
                        if (!seenFiles.has(absUrl)) {
                            seenFiles.add(absUrl);
                            let nameText = $(el).text().trim() || $(el).attr('title') || path.basename(absUrl);
                            // Clean up name
                            nameText = nameText.replace(/\s+/g, ' ').substring(0, 100);

                            namedFiles.push({
                                name: nameText,
                                url: absUrl,
                                format
                            });
                        }
                    } catch (e) { }
                }
            });

            // Puppeteer Files Injection
            if (puppetData && puppetData.files) {
                puppetData.files.forEach((f: any) => {
                    if (!seenFiles.has(f.url)) {
                        seenFiles.add(f.url);
                        namedFiles.push({
                            name: f.name,
                            url: f.url,
                            format: f.type
                        });
                    }
                });
            }

            // C. Gallery Images
            const galleryImages = new Set<string>();

            // Try JSON-LD Gallery (if image is array)
            if (jsonLd && jsonLd.image && Array.isArray(jsonLd.image)) {
                jsonLd.image.forEach((img: string) => galleryImages.add(img));
            }

            // DOM Gallery Scraper
            $('img').each((_, el) => {
                const src = $(el).attr('src') || $(el).attr('data-src');
                const parentClass = $(el).closest('div').attr('class') || '';

                // Exclude related products from gallery
                const inRelated = $(el).closest('.related, .related-products, .associated-products, .cross-sells, .upsells, .prodotti-correlati, .approfondimenti, .products-grid').length > 0;
                if (inRelated) return;

                if (src && (parentClass.includes('gallery') || parentClass.includes('slider') || parentClass.includes('carousel') || parentClass.includes('thumb'))) {
                    try {
                        const abs = new URL(src, url).href;
                        // Avoid tiny icons
                        if (!abs.includes('icon') && !abs.includes('logo')) {
                            galleryImages.add(abs);
                        }
                    } catch (e) { }
                }
            });

            // Puppeteer Gallery Injection
            if (puppetData && puppetData.gallery) {
                puppetData.gallery.forEach((img: string) => galleryImages.add(img));
            }
            // Ensure Hero is in gallery
            if (heroImage) galleryImages.add(heroImage);

            // --- V3 INJECTION: VARIANTS & ASSOCIATED PRODUCTS ---
            if (puppetData && puppetData.variants) {
                // Merge or assign variants from Puppeteer (e.g. Fima Canvas snaps)
                puppetData.variants.forEach((v: any) => {
                    // Match by Name (Dimension) primarily, as SKU might be shared (Base SKU)
                    const existing = variants.find(ov => ov.dimension === v.name);

                    if (!existing) {
                        variants.push({
                            dimension: v.name,
                            sku_real: v.code || v.name,
                            image_url: v.image
                        } as any);
                    } else {
                        // Update image if new one is base64 (Canvas snapshot) and existing is generic
                        if (v.image && v.image.startsWith('data:image') && (!existing.image_url || !existing.image_url.startsWith('data:image'))) {
                            existing.image_url = v.image;
                        }
                        // Update SKU if new one is valid (dynamic extraction) and existing is placeholder
                        if (v.code && v.code.length > 2 && (!existing.sku_real || existing.sku_real === existing.dimension || existing.sku_real.startsWith('V'))) {
                            existing.sku_real = v.code;
                        }
                    }
                });
            }

            if (puppetData && puppetData.associated_products) {
                puppetData.associated_products.forEach((p: any) => {
                    if (!associatedProducts.some(ap => ap.url === p.url)) {
                        associatedProducts.push({
                            url: p.url,
                            name: p.name,
                            type: p.is_required ? 'REQUIRED' : 'ASSOCIATED'
                        });
                    }
                });
            }

            // D. Item Reference
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

            // Puppeteer Code Injection
            if (!itemRef && puppetData && puppetData.guessed_code) {
                itemRef = puppetData.guessed_code;
            }

            // --- FIMA SPECIALIZED METADATA ---
            if (url.includes('fimacf.com')) {
                const fimaSku = $('.js-model').first().text().trim();
                if (fimaSku) itemRef = fimaSku;

                // --- ARENA FURNITURE FALLBACK (Requested by User) ---
                // Posted here to ensure 'itemRef' is available
                try {
                    let skuForArena = itemRef || puppetData?.guessed_code || '';
                    if (!skuForArena && puppetData?.name) {
                        const match = puppetData.name.match(/F\d+/);
                        if (match) skuForArena = match[0];
                    }

                    if (skuForArena) {
                        const parentCode = skuForArena.split('/')[0].split('-')[0].trim();
                        if (parentCode.length >= 4) {
                            const arenaUrl = `http://www.arenafurniture.com/images/products/${parentCode}.jpg`;
                            // console.log(`   🏟️ [Arena Fallback] Checking Arena Image: ${arenaUrl}`);
                            galleryImages.add(arenaUrl);
                        }
                    }
                } catch (e) { console.warn("   ⚠️ Arena Fallback Error", e); }
            }

            // E. Name
            let name = '';
            if (jsonLd && jsonLd.name) {
                name = jsonLd.name;
            } else {
                name = $('h1').first().text().trim() || $('title').text().trim();
            }
            if (puppetData && puppetData.name && (!name || name === 'Error')) {
                name = puppetData.name;
            }

            // F. Real Category Path
            let realCategoryPath: string[] = [];
            // Try JSON-LD Category
            if (jsonLd && jsonLd.category) {
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
                        segments.pop();
                        realCategoryPath = segments.map(s => s.replace(/-/g, ' '));
                    }
                } catch (e) { }
            }

            // G. RITMONIO SPECIALIZED EXTRACTION
            if (url.includes('ritmonio.it')) {
                console.log("   🇮🇹 Ritmonio detected. Running specialized parser...");
                try {
                    // Find script containing product data
                    const scriptText = $('script').map((_, el) => $(el).html()).get().join('\n');
                    const productMatch = scriptText.match(/console\.log\("product",\s*'(.+?)'\);/);

                    if (productMatch && productMatch[1]) {
                        const rawJson = productMatch[1];
                        // Unescape single quotes and other characters if needed (it looks like a JSON string inside a single-quoted JS string)
                        // The file view shows it as console.log("product", '{"article"...}');
                        // If it's single quoted, internal single quotes might be escaped or it might use double quotes for JSON keys.
                        let cleanJson = rawJson;
                        try {
                            const ritData = JSON.parse(cleanJson);
                            console.log(`   ✅ Parsed Ritmonio JSON for ${ritData.article}`);

                            // 1. Associated Products (interiors, handles, etc)
                            // The JSON has "products" array and info in "prodIntCode" / "prodExtCode"
                            // And in Example 3: "products":[{"ID":"1612","article":"E0BA0115SX","type":"PRODUCT_INT","code":null,"exists":false}]
                            if (ritData.products && Array.isArray(ritData.products)) {
                                associatedProducts = ritData.products.map((p: any) => ({
                                    article: p.article,
                                    type: p.type,
                                    id: p.ID,
                                    url: p.article ? `https://www.ritmonio.it/en/bath-shower/product/?code=${p.article}` : null
                                }));
                            }

                            // 2. Features / Finishes
                            if (ritData.features) {
                                richFeatures = ritData.features; // body finishes, handle finishes, etc.
                            }

                            // 3. Robust Category Path: Brand / Família / Coleção
                            // The user requested: Marca / Família / Coleção
                            const brand = "Ritmonio";

                            // Detect Family (Top Level)
                            let family = "Bath & Shower";
                            if (url.includes('/kitchen/')) family = "Kitchen";

                            // Detect Collection/Series
                            const seriesName = ritData.seriesCode || "";
                            let collection = seriesName || "";

                            // Try to get series from the UI Link if JSON seriesCode is generic
                            const seriesFromLink = $('.schedaMenu_link h4').first().text().trim();
                            if (seriesFromLink) collection = seriesFromLink;

                            // Final path override for Ritmonio
                            realCategoryPath = [brand, family, collection].filter(x => x);

                            // AUTO-DISCOVERY: If this is a combined product, maybe we should also "discover" the individual parts
                            // as separate products to be crawled if they have independent URLs.
                            // The associatedProducts mapping already does p.article -> URL.

                            // Update metadata
                            if (ritData.name && ritData.name.en) name = ritData.name.en;
                            if (ritData.article) itemRef = ritData.article;

                        } catch (je) {
                            console.warn("   ⚠️ Ritmonio JSON Parse failed", je);
                        }
                    }
                } catch (pe) {
                    console.error("   ❌ Ritmonio specialized parser error", pe);
                }
            }

            // H. FIMA SPECIALIZED EXTRACTION
            if (url.includes('fimacf.com')) {
                console.log("   🇮🇹 Fima detected. Running specialized parser...");
                try {
                    // 1. Technical Files Classification
                    $('#tab-download a[href]').each((_, el) => {
                        const href = $(el).attr('href');
                        const text = $(el).text().toLowerCase();
                        if (!href || href === '#') return;

                        let format = 'pdf';
                        if (href.toLowerCase().includes('.dwg')) format = 'dwg';

                        let name = $(el).text().trim();

                        try {
                            const absUrl = new URL(href, url).href;
                            if (!seenFiles.has(absUrl)) {
                                seenFiles.add(absUrl);
                                namedFiles.push({ name, url: absUrl, format });
                                // Keep pdfUrls in sync for legacy
                                if (format === 'pdf') {
                                    // already handled by bulk scraper? 
                                    // The bulk scraper at 137 catches ALL links. 
                                    // We might have duplicates if we aren't careful, 
                                    // but seenFiles Set handles it.
                                }
                            }
                        } catch (e) { }
                    });

                    // 2. Recursive Discovery (Mandatory / Associated Products)
                    const fimaDiscovered = new Set<string>();
                    $('.prodotti-obbligatori .product a, .popup-ordinare-separatamente .product a').each((_, el) => {
                        const href = $(el).attr('href');
                        if (href && href.startsWith('http')) fimaDiscovered.add(href);
                    });

                    if (fimaDiscovered.size > 0) {
                        console.log(`   🔗 Fima: Discovered ${fimaDiscovered.size} associated products for recursion.`);
                        fimaDiscovered.forEach(link => {
                            if (!associatedProducts.some(p => p.url === link)) {
                                associatedProducts.push({ url: link, type: 'ASSOCIATED' });
                            }
                        });
                    }

                    // 3. Category Path refinement (Brand / Series)
                    const brand = "Fima";
                    const series = $('.single-product__intro h2').first().text().trim(); // e.g. "Slide"
                    if (series) {
                        realCategoryPath = [brand, series];
                    }

                    // 4. "EXTERIORES" MINIMAL MODE
                    // If the product is an exterior part, we only keep the reference and main image.
                    const isExterior = series.toUpperCase().includes('EXTERIOR') || name.toUpperCase().includes('EXTERIOR') || realCategoryPath.some(c => c.toUpperCase().includes('EXTERIOR'));
                    if (isExterior) {
                        console.log("🧊 [Fima] Exterior part detected. Applying minimal extraction (Ref + Main Image only).");
                        namedFiles.length = 0; // Clear files
                        galleryImages.clear(); // Clear secondary gallery
                        if (heroImage) galleryImages.add(heroImage); // Keep only main
                    }

                    // 5. Image refinement (if missing or small)
                    if (!heroImage || heroImage.includes('icon')) {
                        const fimaHero = $('.single-product__intro img').first().attr('src');
                        if (fimaHero) heroImage = new URL(fimaHero, url).href;
                    }

                } catch (fe) {
                    console.error("   ❌ Fima specialized parser error", fe);
                }
            }

            return {
                url,
                name,
                description: puppetData?.description || '', // Restore Description
                heroImage,
                pdfUrls: namedFiles.filter(f => f.format === 'pdf' || f.format === 'pdf_link').map(f => f.url), // Legacy compat
                namedFiles: namedFiles, // NEW
                galleryImages: Array.from(galleryImages), // NEW
                itemReference: itemRef,
                categoryPath: realCategoryPath.length > 0 ? realCategoryPath : undefined,
                collections: [],
                variants,
                associated_products_json: associatedProducts.length > 0 ? JSON.stringify(associatedProducts) : undefined,
                features_json: richFeatures ? JSON.stringify(richFeatures) : undefined,
                discoveredLinks: associatedProducts.map(p => p.url).filter(Boolean)
            };

        } catch (e: any) {
            console.error(`   ❌ Failed enrichment: ${e.message}`);
            return { url, name: 'Error', pdfUrls: [], collections: [], variants: [] };
        } finally {
            if (page) {
                try { await page.close(); } catch (e) { }
            }
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
