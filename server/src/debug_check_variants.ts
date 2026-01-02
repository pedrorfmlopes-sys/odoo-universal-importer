import { getCeDatabase } from './modules/catalogEnricher/db/ceDatabase';

const db = getCeDatabase();

const jobId = 'bulk_1766494557878';

console.log(`Checking Variants for Job ${jobId}...`);

const rows = db.prepare('SELECT data_json FROM ce_crawler_staging WHERE job_id = ?').all(jobId) as { data_json: string }[];

let totalProducts = rows.length;
let totalVariants = 0;

rows.forEach((row) => {
    try {
        const data = JSON.parse(row.data_json);
        const variants = JSON.parse(data.variants_json || '[]');
        if (Array.isArray(variants)) {
            totalVariants += variants.length;
        }
    } catch (e: any) {
        console.error("Parse Error for row", e.message);
    }
});

console.log(`Base Products: ${totalProducts}`);
console.log(`Total Variants (Combinations): ${totalVariants}`);
if (totalProducts > 0) {
    console.log(`Average Variants per Product: ${(totalVariants / totalProducts).toFixed(1)}`);
} else {
    console.log("No products found yet.");
}
