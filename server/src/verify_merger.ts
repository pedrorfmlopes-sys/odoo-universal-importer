import { ceMergerService } from './modules/catalogEnricher/services/ceMergerService';
import { getCeDatabase } from './modules/catalogEnricher/db/ceDatabase';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// Mock File Upload
const mockUpload = (filename: string, data: any[]) => {
    // Write a real excel file or just bypass? 
    // Service expects a buffer to use XLSX.read.
    // Making a buffer from a JSON is complex without XLSX write.
    // Instead, I'll mock the 'file' object and let the service write it.
    // Wait, the service does `XLSX.read(file.buffer)`.

    // easier to use a dummy buffer and a mock implementation, OR create a real excel file using `xlsx`.
    const XLSX = require('xlsx');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return {
        originalname: filename,
        buffer: buffer
    } as Express.Multer.File;
};

async function run() {
    console.log("🛠️ Testing Smart Merger Backend...");

    // 1. Create a Dummy Brand Profile
    const db = getCeDatabase();
    const brandId = uuidv4();
    db.prepare("INSERT INTO ce_brand_profiles (id, name, domain_root) VALUES (?, ?, ?)").run(brandId, "Test Merger Brand", "testbrand.com");
    console.log(`✅ Created Brand: ${brandId}`);

    // 2. Create Dummy Web Products
    db.prepare("INSERT INTO ce_web_products (brand_profile_id, guessed_code, product_name, product_url) VALUES (?, ?, ?, ?)").run(brandId, "ABC-100", "Web Product A", "http://testbrand.com/a");
    db.prepare("INSERT INTO ce_web_products (brand_profile_id, guessed_code, product_name, product_url) VALUES (?, ?, ?, ?)").run(brandId, "XYZ-200", "Web Product B", "http://testbrand.com/b");
    console.log(`✅ Created Web Products`);

    // 3. Upload Pricelist (Exact Match Scenario)
    const excelData = [
        { SKU: "ABC-100", Name: "Official Item A", Price: 10.50 },
        { SKU: "XYZ-200", Name: "Official Item B", Price: 20.00 },
        { SKU: "MISSING-300", Name: "Missing Item C", Price: 5.00 } // Should not match
    ];

    const file = mockUpload("test_pricelist.xlsx", excelData);
    const pl = ceMergerService.savePricelist(file, brandId);
    console.log(`✅ Uploaded Pricelist: ${pl.id} (${pl.row_count} rows)`);

    // 4. Run Matcher (Exact SKU)
    const mapping = { sku: "SKU", name: "Name", price: "Price" };
    console.log("🔄 Running Matcher...");
    const result = await ceMergerService.runMatcher(pl.id, mapping);
    console.log(`📊 Match Result: ${result.matches} / ${result.total}`);

    if (result.matches !== 2) throw new Error(`Expected 2 matches, got ${result.matches}`);

    // 5. Verify Merged Results
    const merged = ceMergerService.getMergedResults(pl.id, 1, 10);
    const items = merged.items as any[];

    const itemA = items.find((i: any) => i.final_sku === "ABC-100");
    if (!itemA || !itemA.web_product_id) throw new Error("Item A not matched correctly");
    console.log("✅ Verified Item A match");

    const itemC = items.find((i: any) => i.final_sku === "MISSING-300");
    if (!itemC || itemC.web_product_id) throw new Error("Item C matched incorrectly (should be null)");
    console.log("✅ Verified Item C no-match");

    console.log("🎉 VERIFICATION PASSED!");
}

run().catch(e => {
    console.error("❌ FAILED:", e);
    process.exit(1);
});
