import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getCeDatabase } from '../db/ceDatabase';
import { MergeRule, Pricelist, RuleParameters, MergedItem } from '../models/MergeTypes';

const STORAGE_ROOT = process.env.CE_STORAGE_ROOT || path.join(process.cwd(), 'data', 'catalog-enricher');

export const ceMergerService = {

    // --- Pricelists ---

    savePricelist(file: Express.Multer.File, brandProfileId: string): Pricelist & { sheets: string[] } {
        const id = uuidv4();
        const pricelistDir = path.join(STORAGE_ROOT, 'pricelists');
        if (!fs.existsSync(pricelistDir)) fs.mkdirSync(pricelistDir, { recursive: true });

        // 1. Save Raw File
        const storedPath = path.join(pricelistDir, `${id}_${file.originalname}`);
        fs.writeFileSync(storedPath, file.buffer);

        // 2. Parse Info (Sheets & Row Count of first sheet)
        const workbook = XLSX.read(file.buffer, { type: 'buffer' });
        const sheets = workbook.SheetNames;
        const mainSheet = sheets[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[mainSheet]); // Just for initial stats

        // 3. Save to DB
        const db = getCeDatabase();
        // columns_json is for the default sheet
        const columns = rows.length > 0 ? Object.keys(rows[0] as object) : [];
        const columnsJson = JSON.stringify(columns);

        db.prepare(`
            INSERT INTO ce_pricelists (id, brand_profile_id, filename, row_count, columns_json, data_path)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, brandProfileId, file.originalname, rows.length, columnsJson, storedPath);

        return {
            id,
            brand_profile_id: brandProfileId,
            filename: file.originalname,
            uploaded_at: new Date().toISOString(),
            row_count: rows.length,
            columns_json: columnsJson,
            data_path: storedPath,
            sheets // Return sheets for UI
        };
    },


    getPricelists(brandProfileId: string): Pricelist[] {
        const db = getCeDatabase();
        return db.prepare('SELECT * FROM ce_pricelists WHERE brand_profile_id = ? ORDER BY uploaded_at DESC').all(brandProfileId) as Pricelist[];
    },

    deletePricelist(id: string) {
        const db = getCeDatabase();
        const pl = db.prepare('SELECT data_path FROM ce_pricelists WHERE id = ?').get(id) as Pricelist;
        if (pl && pl.data_path && fs.existsSync(pl.data_path)) {
            fs.unlinkSync(pl.data_path);
        }
        db.prepare('DELETE FROM ce_merged_catalog WHERE pricelist_id = ?').run(id); // Cascade
        db.prepare('DELETE FROM ce_pricelists WHERE id = ?').run(id);
    },

    // --- Rules ---

    getRules(brandProfileId: string): MergeRule[] {
        const db = getCeDatabase();
        return db.prepare('SELECT * FROM ce_merge_rules WHERE brand_profile_id = ? ORDER BY priority DESC').all(brandProfileId) as MergeRule[];
    },

    saveRule(rule: Omit<MergeRule, 'id'>) {
        const db = getCeDatabase();
        const id = uuidv4();
        db.prepare(`
            INSERT INTO ce_merge_rules (id, brand_profile_id, rule_type, web_field, excel_field, priority, parameters_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(id, rule.brand_profile_id, rule.rule_type, rule.web_field, rule.excel_field, rule.priority, rule.parameters_json);
        return { id, ...rule };
    },

    deleteRule(id: string) {
        getCeDatabase().prepare('DELETE FROM ce_merge_rules WHERE id = ?').run(id);
    },

    // --- Matching Engine ---

    async runMatcher(pricelistId: string, mapping: any) {
        const db = getCeDatabase();
        const pricelist = db.prepare('SELECT * FROM ce_pricelists WHERE id = ?').get(pricelistId) as Pricelist;
        if (!pricelist) throw new Error("Pricelist not found");

        const brandProfileId = pricelist.brand_profile_id;

        // 1. Load Data
        const excelRows = JSON.parse(fs.readFileSync(pricelist.data_path, 'utf-8'));
        const webProducts = db.prepare('SELECT id, product_name, guessed_code, product_url FROM ce_web_products WHERE brand_profile_id = ?').all(brandProfileId) as any[];

        // 2. Load Rules
        const rules = db.prepare('SELECT * FROM ce_merge_rules WHERE brand_profile_id = ? ORDER BY priority DESC').all(brandProfileId) as MergeRule[];

        // 3. Clear old merge results for this pricelist
        db.prepare('DELETE FROM ce_merged_catalog WHERE pricelist_id = ?').run(pricelistId);

        // 4. Iterate & Match
        const insertStmt = db.prepare(`
            INSERT INTO ce_merged_catalog (id, pricelist_id, brand_profile_id, web_product_id, final_sku, final_name, final_price, match_confidence, match_method, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
        `);

        // Index Web Products for O(1) exact lookup
        // Map<Code, Product>
        const webIndex = new Map<string, any>();
        webProducts.forEach(p => {
            if (p.guessed_code) webIndex.set(this.normalize(p.guessed_code), p);
        });

        let matches = 0;

        const transaction = db.transaction(() => {
            for (const row of excelRows) {
                const sku = row[mapping.sku] ? String(row[mapping.sku]) : '';
                const name = row[mapping.name] ? String(row[mapping.name]) : '';
                const price = row[mapping.price] ? parseFloat(row[mapping.price]) : 0;

                let matchId: number | null = null;
                let confidence = 0;
                let method = '';

                // Strategy A: Exact SKU Match (Normalized)
                const normSku = this.normalize(sku);
                if (normSku && webIndex.has(normSku)) {
                    matchId = webIndex.get(normSku).id;
                    confidence = 100;
                    method = 'exact_sku';
                }

                // Strategy B: Rules (Regex/Fuzzy) - TODO: Implement full rule engine
                if (!matchId) {
                    // Placeholder for future rule engine expansion
                }

                insertStmt.run(
                    uuidv4(),
                    pricelistId,
                    brandProfileId,
                    matchId,
                    sku,
                    name,
                    price,
                    confidence,
                    method
                );

                if (matchId) matches++;
            }
        });

        transaction();

        return { total: excelRows.length, matches };
    },

    normalize(val: string) {
        return val ? val.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
    },

    getMergedResults(pricelistId: string, page: number = 1, limit: number = 50) {
        const db = getCeDatabase();
        const offset = (page - 1) * limit;

        const total = (db.prepare('SELECT count(*) as c FROM ce_merged_catalog WHERE pricelist_id = ?').get(pricelistId) as any).c;

        const query = `
            SELECT 
                m.*, 
                w.image_url as web_image, 
                w.product_name as web_name, 
                w.guessed_code as web_code
            FROM ce_merged_catalog m
            LEFT JOIN ce_web_products w ON m.web_product_id = w.id
            WHERE m.pricelist_id = ?
            ORDER BY m.match_confidence DESC, m.final_sku ASC
            LIMIT ? OFFSET ?
        `;

        const items = db.prepare(query).all(pricelistId, limit, offset);

        return { items, total, page, totalPages: Math.ceil(total / limit) };
    }
};
