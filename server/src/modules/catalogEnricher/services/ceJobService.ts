
import { v4 as uuidv4 } from 'uuid';
import { getCeDatabase } from '../db/ceDatabase';
import { CeJob, JobType, JobStatus } from '../types/ceTypes';
import { ceProbeService } from './ceProbeService';
import { ceProfileService } from './ceProfileService';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { Server as SocketIOServer } from 'socket.io';
import fs from 'fs';
import path from 'path';

let io: SocketIOServer | null = null;

export const initJobService = (socketIo: SocketIOServer) => {
    io = socketIo;
};

// Simple in-memory concurrency controller to replace p-queue (avoiding ESM issues)
class SimpleQueue {
    private queue: (() => Promise<void>)[] = [];
    private active = 0;
    private concurrency = 2;

    constructor(concurrency: number) {
        this.concurrency = concurrency;
    }

    add(fn: () => Promise<void>) {
        this.queue.push(fn);
        this.next();
    }

    private next() {
        if (this.active >= this.concurrency || this.queue.length === 0) return;

        const fn = this.queue.shift();
        if (fn) {
            this.active++;
            fn().finally(() => {
                this.active--;
                this.next();
            });
        }
    }
}

const workerQueue = new SimpleQueue(1); // 1 Job at a time
const itemQueue = new SimpleQueue(2);   // 2 Items (requests) at a time within jobs

