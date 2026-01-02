
import { getCeDatabase } from '../db/ceDatabase';
import { ceExcelService } from '../services/ceExcelService';
import path from 'path';

// Force DB Path
process.env.CE_DB_PATH = './data/importer.db';
const db = getCeDatabase();

// 1. Get Last Upload
const lastUpload = db.prepare('SELECT * FROM ce_uploads ORDER BY created_at DESC LIMIT 1').get() as any;

if (!lastUpload) {
    console.log('No uploads found in DB.');
    process.exit(0);
}

console.log('--- Last Upload Inspection ---');
console.log('ID:', lastUpload.id);
console.log('Filename:', lastUpload.filename);
console.log('Stored Path:', lastUpload.stored_path);

try {
    const rows = ceExcelService.readRows(lastUpload.id);
    console.log(`Total Rows Read: ${rows.length}`);

    if (rows.length > 0) {
        console.log('--- Header Analysis (Keys of Row 0) ---');
        console.log(Object.keys(rows[0]));

        console.log('--- First 3 Rows Data ---');
        console.log(rows.slice(0, 3));
    } else {
        console.error('❌ Excel file appears empty or content could not be parsed.');
    }
} catch (e: any) {
    console.error('❌ Failed to read excel:', e.message);
}
