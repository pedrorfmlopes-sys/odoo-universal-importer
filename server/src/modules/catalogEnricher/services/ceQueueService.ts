import PQueue from 'p-queue';
import { ceRecipeService } from '../services/ceRecipeService';
import { startTeacherBrowser } from '../services/cePuppeteerService';
import puppeteer from 'puppeteer';
import { Server as SocketIOServer } from 'socket.io'; // Import Types

// Singleton Queue
// Concurrency 1 means we crawl categories one by one to avoid overwhelming server CPU/Memory
const queue = new PQueue({ concurrency: 1 });

interface BulkCrawlTask {
    jobId: string;
    profileId: string;
    recipeId: string;
    url: string;
    categoryName: string;
}

import { analyzePage } from './cePuppeteerService';
import { ceEnrichmentService } from './ceEnrichmentService';
import { getCeDatabase } from '../db/ceDatabase';

// ... imports
import { ceAiService } from './ceAiService';

let ioInstance: SocketIOServer | null = null;
const activeJobs = new Map<string, { total: number, processed: number, status: string, itemsFound: number, totalProducts: number, productsProcessed: number }>();

export const initQueueService = (io: SocketIOServer) => {
    ioInstance = io;
    console.log("[QueueService] Socket.IO initialized.");
};

// Debug Logger Helper
const fs = require('fs');
const logPath = require('path').join(__dirname, '../../../../data/crawler_debug.txt');
const logDebug = (msg: string) => { try { fs.appendFileSync(logPath, `[Queue] ${msg}\n`); } catch (e) { } };

// Helper to manage cancellation tokens
export const cancellationTokens = new Map<string, AbortController>();

