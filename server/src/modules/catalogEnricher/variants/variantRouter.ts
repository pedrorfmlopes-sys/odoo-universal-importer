import { Page } from 'puppeteer';
import { GenericSelectStrategy } from './strategies/genericSelectStrategy';
import { VariantStrategy } from './variant.types';
const strategies: VariantStrategy[] = [
    // Brand Agnostic Strategies Only
    GenericSelectStrategy
];


export const VariantRouter = {
    async pickStrategy(url: string, page: Page): Promise<VariantStrategy | null> {
        const hostname = new URL(url).hostname;
        const ctx = { url, hostname, page };

        for (const strat of strategies) {
            if (await strat.detect(ctx)) {
                console.log(`   🎯 Strategy Matched: ${strat.id}`);
                return strat;
            }
        }
        return null;
    }
};
