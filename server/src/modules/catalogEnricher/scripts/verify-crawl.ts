
import { getCeDatabase } from '../db/ceDatabase';
import path from 'path';

process.env.CE_DB_PATH = path.join(__dirname, '../../../../data/importer.db');
const db = getCeDatabase();

const targets = ['2120', '2714', '2710', '5364'];

console.log('🔍 Final Verification:');

targets.forEach(code => {
    // Check Contains Logic
    const matches = db.prepare('SELECT * FROM ce_web_products WHERE guessed_code LIKE ?').all(`%${code}%`);
    if (matches.length > 0) {
        console.log(`✅ MATCHED [${code}]:`);
        matches.forEach((m: any) => console.log(`   -> ${m.product_name} | URL: ${m.product_url}`));
    } else {
        console.log(`❌ STILL MISSING [${code}]`);
    }
});

const count = db.prepare('SELECT count(*) as c FROM ce_web_products').get() as any;
console.log(`\n📊 Total Products: ${count.c}`);
