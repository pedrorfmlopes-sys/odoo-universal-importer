// @ts-nocheck

import { getCeDatabase } from './src/modules/catalogEnricher/db/ceDatabase';

const db = getCeDatabase();
console.log('[Debug] Checking taxonomy for relative URLs...');

const rows = db.prepare(`
    SELECT id, name, url, brand_profile_id 
    FROM ce_taxonomy 
    WHERE url NOT LIKE 'http%' AND url IS NOT NULL AND url != ''
`).all();

if (rows.length === 0) {
    console.log('[Debug] No relative URLs found in taxonomy.');
} else {
    console.log(`[Debug] Found ${rows.length} invalid/relative URLs:`);
    rows.forEach((r: any) => {
        console.log(`- [${r.name}] URL: "${r.url}" (Profile: ${r.brand_profile_id})`);
    });
}