export const ceQueueService = {


    addBulkTask: async (jobId: string, profileId: string, recipeId: string, urls: string[], options: { ignore_facets?: boolean } = { ignore_facets: true }) => {
        // Create AbortController
        if (!cancellationTokens.has(jobId)) {
            cancellationTokens.set(jobId, new AbortController());
        }

        try {
            console.log(`[Queue] Adding ${urls.length} urls to job ${jobId} (Options: ${JSON.stringify(options)})`);

            let recipe = null;
            if (recipeId !== 'universal') {
                recipe = ceRecipeService.getRecipe(recipeId);
                if (!recipe) throw new Error("Recipe not found: " + recipeId);
            }

            // 1. Facet Filtering
            let targetUrls = urls;
            if (options.ignore_facets) {
                targetUrls = urls.filter(u => {
                    try {
                        const domain = new URL(u).hostname.replace('www.', '');
                        const kind = ceAiService.getCachedNodeKind(domain, u);
                        if (kind === 'facet') {
                            try { require('fs').appendFileSync('server/debug_partial_log.txt', `[Filter] Skipped FACET: ${u}\n`); } catch (_) { }
                            console.log(`[Queue] ⚠️ Skipping identified FACET: ${u}`);
                            return false;
                        }
                        return true;
                    } catch { return true; }
                });
                console.log(`[Queue] Filtered ${urls.length - targetUrls.length} facets. Remaining: ${targetUrls.length}`);
                try { require('fs').appendFileSync('server/debug_partial_log.txt', `[Filter] Result: ${targetUrls.length} URLs remaining after facet filter.\n`); } catch (_) { }
            }

            // Initialize Job State
            activeJobs.set(jobId, { total: targetUrls.length, processed: 0, status: 'running', itemsFound: 0, totalProducts: 0, productsProcessed: 0 });

            // Persist Job in DB
            const db = getCeDatabase();
            db.prepare(`
                INSERT INTO ce_jobs (id, type, status, progress, counters_json, params_json, profile_id)
                VALUES (?, 'crawler', 'running', 0, ?, ?, ?)
            `).run(
                jobId,
                JSON.stringify({ found: 0, processed: 0, total: targetUrls.length }),
                JSON.stringify({ recipeId, urls: targetUrls }),
                profileId
            );

            notifyProgress(jobId, `Starting job with ${targetUrls.length} categories...`);

            // Force immediate update to clear "Syncing..."
            if (ioInstance) {
                ioInstance.emit('job-progress', {
                    jobId,
                    progress: 0,
                    processed: 0,
                    total: targetUrls.length,
                    status: 'running',
                    message: `Starting job with ${targetUrls.length} categories...`,
                    itemsFound: 0,
                    productsProcessed: 0,
                    totalProducts: 0
                });
            }

            // Fetch Dossier/Profile Name for Category Context
            const profile = db.prepare('SELECT name FROM ce_brand_profiles WHERE id = ?').get(profileId) as { name: string };
            const dossierName = profile ? profile.name : 'Unknown Dossier';
            console.log(`[Queue] Using Dossier Name as Category: "${dossierName}"`);

            // 2. Global Dedupe for this Job
            const globalSeenProducts = new Set<string>();

            // 3. Add to Queue
            for (const url of targetUrls) {
                queue.add(async () => {
                    try {
                        console.log(`[Queue] Processing category: ${url}`);
                        const urlName = url.split('/').filter(Boolean).pop() || 'CATEGORY';
                        notifyProgress(jobId, `Explorando: ${urlName}`);

                        const newItems = await processCategory(url, recipe, profileId, jobId, globalSeenProducts, dossierName);

                        // Update Progress
                        const jobState = activeJobs.get(jobId);
                        if (jobState) {
                            jobState.processed++;
                            jobState.itemsFound += newItems;
                            if (jobState.processed >= jobState.total) { // FINISHED
                                commitJobToCatalog(jobId);
                            } else {
                                notifyProgress(jobId, `Items: ${jobState.itemsFound} | ${(jobState.processed / jobState.total * 100).toFixed(0)}%`);
                            }
                        }
                    } catch (e: any) {
                        console.error(`[Queue] Category Task Failed: ${url}`, e);
                        // Still update processed count effectively
                        const jobState = activeJobs.get(jobId);
                        if (jobState) {
                            jobState.processed++;
                            if (jobState.processed >= jobState.total) commitJobToCatalog(jobId);
                        }
                    }
                });
            }
        } catch (e: any) {
            console.error("[Queue] CRITICAL ERROR in addBulkTask:", e);
            try {
                const fs = require('fs');
                fs.writeFileSync('server/debug_queue_full_error.txt', `[${new Date().toISOString()}] CRITICAL: ${e.message}\nStack: ${e.stack}\n`);
            } catch (_) { }
            throw e;
        }
    },
    getQueueStats: () => {
        return { size: queue.size, pending: queue.pending, isPaused: queue.isPaused };
    },

    // --- NEW CONTROL METHODS ---
    getActiveJobs: () => {
        // 1. Sync Memory with DB for persistence check
        try {
            const db = getCeDatabase();
            const persistentJobs = db.prepare("SELECT * FROM ce_jobs WHERE status IN ('pending', 'running', 'waiting_commit')").all() as any[];

            // Track which IDs we found in DB
            const dbJobIds = new Set(persistentJobs.map(j => j.id));

            // Sync memory -> ensure all DB jobs have a memory state for the UI
            for (const job of persistentJobs) {
                if (!activeJobs.has(job.id)) {
                    // RESURRECT or INITIALIZE memory state from DB
                    try {
                        const counts = JSON.parse(job.counters_json || '{}');
                        activeJobs.set(job.id, {
                            total: counts.total || 0,
                            processed: counts.processed || 0,
                            status: job.status,
                            itemsFound: counts.found || 0,
                            totalProducts: counts.totalProducts || 0,
                            productsProcessed: counts.productsProcessed || 0
                        });
                    } catch (err) {
                        console.warn(`[Queue] Failed to parse job ${job.id} state from DB`, err);
                    }
                } else {
                    // Update memory status if DB changed (e.g. by ceJobService)
                    const memJob = activeJobs.get(job.id)!;
                    memJob.status = job.status;
                    if (job.counters_json) {
                        try {
                            const counts = JSON.parse(job.counters_json);
                            memJob.total = counts.total || memJob.total;
                            memJob.processed = counts.processed || memJob.processed;
                            memJob.itemsFound = counts.found || memJob.itemsFound;
                        } catch (e) { }
                    }
                }
            }

            // Remove orphans (Jobs in memory but NOT active in DB anymore)
            for (const [id] of activeJobs) {
                if (!dbJobIds.has(id)) {
                    activeJobs.delete(id);
                }
            }
        } catch (e) { console.error("[QueueService] Failed to sync DB", e); }

        // 2. Return Only Meaningful Jobs
        const jobs = Array.from(activeJobs.entries())
            .map(([id, state]) => ({ ...state, id }));

        return jobs;
    },

    pauseQueue: () => {
        queue.pause();
        activeJobs.forEach(job => {
            if (job.status === 'running') job.status = 'paused';
        });
        if (ioInstance) ioInstance.emit('queue-status', { status: 'paused' });
        return { success: true };
    },

    resumeQueue: () => {
        queue.start();
        activeJobs.forEach(job => {
            if (job.status === 'paused') job.status = 'running';
        });
        if (ioInstance) ioInstance.emit('queue-status', { status: 'running' });
        return { success: true };
    },

    stopJob: (jobId: string) => {
        console.log(`[Queue] Stopping Job: ${jobId}`);
        // 1. Abort Signal
        if (cancellationTokens.has(jobId)) {
            cancellationTokens.get(jobId)?.abort();
            cancellationTokens.delete(jobId);
        }

        // 2. Remove from active tracking
        activeJobs.delete(jobId);

        // 3. Pause & Clear Queue
        queue.pause();
        queue.clear();

        // 4. Update DB & Notify
        const db = getCeDatabase();
        try {
            db.prepare("UPDATE ce_jobs SET status = 'stopped' WHERE id = ?").run(jobId);
            db.prepare('DELETE FROM ce_crawler_staging WHERE job_id = ?').run(jobId);
        } catch (e: any) {
            console.warn("[Queue] Failed to update/delete job data:", e.message);
        }

        // Resume queue (empty)
        queue.start();

        if (ioInstance) ioInstance.emit('job-completed', { jobId, status: 'stopped', itemsFound: 0 });
        return { success: true };
    }
};

