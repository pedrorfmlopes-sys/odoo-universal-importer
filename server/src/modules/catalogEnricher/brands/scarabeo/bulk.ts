
import axios from 'axios';
import * as cheerio from 'cheerio';
import { getCeDatabase } from '../../db/ceDatabase';
import path from 'path';

// ENTRY_URLS adapted for Scarabeo
const ENTRY_URLS = [
    'https://scarabeoceramiche.it/collezioni/collezione-ceramica/moon/'
];

export async function runCrawler(providedDb?: any) {
    console.log('🕷️ Starting Scarabeo Crawler (Enhanced)...');
    const db = providedDb || getCeDatabase();

    const categoryLinks: string[] = [...ENTRY_URLS];

    for (const catUrl of categoryLinks) {
        await processCategory(catUrl, db);
    }

    console.log('✅ Crawl finished.');
}

async function processCategory(url: string, db: any) {
    console.log(`📂 Processing Category: ${url}`);

    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);

        // Extract Products
        // For Scarabeo collections, product cards might use different classes
        // In Moon collection, they seem to use .product or similar
        const productCards = $('.product, .x-col');
        let productsFound = 0;

        productCards.each((_, el) => {
            const name = $(el).find('h2, h3, .woocommerce-loop-product__title').first().text().trim();
            const productUrl = $(el).find('a').first().attr('href');
            const imageUrl = $(el).find('img').first().attr('src');

            if (productUrl && name && name.length > 2) {
                try {
                    const stmt = db.prepare(`
                        INSERT INTO ce_web_products (brand_profile_id, category_name, product_name, product_url, image_url, guessed_code)
                        VALUES (?, ?, ?, ?, ?, ?)
                        ON CONFLICT(product_url) DO UPDATE SET
                            product_name = excluded.product_name,
                            image_url = excluded.image_url,
                            crawled_at = CURRENT_TIMESTAMP
                    `);

                    stmt.run('scarabeo-profile', 'Scarabeo', name, productUrl, imageUrl, '');
                    productsFound++;
                } catch (e: any) {
                    // console.error('Error inserting product:', e.message);
                }
            }
        });

        console.log(`      Found ${productsFound} products.`);

    } catch (e: any) {
        console.error(`❌ Error processing category ${url}:`, e.message);
    }
}

if (require.main === module) {
    runCrawler().catch(console.error);
}
