
import { getCeDatabase } from './src/modules/catalogEnricher/db/ceDatabase';
import fs from 'fs';

// Initialize DB 
const db = getCeDatabase();

// ID from the failed job
const uploadId = '652d0959-7acd-401a-8c6e-70a04bd875f8';

console.log(`Checking Pricelist/Upload: ${uploadId}`);

// Check Pricelist
const pl = db.prepare(`SELECT * FROM ce_pricelists WHERE id = ?`).get(uploadId) as any;
console.log("\n--- PRICELIST DETAILS ---");
console.log(JSON.stringify(pl, null, 2));

if (pl && pl.data_path) {
    console.log(`\nPath: ${pl.data_path}`);
    const exists = fs.existsSync(pl.data_path);
    console.log(`File exists? ${exists}`);

    if (exists) {
        try {
            if (pl.filename.endsWith('.json')) {
                const data = JSON.parse(fs.readFileSync(pl.data_path, 'utf-8'));
                console.log(`JSON Data Length: ${data.length}`);
                if (data.length > 0) {
                    console.log('Sample Row keys:', Object.keys(data[0]));
                }
            } else {
                console.log("File is likely Excel/Binary. Checking extension...");
                console.log(`Filename: ${pl.filename}`);
            }
        } catch (e) {
            console.error("Error reading file:", e);
        }
    }
} else {
    console.log("Pricelist not found or has no data_path.");

    // Check ce_uploads just in case (though we don't know the table schema perfectly, usually it's different)
    // Actually ce_uploads is likely implied.
}
