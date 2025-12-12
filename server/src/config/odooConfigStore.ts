import fs from 'fs/promises';
import path from 'path';
import { OdooConfig } from '../odoo/types';

const CONFIG_FILE = path.resolve(process.cwd(), 'odoo-config.json');

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
};
