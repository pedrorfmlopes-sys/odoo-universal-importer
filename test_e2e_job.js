
const axios = require('axios');

async function testTargetedEnrichment() {
    const baseUrl = 'http://localhost:4000/api/catalog-enricher';
    const payload = {
        pricelistId: "652d959-7acd-401a-8c6e-78a84bd875f8",
        skuColumn: "PrintConfigCode",
        profileId: "a56b5943-953d-4879-9936-719cdf35ad29"
    };

    console.log("🚀 Starting E2E Test: Targeted Enrichment...");
    try {
        // 1. Start Job
        console.log("Step 1: POST /merger/targeted-enrichment");
        const startRes = await axios.post(`${baseUrl}/merger/targeted-enrichment`, payload);
        console.log("Response:", startRes.data);
        const jobId = startRes.data.jobId;

        if (!jobId) throw new Error("No jobId returned!");

        // 2. Poll Active Jobs
        console.log("\nStep 2: GET /crawler/active-jobs (Poll 1)");
        const pollRes1 = await axios.get(`${baseUrl}/crawler/active-jobs`);
        console.log("Active Jobs:", JSON.stringify(pollRes1.data.jobs, null, 2));

        const jobFound = pollRes1.data.jobs.find(j => j.id === jobId);
        if (jobFound) {
            console.log("✅ SUCCESS: Job found in active list!");
            console.log("Status:", jobFound.status, "Progress:", jobFound.progress);
        } else {
            console.log("❌ FAILURE: Job NOT found in active list immediately after creation.");

            // Wait 2 seconds and retry
            console.log("\nWaiting 2s for retry...");
            await new Promise(r => setTimeout(r, 2000));

            console.log("Step 3: GET /crawler/active-jobs (Poll 2)");
            const pollRes2 = await axios.get(`${baseUrl}/crawler/active-jobs`);
            console.log("Active Jobs:", JSON.stringify(pollRes2.data.jobs, null, 2));

            if (pollRes2.data.jobs.find(j => j.id === jobId)) {
                console.log("✅ SUCCESS: Job found in active list on retry!");
            } else {
                console.log("❌ CRITICAL: Job still missing after 2 seconds.");
            }
        }

    } catch (e) {
        console.error("Test Failed:", e.response ? e.response.data : e.message);
    }
}

testTargetedEnrichment();
