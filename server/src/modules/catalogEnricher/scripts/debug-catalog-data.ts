
import { getCeDatabase } from '../db/ceDatabase';
import path from 'path';

process.env.CE_DB_PATH = path.join(__dirname, '../../../../data/importer.db');
const db = getCeDatabase();

// FORCE CHECKPOINT
console.log('🔄 Forcing WAL Checkpoint...');
db.pragma('wal_checkpoint(RESTART)');

const count = db.prepare('SELECT count(*) as c FROM ce_web_products').get() as any;
console.log(`📊 Total Products in DB: ${count.c}`);

const sample = db.prepare('SELECT brand_profile_id, category_name, product_name FROM ce_web_products LIMIT 5').all();
console.log('🔍 Sample Data:');
console.table(sample);

const profiles = db.prepare('SELECT id, name FROM ce_brand_profiles').all();
console.log('📂 Known Profiles:');
console.table(profiles);