const notifyProgress = (jobId: string, msg: string) => {
    if (ioInstance) {
        const jobState = activeJobs.get(jobId);
        ioInstance.emit('job-progress', {
            jobId,
            progress: jobState ? Math.round((jobState.processed / jobState.total) * 100) : 0,
            status: 'running',
            message: msg,
            totalProducts: jobState?.totalProducts || 0,
            productsProcessed: jobState?.productsProcessed || 0,
            itemsFound: jobState?.itemsFound || 0
        });
    } else {
        console.warn(`[Queue] ⚠️ Socket.IO not initialized! Progress update for job ${jobId} dropped: "${msg}"`);
    }
};

async function processCategory(url: string, recipe: any, profileId: string, jobId: string, globalSeen: Set<string>, dossierName: string = 'Universal Cat'): Promise<number> {
    if (!recipe) {
        // --- UNIVERSAL MODE ---
        console.log(`🚀 Launched Universal Crawler for ${url}`);
        const db = getCeDatabase();

        try {
            // 1. Discover Products
            const { metadata } = await analyzePage(url, jobId, { noInteractions: true });
            const productLinks = metadata.product_family_urls_found || [];

            // RECURSION POLICY: Only follow associated links if we are in a multi-category bulk crawl.
            // If the user selected a SINGLE CATEGORY/URL, we respect their explicit selection.
            const jobState = activeJobs.get(jobId);
            const allowRecursion = jobState && jobState.total > 2; // Simple heuristic: > 2 categories = exploratory bulk mode

            // Update Total Products Count
            if (jobState) {
                jobState.totalProducts += productLinks.length;
            }

            // Prepare Staging Insert
            const insertStaging = db.prepare(`
                 INSERT INTO ce_crawler_staging (job_id, url, status, data_json)
                 VALUES (?, ?, 'extracted', ?)
            `);

            // 2. Process Each Product (Dynamic Queue for Recursive Discovery)
            let newItems = 0;
            const productQueue = [...productLinks];
            const seenInThisSession = new Set<string>();

            while (productQueue.length > 0) {
                const prodUrl = productQueue.shift();
                if (!prodUrl) continue;

                // 1. DEDUPLICATION
                if (globalSeen.has(prodUrl)) continue;
                if (seenInThisSession.has(prodUrl)) continue;

                seenInThisSession.add(prodUrl);
                globalSeen.add(prodUrl);

                if (!activeJobs.has(jobId)) { break; } // Abort check

                // Smooth Progress Calculation
                if (jobState) {
                    const totalEstimated = Math.max(productLinks.length, seenInThisSession.size + productQueue.length);
                    const subProgress = seenInThisSession.size / totalEstimated;
                    const globalProgress = Math.round(((jobState.processed + subProgress) / jobState.total) * 100);

                    // Emit explicitly calculated progress
                    if (ioInstance) {
                        ioInstance.emit('job-progress', {
                            jobId,
                            progress: Math.min(globalProgress, 99),
                            status: 'running',
                            message: `A processar: ${prodUrl.split('/').pop()}`,
                            itemsFound: jobState.itemsFound + newItems,
                            productsProcessed: jobState.productsProcessed,
                            totalProducts: jobState.totalProducts
                        });
                    }
                }

                try {
                    console.log(`[Universal] Processing: ${prodUrl}`);
                    logDebug(`PROCESS_ITEM: ${prodUrl} (Job: ${jobId})`);

                    const enriched = await ceEnrichmentService.enrichProductFamily(prodUrl, jobId);

                    // Save to Staging DB
                    const stagingData = {
                        brand_profile_id: profileId,
                        category_name: (enriched.categoryPath && enriched.categoryPath.length > 0) ? enriched.categoryPath.join(' / ') : dossierName,
                        product_name: enriched.name || 'Unknown',
                        product_url: prodUrl,
                        image_url: enriched.heroImage || '',
                        guessed_code: enriched.itemReference || '',
                        variants_json: enriched.variants ? JSON.stringify(enriched.variants) : '[]',
                        gallery_json: enriched.galleryImages ? JSON.stringify(enriched.galleryImages) : '[]',
                        file_urls_json: enriched.namedFiles ? JSON.stringify(enriched.namedFiles) : '[]',
                        associated_products_json: enriched.associated_products_json || '[]',
                        features_json: enriched.features_json || '{}'
                    };

                    insertStaging.run(
                        jobId,
                        prodUrl,
                        JSON.stringify(stagingData)
                    );
                    newItems++;
                    if (jobState) jobState.productsProcessed++;
                    console.log(`   ✅ Saved: ${enriched.name} (${enriched.variants?.length || 0} variants)`);

                    notifyProgress(jobId, `Enriquecido: ${enriched.name}`);

                    // 2. RECURSIVE DISCOVERY (Conditional)
                    if (allowRecursion && enriched.discoveredLinks && enriched.discoveredLinks.length > 0) {
                        for (const childUrl of enriched.discoveredLinks) {
                            if (!globalSeen.has(childUrl) && !seenInThisSession.has(childUrl)) {
                                console.log(`   🔍 Discovered associated product: ${childUrl}`);
                                productQueue.push(childUrl);
                                if (jobState) jobState.totalProducts++;
                            }
                        }
                    }

                } catch (pe: any) {
                    console.error(`   ❌ Failed product ${prodUrl}:`, pe.message);
                }
            }
            console.log(`[Universal] Session done. ${newItems} items processed.`);
            if (jobState) {
                jobState.productsProcessed += seenInThisSession.size;
            }
            return newItems;

        } catch (e: any) {
            console.error("[Universal] Category Error:", e.message);
            return 0;
        }
    }

    // --- RECIPE MODE ---
    console.log(`🚀 Launched Recipe Crawler for ${url} (Recipe: ${recipe.name})`);

    // 1. Replay Recipe
    const { replayRecipe } = require('./cePuppeteerService'); // Dynamic import to avoid cycles if any
    const extractedData = await replayRecipe(recipe.steps, url);

    // 2. Process Extracted Items
    let newItems = 0;
    const db = getCeDatabase();
    const insertStaging = db.prepare(`
        INSERT INTO ce_crawler_staging (job_id, url, status, data_json)
        VALUES (?, ?, 'extracted', ?)
    `);

    // Calculate Progress for Recipe Mode (Binary: 0% -> 100% per category as it's sequential one-shot)
    if (activeJobs.has(jobId)) {
        const jobState = activeJobs.get(jobId);
        if (jobState) {
            jobState.totalProducts += extractedData.length;
        }
    }

    for (const data of extractedData) {
        // Basic Deduplication against global set
        if (data.product_url && globalSeen.has(data.product_url)) continue;
        if (data.product_url) globalSeen.add(data.product_url);

        const stagingData = {
            brand_profile_id: profileId,
            category_name: dossierName, // Recipe mode usually scrapes a specific list, so we default to dossier/category name
            product_name: data.name || 'Unknown Product',
            product_url: data.url || url, // If no URL extracted, use category URL (list)
            image_url: data.image || (data.images ? data.images[0] : ''),
            guessed_code: data.reference || data.code || '',
            variants_json: JSON.stringify(data.variants || []),
            gallery_json: JSON.stringify(data.images || []),
            file_urls_json: JSON.stringify(data.files || []),
            associated_products_json: '[]',
            features_json: JSON.stringify(data.features || {})
        };

        try {
            insertStaging.run(jobId, data.url || url, JSON.stringify(stagingData));
            newItems++;
            console.log(`   ✅ [Recipe] Saved: ${stagingData.product_name}`);

            // Log Progress for individual items if relevant
            if (activeJobs.has(jobId)) {
                const jobState = activeJobs.get(jobId);
                if (jobState) {
                    jobState.productsProcessed++;
                    if (ioInstance) {
                        ioInstance.emit('job-progress', {
                            jobId,
                            progress: Math.round((jobState.processed / jobState.total) * 100), // Keep overall category progress
                            status: 'running',
                            message: `Extracted: ${stagingData.product_name}`,
                            itemsFound: jobState.itemsFound + newItems,
                            productsProcessed: jobState.productsProcessed,
                            totalProducts: jobState.totalProducts
                        });
                    }
                }
            }

        } catch (err: any) {
            console.error(`   ❌ [Recipe] Failed to save item: ${err.message}`);
        }
    }

    return newItems;
}

