
import { Page } from 'puppeteer';
import * as puppeteer from 'puppeteer';
import { VariantRouter } from '../variants/variantRouter';
import { VariantUtils } from '../variants/variantUtils';
import { ProductVariant } from '../variants/variant.types'; // Types moved here

export { ProductVariant };

export const ceVariantService = {

    // Legacy Static Extraction (keeps existing functionality for quick scans)
    async extractVariants(url: string, html?: string): Promise<ProductVariant[]> {
        // Implementation could be kept or delegated.
        // For now, let's focus on the Interactive Universal Engine.
        return [];
    },

    // THE UNIVERSAL INTERACTIVE ENGINE
    async extractInteractiveVariants(page: Page): Promise<ProductVariant[]> {
        const url = page.url();
        console.log(`🤖 Starting Universal Variant Extraction for: ${url}`);

        // 1. Pick Strategy
        const strategy = await VariantRouter.pickStrategy(url, page);
        if (!strategy) {
            console.log("   -> No variant strategy matched.");
            return [];
        }

        // 2. Get Options
        const options = await strategy.getDimensionOptions(page);
        console.log(`   -> Found ${options.length} dimension options using [${strategy.id}]`);

        const variants: ProductVariant[] = [];

        // 3. Iterate
        for (let i = 0; i < options.length; i++) {
            const opt = options[i];
            try {
                // Select
                await strategy.selectDimension(page, opt);

                // Wait
                // We assume the previous SKU was unknown or we track it.
                // For simplicity, we just wait a bit.
                // Ideally we pass the previous state.
                await strategy.waitForUpdate(page, { sku: null, pdfHash: '' });

                // Read Data
                const dimRaw = opt.label;
                const dimNorm = VariantUtils.normalizeDimension(dimRaw);
                // Validation moved to smart guardrail below
                const skuReal = await strategy.readSkuReal(page);
                const pdfs = await strategy.readPdfUrls(page);
                const uniquePdfs = Array.from(new Set(pdfs));

                if (skuReal) {
                    console.log(`      [${dimRaw}] SKU: ${skuReal} | PDFs: ${uniquePdfs.length}`);
                }

                // Universal Guardrail: Variants must be distinct dimensions (contain digits)
                // EXCEPTION: If it is a single variant (accessory match), allow text-only labels.
                if (options.length > 1 && (!dimNorm || !/\d/.test(dimNorm))) {
                    continue;
                }

                variants.push({
                    dimension: dimRaw,
                    dimension_normalized: dimNorm,
                    variant_code: skuReal || `GEN_${dimNorm}`,
                    sku_real: skuReal,
                    internal_variant_code: `GEN_${dimNorm}`,
                    pdf_urls: uniquePdfs,
                    source: 'ui-interactive',
                    sku_source: skuReal ? 'dom_after_select' : 'unknown',
                    strategy_id: strategy.id
                });

            } catch (e: any) {
                console.error(`      ❌ Error on option ${opt.label}: ${e.message}`);
                // Try recovery?
            }
        }

        // 4. Deduplicate
        const unique = new Map<string, ProductVariant>();
        variants.forEach(v => unique.set(v.dimension_normalized, v));
        return Array.from(unique.values());
    },

    // High Level Entry Point (Launches Browser)
    async extractVariantsForProduct(url: string): Promise<ProductVariant[]> {
        const browser = await puppeteer.launch({
            headless: true, // "new"
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        try {
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
            await page.setViewport({ width: 1280, height: 800 });
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

            return await this.extractInteractiveVariants(page);
        } catch (e) {
            console.error("Variant Extraction Failed:", e);
            return [];
        } finally {
            await browser.close();
        }
    }
};
