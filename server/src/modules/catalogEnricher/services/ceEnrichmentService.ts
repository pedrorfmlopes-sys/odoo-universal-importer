
import * as cheerio from 'cheerio';
import { Page } from 'puppeteer';
import { analyzePage, getEnrichmentPage } from './cePuppeteerService';
import fs from 'fs';
import path from 'path';
import { ceVariantService, ProductVariant } from './ceVariantService';
import { brandRegistry } from '../brands/brandRegistry';

export interface EnrichedProduct {
    url: string;
    name: string;
    description?: string;
    categoryPath: string[];
    heroImage?: string;
    pdfUrls: string[];
    namedFiles?: { name: string, url: string, format: string }[];
    galleryImages?: string[];
    itemReference?: string;
    collections: string[];
    variants?: ProductVariant[];
    associated_products_json?: string;
    features_json?: string;
    discoveredLinks?: string[];
    specs?: Record<string, string>;
}

export const ceEnrichmentService = {

    async collectLeafProducts(tree: any[]): Promise<any[]> {
        console.log("🍃 [Fase 2] Collecting Leaf Products...");

        const traverse = async (node: any, pathName: string[]) => {
            const currentPath = [...pathName, node.name];

            if (node.children && node.children.length > 0) {
                for (let i = 0; i < node.children.length; i++) {
                    node.children[i] = await traverse(node.children[i], currentPath);
                }
                return node;
            }

            if (node.url && node.url.startsWith('http')) {
                try {
                    console.log(`🔎 Analyzing Leaf: ${node.name} (${node.url})`);
                    await new Promise(r => setTimeout(r, 500));
                    const { metadata } = await analyzePage(node.url);
                    if (metadata.product_family_urls_found && metadata.product_family_urls_found.length > 0) {
                        node.product_urls = metadata.product_family_urls_found;
                        node.is_leaf = true;
                    }
                } catch (e: any) { }
            }
            return node;
        };

        const enrichedTree = [];
        for (const rootNode of tree) {
            enrichedTree.push(await traverse(rootNode, []));
        }
        return enrichedTree;
    },

    async enrichProductFamily(url: string, jobId?: string, options: { downloadAssets?: boolean } = {}): Promise<Partial<EnrichedProduct>> {
        console.log(`💎 Enriching Product: ${url}`);

        let variants: ProductVariant[] = [];
        let html = '';
        let page: Page | null = null;

        try {
            page = await getEnrichmentPage();
            const analysisReq = await analyzePage(url, jobId, { existingPage: page, downloadAssets: options.downloadAssets });
            html = analysisReq.html;
            const puppetData = analysisReq.metadata?.extracted_data;

            try {
                variants = await ceVariantService.extractInteractiveVariants(page);
            } catch (ve: any) { }

            if (!html) throw new Error("No HTML retrieved");
            const $ = cheerio.load(html);

            const namedFiles: { name: string, url: string, format: string }[] = [];
            const seenFiles = new Set<string>();

            let associatedProducts: any[] = [];
            let richFeatures: any = null;
            let realCategoryPath: string[] = [];
            let itemRef = '';
            let name = puppetData?.name || '';

            // Brand-Specific Hook
            const brandHandler = brandRegistry.getHandler(url);
            const custom = brandHandler?.extract ? brandHandler.extract(url, html, $) : null;
            if (custom?.associatedProducts) associatedProducts = custom.associatedProducts;
            if (custom?.richFeatures) richFeatures = custom.richFeatures;
            if (custom?.realCategoryPath) realCategoryPath = custom.realCategoryPath;
            if (custom?.itemRef) itemRef = custom.itemRef;
            if (custom?.name) name = custom.name;
            if (custom?.files) {
                custom.files.forEach((f: any) => {
                    if (!seenFiles.has(f.url)) {
                        seenFiles.add(f.url);
                        namedFiles.push(f);
                    }
                });
            }

            let jsonLd: any = null;
            try {
                const jsonText = $('script[type="application/ld+json"]').first().html();
                if (jsonText) jsonLd = JSON.parse(jsonText);
            } catch (e) { }

            let heroImage = custom?.heroImage || puppetData?.main_image || $('meta[property="og:image"]').attr('content');
            if (jsonLd && jsonLd.image) {
                if (Array.isArray(jsonLd.image) && jsonLd.image.length > 0) heroImage = jsonLd.image[0];
                else if (typeof jsonLd.image === 'string') heroImage = jsonLd.image;
            }
            if (!heroImage) {
                const mainImg = $('img#main-image, .product-image img, .gallery img').first();
                if (mainImg.length) heroImage = mainImg.attr('src');
            }
            if (heroImage && !heroImage.startsWith('http')) {
                try { heroImage = new URL(heroImage, url).href; } catch (e) { }
            }


            $('a[href]').each((_, el) => {
                const href = $(el).attr('href');
                if (!href) return;
                const cleanHref = href.toLowerCase().trim();
                let format = 'unknown';
                if (cleanHref.includes('.pdf')) format = 'pdf';
                else if (cleanHref.includes('.dwg')) format = 'dwg';
                else if (cleanHref.includes('.stp') || cleanHref.includes('.step')) format = 'step';

                if (format !== 'unknown') {
                    try {
                        const absUrl = new URL(href, url).href;
                        if (!seenFiles.has(absUrl)) {
                            seenFiles.add(absUrl);
                            let nameText = $(el).text().trim() || $(el).attr('title') || path.basename(absUrl);
                            namedFiles.push({ name: nameText.substring(0, 100), url: absUrl, format });
                        }
                    } catch (e) { }
                }
            });

            const galleryImages = new Set<string>();
            if (heroImage) galleryImages.add(heroImage);

            if (puppetData && puppetData.variants) {
                puppetData.variants.forEach((v: any) => {
                    const existing = variants.find(ov => ov.dimension === v.name);
                    if (!existing) {
                        variants.push({ dimension: v.name, sku_real: v.code || v.name, image_url: v.image } as any);
                    } else {
                        if (v.image && v.image.startsWith('data:image') && !existing.image_url?.startsWith('data:image')) existing.image_url = v.image;
                        if (v.code && v.code.length > 2) existing.sku_real = v.code;
                    }
                });
            }

            if (!itemRef) {
                if (jsonLd) itemRef = jsonLd.sku || jsonLd.mpn || '';
                if (!itemRef) {
                    const refMatch = $('body').text().match(/(?:Art\.|Ref\.|SKU|No\.)[:\s]+([A-Z0-9\-\.]+)/i);
                    if (refMatch) itemRef = refMatch[1].trim();
                }
                if (!itemRef && puppetData?.guessed_code) itemRef = puppetData.guessed_code;
            }

            if (!name) {
                name = jsonLd?.name || $('h1').first().text().trim() || $('title').text().trim() || 'No Name';
            }

            if (realCategoryPath.length === 0) {
                if (jsonLd?.category) realCategoryPath = [jsonLd.category];
                else {
                    const breadItems = $('.breadcrumb li, nav li, .breadcrumbs span');
                    breadItems.each((_, EL) => {
                        const txt = $(EL).text().trim();
                        if (txt && txt !== '>' && txt !== '/') realCategoryPath.push(txt);
                    });
                }
            }

            return {
                url,
                name,
                description: puppetData?.description || '',
                heroImage,
                pdfUrls: namedFiles.filter(f => f.format === 'pdf').map(f => f.url),
                namedFiles,
                galleryImages: Array.from(galleryImages),
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

    async exportCatalogV2(tree: any[], productsIndex: EnrichedProduct[]) {
        const outputDir = path.join(__dirname, '../../../../exports');
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        const jsonPath = path.join(outputDir, 'catalog.v2.json');
        fs.writeFileSync(jsonPath, JSON.stringify({ metadata: { generatedAt: new Date().toISOString() }, tree, products: productsIndex }, null, 2));

        const csvPath = path.join(outputDir, 'catalog.v2.csv');
        const headers = ['Category Path', 'Product Name', 'Item Ref', 'URL', 'Variant Count'];
        const rows = [headers.join(';')];
        productsIndex.forEach(p => {
            rows.push([
                (p.categoryPath || []).join(' > '),
                p.name,
                p.itemReference || '',
                p.url,
                (p.variants || []).length
            ].map(s => String(s).replace(/;/g, ',')).join(';'));
        });
        fs.writeFileSync(csvPath, '\uFEFF' + rows.join('\n'), { encoding: 'utf8' });
    }
};
