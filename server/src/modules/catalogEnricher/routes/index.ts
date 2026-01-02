import { Router } from 'express';
import multer from 'multer';
import { ceJobService } from '../services/ceJobService';
import { ceExcelService } from '../services/ceExcelService';
import * as credentialController from '../controllers/ceCredentialController'; // New
import { ceAssetController } from '../controllers/ceAssetController'; // New
import { io } from '../../../index';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Asset Download
router.post('/assets/download-missing', ceAssetController.downloadMissingAssets); // NEW

// Health Check
router.get('/health', (req, res) => {
    res.json({ status: 'ok', module: 'catalog-enricher', timestamp: new Date().toISOString() });
});

// Upload Excel
router.post('/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No file uploaded' });
            return;
        }
        const result = ceExcelService.saveUpload(req.file);
        res.json({ success: true, ...result });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Preview Excel Upload (Rows)
router.get('/upload/:id/preview', (req, res) => {
    try {
        const { id } = req.params;
        const { sheet, startRow, endRow } = req.query;

        const rows = ceExcelService.readRows(id, {
            sheetName: sheet as string,
            startRow: startRow ? parseInt(startRow as string) : 1,
            endRow: endRow ? parseInt(endRow as string) : 10
        });

        res.json({ rows });
    } catch (err: any) {
        console.error("Preview failed:", err);
        res.status(500).json({ error: err.message });
    }
});

