// @ts-nocheck

// debug_integrity_check.ts
console.log("Checking integrity of services...");

try {
    console.log("1. Importing ceTypes...");
    require('./src/modules/catalogEnricher/types/ceTypes');
    console.log("✅ ceTypes OK");

    console.log("2. Importing ceAiService...");
    require('./src/modules/catalogEnricher/services/ceAiService');
    console.log("✅ ceAiService OK");

    console.log("3. Importing cePuppeteerService...");
    require('./src/modules/catalogEnricher/services/cePuppeteerService');
    console.log("✅ cePuppeteerService OK");

    console.log("4. Importing ceQueueService...");
    require('./src/modules/catalogEnricher/services/ceQueueService');
    console.log("✅ ceQueueService OK");

} catch (e) {
    console.error("❌ CRITICAL ERROR:", e);
    process.exit(1);
}
console.log("✅ ALL SERVICES OK");
