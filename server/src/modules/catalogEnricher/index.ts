
import { Express } from 'express';
import ceRouter from './routes';
import path from 'path';
import fs from 'fs';
import { getCeDatabase } from './db/ceDatabase';

// Configuration constants
const MODULE_MOUNT_PATH = '/api/catalog-enricher';

export const mountCatalogEnricher = (app: Express) => {
    console.log(`[Catalog Enricher] Mounting module at ${MODULE_MOUNT_PATH}`);

    // Ensure storage directory exists
    const storagePath = process.env.CE_STORAGE_ROOT || path.join(process.cwd(), 'data', 'catalog-enricher');
    if (!fs.existsSync(storagePath)) {
        fs.mkdirSync(storagePath, { recursive: true });
        console.log(`[Catalog Enricher] Created storage at ${storagePath}`);
    }

    // Initialize DB
    try {
        getCeDatabase();
    } catch (err) {
        console.error('[Catalog Enricher] Failed to initialize Database:', err);
    }

    // Mount Routes
    app.use(MODULE_MOUNT_PATH, ceRouter);

    console.log(`[Catalog Enricher] Module mounted successfully`);
};
