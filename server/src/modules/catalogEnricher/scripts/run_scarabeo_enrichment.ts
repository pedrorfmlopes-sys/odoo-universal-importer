
import { getCeDatabase } from '../db/ceDatabase';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

// --- CONFIG & UTILS ---

interface Config {
    excelPath: string;
    limit: number;
    allowPrefixMatch: boolean;
}

const parseArgs = (): Config => {
    const args = process.argv.slice(2);
    const config: Config = {
        excelPath: '',
        limit: 0,
        allowPrefixMatch: false
    };

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--excel' && args[i + 1]) {
            config.excelPath = args[i + 1];
            i++;
        } else if (args[i] === '--limit' && args[i + 1]) {
            config.limit = parseInt(args[i + 1], 10);
            i++;
        } else if (args[i] === '--allowPrefixMatch') {
            config.allowPrefixMatch = true;
        }
    }
    return config;
};

const findExcelFile = (): string | null => {
    const searchDirs = [
        path.join(process.cwd(), 'server/data/catalog-enricher/uploads'),
        path.join(process.cwd(), 'data/catalog-enricher/uploads')
    ];

    for (const dir of searchDirs) {
        if (!fs.existsSync(dir)) continue;

        // Recursive simple search
        const files = getAllFiles(dir);
        const match = files.find(f => f.includes('Scarabeo - LISTINO EXCEL 2024.xlsx'));
        if (match) return match;
    }
    return null;
};

const getAllFiles = (dir: string, fileList: string[] = []): string[] => {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            getAllFiles(filePath, fileList);
        } else {
            fileList.push(filePath);
        }
    });
    return fileList;
};

// --- CORE ---

interface WebProduct {
    id: number;
    product_url: string;
    guessed_code: string;
    image_url: string;
    files_json: string; // JSON string
    features_json: string; // JSON string
    // derived
    filesCount: number;
}

