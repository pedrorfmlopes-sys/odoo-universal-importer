
import { getCeDatabase } from '../db/ceDatabase';
import path from 'path';

process.env.CE_DB_PATH = path.join(__dirname, '../../../../data/importer.db');
const db = getCeDatabase();

const targets = ['2714', '2710', '2120'];

console.log('🔍 Diagnosing Failures:');

targets.forEach(code => {
    console.log(`\n--- Product Root: ${code} ---`);

    // 1. Direct Fuzzy Search in Guessed Codes
    const matches = db.prepare('SELECT * FROM ce_web_products WHERE guessed_code LIKE ?').all(`%${code}%`);
    if (matches.length > 0) {
        console.log(`✅ Found ${matches.length} matches in DB:`);
        matches.forEach((m: any) => console.log(`   - [${m.guessed_code}] ${m.product_name} -> ${m.product_url}`));
    } else {
        console.log('❌ No matches found in DB.');
    }

    // 2. Search by Name (maybe code is in the name?)
    const nameMatches = db.prepare('SELECT * FROM ce_web_products WHERE product_name LIKE ?').all(`%${code}%`);
    if (nameMatches.length > 0) {
        console.log(`✅ Found ${nameMatches.length} matches in Names:`);
        nameMatches.forEach((m: any) => console.log(`   - [${m.product_name}] (${m.guessed_code})`));
    }
});

// Check Total Count to see if Crawler aborted early
const count = db.prepare('SELECT count(*) as c FROM ce_web_products').get() as any;
console.log(`\n📊 Total Products in DB: ${count.c}`);
