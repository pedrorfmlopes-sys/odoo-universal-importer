
import { ceJobService, initJobService } from './src/modules/catalogEnricher/services/ceJobService';
import { getCeDatabase } from './src/modules/catalogEnricher/db/ceDatabase';
import { Server } from 'socket.io'; // mock

const UPLOAD_ID = '652d0959-7acd-401a-8c6e-70a04bd875f8';

async function test() {
    console.log("🚀 STARTING RIGOROUS READING TEST");
    console.log(`Target ID: ${UPLOAD_ID}`);

    const db = getCeDatabase();
    const pl = db.prepare('SELECT * FROM ce_pricelists WHERE id = ?').get(UPLOAD_ID) as any;
    console.log("DB Record:", pl);

    if (!pl) {
        console.error("❌ Pricelist record not found in DB!");
        process.exit(1);
    }

    const job = {
        id: 'test-job-' + Date.now(),
        profile_id: 'a56b5943-953d-4879-9936-719cdf35ad29',
        type: 'targeted_enrichment',
        status: 'pending',
        progress: 0,
        params_json: JSON.stringify({
            uploadId: UPLOAD_ID,
            skuColumn: 'PrintConfigCode',
            profileId: 'a56b5943-953d-4879-9936-719cdf35ad29',
            startRow: 1,
            endRow: 10
        }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Mock params for validation
        params: {
            uploadId: UPLOAD_ID,
            skuColumn: 'PrintConfigCode',
            profileId: 'a56b5943-953d-4879-9936-719cdf35ad29',
            startRow: 1,
            endRow: 10
        }
    };

    // INSERT JOB
    db.prepare(`
        INSERT INTO ce_jobs (id, profile_id, type, status, progress, params_json, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(job.id, job.profile_id, job.type, job.status, job.progress, job.params_json, job.created_at, job.updated_at);

    console.log(`✅ Created Job ${job.id} in DB`);

    // Initialize Service with Mock IO
    const ioMock = {
        emit: (ev, data) => console.log(`[Socket] ${ev}`, data)
    } as any;
    initJobService(ioMock);

    try {
        console.log("⚡ invoking runTargetedEnrichmentJob...");
        // This function normally runs the browser too. 
        // We only care if it crashes at the "reading" phase or if it logs "Read X rows".
        // To prevent it from actually launching Puppeteer and taking forever, 
        // we can either let it run specifically for 1-2 items (fast) or mock the enrichment part.
        // Given the user wants "certainty", let's let it run for 1 item fully.

        // We need to modify job params to limit scope if possible? 
        // startRow/endRow is already set to 1-5.

        await ceJobService.runTargetedEnrichmentJob(job as any);
        console.log("✅ FUNCTION FINISHED WITHOUT CRASH");

        // Verify items created
        const items = db.prepare('SELECT count(*) as c FROM ce_job_items WHERE job_id = ?').get(job.id) as any;
        console.log(`📊 Items created in DB for test job: ${items.c}`);

        if (items.c > 0) {
            console.log("✅ SUCCESS: Data was read and processed.");
        } else {
            console.error("❌ FAILURE: Job finished but 0 items created. Reading likely failed silently.");
            process.exit(1);
        }

    } catch (e) {
        console.error("❌ EXCEPTION:", e);
        process.exit(1);
    } finally {
        console.log("🛑 FORCE EXITING");
        process.exit(0);
    }
}

test();
