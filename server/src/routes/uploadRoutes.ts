import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { parseExcel } from '../utils/excelParser';

const router = Router();
const upload = multer({ dest: 'tmp/' });

// Ensure tmp directory exists
const tmpDir = path.join(process.cwd(), 'tmp');
if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir);
}

router.post('/upload-excel', upload.single('file'), (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.file) {
            res.status(400).json({ message: "No file uploaded" });
            return;
        }

        const result = parseExcel(req.file.path);

        // Cleanup file.
        // We delete it immediately as we are returning the parsed data in memory.
        try {
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
        } catch (cleanupErr) {
            console.warn("Failed to delete temp file:", cleanupErr);
        }

        // Return sheets structure + compatibility fields from first sheet
        const sheets = result.sheets;
        const defaultSheet = sheets.length > 0 ? sheets[0] : { columns: [], rows: [], previewRows: [], rowCount: 0 };

        res.json({
            // New multi-sheet structure
            sheets: result.sheets,
            defaultSheetName: result.defaultSheet,

            // Backward compatibility for existing frontend
            columns: defaultSheet.columns,
            previewRows: defaultSheet.previewRows,
            totalRows: defaultSheet.rowCount,
            rows: defaultSheet.rows
        });



    } catch (err) {
        next(err);
    }
});

export default router;
