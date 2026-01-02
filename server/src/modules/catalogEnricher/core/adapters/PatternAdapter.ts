import { IBrandAdapter, JobScope, ProductItem, ExtractedAsset } from './IBrandAdapter';
import { IDriver } from '../drivers/IDriver';
import { ceProfileService } from '../../services/ceProfileService';

/**
 * The "Legacy" adapter that uses the existing Regex/Pattern logic.
 * It doesn't actually crawl for discovery (it relies on the Input Excel List),
 * and "Extraction" is just Pattern Substitution.
 */
export class PatternAdapter implements IBrandAdapter {

    constructor(private profile: any) { }

    async *discover(scope: JobScope): AsyncGenerator<ProductItem> {
        // For Pattern strategy, "Discovery" just means iterating the input list.
        if (scope.type === 'list' && scope.items) {
            for (const item of scope.items) {
                // Determine Item Code (trying common columns)
                const code = item['ItemCode'] || item['Reference'] || item['Ref'] || item['Code'];
                const name = item['Name'] || item['Description'];

                if (code) {
                    // Try to pre-calculate the product URL if a template exists
                    let productUrl = undefined;
                    const rules = this.parseRules();
                    // Use a generic 'web' key or the first available template for the main URL
                    const mainTemplate = rules.patterns['web']?.template || Object.values(rules.patterns)[0]?.template;

                    if (mainTemplate) {
                        productUrl = ceProfileService.applyPattern(item, mainTemplate);
                    }

                    yield {
                        productRef: String(code),
                        name: String(name || ''),
                        rawRow: item,
                        productUrl
                    };
                }
            }
        }
    }

    async extract(product: ProductItem, driver: IDriver): Promise<ExtractedAsset[]> {
        const results: ExtractedAsset[] = [];
        const rules = this.parseRules();

        // 1. Iterate defined patterns (Legacy single template OR V2 multi-target)
        for (const [target, patternData] of Object.entries(rules.patterns)) {
            const template = (patternData as any).template;

            if (template) {
                // Use the existing service logic to apply the pattern
                const url = ceProfileService.applyPattern(product.rawRow, template);

                if (url && url !== template) {
                    // Determine Type/Role from target key
                    let type: 'image' | 'pdf' | 'cad' | 'other' = 'other';
                    if (target === 'image') type = 'image';
                    if (target === 'pdf') type = 'pdf';
                    if (target === 'cad') type = 'cad';
                    if (target === 'web') type = 'other';

                    results.push({
                        type,
                        role: 'main', // Default role for simple patterns
                        url
                    });
                }
            }
        }

        return results;
    }

    private parseRules() {
        let patterns: Record<string, any> = {};

        if (this.profile.extraction_rules_json) {
            try {
                const json = JSON.parse(this.profile.extraction_rules_json);
                if (json.patterns) {
                    patterns = json.patterns;
                } else if (JSON.stringify(json).includes('targetType')) {
                    // Very old migration (?) or just fallback
                }
            } catch { }
        }

        // Fallback to legacy column if V2 JSON not found
        if (Object.keys(patterns).length === 0 && this.profile.url_pattern_template) {
            patterns['web'] = { template: this.profile.url_pattern_template }; // treat as web/any
        }

        return { patterns };
    }
}
