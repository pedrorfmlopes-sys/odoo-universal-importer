import { IBrandAdapter } from './adapters/IBrandAdapter';
import { PatternAdapter } from './adapters/PatternAdapter';
import { HttpCheerioAdapter } from './adapters/HttpCheerioAdapter';

export const StrategyRegistry = {

    getAdapter(profile: any): IBrandAdapter {
        // 1. Determine Strategy from Profile Config
        let strategy = 'pattern'; // Default

        if (profile && profile.extraction_rules_json) {
            try {
                const config = JSON.parse(profile.extraction_rules_json);

                // Explicit strategy declared
                if (config.adapter) {
                    strategy = config.adapter;
                }
                // Heuristic: If it has "selectors" or targets with "selector", use Cheerio
                else if (config.targets) {
                    const hasSelectors = Object.values(config.targets).some((t: any) => !!t.selector);
                    if (hasSelectors) strategy = 'http_cheerio';
                }
            } catch { }
        }

        // 2. Return Interface Implementation
        console.log(`[StrategyRegistry] Selected strategy '${strategy}' for profile '${profile?.name}'`);

        switch (strategy) {
            case 'http_cheerio':
                return new HttpCheerioAdapter(profile);

            case 'pattern':
            default:
                return new PatternAdapter(profile);
        }
    }
};
