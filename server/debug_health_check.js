
const axios = require('axios');
const BASE = 'http://localhost:4000/api/catalog-enricher';

async function checkHealth() {
    console.log(`[Health] Checking API Endpoints...`);
    const endpoints = [
        { method: 'get', url: `${BASE}/crawler/active-jobs`, name: 'Active Jobs' },
        { method: 'get', url: `${BASE}/profiles`, name: 'Profiles' },
        { method: 'get', url: `${BASE}/catalog/products?page=1&limit=1`, name: 'Catalog Products' },
        // We can't easily POST to /bulk without starting a job, but we can verify it exists
    ];

    for (const ep of endpoints) {
        try {
            const res = await axios[ep.method](ep.url);
            console.log(`✅ [${ep.name}] ${ep.url} => ${res.status} OK`);
        } catch (e) {
            console.error(`❌ [${ep.name}] ${ep.url} => ${e.message}`);
        }
    }
}

checkHealth();
