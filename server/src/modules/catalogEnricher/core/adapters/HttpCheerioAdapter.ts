import { IBrandAdapter, JobScope, ProductItem, ExtractedAsset } from './IBrandAdapter';
import { IDriver } from '../drivers/IDriver';
import * as cheerio from 'cheerio';
import { getCeDatabase } from '../../db/ceDatabase';

interface TargetConfig {
    strategy?: 'css_selector' | 'attribute' | 'pattern';
    selector?: string;
    attribute?: string;
    regex?: string;
    template?: string; // for mixed pattern usage
    // Filters
    excludes?: string[];
    includes?: string[];
}

interface CheerioAdapterConfig {
    discovery?: {
        strategy: 'list_input'; // For now only supports list input
    };
    url_pattern_template?: string;
    targets?: Record<string, TargetConfig>;
}

export class HttpCheerioAdapter implements IBrandAdapter {
    private config: CheerioAdapterConfig;

    constructor(private profile: any) {
        this.config = {};
        if (profile.extraction_rules_json) {
            try {
                this.config = JSON.parse(profile.extraction_rules_json);
            } catch (e) {
                console.warn('[HttpCheerioAdapter] Failed to parse rules JSON', e);
            }
        }
    }

    async *discover(scope: JobScope): AsyncGenerator<ProductItem> {
        // Default to List Input Discovery
        if (scope.type === 'list' && scope.items) {
            for (const item of scope.items) {
                // Determine Code using Primary Key (configured by user) or Heuristics
                let code: string | undefined = undefined;
                if (scope.primaryKey && item[scope.primaryKey] !== undefined) {
                    code = String(item[scope.primaryKey]);
                } else {
                    // Fallback heuristics
                    code = item['ItemCode'] || item['Reference'] || item['Ref'] || item['Code'];
                }

                const name = item['Name'] || item['Description'];

                let productUrl = '';

                // --- SMART LOOKUP (CRAWLED CATALOG) ---
                // Try to find the URL in our local crawled database first
                if (code) {
                    try {
                        const db = getCeDatabase();
                        // 1. Exact Match
                        let match = db.prepare('SELECT product_url FROM ce_web_products WHERE guessed_code = ?').get(code) as any;

                        // 2. Fuzzy Match (if needed) - e.g. Excel has '5204/A', DB has '5204'
                        if (!match && code.length > 3) {
                            const root = code.substring(0, 4);
                            // Try matching prefix 
                            match = db.prepare('SELECT product_url FROM ce_web_products WHERE guessed_code = ?').get(root) as any;

                            // Or try contains (Reverse - Contextual): DB has '5207fronte' and we have '520754'. Root is '5207'.
                            if (!match) {
                                match = db.prepare('SELECT product_url FROM ce_web_products WHERE guessed_code LIKE ?').get(root + '%') as any;
                            }

                            // Or try contains (Global): DB has 'Castellana-5364', input '5364'.
                            if (!match) {
                                match = db.prepare('SELECT product_url FROM ce_web_products WHERE guessed_code LIKE ?').get('%' + root + '%') as any;
                            }

                            // Or try contains (Standard): DB has '5204', input is '520456' -> logic is code LIKE guessed_code%
                            if (!match) {
                                match = db.prepare('SELECT product_url FROM ce_web_products WHERE ? LIKE guessed_code || "%"').get(code) as any;
                            }
                        }

                        if (match && match.product_url) {
                            productUrl = match.product_url;
                            // console.log(`[SmartLookup] Matched ${code} -> ${productUrl}`);
                        } else {
                            // LOG MISSING PRODUCT
                            // If we looked up and found nothing, track it for future analysis
                            try {
                                db.prepare(`
                                    INSERT INTO ce_missing_products (brand_profile_id, product_code) 
                                    VALUES (?, ?)
                                    ON CONFLICT(product_code) DO UPDATE SET 
                                        occurrence_count = occurrence_count + 1, 
                                        last_seen_at = CURRENT_TIMESTAMP
                                `).run(this.profile.id, code);
                            } catch (err) { /* ignore db errors */ }
                        }
                    } catch (e) {
                        // DB might not be ready or empty, ignore
                    }
                }

                const template = this.config.url_pattern_template || this.profile.url_pattern_template;

                // Only use template if we didn't find a smart match
                if (!productUrl && template) {
                    productUrl = template;

                    // 1. Replace keys present in the row
                    for (const [k, v] of Object.entries(item)) {
                        productUrl = productUrl.replace(new RegExp(`{{${k}}}`, 'gi'), String(v));
                    }

                    // 2. Virtual 'ItemCode' fallback
                    // If the template uses {{ItemCode}} but the excel uses 'Codice', we inject the value of the primary key.
                    if (productUrl.includes('{{ItemCode}}') && code) {
                        productUrl = productUrl.replace(/{{ItemCode}}/gi, String(code));
                    }
                } else if (!template && code) {
                    // No template? Maybe the list has a 'URL' column?
                    // Or we just return the code without a URL (limited enrichment)
                    if (item['URL'] || item['Url']) productUrl = item['URL'] || item['Url'];
                }

                if (code) {
                    yield {
                        productRef: String(code),
                        name: String(name || ''),
                        productUrl,
                        rawRow: item
                    };
                }
            }
        }
    }