// Analyze (Start Job)
router.post('/analyze', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            res.status(400).json({ error: 'URL is required' });
            return;
        }

        const job = ceJobService.createJob('analyze', { url });
        res.json({ success: true, jobId: job.id, message: 'Analysis job started' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Run Enrich (Batch Job)
router.post('/run', async (req, res) => {
    try {
        const { uploadId, urlColumn, domain } = req.body;
        if (!uploadId || !urlColumn) {
            res.status(400).json({ error: 'Missing uploadId or urlColumn' });
            return;
        }

        const job = ceJobService.createJob('enrich', req.body);
        res.json({ success: true, jobId: job.id, message: 'Enrichment job started' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Get All Jobs
router.get('/jobs', (req, res) => {
    try {
        const { profileId } = req.query;
        const jobs = ceJobService.getAllJobs(profileId as string);
        res.json(jobs);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Get Job Status
router.get('/jobs/:id', (req, res) => {
    try {
        const job = ceJobService.getJob(req.params.id);
        if (!job) {
            res.status(404).json({ error: 'Job not found' });
            return;
        }
        res.json(job);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Stop Job
router.post('/jobs/:id/stop', (req, res) => {
    try {
        const result = ceJobService.stopJob(req.params.id);
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Get Job Items (Results)
router.get('/jobs/:id/items', (req, res) => {
    try {
        const items = ceJobService.getJobItems(req.params.id);
        res.json({ items });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Job
router.delete('/jobs/:id', (req, res) => {
    try {
        const result = ceJobService.deleteJob(req.params.id);
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// -------------------------------------------------------------------------
// PROFILES (Brand Dossiers)
// -------------------------------------------------------------------------

import { ceProfileService } from '../services/ceProfileService';

router.get('/profiles', (req, res) => {
    try {
        const profiles = ceProfileService.getAllProfiles();
        res.json(profiles);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/profiles', (req, res) => {
    try {
        const profile = ceProfileService.createProfile(req.body);
        res.json(profile);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/profiles/:id', (req, res) => {
    try {
        const profile = ceProfileService.updateProfile(req.params.id, req.body);
        res.json(profile);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/profiles/:id', (req, res) => {
    try {
        ceProfileService.deleteProfile(req.params.id);
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/profiles/detect-pattern', (req, res) => {
    try {
        const { row, url } = req.body;
        console.log('[Detect Pattern] Request:', { row, url });
        if (!row || !url) { res.status(400).json({ error: "Missing row or url" }); return; }
        const result = ceProfileService.detectUrlPattern(row, url);
        res.json(result);
    } catch (e: any) {
        console.error('[Detect Pattern] Error:', e);
        res.status(500).json({ error: e.message });
    }
});

router.post('/profiles/test-pattern', (req, res) => {
    try {
        const { row, template } = req.body;
        const url = ceProfileService.applyPattern(row, template);
        res.json({ url });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// -------------------------------------------------------------------------
// V3 CATALOG (CRAWLER DATA)
// -------------------------------------------------------------------------
import { getCatalogProducts, getMissingProducts, getCatalogCategories } from '../services/ceCatalogService';

router.get('/catalog/products', (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const search = req.query.search as string || '';
        const profileId = req.query.profileId as string || undefined;
        // Updated service signature
        const result = getCatalogProducts(page, limit, search, profileId);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/catalog/products', (req, res) => {
    try {
        const profileId = req.query.profileId as string;
        if (!profileId) throw new Error("Missing profileId");

        // Import dynamically to avoid circular dependency issues if any, or just import at top
        const { clearProfileProducts } = require('../services/ceCatalogService');
        const result = clearProfileProducts(profileId);
        res.json({ success: true, ...result });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/catalog/products/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { deleteProduct } = require('../services/ceCatalogService');
        const result = deleteProduct(id);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/catalog/products/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { updateProduct } = require('../services/ceCatalogService');
        const result = updateProduct(id, req.body);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/catalog/categories', (req, res) => {
    try {
        const profileId = req.query.profileId as string || undefined;
        const result = getCatalogCategories(profileId);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// -------------------------------------------------------------------------
// V3 CRAWLER COMMAND CENTER
// -------------------------------------------------------------------------
import { previewCrawl, autoDetectSelectors, startCrawlJob } from '../services/ceCrawlerService';

router.post('/crawler/preview', async (req, res) => {
    try {
        const { url, selectors } = req.body;
        if (!url || !selectors) throw new Error('Missing URL or Selectors');
        const result = await previewCrawl(url, selectors);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/crawler/teacher/start', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) throw new Error('Missing URL');
        const { startTeacherBrowser } = await import('../services/cePuppeteerService');
        const result = await startTeacherBrowser(url);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/crawler/autodetect', async (req, res) => {
    try {
        const url = req.query.url as string;
        if (!url) throw new Error('Missing URL');
        const result = await autoDetectSelectors(url);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/crawler/start', async (req, res) => {
    try {
        const { url, selectors, profileId } = req.body;

        console.log('🚀 Starting Universal Crawl:', { url, selectors, profileId });

        if (!url || !selectors) throw new Error("Missing URL or selectors");

        const jobId = 'job_' + Date.now();

        // Run in background (do NOT await)
        startCrawlJob(jobId, url, selectors, profileId || 'unknown_profile')
            .catch(err => console.error('Background Crawl Failed:', err));

        res.json({ success: true, message: 'Crawl job started in background', jobId });

    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/catalog/missing', (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const result = getMissingProducts(page, limit);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// -------------------------------------------------------------------------
// RECIPES (Teacher Mode Saved Replays)
// -------------------------------------------------------------------------
import { ceRecipeService } from '../services/ceRecipeService';

router.get('/recipes', (req, res) => {
    try {
        const domain = req.query.domain as string;
        const recipes = ceRecipeService.getAllRecipes(domain);
        res.json(recipes);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/recipes/:id', (req, res) => {
    try {
        const recipe = ceRecipeService.getRecipe(req.params.id);
        if (!recipe) { res.status(404).json({ error: 'Recipe not found' }); return; }
        res.json(recipe);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/recipes', (req, res) => {
    try {
        const result = ceRecipeService.saveRecipe(req.body);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/recipes/:id', (req, res) => {
    try {
        ceRecipeService.deleteRecipe(req.params.id);
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// -------------------------------------------------------------------------
// TAXONOMY (Structure Discovery)
// -------------------------------------------------------------------------
import { ceTaxonomyService } from '../services/ceTaxonomyService';

router.get('/taxonomy/:profileId', (req, res) => {
    try {
        const tree = ceTaxonomyService.getTree(req.params.profileId);
        res.json(tree);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/taxonomy', (req, res) => {
    try {
        const result = ceTaxonomyService.addNode(req.body);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/taxonomy/save', (req, res) => {
    try {
        const { profileId, tree } = req.body;
        if (!profileId || !tree) throw new Error("Missing profileId or tree");
        const result = ceTaxonomyService.saveTaxonomyTree(profileId, tree);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/taxonomy/:profileId', (req, res) => {
    try {
        ceTaxonomyService.clearTaxonomy(req.params.profileId);
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Scan Structure Route
router.post('/crawler/scan-structure', async (req, res) => {
    let internalTimeout: NodeJS.Timeout | null = null;
    try {
        const { url, domain, deep, scanJobId } = req.body;
        if (!url || !domain) throw new Error("Missing url or domain");

        console.log(`🔍 Scanning Structure for ${domain} (Deep: ${!!deep})`);

        // Safety Timeout (3 minutes if Deep, 2 minutes otherwise)
        const timeoutMs = deep ? 180000 : 120000;
        const controller = new AbortController();
        internalTimeout = setTimeout(() => controller.abort(), timeoutMs);

        // 1. Get HTML & Metadata (using Smart Harvester)
        const { analyzePage } = await import('../services/cePuppeteerService');
        const { html, metadata } = await analyzePage(url, scanJobId, { signal: controller.signal });

        if (internalTimeout) clearTimeout(internalTimeout);

        // 2. AI Analysis
        const { ceAiService } = await import('../services/ceAiService');
        const tree = await ceAiService.scanStructure(domain, html, deep, url, metadata, (msg) => {
            if (scanJobId && io) io.emit('scan-status', { scanJobId, message: msg });
        });

        res.json({ tree });

    } catch (e: any) {
        if (internalTimeout) clearTimeout(internalTimeout);
        console.error("Scan Structure Error:", e);
        res.status(500).json({ error: e.name === 'AbortError' ? 'O scan demorou demais e foi interrompido por segurança.' : e.message });
    }
});

// Bulk Crawl Route (Structure -> Products)
router.post('/crawler/bulk', async (req, res) => {
    try {
        const { profileId, recipeId, urls, options } = req.body;

        try {
            const fs = require('fs');
            fs.writeFileSync('server/debug_partial_log.txt', `[${new Date().toISOString()}] Request received.\nURLs (${urls?.length}): ${JSON.stringify(urls)}\nOptions: ${JSON.stringify(options)}\n`);
        } catch (_) { }

        if (!profileId || !recipeId || !urls || !Array.isArray(urls)) throw new Error("Missing parameters");

        console.log(`🚀 Starting Bulk Crawl: ${urls.length} categories using recipe ${recipeId}`);

        // Lazy load Queue Service
        const { ceQueueService } = await import('../services/ceQueueService');
        const jobId = `bulk_${Date.now()}`;

        // Add to Queue (Async)
        ceQueueService.addBulkTask(jobId, profileId, recipeId, urls, options || {})
            .catch(e => console.error("Bulk Task Error:", e));

        res.json({ success: true, jobId, message: `Queued ${urls.length} categories for extraction` });

    } catch (e: any) {
        console.error("Bulk Crawl Route Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- JOB CONTROL API ---

router.get('/crawler/active-jobs', async (req, res) => {
    try {
        const { ceQueueService } = await import('../services/ceQueueService');
        const jobs = ceQueueService.getActiveJobs();
        res.json({ jobs });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/crawler/pause', async (req, res) => {
    try {
        const { ceQueueService } = await import('../services/ceQueueService');
        const result = ceQueueService.pauseQueue();
        res.json(result);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/crawler/resume', async (req, res) => {
    try {
        const { ceQueueService } = await import('../services/ceQueueService');
        const result = ceQueueService.resumeQueue();
        res.json(result);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/crawler/jobs/:jobId/stop', async (req, res) => {
    const { jobId } = req.params;
    const { deleteData } = req.body;
    try {
        const { ceQueueService } = await import('../services/ceQueueService');
        const result = ceQueueService.stopJob(jobId);
        res.json(result);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});


router.post('/crawler/test-recipe', async (req, res) => {
    const { url, recipe } = req.body;
    try {
        const { testRecipe } = await import('../services/cePuppeteerService');
        const result = await testRecipe(url, recipe);
        res.json(result);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});


router.post('/crawler/jobs/:jobId/commit', async (req, res) => {
    const { jobId } = req.params;
    try {
        const { commitJobToCatalog } = await import('../services/ceQueueService');
        const result = commitJobToCatalog(jobId);
        res.json(result);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Credentials
router.get('/credentials', credentialController.getCredentials);
router.post('/credentials', credentialController.createCredential);
router.put('/credentials/:id', credentialController.updateCredential);
router.delete('/credentials/:id', credentialController.deleteCredential);
router.get('/credentials/:id/reveal', credentialController.revealCredential);

// -------------------------------------------------------------------------
// SMART MERGER API
// -------------------------------------------------------------------------
import { ceMergerService } from '../services/ceMergerService';

router.post('/merger/pricelists', upload.single('file'), (req, res) => {
    try {
        const { brandProfileId } = req.body;
        if (!req.file || !brandProfileId) throw new Error("Missing file or brandProfileId");
        const result = ceMergerService.savePricelist(req.file, brandProfileId);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/merger/pricelists', (req, res) => {
    try {
        const { brandProfileId } = req.query;
        if (!brandProfileId) throw new Error("Missing brandProfileId");
        const result = ceMergerService.getPricelists(brandProfileId as string);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/merger/pricelists/:id', (req, res) => {
    try {
        ceMergerService.deletePricelist(req.params.id);
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/merger/rules', (req, res) => {
    try {
        const result = ceMergerService.saveRule(req.body);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/merger/rules', (req, res) => {
    try {
        const { brandProfileId } = req.query;
        const result = ceMergerService.getRules(brandProfileId as string);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/merger/rules/:id', (req, res) => {
    try {
        ceMergerService.deleteRule(req.params.id);
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/merger/match', async (req, res) => {
    try {
        const { pricelistId, mapping } = req.body;
        const result = await ceMergerService.runMatcher(pricelistId, mapping);
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/merger/targeted-enrichment', async (req, res) => {
    try {
        console.log('📬 [API] POST /merger/targeted-enrichment - body:', JSON.stringify(req.body));
        const { pricelistId, skuColumn, profileId, sheet, startRow, endRow } = req.body;
        if (!pricelistId || !skuColumn || !profileId) {
            res.status(400).json({ error: 'Missing pricelistId, skuColumn or profileId' });
            return;
        }

        const job = ceJobService.createJob('targeted_enrichment', {
            uploadId: pricelistId,
            skuColumn,
            profileId,
            sheet,
            startRow,
            endRow
        });
        res.json({ success: true, jobId: job.id, message: 'Targeted Enrichment job started' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/merger/results', (req, res) => {
    try {
        const { pricelistId, page, limit } = req.query;
        const result = ceMergerService.getMergedResults(
            pricelistId as string,
            parseInt(page as string) || 1,
            parseInt(limit as string) || 50
        );
        res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
