import { Router, Request, Response, NextFunction } from 'express';
import { getOdooConfig, saveOdooConfig } from '../config/odooConfigStore';
import { OdooClient } from '../odoo/odooClient';

const router = Router();
const MASK = '__MASKED__';

router.get('/config', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const config = await getOdooConfig();
        if (!config) {
            // Return empty structure so form can be controlled
            res.json({ url: '', db: '', userEmail: '', apiKey: '', importMode: 'basic' });
            return;
        }

        // Mask keys for security
        const safeConfig = { ...config };
        if (safeConfig.apiKey) safeConfig.apiKey = MASK;
        if (safeConfig.aiApiKey) safeConfig.aiApiKey = MASK;

        res.json(safeConfig);
    } catch (err) {
        next(err);
    }
});

router.post('/config', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { url, db, userEmail, apiKey, importMode, aiProvider, aiApiKey, aiModel } = req.body;

        // Load existing config to check for mask restoration
        const existing = await getOdooConfig();

        // If incoming key is MASK, restore old key. Otherwise use new key.
        const finalApiKey = (apiKey === MASK && existing?.apiKey) ? existing.apiKey : apiKey;
        const finalAiApiKey = (aiApiKey === MASK && existing?.aiApiKey) ? existing.aiApiKey : aiApiKey;

        if (
            !url || typeof url !== 'string' ||
            !db || typeof db !== 'string' ||
            !userEmail || typeof userEmail !== 'string' ||
            !finalApiKey || typeof finalApiKey !== 'string'
        ) {
            res.status(400).json({ message: "Missing required fields or invalid types" });
            return;
        }

        const validImportMode = (importMode === 'pro') ? 'pro' : 'basic';

        await saveOdooConfig({
            url, db, userEmail,
            apiKey: finalApiKey,
            importMode: validImportMode,
            aiProvider,
            aiApiKey: finalAiApiKey,
            aiModel
        });
        res.json({ success: true, message: "Config saved" });

    } catch (err) {
        next(err);
    }
});

router.post('/config/test', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const config = await getOdooConfig();
        if (!config) {
            res.status(400).json({ message: "No config saved" });
            return;
        }
        const client = new OdooClient(config);
        // Try to search users to verify connection
        await client.searchRead('res.users', [], ['login'], 1);
        res.json({ success: true, message: "Connection successful" });
    } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
    }
});

export default router;
