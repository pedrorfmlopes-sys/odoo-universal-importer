
import { getCeDatabase } from './src/modules/catalogEnricher/db/ceDatabase';
const db = getCeDatabase();
const recipes = db.prepare('SELECT * FROM ce_recipes').all();
console.log('RECIPES_DATA_START');
console.log(JSON.stringify(recipes, null, 2));
console.log('RECIPES_DATA_END');
process.exit(0);
