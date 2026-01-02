
import { getCeDatabase } from './src/modules/catalogEnricher/db/ceDatabase';
import { ceJobService } from './src/modules/catalogEnricher/services/ceJobService';

const db = getCeDatabase();
// Find running jobs
const runningJobs = db.prepare("SELECT id FROM ce_jobs WHERE status = 'running' OR status = 'pending'").all() as { id: string }[];

console.log(`🛑 Found ${runningJobs.length} active jobs to stop.`);

for (const job of runningJobs) {
    console.log(`Stopping Job: ${job.id}`);
    try {
        ceJobService.stopJob(job.id);
        console.log(`✅ Stopped ${job.id}`);
    } catch (e: any) {
        console.error(`❌ Failed to stop ${job.id}:`, e.message);
    }
}

// Force clean DB state just in case
db.prepare("UPDATE ce_jobs SET status = 'stopped' WHERE status = 'running'").run();
console.log("🧹 Forced DB Cleanup Complete.");
process.exit(0);
