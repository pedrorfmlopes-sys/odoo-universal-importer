
import { getCeDatabase } from '../db/ceDatabase';
import path from 'path';

process.env.CE_DB_PATH = path.join(__dirname, '../../../../data/importer.db');

const db = getCeDatabase();

console.log('🔍 Diagnosing 520754...');

// 1. Check if 5207 exists
const exact = db.prepare('SELECT * FROM ce_web_products WHERE guessed_code = ?').get('520754');
console.log('Exact 520754:', exact || 'NOT FOUND');

// 2. Check root 5207
const root = db.prepare('SELECT * FROM ce_web_products WHERE guessed_code = ?').get('5207');
console.log('Root 5207:', root || 'NOT FOUND');

// 3. Search by partial code
const partial = db.prepare('SELECT * FROM ce_web_products WHERE guessed_code LIKE ?').all('5207%');
console.log('Partial 5207%:', partial.length > 0 ? partial : 'NO MATCHES');

// 4. Search by Name (maybe user knows the name associated with 5207?)
// Let's list some random products to see naming convention around similar IDs if possible
const random = db.prepare('SELECT * FROM ce_web_products LIMIT 5').all();
console.log('Sample Data:', random);
