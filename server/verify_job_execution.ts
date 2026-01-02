
import { ceJobService, initJobService } from './src/modules/catalogEnricher/services/ceJobService';
import { getCeDatabase } from './src/modules/catalogEnricher/db/ceDatabase';
import { Server } from 'socket.io';

async function testJobExecution() {
    console.log("🚀 Starting Job Execution Verification...");

    // 1. Mock Socket.IO
    const ioMock = {
        emit: (event: string, data: any) => {
            console.log(`📡 [Socket Mock] ${event}:`, JSON.stringify(data).slice(0, 100) + "...");
        }
    } as unknown as Server;

    initJobService(ioMock);

    // 2. Create a Mock Job (Targeted Enrichment)
    // We will use Direct URLs mode to avoid Excel dependency complexities for this test
    const profileId = 'a56b5943-953d-4879-9936-719cdf35ad29'; // Fima
    const params = {
        profileId,
        urls: ['F5603X4', 'F6000/30CR'],
        skuColumn: 'sku', // Mandatory now
        enrichmentMode: 'targeted'
    };

    // NOTE: ceJobService expects 'urls' to be actual URLs if urlColumn is 'url', 
    // BUT for targeted enrichment, we usually pass uploadId. 
    // Let's look at `runTargetedEnrichmentJob` again... 
    // It calls `ceExcelService` if uploadId is present.
    // If NOT, it uses `urls`... wait, `runTargetedEnrichmentJob` logic was:
    // "if (urls && urls.length > 0) ... rowsToProcess = urls.map..." 
    // BUT it maps them to { url: u }. 
    // THEN it looks for `actualSkuCol`. 
    // So if we pass `urls`, and set `urlColumn` to 'url', it will look for 'url' in the row.
    // So we should pass SKUs as 'urls' and expect it to treat them as SKUs.

    const job = ceJobService.createJob('targeted_enrichment', params);
    console.log(`✅ Job Created: ${job.id}`);

    // 3. Trigger Processing Check
    // Ideally `createJob` calls `triggerWorker`, which is async.
    // We will wait a bit to see if it starts.

    console.log("⏳ Waiting for worker to pick up job...");

    const db = getCeDatabase();

    // Poll status
    for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const currentJob = ceJobService.getJob(job.id);
        console.log(`   [${i}s] Status: ${currentJob?.status} | Progress: ${currentJob?.progress}%`);

        if (currentJob?.status === 'completed' || currentJob?.status === 'failed') {
            break;
        }
    }

    // 4. Verify Results
    const items = ceJobService.getJobItems(job.id);
    console.log(`\n📊 Job Items Report (${items.length} items):`);
    items.forEach(item => {
        console.log(`   - SKU: ${item.key_value} | Status: ${item.status} | URL: ${item.product_url}`);
    });

    if (items.some(i => i.status === 'ok')) {
        console.log("\n✅ SUCCESS: Job processed items correctly.");
    } else {
        console.log("\n❌ FAILURE: No items processed successfully.");
        process.exit(1);
    }

    process.exit(0);
}

testJobExecution();
