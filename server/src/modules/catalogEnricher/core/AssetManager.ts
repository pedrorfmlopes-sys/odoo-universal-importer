import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import axios from 'axios';
import { getCeDatabase } from '../db/ceDatabase';
import { IDriver } from './drivers/IDriver';

export interface ImageProcessOptions {
    maxWidth?: number;
    format?: 'webp' | 'jpeg' | 'png';
    quality?: number;
}

export interface AssetRecord {
    brandProfileId: string;
    productRef: string;
    assetType: 'image' | 'pdf' | 'cad' | 'other';
    role: string; // 'main', 'gallery', etc
    url: string;
    jobId?: string;
    productUrl?: string;
}

export const assetManager = {

    /**
     * Ensures the asset is downloaded, processed, and registered in the DB.
     * Idempotent: checks hash/existence before re-downloading.
     */
    async processAsset(
        asset: AssetRecord,
        storageRoot: string,
        options: { download: boolean, optimize?: ImageProcessOptions }
    ): Promise<{ status: 'ok' | 'error' | 'skipped', localPath?: string, error?: string }> {

        const db = getCeDatabase();

        // 1. Generate Asset Key
        const assetKey = `${asset.brandProfileId}_${asset.productRef}_${asset.assetType}_${asset.role}`;

        // 2. Check DB Cache
        const existing = db.prepare('SELECT * FROM ce_assets WHERE asset_key = ?').get(assetKey) as any;

        // If we have it and it's fresh enough (e.g. < 7 days) and file exists, skip?
        // For now, let's assume if it exists and status is 200, we skip unless force_refresh is needed (not implemented yet)
        if (existing && existing.http_status === 200 && existing.local_path && fs.existsSync(existing.local_path)) {
            // Update last_seen_at
            db.prepare("UPDATE ce_assets SET last_seen_at = datetime('now'), job_id = ? WHERE id = ?")
                .run(asset.jobId, existing.id);
            return { status: 'skipped', localPath: existing.local_path };
        }

        if (!options.download) {
            // Register as "found" (link only)
            this.upsertAssetDB({
                ...asset,
                assetKey,
                httpStatus: 200, // Assumed valid if we are here via a validated flow, or we should validate?
                // Ideally the caller validates first. But let's verify if not expensive.
            });
            return { status: 'ok' };
        }

        // 3. Download
        try {
            const tempDir = path.join(storageRoot, 'temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

            const filename = `${asset.brandProfileId}_${asset.productRef}_${asset.role}_${Date.now()}`;
            const tempPath = path.join(tempDir, filename); // No extension yet

            // Streaming download
            const response = await axios({
                method: 'GET',
                url: asset.url,
                responseType: 'stream'
            });

            const writer = fs.createWriteStream(tempPath);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', () => resolve(null));
                writer.on('error', reject);
            });

            // 4. Determine File Type & Optimize if Image
            let finalExt = path.extname(asset.url).split('?')[0] || '.bin';
            let finalPath = '';
            let fileHash = '';

            // Calculate Hash
            const fileBuffer = fs.readFileSync(tempPath);
            const hashSum = crypto.createHash('sha256');
            hashSum.update(fileBuffer);
            fileHash = hashSum.digest('hex');

            // Setup Brand Folder
            const brandDir = path.join(storageRoot, 'assets', asset.brandProfileId);
            if (!fs.existsSync(brandDir)) fs.mkdirSync(brandDir, { recursive: true });

            if (asset.assetType === 'image' && options.optimize) {
                // Resize/Convert using Sharp
                const sharpInstance = sharp(tempPath);

                if (options.optimize.maxWidth) {
                    sharpInstance.resize({ width: options.optimize.maxWidth, withoutEnlargement: true });
                }

                const fmt = options.optimize.format || 'webp';
                if (fmt === 'webp') sharpInstance.webp({ quality: options.optimize.quality || 80 });
                if (fmt === 'jpeg') sharpInstance.jpeg({ quality: options.optimize.quality || 80 });
                if (fmt === 'png') sharpInstance.png({ quality: options.optimize.quality || 80 });

                finalExt = `.${fmt}`;
                finalPath = path.join(brandDir, `${asset.brandProfileId}_${asset.productRef}_${asset.role}${finalExt}`);

                await sharpInstance.toFile(finalPath);

                // Cleanup temp
                fs.unlinkSync(tempPath);

            } else {
                // Move as is (PDFs, CAD, or raw images)
                finalPath = path.join(brandDir, `${asset.brandProfileId}_${asset.productRef}_${asset.role}${finalExt}`);
                fs.copyFileSync(tempPath, finalPath);
                fs.unlinkSync(tempPath);
            }

            // 5. Update DB
            this.upsertAssetDB({
                ...asset,
                assetKey,
                localPath: finalPath,
                fileHash,
                httpStatus: 200
            });

            return { status: 'ok', localPath: finalPath };

        } catch (err: any) {
            console.error(`[AssetManager] Failed ${asset.url}`, err.message);
            // Record failure
            this.upsertAssetDB({
                ...asset,
                assetKey,
                httpStatus: err.response?.status || 0,
                error: err.message
            });
            return { status: 'error', error: err.message };
        }
    },

    upsertAssetDB(data: any) {
        const db = getCeDatabase();
        const now = new Date().toISOString();

        // Check if exists to decide INSERT or UPDATE (SQLite upsert syntax is also possible)
        // We defined asset_key as UNIQUE

        const stmt = db.prepare(`
            INSERT INTO ce_assets (
                id, asset_key, job_id, brand_profile_id, product_ref, asset_type, role,
                original_url, product_url, local_path, http_status, file_hash, 
                last_checked_at, last_seen_at, error_log, created_at, updated_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, 
                ?, ?, ?, ?, ?, 
                ?, ?, ?, ?, ?
            )
            ON CONFLICT(asset_key) DO UPDATE SET
                job_id=excluded.job_id,
                original_url=excluded.original_url,
                local_path=COALESCE(excluded.local_path, local_path),
                http_status=excluded.http_status,
                file_hash=COALESCE(excluded.file_hash, file_hash),
                last_checked_at=excluded.last_checked_at,
                last_seen_at=excluded.last_seen_at,
                error_log=excluded.error_log,
                updated_at=excluded.updated_at
        `);

        // Generate ID if new
        // We can't know if it's new easily without query, but ON CONFLICT handles the logic.
        // However, we need an ID for the INSERT part. Ideally we query first or use a deterministic UUID based on key?
        // Let's use deterministic UUID or random. Since we have ON CONFLICT, the ID is only used if inserting.

        const id = crypto.randomUUID();

        stmt.run(
            id, data.assetKey, data.jobId, data.brandProfileId, data.productRef, data.assetType, data.role,
            data.url, data.productUrl, data.localPath, data.httpStatus, data.fileHash,
            now, now, data.error, now, now
        );
    }
};
