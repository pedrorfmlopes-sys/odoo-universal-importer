
const axios = require('axios'); // Mock axio request using fetch if needed, but we run in node
// Actually, I can just invoke ceExcelService directly to test if the FUNCTION works, 
// as validating the HTTP route usually requires starting the full server.
// For now, let's verify the SERVICE method works as expected.

import { ceExcelService } from './src/modules/catalogEnricher/services/ceExcelService';
import { getCeDatabase } from './src/modules/catalogEnricher/db/ceDatabase';

const UPLOAD_ID = '652d0959-7acd-401a-8c6e-70a04bd875f8'; // The one we know exists

console.log(`🧪 Testing Excel Preview for ID: ${UPLOAD_ID}`);

try {
    const rows = ceExcelService.readRows(UPLOAD_ID, {
        startRow: 1,
        endRow: 5
    });

    console.log(`✅ Success! Retrieved ${rows.length} rows.`);
    console.log('Sample Row 1:', JSON.stringify(rows[0], null, 2));

    if (rows.length !== 5) {
        console.error(`❌ Expected 5 rows, got ${rows.length}`);
        process.exit(1);
    }

} catch (e: any) {
    console.error("❌ Failed:", e.message);
    process.exit(1);
}
