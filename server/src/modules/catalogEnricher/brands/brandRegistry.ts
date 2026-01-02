
import { ritmonioExtractor } from './ritmonio/extractor';
import { betteConfig } from './bette/extractor';

export interface BrandHandler {
    extract?: (url: string, html: string, $: any) => any;
    crawler?: (db: any) => Promise<void>;
    config?: any;
}

export const brandRegistry = {
    getHandler(url: string): BrandHandler | null {
        if (url.includes('ritmonio.it')) {
            return { extract: ritmonioExtractor.extract };
        }
        if (url.includes('scarabeoceramiche.it')) {
            // Scarabeo uses a separate bulk crawler
            return {};
        }
        if (url.includes('my-bette.com')) {
            return { config: betteConfig };
        }
        return null;
    }
};