export const commitJobToCatalog = (jobId: string) => {
    const db = getCeDatabase();

    // 1. Verify Job Status
    const job = db.prepare('SELECT * FROM ce_jobs WHERE id = ?').get(jobId) as any;
    if (!job) throw new Error("Job not found");

    console.log(`[Commit] Committing Job ${jobId} to Main Catalog...`);

    // 2. Fetch Staging Data
    const items = db.prepare('SELECT * FROM ce_crawler_staging WHERE job_id = ? AND status = ?').all(jobId, 'extracted') as any[];

    // 3. Upsert into Main Catalog
    // 3. Upsert into Main Catalog
    const insertMain = db.prepare(`
        INSERT INTO ce_web_products (job_id, brand_profile_id, category_name, product_name, product_url, image_url, guessed_code, crawled_at, variants_json, gallery_json, file_urls_json, associated_products_json, features_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?)
        ON CONFLICT(product_url) DO UPDATE SET 
            job_id = excluded.job_id,
            crawled_at = CURRENT_TIMESTAMP, 
            variants_json = excluded.variants_json,
            gallery_json = excluded.gallery_json,
            file_urls_json = excluded.file_urls_json,
            associated_products_json = excluded.associated_products_json,
            features_json = excluded.features_json,
            product_name = excluded.product_name,
            image_url = excluded.image_url,
            category_name = excluded.category_name
    `);

    const insertMissing = db.prepare('INSERT OR IGNORE INTO ce_missing_products (brand_profile_id, product_code) VALUES (?, ?)');

    let committedCount = 0;
    const transaction = db.transaction(() => {
        for (const item of items) {
            const data = JSON.parse(item.data_json);

            insertMain.run(
                jobId,
                data.brand_profile_id,
                data.category_name,
                data.product_name,
                data.product_url,
                data.image_url,
                data.guessed_code,
                data.variants_json,
                data.gallery_json || '[]',
                data.file_urls_json || '[]',
                data.associated_products_json || '[]',
                data.features_json || '{}'
            );
            committedCount++;
        }

        // 4. Update Job Status
        db.prepare("UPDATE ce_jobs SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(jobId);

        // 5. Cleanup Staging
        // db.prepare("DELETE FROM ce_crawler_staging WHERE job_id = ?").run(jobId); // Optional: Keep for debugging?
    });

    transaction();

    console.log(`✅ [Commit] Job ${jobId} committed. ${committedCount} items merged.`);

    if (ioInstance) {
        ioInstance.emit('job-completed', {
            jobId,
            status: 'completed',
            total: job.total,
            processed: job.total,
            itemsFound: committedCount
        });
    }

    return { success: true, committedCount };
};