const run = () => {
    const config = parseArgs();
    console.log("\n--- SCARABEO EXCEL ENRICHMENT PIPELINE ---");
    console.log("Config:", JSON.stringify(config, null, 2));

    const db = getCeDatabase();

    // 1. Resolve Excel Path
    let excelPath = config.excelPath;
    if (!excelPath) {
        const found = findExcelFile();
        if (!found) {
            console.error("[ERROR] Excel file not provided and not found in auto-search locations.");
            console.error("Searched in: server/data/catalog-enricher/uploads/** and data/catalog-enricher/uploads/**");
            process.exit(1);
        }
        console.log(`[INFO] Auto-detected Excel: ${found}`);
        excelPath = found;
    }

    if (!fs.existsSync(excelPath)) {
        console.error(`[ERROR] File does not exist: ${excelPath}`);
        process.exit(1);
    }

    // 2. Prepare Staging Table
    // Drop and recreate to ensure schema
    db.exec("DROP TABLE IF EXISTS ce_excel_sku_staging");
    db.exec(`
        CREATE TABLE ce_excel_sku_staging (
             sku TEXT PRIMARY KEY,
             baseCode TEXT,
             finishCode TEXT,
             extraSuffix TEXT,
             excelName TEXT,
             price REAL,
             ean TEXT,
             productUrl TEXT,
             heroImageUrl TEXT,
             files_json TEXT,
             filesCount INTEGER DEFAULT 0,
             finishName TEXT,
             swatchImageUrl TEXT,
             matchStatus TEXT,
             updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
    console.log("DB: Staging table `ce_excel_sku_staging` recreated.");

    // 3. Load Excel
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet) as any[];
    console.log(`Excel: Read ${rawData.length} lines from '${sheetName}'`);

    // 4. Build Web Lookup Index (Exact Match First)
    console.log("Web: Indexing products...");
    const webRows = db.prepare(`
        SELECT id, product_url, guessed_code, image_url, file_urls_json as files_json, features_json
        FROM ce_web_products 
        WHERE product_url LIKE '%scarabeoceramiche.it%'
    `).all() as WebProduct[];

    const webLookup = new Map<string, WebProduct>();
    let duplicateWarnings = 0;

    const norm = (s: string) => s ? s.toUpperCase().trim() : '';
    const cleanFileBase = (f: string) => f.replace(/\.(pdf|zip|dwg|dxf)$/i, '');

    for (const row of webRows) {
        // Calculate files count
        let fCount = 0;
        let fileCandidates: string[] = [];
        try {
            if (row.files_json) {
                const parsed = JSON.parse(row.files_json);
                if (Array.isArray(parsed)) {
                    fCount = parsed.length;
                    parsed.forEach((f: any) => {
                        const url = typeof f === 'string' ? f : f.url || f.original_url || '';
                        const fname = url.split('/').pop() || '';
                        const base = cleanFileBase(fname);
                        if (base.length > 3) fileCandidates.push(norm(base));
                    });
                }
            }
        } catch (e) { }
        row.filesCount = fCount;

        // Candidate Keys
        const candidates = new Set<string>();
        if (row.guessed_code) candidates.add(norm(row.guessed_code));
        fileCandidates.forEach(c => candidates.add(c));

        // Indexing
        candidates.forEach(key => {
            if (webLookup.has(key)) {
                // Collision!
                const existing = webLookup.get(key)!;
                // rule: pick one with more files, or keep existing
                if (row.filesCount > existing.filesCount) {
                    webLookup.set(key, row);
                } else {
                    // keep existing, simplified
                }
                duplicateWarnings++;
            } else {
                webLookup.set(key, row);
            }
        });
    }
    console.log(`Web: Indexed ${webLookup.size} keys from ${webRows.length} products. (Dupe collisions handled: ${duplicateWarnings})`);

    // 5. Processing Loop
    const upsertStmt = db.prepare(`
    INSERT INTO ce_excel_sku_staging (
        sku, baseCode, finishCode, extraSuffix, excelName, price, ean, 
        productUrl, heroImageUrl, files_json, filesCount, 
        finishName, swatchImageUrl, matchStatus
    )
    VALUES (
        @sku, @baseCode, @finishCode, @extraSuffix, @excelName, @price, @ean, 
        @productUrl, @heroImageUrl, @files_json, @filesCount, 
        @finishName, @swatchImageUrl, @matchStatus
    )
    `);

    let processed = 0;
    let stats = {
        matched: 0,
        unmatched: 0,
        finish_not_found: 0,
        prefix_matched: 0
    };

    const processLimit = config.limit > 0 ? config.limit : rawData.length;
    const dbTrans = db.transaction((items: any[]) => {
        for (let i = 0; i < items.length; i++) {
            if (processed >= processLimit) break;
            const row = items[i];

            const codice = String(row['CODICE'] || row['Codice'] || '').trim();
            if (!codice) continue;

            const descrizione = row['DESCRIZIONE'] || row['Descrizione'] || '';
            const prezzo = parseFloat(row['PREZZO'] || row['Prezzo'] || '0');
            const ean = String(row['EAN'] || row['Ean'] || '');

            // PARSE SKU
            let baseCode = codice;
            let finishCode: string | null = null;
            let extraSuffix: string | null = null;

            const match3 = codice.match(/^(.+?)(\d{2})([A-Z]{1,4})$/);
            const match2 = codice.match(/^(.+?)(\d{2})$/);

            // Constraint: baseCode must be decent length to avoid "51" etc.
            if (match3 && match3[1].length >= 3) {
                baseCode = match3[1];
                finishCode = match3[2];
                extraSuffix = match3[3];
            } else if (match2 && match2[1].length >= 3) {
                baseCode = match2[1];
                finishCode = match2[2];
            }

            // LOOKUP
            const normBase = norm(baseCode);
            let webMatch = webLookup.get(normBase);
            let matchType = 'exact';

            // Prefix Match (Active Logic)
            if (!webMatch && config.allowPrefixMatch && baseCode.length >= 5) {
                // Try strictly controlled prefix matching
                // Candidates: baseCode + 'WC', 'CL', 'BK', etc.
                // iterate webLookup? Or check specific variations?
                // Iterating is safer for "finding ANY extension" but risky for false positives.
                // Constraint: candidate key must start with baseCode AND be short enough.

                for (const [key, prod] of webLookup) {
                    if (key.startsWith(normBase)) {
                        const remainder = key.slice(normBase.length);
                        // Security check: remainder should be short (suffix) or start with separator
                        // valid: 5126CL -> 5126CLWC (len 2)
                        // invalid: 5126 -> 512655 (another product)
                        // Let's say remainder length <= 4 OR starts with '-'
                        if (remainder.length <= 4 || remainder.startsWith('-')) {
                            webMatch = prod;
                            matchType = 'prefix';
                            break; // Take first safe match
                        }
                    }
                }
            }

            let matchStatus = 'unmatched';
            let productUrl = null;
            let heroImageUrl = null;
            let files_json = null;
            let filesCount = 0;
            let finishName = null;
            let swatchImageUrl = null;

            if (webMatch) {
                matchStatus = 'matched';
                if (matchType === 'prefix') {
                    stats.prefix_matched++;
                    // console.log(`[PREFIX_MATCH_USED] ${baseCode} -> ${webMatch.guessed_code}`);
                }

                productUrl = webMatch.product_url;
                heroImageUrl = webMatch.image_url;
                files_json = webMatch.files_json;
                filesCount = webMatch.filesCount;

                // Enrich Finish
                if (finishCode) {
                    try {
                        const feats = JSON.parse(webMatch.features_json || '{}');
                        let allFinishes: any[] = [];
                        if (feats.richFeatures?.finishes) {
                            allFinishes = feats.richFeatures.finishes;
                        } else if (feats.richFeatures?.finishGroups) {
                            feats.richFeatures.finishGroups.forEach((g: any) => {
                                if (g.options) allFinishes.push(...g.options);
                            });
                        }

                        let fMatch = allFinishes.find((f: any) => String(f.code) === String(finishCode));
                        if (!fMatch) {
                            // Fallback: Name prefix match (e.g. '35' matches '35 - Night')
                            fMatch = allFinishes.find((f: any) => {
                                const name = String(f.name || f.label || '').toUpperCase();
                                const code = String(finishCode).toUpperCase();
                                return name.startsWith(code) || (f.value && String(f.value).toUpperCase().startsWith(code));
                            });
                        }

                        if (fMatch) {
                            finishName = fMatch.name || fMatch.label;
                            swatchImageUrl = fMatch.swatchImageUrl || fMatch.image;
                        } else {
                            matchStatus = 'finish_not_found';
                        }
                    } catch (e) { }
                }
            }

            if (matchStatus === 'matched') stats.matched++;
            if (matchStatus === 'unmatched') stats.unmatched++;
            if (matchStatus === 'finish_not_found') stats.finish_not_found++;


            upsertStmt.run({
                sku: codice,
                baseCode,
                finishCode,
                extraSuffix,
                excelName: descrizione,
                price: prezzo,
                ean: ean,
                productUrl,
                heroImageUrl,
                files_json,
                filesCount,
                finishName,
                swatchImageUrl,
                matchStatus
            });

            processed++;
        }
    });

    dbTrans(rawData);

    // REPORT
    console.log("\n--- REPORT ---");
    console.log(`Total Excel Rows: ${rawData.length}`);
    console.log(`Processed Rows:   ${processed}`);
    console.log(`Matched:          ${stats.matched} (${((stats.matched / processed) * 100).toFixed(1)}%)`);
    console.log(`Unmatched:        ${stats.unmatched}`);
    console.log(`Finish Not Found: ${stats.finish_not_found}`);
    if (config.allowPrefixMatch) {
        console.log(`Prefix Matches:   ${stats.prefix_matched}`);
    } else {
        console.log(`Prefix Matches:   DISABLED (0)`);
    }

    // 10 Samples for 5126CL
    console.log("\n--- SAMPLES (5126CL Family) ---");
    const samples = db.prepare(`
        SELECT sku, baseCode, finishCode, extraSuffix, matchStatus, 
               substr(swatchImageUrl, 1, 60) as swatchShort,
               substr(productUrl, 1, 60) as urlShort
        FROM ce_excel_sku_staging
        WHERE baseCode LIKE '5126CL%' OR sku LIKE '5126CL%'
        ORDER BY sku ASC
        LIMIT 10
    `).all();
    console.table(samples);
};

run();
