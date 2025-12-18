
import fs from 'fs/promises';
import path from 'path';
import { OdooConfig } from '../odoo/types';
import { OdooClient } from '../odoo/odooClient';

const CONFIG_FILE = path.resolve(process.cwd(), 'odoo-config.json');

// Global client cache
let cachedClient: OdooClient | null = null;
let lastConfigHash: string = "";

export const getOdooConfig = async (): Promise<OdooConfig | null> => {
    try {
        const data = await fs.readFile(CONFIG_FILE, 'utf-8');
        if (!data || data.trim() === '') return { url: '', db: '', userEmail: '', apiKey: '', importMode: 'basic' };
        try {
            const parsed = JSON.parse(data) as OdooConfig;
            return { importMode: 'basic', ...parsed };
        } catch (jsonErr) {
            console.error("Error parsing odoo-config.json:", jsonErr);
            // Return empty config if JSON is invalid, so user can re-save
            return { url: '', db: '', userEmail: '', apiKey: '', importMode: 'basic' };
        }

    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return null;
        }
        console.error("Error reading odoo-config.json:", error);
        return null;
    }
};

export const saveOdooConfig = async (config: OdooConfig): Promise<void> => {
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
    // Invalidate client
    cachedClient = null;
    lastConfigHash = "";
};


// Helper to get an active OdooClient (initialized lazily or returned from cache)
// This is synchronous-ish access to the *promise* or instance, handled via async init check if needed.
// But for simplicity in routes, let's make it return null if not configured, or a Client instance.
// Since getOdooConfig is async, we can't make this purely sync without pre-loading. 
// However, typically routes are async.

// Better approach: Since we don't have a persistent server state manager, let's just make a function that
// reads config and returns a new or cached client.
export const getOdooClient = async (): Promise<OdooClient | null> => {
    const config = await getOdooConfig();
    if (!config) return null;

    // Simple verification content hash to invalidate
    const currentHash = JSON.stringify(config);
    if (cachedClient && currentHash === lastConfigHash) {
        return cachedClient;
    }

    cachedClient = new OdooClient(config);
    lastConfigHash = currentHash;
    return cachedClient;
};

// Also export a synchronous getter if we are sure it's initialized? No, safe to use async everywhere.
// But for the 'relationalRoutes' using `getOdooClient()` call which seemed to be sync in my previous edit?
// Ah, in previous edit I wrote `const client = getOdooClient();` which implies sync.
// I will update this file to have a sync getter if possible but it's hard with async file read.
// Actually, `odooConfigStore` was just reading file.
// Let's rely on routes calling `await getOdooClient()`.