export const ceJobService = {

    createJob(type: JobType, params: any): CeJob {
        const db = getCeDatabase();
        const id = uuidv4();
        const job: CeJob = {
            id,
            type,
            status: 'pending',
            progress: 0,
            params,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const stmt = db.prepare(`
            INSERT INTO ce_jobs (id, profile_id, type, status, progress, params_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            job.id,
            params.profileId || null,
            job.type,
            job.status,
            job.progress,
            JSON.stringify(job.params),
            job.createdAt,
            job.updatedAt
        );

        // Notify worker
        this.triggerWorker();

        return job;
    },

    getJob(id: string): CeJob | undefined {
        const db = getCeDatabase();
        const row = db.prepare('SELECT * FROM ce_jobs WHERE id = ?').get(id) as any;
        if (!row) return undefined;

        return {
            id: row.id,
            type: row.type as JobType,
            status: row.status as JobStatus,
            progress: row.progress,
            params: row.params_json ? JSON.parse(row.params_json) : {},
            resultSummary: row.result_summary_json ? JSON.parse(row.result_summary_json) : null,
            errorText: row.error_text,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    },



    // List All Jobs (with optional Profile filter)
    getAllJobs(profileId?: string): CeJob[] {
        const db = getCeDatabase();
        let rows;
        if (profileId) {
            rows = db.prepare('SELECT * FROM ce_jobs WHERE profile_id = ? ORDER BY created_at DESC').all(profileId);
        } else {
            rows = db.prepare('SELECT * FROM ce_jobs ORDER BY created_at DESC').all();
        }

        return rows.map((row: any) => ({
            id: row.id,
            type: row.type,
            status: row.status,
            progress: row.progress,
            params: row.params_json ? JSON.parse(row.params_json) : {},
            resultSummary: row.result_summary_json ? JSON.parse(row.result_summary_json) : null,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        } as CeJob));
    },

    getJobItems(jobId: string) {
        const db = getCeDatabase();

        // 1. Determine Job Type to know where to look
        const job = db.prepare('SELECT type FROM ce_jobs WHERE id = ?').get(jobId) as { type: string };

        if (job && job.type === 'crawler') {
            // CRAWLER JOBS: Fetch from Catalog (ce_web_products)
            const rows = db.prepare('SELECT * FROM ce_web_products WHERE job_id = ?').all(jobId);

            return rows.map((r: any) => ({
                row_id: String(r.id),
                key_value: r.guessed_code || r.product_name, // Show SKu or Name
                status: 'ok', // Catalog items are successful by definition
                product_url: r.product_url,
                // Mock assets structure for UI
                assets_json: r.image_url ? JSON.stringify([{ type: 'image', url: r.image_url, role: 'main' }]) : '[]',
                evidence_json: `Category: ${r.category_name} | ${r.product_name}`,
                variants_json: r.variants_json,
                gallery_json: r.gallery_json, // EXPOSE GALLERY
                file_urls_json: r.file_urls_json, // EXPOSE FILES
                image_url: r.image_url,
                product_name: r.product_name,
                category_name: r.category_name,
                collection_name: r.collection_name,
                features_json: r.features_json, // EXPOSE FEATURES
                associated_products_json: r.associated_products_json, // EXPOSE ASSOCIATED PRODUCTS
                updated_at: r.crawled_at
            }));
        } else {
            // ENRICH JOBS: Fetch from Job Items (ce_job_items)
            const rows = db.prepare('SELECT * FROM ce_job_items WHERE job_id = ?').all(jobId);
            return rows.map((r: any) => {
                let evidence = null;
                let assets = null;
                try { evidence = r.evidence_json ? JSON.parse(r.evidence_json) : null; } catch (e) { }
                try { assets = r.assets_json ? JSON.parse(r.assets_json) : null; } catch (e) { }
                return { ...r, evidence, assets };
            });
        }
    },

    triggerWorker() {
        workerQueue.add(async () => {
            // Find next pending job
            const db = getCeDatabase();
            const jobRow = db.prepare("SELECT * FROM ce_jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1").get() as any;

            if (jobRow) {
                await this.processJob(jobRow.id);
            }
        });
    },

    async processJob(jobId: string) {
        const db = getCeDatabase();

        // Mark running
        db.prepare("UPDATE ce_jobs SET status = 'running', updated_at = datetime('now') WHERE id = ?").run(jobId);

        try {
            const job = this.getJob(jobId);
            if (!job) return;

            if (job.type === 'analyze') {
                await this.runAnalyzeJob(job);
            } else if (job.type === 'enrich') {
                await this.runEnrichJob(job);
            } else if (job.type === 'targeted_enrichment') {
                await this.runTargetedEnrichmentJob(job);
            }

            // Mark completed
            db.prepare("UPDATE ce_jobs SET status = 'completed', progress = 100, updated_at = datetime('now') WHERE id = ?").run(jobId);

        } catch (err: any) {
            console.error(`[Job Worker] Job ${jobId} failed:`, err);
            db.prepare("UPDATE ce_jobs SET status = 'failed', error_text = ?, updated_at = datetime('now') WHERE id = ?").run(err.message, jobId);
        }
    },

    async runEnrichJob(job: CeJob) {
        const { uploadId, urlColumn, urls } = job.params;
        if ((!uploadId || !urlColumn) && (!urls || !Array.isArray(urls))) {
            throw new Error("Missing uploadId/urlColumn OR urls array");
        }

        const db = getCeDatabase();

        // 1. Identify Profile & Adapter
        let profile = null;
        if (job.params.profileId) {
            profile = db.prepare('SELECT * FROM ce_brand_profiles WHERE id = ?').get(job.params.profileId) as any;
        }

        // 2. Select Adapter via Registry
        const { StrategyRegistry } = await import('../core/StrategyRegistry');
        const adapter = StrategyRegistry.getAdapter(profile || {});

        // 3. Prepare Discovery Scope

        let actualUrlCol = urlColumn || 'url';
        let rowsToProcess: any[] = [];

        if (urls && urls.length > 0) {
            // Direct URL Input Mode
            rowsToProcess = urls.map((u: string, i: number) => ({ url: u, Code: `DIRECT_${i}` }));
            actualUrlCol = 'url';
        } else if (uploadId) {
            // Excel Upload Mode
            const { ceExcelService } = await import('./ceExcelService');
            const allRows = ceExcelService.readRows(uploadId);

            // Fix: Normalize urlColumn match against row keys to handle whitespace discrepancies
            if (allRows.length > 0) {
                const firstRow = allRows[0];
                const keys = Object.keys(firstRow);

                console.log('[DEBUG] Excel Keys:', keys);
                console.log('[DEBUG] Requested Column:', urlColumn);

                // Try exact trim match first
                const match = keys.find(k => k.trim() === urlColumn.trim());
                if (match) actualUrlCol = match;

                console.log('[DEBUG] Actual Column to use:', actualUrlCol);
            }

            rowsToProcess = allRows;
            if (job.params.sample === true) {
                rowsToProcess = rowsToProcess
                    .filter((r: any) => r[actualUrlCol])
                    .sort(() => 0.5 - Math.random())
                    .slice(0, 5);
            }
        }

        const scope = {
            type: 'list' as const,
            items: rowsToProcess,
            profileConfig: profile,
            primaryKey: actualUrlCol
        };

        // 4. Initialize Driver & AssetManager
        const { HttpDriver } = await import('../core/drivers/HttpDriver');
        const { PuppeteerDriver } = await import('../core/drivers/PuppeteerDriver');
        const { assetManager } = await import('../core/AssetManager');

        // Driver Selection
        let driver: any;
        if (profile && profile.auth_required) {
            console.log(`[EnrichJob] Auth Required. Using PuppeteerDriver with Credential: ${profile.credential_id}`);
            driver = new PuppeteerDriver(profile.credential_id);
        } else {
            console.log(`[EnrichJob] Public Site. Using HttpDriver.`);
            driver = new HttpDriver();
        }

        let processed = 0;
        const total = rowsToProcess.length; // Approximate for progress

        const insertItem = db.prepare(`
            INSERT INTO ce_job_items (job_id, row_id, key_value, status, confidence, product_url, assets_json, evidence_json, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `);

        // 5. Execution Pipeline
        try {
            for await (const product of adapter.discover(scope)) {

                const rowId = product.rawRow ? (String(product.rawRow['__rowNum'] || processed)) : String(processed);

                // EXTRACT
                let extractedAssets: any[] = [];
                let status = 'ok';
                let errorText = '';

                try {
                    extractedAssets = await adapter.extract(product, driver);
                } catch (e: any) {
                    status = 'error';
                    errorText = e.message;
                }

                // PROCESS ASSETS (Download / Validate)
                const processedAssets = [];
                const downloadEnabled = job.params.download === true;
                const optimizeOpts = job.params.optimize; // e.g. { maxWidth: 1200 }

                for (const asset of extractedAssets) {
                    // Decide if we should check accessibility first using driver?
                    // The assetManager can handle "download=false" to just register it.
                    // But if we want to "Validate Links", we might want explicit check.

                    if (job.params.validateLinks) {
                        const check = await driver.validateLink(asset.url);
                        if (!check.valid) {
                            processedAssets.push({ ...asset, status: 'dead', error: check.error || `HTTP ${check.status}` });
                            continue;
                        }
                    }

                    // Handover to AssetManager
                    const record = {
                        brandProfileId: profile ? profile.id : 'unknown',
                        productRef: product.productRef,
                        assetType: asset.type,
                        role: asset.role,
                        url: asset.url,
                        jobId: job.id,
                        productUrl: product.productUrl
                    };

                    const result = await assetManager.processAsset(record, process.cwd() + '/data/catalog-enricher', { // TODO: use configured storage root
                        download: downloadEnabled,
                        optimize: optimizeOpts
                    });

                    processedAssets.push({
                        ...asset,
                        status: result.status,
                        localPath: result.localPath,
                        error: result.error
                    });
                }

                // CHECK FOR ENRICHMENT ERROR
                let finalStatus = status;
                let finalError = errorText;
                if (product.name === 'Error' || (product as any).extract_error) {
                    finalStatus = 'error';
                    finalError = (product as any).extract_error || 'Unknown Enrichment Error';
                }

                // SAVE JOB ITEM
                insertItem.run(
                    job.id,
                    rowId,
                    product.productRef || 'unknown',
                    finalStatus,
                    100,
                    product.productUrl || '',
                    JSON.stringify(processedAssets),
                    JSON.stringify({ error: finalError })
                );

                processed++;
                if (processed % 5 === 0) {
                    db.prepare('UPDATE ce_jobs SET progress = ? WHERE id = ?').run(Math.round((processed / total) * 100), job.id);
                }
            }
        } finally {
            await driver.close();
        }
    },

    async runTargetedEnrichmentJob(job: CeJob) {
        const { uploadId, skuColumn, profileId, sheet, startRow, endRow, urls } = job.params;
        console.log(`🚀 [Targeted Enrichment] Starting Job ${job.id}`, { uploadId, skuColumn, profileId, sheet, range: `${startRow}-${endRow || 'end'}`, urlsCount: urls?.length });

        if ((!uploadId || !skuColumn) && (!urls || !Array.isArray(urls))) {
            throw new Error("Missing uploadId/skuColumn OR urls array");
        }

        const db = getCeDatabase();
        const profile = db.prepare('SELECT * FROM ce_brand_profiles WHERE id = ?').get(profileId) as any;
        if (!profile) throw new Error("Profile not found");

        const { ceExcelService } = await import('./ceExcelService');
        const { resolveSkuToUrl } = await import('./cePuppeteerService');
        const { ceEnrichmentService } = await import('./ceEnrichmentService');

        let allRows: any[] = [];

        if (urls && urls.length > 0) {
            // Direct Input Mode
            allRows = urls.map((sku: string, i: number) => ({ [skuColumn || 'sku']: sku, __rowNum: i }));
            console.log(`[Targeted Enrichment] Using ${allRows.length} direct inputs.`);
        } else if (uploadId) {
            try {
                // Try loading from ce_uploads (Excel format)
                allRows = ceExcelService.readRows(uploadId, { sheetName: sheet });
                console.log(`[Targeted Enrichment] Read ${allRows.length} rows from ce_uploads (Excel). Sheet: ${sheet || 'Default'}`);
            } catch (e: any) {
                console.log(`[Targeted Enrichment] Not found in ce_uploads, trying ce_pricelists (JSON)...`);
                // Fallback for Pricelists
                let loaded = false;
                try {
                    const pl = db.prepare('SELECT data_path, filename FROM ce_pricelists WHERE id = ?').get(uploadId) as any;
                    if (pl && pl.data_path) {
                        const fs = require('fs');
                        if ((pl.filename.endsWith('.json') || pl.data_path.endsWith('.json')) && fs.existsSync(pl.data_path)) {
                            allRows = JSON.parse(fs.readFileSync(pl.data_path, 'utf-8'));
                            loaded = true;
                        } else if (fs.existsSync(pl.data_path)) {
                            // Try reading raw excel file from data_path
                            const XLSX = require('xlsx');
                            const workbook = XLSX.readFile(pl.data_path);
                            const targetSheetName = sheet || workbook.SheetNames[0];
                            const worksheet = workbook.Sheets[targetSheetName];
                            allRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" }); // Use defval to ensure columns align
                            loaded = true;
                        }
                    }
                } catch (fbErr) {
                    console.warn(`[Fallback Error] ${fbErr}`);
                }

                if (!loaded) {
                    throw new Error(`Failed to read upload/pricelist ${uploadId}: ${e.message}`);
                }
            }
        }

        if (allRows.length === 0) return;

        // Apply Row Filtering (1-based index from UI -> 0-based array)
        // startRow 1 means index 0
        const startIdx = startRow ? Math.max(0, startRow - 1) : 0;
        const endIdx = endRow ? Math.min(allRows.length, endRow) : allRows.length;

        const rowsToProcess = allRows.slice(startIdx, endIdx);
        console.log(`[Targeted Enrichment] Processing subset: ${rowsToProcess.length} rows (Index ${startIdx} to ${endIdx})`);

        // Find actual column name (handle whitespace)
        const keys = Object.keys(allRows[0]);
        const actualSkuCol = keys.find(k => k.trim().toLowerCase() === skuColumn.trim().toLowerCase()) || skuColumn;

        // Find Italian and English name columns specifically
        const itaCol = keys.find(k => k.trim().toLowerCase() === 'nome_ita');
        const engCol = keys.find(k => k.trim().toLowerCase() === 'nome_eng');
        const spaCol = keys.find(k => k.trim().toLowerCase() === 'nome_spa');

        const nameKeywords = ['nome_eng', 'nome_ita', 'nome_spa', 'nome', 'description', 'descrição', 'descrizione', 'serie', 'family', 'familia', 'famille', 'coleção', 'colección', 'collection', 'name', 'productcategory'];
        const actualNameCol = keys.find(k => ['nome_ita', 'nome_spa', 'description', 'name'].some(kw => k.trim().toLowerCase() === kw))
            || keys.find(k => nameKeywords.some(kw => k.trim().toLowerCase() === kw))
            || keys.find(k => nameKeywords.some(kw => k.trim().toLowerCase().includes(kw)));

        let processed = 0;
        const total = rowsToProcess.length;
        let itemsFound = 0;

        // Initialize counters_json for resurrected jobs to find
        db.prepare("UPDATE ce_jobs SET counters_json = ?, updated_at = datetime('now') WHERE id = ?").run(
            JSON.stringify({ found: 0, processed: 0, total }),
            job.id
        );

        // Immediate Emit to show monitor
        if (io) {
            io.emit('job-progress', {
                jobId: job.id,
                progress: 0,
                status: 'running',
                message: `Initializing on ${total} items...`,
                processed: 0,
                total,
                itemsFound: 0
            });
        }

        const insertItem = db.prepare(`
            INSERT INTO ce_job_items (job_id, row_id, key_value, status, confidence, product_url, assets_json, evidence_json, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `);

        for (const row of rowsToProcess) {
            const skuValue = String(row[actualSkuCol] || '').trim();
            const names: string[] = [];
            if (itaCol && row[itaCol]) names.push(String(row[itaCol]).trim());
            if (engCol && row[engCol]) names.push(String(row[engCol]).trim());
            if (spaCol && row[spaCol]) names.push(String(row[spaCol]).trim());

            // Fallback to detected name column if others missing
            if (names.length === 0 && actualNameCol && row[actualNameCol]) {
                names.push(String(row[actualNameCol]).trim());
            }

            const rowId = String(row['__rowNum'] || processed);

            if (!skuValue) {
                processed++;
                continue;
            }

            console.log(`[Targeted Job] Processing SKU: ${skuValue} (${processed + 1}/${total})`);

            let url: string | null = null;
            try {
                // 1. Resolve SKU to URL (with multi-language names for prediction)
                url = await resolveSkuToUrl(profileId, skuValue, { names });

                if (url) {
                    // 2. Enrich (Enable Asset Download)
                    const enriched = await ceEnrichmentService.enrichProductFamily(url, job.id, { downloadAssets: true });

                    let finalStatus = 'ok';
                    let finalError = undefined;

                    if (enriched.name === 'Error' || (enriched as any).extract_error) {
                        finalStatus = 'error';
                        finalError = (enriched as any).extract_error || 'Unknown Enrichment Error';
                        console.warn(`[Targeted Job] Item marked as error: ${finalError}`);
                    }

                    // 3. Save to Job Items (Enrich evidence with images for UI visibility)
                    insertItem.run(
                        job.id,
                        rowId,
                        skuValue,
                        finalStatus,
                        100,
                        url,
                        JSON.stringify(enriched.namedFiles || []),
                        JSON.stringify({
                            name: enriched.name,
                            description: enriched.description,
                            heroImage: enriched.heroImage,
                            gallery: enriched.galleryImages,
                            error: finalError
                        }),
                    );

                    // 4. Also Save to Main Catalog for persistence
                    db.prepare(`
                        INSERT OR REPLACE INTO ce_web_products (
                            job_id, brand_profile_id, product_name, guessed_code, product_url, 
                            image_url, category_name, gallery_json, file_urls_json, 
                            features_json, variants_json, crawled_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                    `).run(
                        job.id,
                        profileId,
                        enriched.name || skuValue,
                        skuValue,
                        url,
                        enriched.heroImage,
                        (enriched.categoryPath || []).join(' > '),
                        JSON.stringify(enriched.galleryImages || []),
                        JSON.stringify(enriched.namedFiles || []),
                        JSON.stringify(enriched.specs || {}),
                        JSON.stringify(enriched.variants || [])
                    );

                } else {
                    insertItem.run(job.id, rowId, skuValue, 'not_found', 0, null, null, null);
                }
            } catch (e: any) {
                console.error(`[Targeted Job] Failed SKU ${skuValue}:`, e.message);
                insertItem.run(job.id, rowId, skuValue, 'error', 0, null, null, JSON.stringify({ error: e.message }));
            }

            processed++;
            if (url) itemsFound++;

            const progress = Math.round((processed / total) * 100);

            // Update counters_json and progress in DB
            db.prepare("UPDATE ce_jobs SET progress = ?, counters_json = ?, updated_at = datetime('now') WHERE id = ?").run(
                progress,
                JSON.stringify({ found: itemsFound, processed, total }),
                job.id
            );

            // CRITICAL FIX: Update in-memory object so polling (getActiveJobs) sees progress
            job.progress = progress;
            job.counters = { found: itemsFound, processed, total };

            if (io) io.emit('job-progress', {
                jobId: job.id,
                progress,
                status: 'running',
                message: `SKU: ${skuValue}`,
                processed,
                total,
                itemsFound
            });
        }
    },

    async runAnalyzeJob(job: CeJob) {
        const { url } = job.params;
        if (!url) throw new Error("Missing URL in job params");

        const db = getCeDatabase();

        // 1. Probe (Metadata)
        const probeResult = await ceProbeService.probeUrl(url);

        // 2. Extract Domain for Profile Key
        let domain = 'unknown';
        try {
            const u = new URL(url);
            domain = u.hostname;
        } catch { }

        // 3. Fetch Content for "Learning" (Simulate scraping content to pass to AI)
        // In a real scenario, ceProbeService might return the full body or we fetch again
        // For efficiency, we will fetch briefly here or reuse if probe stored it (probe currently doesn't return body)
        // Let's do a quick fetch for learning
        let htmlSample = '';
        try {
            // Re-fetch to get body for AI (axios)
            const res = await (await import('axios')).default.get(url, {
                timeout: 5000,
                validateStatus: (status) => status < 500,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) OdooImporterBot/1.0' }
            });
            htmlSample = typeof res.data === 'string' ? res.data : '';
        } catch (e) {
            console.warn('[Analyze Job] Failed to fetch content for AI learning');
        }

        // 4. AI / Heuristic Learning
        const { ceAiService } = await import('./ceAiService'); // Dynamic import to avoid circular dependency issues if any
        const profile = await ceAiService.learnProfile(domain, htmlSample);

        // 5. Save Learned Profile (Auto-save on analyze)
        await ceAiService.saveProfile(profile);

        // Save result in summary (DB)
        const summary = {
            probe: probeResult,
            domain,
            learnedProfile: profile,
            strategies: [
                { id: 'cheerio_static', name: 'Static HTML', confidence: probeResult.requiresJs ? 10 : 90 }
            ]
        };

        db.prepare("UPDATE ce_jobs SET result_summary_json = ? WHERE id = ?").run(JSON.stringify(summary), job.id);

        // Simulate some processing time
        await new Promise(r => setTimeout(r, 500));
    },

    stopJob(id: string) {
        const db = getCeDatabase();

        // 1. Tell Queue Service to abort
        const { ceQueueService } = require('./ceQueueService'); // Dynamic import
        ceQueueService.stopJob(id);

        // 2. Mark as stopped in DB
        const res = db.prepare("UPDATE ce_jobs SET status = 'stopped' WHERE id = ?").run(id);

        return { success: res.changes > 0 };
    },

    deleteJob(id: string) {
        const db = getCeDatabase();

        // 1. Delete Dependencies first (FK Constraints)
        db.prepare('DELETE FROM ce_job_items WHERE job_id = ?').run(id);
        db.prepare('DELETE FROM ce_crawler_staging WHERE job_id = ?').run(id);
        db.prepare('DELETE FROM ce_web_products WHERE job_id = ?').run(id);

        // 2. Delete Job
        const res = db.prepare('DELETE FROM ce_jobs WHERE id = ?').run(id);
        return { success: res.changes > 0 };
    }
};
