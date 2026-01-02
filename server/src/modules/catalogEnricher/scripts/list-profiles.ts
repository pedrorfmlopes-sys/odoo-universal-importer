
import { getCeDatabase } from '../db/ceDatabase';
import path from 'path';

process.env.CE_DB_PATH = path.join(__dirname, '../../../../data/importer.db');
const db = getCeDatabase();

const profiles = db.prepare('SELECT id, name FROM ce_brand_profiles').all();
console.log('📂 Existing Profiles:');
profiles.forEach((p: any) => console.log(`   - [${p.id}] "${p.name}"`));
