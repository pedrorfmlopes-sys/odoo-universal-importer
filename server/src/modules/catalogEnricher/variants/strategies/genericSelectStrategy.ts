
import { Page } from 'puppeteer';
import { VariantStrategy, DimensionOption } from '../variant.types';
import { VariantUtils } from '../variantUtils';

export const GenericSelectStrategy: VariantStrategy = {
    id: 'generic-select',

    async detect(ctx: { page: Page }): Promise<boolean> {
        // Look for <select>
        const hasSelect = await ctx.page.$('select');
        return !!hasSelect;
    },

    async getDimensionOptions(page: Page): Promise<DimensionOption[]> {
        return await page.evaluate(() => {
            const selects = Array.from(document.querySelectorAll('select'));
            // Heuristic: Find the select with "X" in text or "size"/"dimension" in name/label
            // For now, pick the first one with > 1 options
            const target = selects.find(s => s.options.length > 1);
            if (!target) return [];

            return Array.from(target.options).map((o, i) => ({
                label: o.text.trim(),
                value: o.value,
                index: i,
                meta: { selector: 'select' } // simplified
            }));
        });
    },

    async selectDimension(page: Page, opt: DimensionOption): Promise<void> {
        await page.select('select', opt.value || '');
    },

    async readSkuReal(page: Page): Promise<string | null> {
        return await VariantUtils.readSkuByLabel(page);
    },

    async readPdfUrls(page: Page): Promise<string[]> {
        return await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a[href$=".pdf"]')).map(a => (a as HTMLAnchorElement).href);
        });
    },

    async waitForUpdate(page: Page): Promise<void> {
        await new Promise(r => setTimeout(r, 1000)); // Generic wait
    }
};
