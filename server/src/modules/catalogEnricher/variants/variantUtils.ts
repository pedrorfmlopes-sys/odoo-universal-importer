
import { Page } from 'puppeteer';

export const VariantUtils = {
    unescapeUnicode(str: string): string {
        return str.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
            String.fromCharCode(parseInt(hex, 16))
        );
    },

    normalizeDimension(dim: string): string {
        if (!dim) return '';
        let d = this.unescapeUnicode(dim);
        d = d.toLowerCase();
        d = d.replace(/\s*×\s*/g, 'x');
        d = d.replace(/\s*x\s*/g, 'x');
        d = d.replace(/\s+/g, '');
        return d;
    },

    async readSkuByLabel(page: Page): Promise<string | null> {
        // Universal SKU reader looking for labels like "SKU:", "Ref:", "Article No:"
        return await page.evaluate(() => {
            const regex = /(?:Art\.|Ref\.|SKU|No\.|Número de artículo|Artikelnummer|Item number)\s*[:\.]?\s*([A-Z0-9\-\.]+)/i;

            // 1. Look in P, SPAN, DIV, LI
            const candidates = Array.from(document.querySelectorAll('p, span, div, li, td'));
            for (const el of candidates) {
                // Ignore long texts
                if ((el.textContent?.length || 0) > 100) continue;

                const m = (el.textContent || '').match(regex);
                if (m) return m[1].trim();
            }
            return null;
        });
    }
};
