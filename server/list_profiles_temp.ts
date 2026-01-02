
import { getCeDatabase } from './src/modules/catalogEnricher/db/ceDatabase';
const db = getCeDatabase();
const profiles = db.prepare('SELECT * FROM ce_brand_profiles WHERE name IN (\'Bette\', \'Scarabeo\', \'Ritmonio\')').all();
console.log('PROFILES_DATA_START');
console.log(JSON.stringify(profiles, null, 2));
console.log('PROFILES_DATA_END');
process.exit(0);