    async extract(product: ProductItem, driver: IDriver): Promise<ExtractedAsset[]> {
        const results: ExtractedAsset[] = [];

        if (!product.productUrl) {
            return []; // Cannot scrape without URL
        }

        // 1. Fetch Page
        const page = await driver.fetchPage(product.productUrl);
        if (page.status >= 400) {
            throw new Error(`HTTP ${page.status} fetching ${product.productUrl}`);
        }

        const $ = cheerio.load(page.content || '');
        const targets = this.config.targets || {};

        // 2. Process Targets
        for (const [targetKey, rule] of Object.entries(targets)) {

            // Determine generic type from key name (heuristic) or explicit field
            let type: 'image' | 'pdf' | 'cad' | 'other' = 'other';
            if (targetKey.includes('image') || targetKey.includes('photo')) type = 'image';
            else if (targetKey.includes('pdf') || targetKey.includes('doc')) type = 'pdf';
            else if (targetKey.includes('cad') || targetKey.includes('3d')) type = 'cad';

            // Determine Role
            let role = targetKey; // 'images_main', 'pdf_tech', etc.

            // Strategy: CSS Selector
            if (rule.selector) {
                $(rule.selector).each((_, el) => {
                    let url = '';

                    // Attribute (href, src, data-src, etc)
                    const attr = rule.attribute || (type === 'image' ? 'src' : 'href');
                    url = $(el).attr(attr) || '';

                    // Fallback to commonly used lazy-loading attrs if default failed
                    if (!url && type === 'image') {
                        url = $(el).attr('data-src') || $(el).attr('data-original') || '';
                    }

                    if (url) {
                        // Normalize URL
                        try {
                            url = new URL(url, page.finalUrl).href;
                        } catch { return; } // Invalid URL

                        // Filters
                        if (rule.excludes && rule.excludes.some(ex => url.includes(ex))) return;
                        if (rule.includes && !rule.includes.some(inc => url.includes(inc))) return;

                        results.push({
                            type,
                            role,
                            url
                        });
                    }
                });
            }
            // Strategy: Pattern (Fallback mixed mode)
            // Sometimes we want to scrape images but calculate PDF link
            else if (rule.strategy === 'pattern' && rule.template) {
                // Reuse simple substitution logic
                let url = rule.template;
                // Substitution only supports Item Columns for now
                if (product.rawRow) {
                    for (const [k, v] of Object.entries(product.rawRow)) {
                        url = url.replace(new RegExp(`{{${k}}}`, 'gi'), String(v));
                    }
                }

                // Fix: Virtual ItemCode Substitution
                // Ensure {{ItemCode}} is replaced by the resolved product reference if not found in specific columns
                if (url.includes('{{ItemCode}}') && product.productRef) {
                    url = url.replace(/{{ItemCode}}/gi, product.productRef);
                }

                results.push({ type, role, url });
            }
        }

        // 3. Fallback: If no config, maybe auto-detect OG Image?
        // (Optional, keeps parity with old logic)
        if (Object.keys(targets).length === 0) {
            const ogImage = $('meta[property="og:image"]').attr('content');
            if (ogImage) {
                results.push({ type: 'image', role: 'main_og', url: new URL(ogImage, page.finalUrl).href });
            }
        }

        return results;
    }
}
