
const { Database } = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../data/importer.db');
const db = require('better-sqlite3')(dbPath);

// 1. Get the Job to find the Profile ID
const jobId = 'bulk_1766494557878';
const job = db.prepare('SELECT profile_id, params_json FROM ce_jobs WHERE id = ?').get(jobId);

if (!job) {
    console.log("Job not found");
    process.exit(1);
}

const profileId = job.profile_id;
console.log(`Profile ID: ${profileId}`);

// 2. Get the Taxonomy/Tree for this Profile
// Usually stored in ce_brand_profiles or a separate table if cache exists.
// Let's check ce_brand_profiles first.
const profile = db.prepare('SELECT taxonomy_json FROM ce_brand_profiles WHERE id = ?').get(profileId);

if (profile && profile.taxonomy_json) {
    try {
        const tree = JSON.parse(profile.taxonomy_json);
        console.log("Taxonomy Tree Found.");

        // Helper to sum counts recursively
        let totalEstimated = 0;
        let categoriesWithCount = 0;

        const traverse = (nodes) => {
            for (const node of nodes) {
                if (node.count) {
                    totalEstimated += parseInt(node.count, 10);
                    categoriesWithCount++;
                }
                if (node.children && node.children.length > 0) {
                    traverse(node.children);
                }
            }
        };

        traverse(tree);

        console.log(`Total Estimated Items (from Scan): ${totalEstimated}`);
        console.log(`Categories contributing to count: ${categoriesWithCount}`);

    } catch (e) {
        console.log("Failed to parse taxonomy JSON", e);
    }
} else {
    console.log("No taxonomy_json found in profile.");
}
