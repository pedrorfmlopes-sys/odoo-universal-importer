
import { analyzePage, initPuppeteerService } from '../services/cePuppeteerService';
import { getCeDatabase } from '../db/ceDatabase';
import path from 'path';
import fs from 'fs';

// Mock SocketIO
const mockIo: any = {
    emit: (event: string, data: any) => {
        console.log(`[SocketIO] ${event}:`, JSON.stringify(data).substring(0, 100) + '...');
    }
};

const GOLDEN_URL = "https://www.ritmonio.it/en/bath-shower/product/?code=069929_PR51AZ102%2BE0BA0115SX%2BPR51MC102&family=69928";

const run = async () => {
    console.log("🚀 Starting Ritmonio Verification...");
    initPuppeteerService(mockIo);

    // 1. Get Credential ID for Ritmonio
    const db = getCeDatabase();
    const profile = db.prepare("SELECT id, credential_id FROM ce_brand_profiles WHERE name LIKE 'Ritmonio%' OR domain_root LIKE '%ritmonio%'").get() as any;

    if (!profile) {
        console.error("❌ Ritmonio profile not found in DB!");
        process.exit(1);
    }
    console.log(`✅ Found Ritmonio Profile: ${profile.id} (Cred: ${profile.credential_id})`);

    // 2. Run Analysis
    console.log(`🔍 Analyzing: ${GOLDEN_URL}`);
    try {
        const result = await analyzePage(GOLDEN_URL, undefined, {
            downloadAssets: true,
            credentialId: profile.credential_id
        });

        const htmlPath = path.join(process.cwd(), 'data', 'ritmonio_debug.html');
        fs.writeFileSync(htmlPath, result.html);
        console.log(`📄 Saved HTML dump to: ${htmlPath}`);

        console.log("✅ Analysis Complete.");
        console.log("📄 Metadata Files Found:", result.metadata.extracted_data?.files?.length);

        // 3. Verify Files
        const files = result.metadata.extracted_data?.files || [];
        const zips = files.filter(f => f.type === '3d' || f.url.endsWith('.zip'));
        const pdfs = files.filter(f => f.type === 'pdf' || f.url.endsWith('.pdf'));

        console.log(`📦 ZIPs: ${zips.length}`);
        console.log(`📄 PDFs: ${pdfs.length}`);

        if (zips.length === 0) {
            console.error("❌ No ZIP files found!");
        } else {
            // Check local files
            const assetsDir = path.join(process.cwd(), 'data', 'catalog-enricher', 'assets', 'ritmonio');
            console.log(`📂 Checking assets dir: ${assetsDir}`);
            if (fs.existsSync(assetsDir)) {
                const onDisk = fs.readdirSync(assetsDir);
                console.log("📂 Files on disk:", onDisk);
                // Check if any zip exists
                const hasZip = onDisk.some(f => f.endsWith('.zip'));
                if (hasZip) console.log("✅ ZIP file confirmed on disk.");
                else console.error("❌ No ZIP file found on disk.");
            } else {
                console.error("❌ Assets directory does not exist.");
            }
        }

    } catch (e: any) {
        console.error("❌ Verification Failed:", e);
    }

    process.exit(0);
};

run();
