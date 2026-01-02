import { getCeDatabase } from '../db/ceDatabase';
import { getEnrichmentPage } from './cePuppeteerService';
import path from 'path';
import fs from 'fs';

// Asset Service to handle decoupled physical downloads
export const ceAssetService = {

    // 1. Download Missing Assets for a Profile
    downloadMissingAssets: async (brandProfileId: string, assetTypes = ['3d', 'step', 'zip']) => {
        const db = getCeDatabase();
        console.log(`[AssetService] Starting Asset Batch for Profile: ${brandProfileId}`);

        // 1. Fetch Candidates (Files that have URL but no local_path)
        const products = db.prepare(`
            SELECT id, product_name, product_url, file_urls_json 
            FROM ce_web_products 
            WHERE brand_profile_id = ? 
            AND file_urls_json IS NOT NULL 
            AND file_urls_json != '[]'
        `).all(brandProfileId) as any[];

        let downloadCount = 0;
        let errorCount = 0;
        const assetsDir = path.join(__dirname, '../../../../data/assets/3d_models');
        if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

        // 2. Get Authenticated Page (Profile Aware)
        // We need the credentialId for this profile to login
        const profile = db.prepare('SELECT credential_id FROM ce_brand_profiles WHERE id = ?').get(brandProfileId) as any;
        let page = null;

        if (profile && profile.credential_id) {
            console.log(`[AssetService] Logging in with Credential: ${profile.credential_id}`);
            try {
                page = await getEnrichmentPage(profile.credential_id);
            } catch (e) {
                console.error("[AssetService] Login Failed:", e);
                throw new Error("Login Failed for Asset Batch");
            }
        } else {
            console.warn("[AssetService] No Credential linked to Profile. Trying Public Download...");
            // Reuse public page logic if needed, or error out depending on strictness
            try {
                page = await getEnrichmentPage(); // Unauthenticated Browser
            } catch (e) { throw e; }
        }

        if (!page) throw new Error("Could not initialize browser page");

        // 3. Process Files
        for (const prod of products) {
            let files: any[] = [];
            try { files = JSON.parse(prod.file_urls_json); } catch (e) { continue; }

            let changed = false;

            for (const file of files) {
                // Filter by type and check if missing local path
                const isTargetType = assetTypes.includes(file.format) || assetTypes.includes(file.type);

                if (isTargetType && !file.local_path) {
                    console.log(`[AssetService] Downloading: ${file.name} (${file.url})`);

                    try {
                        // --- DOWNLOAD LOGIC (Duplicated/Refactored from PuppeteerService) ---
                        const cookies = await page.cookies();
                        const cookieString = cookies.map((c: any) => `${c.name}=${c.value}`).join('; ');

                        const response = await require('axios')({
                            method: 'GET',
                            url: file.url,
                            responseType: 'stream',
                            headers: {
                                'Cookie': cookieString,
                                'User-Agent': await page.browser().userAgent()
                            },
                            timeout: 120000 // 2 mins for big files
                        });

                        // Determine Filename
                        let filename = path.basename(file.url).split('?')[0];
                        if (filename === 'download' || !filename.includes('.')) {
                            const cd = response.headers['content-disposition'];
                            if (cd) {
                                const match = cd.match(/filename="?([^"]+)"?/);
                                if (match && match[1]) filename = match[1];
                            }
                        }
                        // Fallback Name
                        if (!filename.includes('.')) {
                            const ext = file.format === 'step' ? '.stp' : '.zip';
                            filename = `${prod.product_name.replace(/[^a-z0-9]/gi, '_')}${ext}`;
                        }

                        // Save File
                        const savePath = path.join(assetsDir, filename);
                        const writer = fs.createWriteStream(savePath);
                        response.data.pipe(writer);

                        await new Promise((resolve, reject) => {
                            writer.on('finish', () => resolve(true));
                            writer.on('error', reject);
                        });

                        console.log(`✅ [AssetService] Downloaded: ${savePath}`);
                        file.local_path = savePath;
                        changed = true;
                        downloadCount++;

                    } catch (e: any) {
                        console.error(`❌ [AssetService] Failed ${file.url}: ${e.message}`);
                        file.error = e.message;
                        errorCount++;
                    }
                }
            }

            if (changed) {
                // Update DB for this product
                db.prepare('UPDATE ce_web_products SET file_urls_json = ? WHERE id = ?')
                    .run(JSON.stringify(files), prod.id);
            }
        }

        console.log(`[AssetService] Batch Complete. Downloaded: ${downloadCount}, Errors: ${errorCount}`);

        // Optional: Leave browser open for next batch or close? 
        // cePuppeteerService manages the singleton, so we leave it.

        return { downloadCount, errorCount };
    }
};
