
import { getCeDatabase } from './modules/catalogEnricher/db/ceDatabase';

async function checkTaxonomy() {
    const db = getCeDatabase();
    const rows = db.prepare("SELECT name, url, type FROM ce_taxonomy WHERE url LIKE '%fimacf.com%' LIMIT 50").all();
    console.table(rows);

    const facets = rows.filter((r: any) => r.type === 'facet');
    console.log(`Found ${facets.length} facets for Fima in taxonomy.`);
    if (facets.length > 0) {
        console.log("Example Facets:");
        console.table(facets.slice(0, 5));
    }
}

checkTaxonomy();
