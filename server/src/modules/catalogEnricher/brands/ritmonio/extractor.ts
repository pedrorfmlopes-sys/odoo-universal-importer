
import * as cheerio from 'cheerio';

export const ritmonioExtractor = {
    extract(url: string, html: string, $: any) {
        console.log("   🇮🇹 Ritmonio specialized extractor running...");

        let name = '';
        let itemRef = '';
        let associatedProducts: any[] = [];
        let richFeatures: any = null;
        let realCategoryPath: string[] = [];

        try {
            const scriptText = $('script').map((_: any, el: any) => $(el).html()).get().join('\n');
            const productMatch = scriptText.match(/console\.log\("product",\s*'(.+?)'\);/);

            if (productMatch && productMatch[1]) {
                const rawJson = productMatch[1];
                const ritData = JSON.parse(rawJson);

                if (ritData.products && Array.isArray(ritData.products)) {
                    associatedProducts = ritData.products.map((p: any) => ({
                        article: p.article,
                        type: p.type,
                        id: p.ID,
                        url: p.article ? `https://www.ritmonio.it/en/bath-shower/product/?code=${p.article}` : null
                    }));
                }

                if (ritData.features) {
                    richFeatures = ritData.features;
                }

                const brand = "Ritmonio";
                let family = "Bath & Shower";
                if (url.includes('/kitchen/')) family = "Kitchen";

                const seriesName = ritData.seriesCode || "";
                let collection = seriesName || "";

                const seriesFromLink = $('.schedaMenu_link h4').first().text().trim();
                if (seriesFromLink) collection = seriesFromLink;

                realCategoryPath = [brand, family, collection].filter(x => x);

                if (ritData.name && ritData.name.en) name = ritData.name.en;
                if (ritData.article) itemRef = ritData.article;
            }
        } catch (e) {
            console.error("   ❌ Ritmonio extractor error:", e);
        }

        return {
            name,
            itemRef,
            associatedProducts,
            richFeatures,
            realCategoryPath
        };
    }
};
