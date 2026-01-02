
import { getCeDatabase } from '../db/ceDatabase';
import { v4 as uuidv4 } from 'uuid';

export interface ScraperRecipe {
    id: string;
    name: string;
    domain: string;
    start_url?: string;
    steps_json: string;
    created_at?: string;
    updated_at?: string;
}

export const ceRecipeService = {
    getAllRecipes: (domain?: string) => {
        const db = getCeDatabase();
        let query = 'SELECT * FROM ce_recipes ORDER BY updated_at DESC';
        const params: any[] = [];

        if (domain) {
            query = 'SELECT * FROM ce_recipes WHERE domain LIKE ? ORDER BY updated_at DESC';
            params.push(`%${domain}%`);
        }

        const rows = db.prepare(query).all(...params) as ScraperRecipe[];
        return rows.map(r => ({ ...r, steps: JSON.parse(r.steps_json) }));
    },

    getRecipe: (id: string) => {
        const db = getCeDatabase();
        const row = db.prepare('SELECT * FROM ce_recipes WHERE id = ?').get(id) as ScraperRecipe;
        if (!row) return null;
        return { ...row, steps: JSON.parse(row.steps_json) };
    },

    saveRecipe: (data: { id?: string, name: string, domain: string, start_url?: string, steps: any[] }) => {
        const db = getCeDatabase();
        const stepsJson = JSON.stringify(data.steps);
        const now = new Date().toISOString();

        if (data.id) {
            // Update
            db.prepare(`
                UPDATE ce_recipes 
                SET name = ?, domain = ?, start_url = ?, steps_json = ?, updated_at = ?
                WHERE id = ?
            `).run(data.name, data.domain, data.start_url || '', stepsJson, now, data.id);
            return { id: data.id };
        } else {
            // Create
            const id = uuidv4();
            db.prepare(`
                INSERT INTO ce_recipes (id, name, domain, start_url, steps_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(id, data.name, data.domain, data.start_url || '', stepsJson, now, now);
            return { id };
        }
    },

    deleteRecipe: (id: string) => {
        const db = getCeDatabase();
        db.prepare('DELETE FROM ce_recipes WHERE id = ?').run(id);
        return { success: true };
    }
};
