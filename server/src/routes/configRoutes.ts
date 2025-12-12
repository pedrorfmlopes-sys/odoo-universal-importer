import { Router, Request, Response, NextFunction } from 'express';
import { getOdooConfig, saveOdooConfig } from '../config/odooConfigStore';
import { OdooClient } from '../odoo/odooClient';

const router = Router();

router.get('/config', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const config = await getOdooConfig();
        if (!config) {
            // Return empty structure so form can be controlled
            res.json({ url: '', db: '', userEmail: '', apiKey: '', importMode: 'basic' });
            return;
        }
        // Don't expose sensitive data if possible, but user wants to edit it back?
        // Usually we hide API key, but for this local tool, we might need it back.
        // Let's return it all for now as requested.
        res.json(config);
    } catch (err) {
        next(err);
    }
});

router.post('/config', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { url, db, userEmail, apiKey, importMode } = req.body;
        if (
            !url || typeof url !== 'string' ||
            !db || typeof db !== 'string' ||
            !userEmail || typeof userEmail !== 'string' ||
            !apiKey || typeof apiKey !== 'string'
        ) {
            res.status(400).json({ message: "Missing required fields or invalid types" });
            return;
        }

        const validImportMode = (importMode === 'pro') ? 'pro' : 'basic';
        await saveOdooConfig({ url, db, userEmail, apiKey, importMode: validImportMode });
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
