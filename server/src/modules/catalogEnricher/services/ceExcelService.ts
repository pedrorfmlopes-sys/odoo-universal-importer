
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getCeDatabase } from '../db/ceDatabase';

export const ceExcelService = {
    saveUpload(file: Express.Multer.File): { id: string, filename: string, path: string, headers: string[], sheets: string[] } {
        const id = uuidv4();
        const storageRoot = process.env.CE_STORAGE_ROOT || path.join(process.cwd(), 'data', 'catalog-enricher');
        const uploadDir = path.join(storageRoot, 'uploads', id);

        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

        const storedPath = path.join(uploadDir, file.originalname);
        fs.writeFileSync(storedPath, file.buffer);

        // Parse headers immediately for the UI
        const workbook = XLSX.read(file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Get generic array (array of arrays)
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];
        const headers = rows.length > 0 ? rows[0] : [];

        // Save to DB
        const db = getCeDatabase();
        const stmt = db.prepare(`
            INSERT INTO ce_uploads (id, filename, stored_path, source_hash, created_at)
            VALUES (?, ?, ?, ?, datetime('now'))
        `);

        // Simple hash placeholder
        const hash = id;

        stmt.run(id, file.originalname, storedPath, hash);

        return { id, filename: file.originalname, path: storedPath, headers, sheets: workbook.SheetNames };
    },

    readRows(uploadId: string, options: { sheetName?: string, startRow?: number, endRow?: number } = {}): any[] {
        const db = getCeDatabase();
        let row = db.prepare("SELECT stored_path, 'upload' as type FROM ce_uploads WHERE id = ?").get(uploadId) as any;

        if (!row) {
            // Fallback to pricelists
            const pl = db.prepare("SELECT data_path as stored_path, 'pricelist' as type FROM ce_pricelists WHERE id = ?").get(uploadId) as any;
            if (pl) row = pl;
        }

        if (!row) throw new Error('Upload or Pricelist not found');

        // Check file extension for type safety
        const isJson = row.stored_path.endsWith('.json');

        if (isJson) {
            const content = fs.readFileSync(row.stored_path, 'utf8');
            let allRows = JSON.parse(content);
            // Ensure array
            if (!Array.isArray(allRows)) throw new Error("JSON Content is not an array");

            // Slicing logic for JSON
            let start = 0;
            let end = allRows.length;
            if (options.startRow) start = Math.max(0, options.startRow - 1);
            if (options.endRow) end = Math.min(allRows.length, options.endRow);

            console.log(`[Excel Service] Reading JSON Pricelist. Total: ${allRows.length}. Slicing: ${start} to ${end}`);
            return allRows.slice(start, end);
        }

        const buffer = fs.readFileSync(row.stored_path);
        const workbook = XLSX.read(buffer, { type: 'buffer' });

        // 1. Select Sheet
        const sheetName = options.sheetName || workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);

        // 2. Parse all rows first
        const allRows = XLSX.utils.sheet_to_json(sheet); // Objects with headers as keys

        // 3. Apply Slice (startRow and endRow are 1-based, affecting the data rows)
        // If startRow=1, endRow=3, we want the first 3 items
        let start = 0;
        let end = allRows.length;

        if (options.startRow) start = Math.max(0, options.startRow - 1);
        if (options.endRow) end = Math.min(allRows.length, options.endRow);

        console.log(`[Excel Service] Reading "${sheetName}". Total: ${allRows.length}. Slicing: ${start} to ${end}`);
        return allRows.slice(start, end);
    }
};
