
const Database = require('better-sqlite3');
const db = new Database('data/importer.db');

try {
    const jobs = db.prepare(`
        SELECT * FROM ce_jobs 
        WHERE params_json LIKE '%ritmonio%'
        ORDER BY created_at DESC 
        LIMIT 5
    `).all();

    console.log(`Found ${jobs.length} jobs for Ritmonio.`);
    console.log("=== Job Details ===");

    jobs.forEach(j => {
        const params = JSON.parse(j.params_json || '{}');
        const counters = JSON.parse(j.counters_json || '{}');

        console.log(`ID: ${j.id}`);
        console.log(`Status: ${j.status}`);
        console.log(`URL: ${params.url || params.startUrl || 'N/A'}`);
        console.log(`Recipe ID: ${params.recipeId || 'N/A'}`);
        console.log(`Counters:`, counters);
        if (j.error_text) console.log(`Error: ${j.error_text}`);

        // Check products for this job
        // Note: ce_web_products usually links via job_id or we check items table
        try {
            // Let's check 'ce_crawler_staging' or 'ce_web_products'
            // Based on table list: ce_web_products, ce_crawler_staging
            const staged = db.prepare(`SELECT count(*) as c FROM ce_crawler_staging WHERE job_id = ?`).get(j.id);
            const products = db.prepare(`SELECT count(*) as c FROM ce_web_products WHERE last_job_id = ?`).get(j.id);
            console.log(`Staging Items: ${staged.c}`);
            console.log(`Web Products Linked: ${products.c}`);
        } catch (e) { console.log("DB Check Error: " + e.message); }

        console.log('-------------------------');
    });

} catch (err) {
    console.error(err);
}
