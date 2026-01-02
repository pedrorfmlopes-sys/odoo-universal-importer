// @ts-nocheck

import { getEnrichmentPage, initPuppeteerService } from './src/modules/catalogEnricher/services/cePuppeteerService';
import { getCeDatabase } from './src/modules/catalogEnricher/db/ceDatabase';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// Mock Socket
const mockIO: any = {
    emit: (event: string, data: any) => console.log(`[Socket] ${event}:`, data)
};

async function run() {
    console.log("🚀 Starting 3D Download Test...");
    initPuppeteerService(mockIO);

    const db = getCeDatabase();
    // 1. Get Ritmonio Credential ID
    const profile = db.prepare("SELECT * FROM ce_brand_profiles WHERE name LIKE '%Ritmonio%'").get() as any;
    if (!profile) {
        console.error("❌ Ritmonio profile not found!");
        process.exit(1);
    }
    console.log(`✅ Profile: ${profile.name}, Cred: ${profile.credential_id}`);

    try {
        // 2. Get Authenticated Page (Browser)
        // This triggers the "Login First" logic if needed
        const page = await getEnrichmentPage(profile.credential_id);
        const cookies = await page.cookies();

        // 3. Prepare Download
        const targetUrl = 'https://www.ritmonio.it/en/download/?code=2279702399'; // Known 3D Model
        console.log(`⬇️ Attempting to download: ${targetUrl}`);

        const downloadDir = path.join(__dirname, 'temp_downloads');
        if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir);

        const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

        // 4. Download via Axios (mimicking browser session)
        const response = await axios({
            method: 'GET',
            url: targetUrl,
            responseType: 'stream',
            headers: {
                'Cookie': cookieString,
                'User-Agent': await page.browser().userAgent()
            }
        });

        // Determine filename
        let filename = 'downloaded_3d_file.zip'; // Default
        const contentDisp = response.headers['content-disposition'];
        if (contentDisp) {
            const match = contentDisp.match(/filename="?([^"]+)"?/);
            if (match && match[1]) filename = match[1];
        }

        const filePath = path.join(downloadDir, filename);
        const writer = fs.createWriteStream(filePath);

        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(true));
            writer.on('error', reject);
        });

        console.log(`✅ Download Complete!`);
        console.log(`📂 Location: ${filePath}`);

        const stats = fs.statSync(filePath);
        console.log(`📦 Size: ${stats.size} bytes`);

        if (stats.size < 1000) {
            console.warn("⚠️ Warning: File size seems too small. Might be an error page or empty.");
            // Read head content if small
            const head = fs.readFileSync(filePath, 'utf8');
            if (head.includes('<!DOCTYPE html>')) {
                console.error("❌ ERROR: Downloaded HTML instead of Binary. Auth might have failed.");
            }
        }

    } catch (e: any) {
        console.error("💥 Download Failed:", e.message);
    } finally {
        process.exit(0);
    }
}

run();
