
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db: Database.Database | null = null;

export const getCeDatabase = () => {
    if (db) return db;

    // Use a shared DB path as requested ("Importer DB") - we'll create one if it doesn't exist
    // This allows sharing this DB file with other modules in the future
    const dbPath = process.env.CE_DB_PATH || path.join(process.cwd(), 'data', 'importer.db');
    console.log(`[Database] 📂 Connecting to SQLite at: ${dbPath}`);

    // Ensure directory
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    console.log(`[Catalog Enricher] Opening Database: ${dbPath}`);
    db = new Database(dbPath, { verbose: console.log });

    // WAL mode for better concurrency
    db.pragma('journal_mode = WAL');

    // DEBUG: Check data
    try {
        const jobCount = db.prepare('SELECT count(*) as c FROM ce_jobs').get() as any;
        const prodCount = db.prepare('SELECT count(*) as c FROM ce_web_products').get() as any;
        console.log(`[DB DEBUG] Connected. Jobs: ${jobCount.c}, Products: ${prodCount.c}`);
    } catch (e) { console.error("DB Debug error", e); }

    // Initialize Schema
    initSchema(db);

    return db;
};

const initSchema = (database: Database.Database) => {
    // Phase 1: ce_uploads and ce_jobs

    database.exec(`
        CREATE TABLE IF NOT EXISTS ce_uploads (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            stored_path TEXT NOT NULL,
            source_hash TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );
        
        CREATE TABLE IF NOT EXISTS ce_jobs (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL, -- enrich, update, analyze
            status TEXT DEFAULT 'pending', -- pending, running, completed, failed
            progress INTEGER DEFAULT 0,
            params_json TEXT, -- JSON
            counters_json TEXT, -- JSON
            result_summary_json TEXT, -- JSON
            error_text TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS ce_job_items (
            job_id TEXT,
            row_id TEXT,
            key_value TEXT,
            status TEXT, -- ok, not_found, ambiguous, error
            confidence INTEGER,
            product_url TEXT,
            assets_json TEXT,
            evidence_json TEXT,
            notes TEXT,
            updated_at TEXT,
            PRIMARY KEY (job_id, row_id),
            FOREIGN KEY(job_id) REFERENCES ce_jobs(id)
        );

        CREATE TABLE IF NOT EXISTS ce_site_profiles (
            id TEXT PRIMARY KEY,
            domain TEXT UNIQUE NOT NULL,
            version INTEGER DEFAULT 1,
            mode TEXT DEFAULT 'cheerio',
            strategy_id TEXT,
            rules_json TEXT,
            selectors_json TEXT,
            hints_json TEXT,
            success_rate REAL,
            last_validated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS ce_credentials (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            service_url TEXT,
            username TEXT,
            password_enc TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS ce_brand_profiles (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            domain_root TEXT,
            auth_required BOOLEAN DEFAULT 0,
            credential_id TEXT, -- Link to ce_credentials
            auth_login_url TEXT, -- Legacy
            auth_user TEXT,      -- Legacy
            auth_pass TEXT,      -- Legacy
            url_pattern_template TEXT,
            extraction_rules_json TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY(credential_id) REFERENCES ce_credentials(id)
        );

        CREATE TABLE IF NOT EXISTS ce_assets (
            id TEXT PRIMARY KEY,
            asset_key TEXT UNIQUE NOT NULL, -- brand+product+type+role
            job_id TEXT,
            brand_profile_id TEXT,
            product_ref TEXT,
            asset_type TEXT, -- image, pdf
            role TEXT,       -- main, gallery, tech_sheet
            original_url TEXT,
            product_url TEXT,
            local_path TEXT,
            http_status INTEGER,
            file_hash TEXT,
            check_sum TEXT,
            last_checked_at TEXT,
            last_seen_at TEXT,
            error_log TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY(job_id) REFERENCES ce_jobs(id),
            FOREIGN KEY(brand_profile_id) REFERENCES ce_brand_profiles(id)
        );

        CREATE INDEX IF NOT EXISTS idx_ce_assets_lookup ON ce_assets(brand_profile_id, product_ref);
        CREATE INDEX IF NOT EXISTS idx_ce_assets_hash ON ce_assets(file_hash);

    `);

    // Migrations
    try {
        database.exec("ALTER TABLE ce_jobs ADD COLUMN profile_id TEXT REFERENCES ce_brand_profiles(id)");
    } catch (e) { /* Column likely exists */ }

    // Crawler Table
    database.exec(`
        -- Removed DROP TABLE to persist data

        CREATE TABLE IF NOT EXISTS ce_web_products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id TEXT, -- Link to Bulk Job
            brand_profile_id TEXT, -- Link to specific Dossier (UUID)
            category_name TEXT,
            collection_name TEXT,
            product_name TEXT,
            product_url TEXT UNIQUE,
            image_url TEXT,
            guessed_code TEXT,
            crawled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            variants_json TEXT, -- Extracted Variants JSON
            search_blob TEXT, -- concatenated text for fuzzy search
            gallery_json TEXT, -- Additional Gallery Images
            file_urls_json TEXT, -- Named PDFs and 3D Files
            associated_products_json TEXT, -- Components like inner parts/handles
            features_json TEXT -- Specialized features like finishes/swatches
        );
    `);

    // Migration: Add job_id if not exists (for dev safety, though we dropped table above for simplicity in dev)
    try {
        database.exec("ALTER TABLE ce_web_products ADD COLUMN job_id TEXT");
    } catch (e) { }

    // Migration: Add Rich Content columns
    try { database.exec("ALTER TABLE ce_web_products ADD COLUMN gallery_json TEXT"); } catch (e) { }
    try { database.exec("ALTER TABLE ce_web_products ADD COLUMN file_urls_json TEXT"); } catch (e) { }
    try { database.exec("ALTER TABLE ce_web_products ADD COLUMN associated_products_json TEXT"); } catch (e) { }
    try { database.exec("ALTER TABLE ce_web_products ADD COLUMN features_json TEXT"); } catch (e) { }

    // Missing Products Table (To track products not found in Web Catalog)
    database.exec(`
        CREATE TABLE IF NOT EXISTS ce_missing_products(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            brand_profile_id TEXT,
            product_code TEXT UNIQUE,
            last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            occurrence_count INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS ce_recipes (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            domain TEXT NOT NULL,
            start_url TEXT,
            steps_json TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS ce_taxonomy (
            id TEXT PRIMARY KEY,
            brand_profile_id TEXT NOT NULL,
            parent_id TEXT, -- ID of parent category (nullable (root))
            name TEXT NOT NULL,
            url TEXT,
            type TEXT, -- category, collection, variant
            level INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY(brand_profile_id) REFERENCES ce_brand_profiles(id),
            FOREIGN KEY(parent_id) REFERENCES ce_taxonomy(id)
        );
    `);

    // Staging Table for Real-time Extraction
    database.exec(`
        CREATE TABLE IF NOT EXISTS ce_crawler_staging (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id TEXT NOT NULL,
            url TEXT NOT NULL,
            status TEXT DEFAULT 'pending', -- pending, extracted, error
            data_json TEXT, -- Full extraction payload
            error_message TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY(job_id) REFERENCES ce_jobs(id)
        );
        CREATE INDEX IF NOT EXISTS idx_ce_staging_job ON ce_crawler_staging(job_id);

        -- Merger Logic Tables
        CREATE TABLE IF NOT EXISTS ce_pricelists (
            id TEXT PRIMARY KEY,
            brand_profile_id TEXT NOT NULL,
            filename TEXT NOT NULL,
            uploaded_at TEXT DEFAULT (datetime('now')),
            row_count INTEGER DEFAULT 0,
            columns_json TEXT, -- Mapped columns
            data_path TEXT, -- Path to storage or table
            FOREIGN KEY(brand_profile_id) REFERENCES ce_brand_profiles(id)
        );

        CREATE TABLE IF NOT EXISTS ce_merge_rules (
            id TEXT PRIMARY KEY,
            brand_profile_id TEXT NOT NULL,
            rule_type TEXT NOT NULL, -- exact, regex, fuzzy
            web_field TEXT, -- guessed_code, product_name
            excel_field TEXT, -- sku, name
            priority INTEGER DEFAULT 0,
            parameters_json TEXT, -- { pattern: "", replacement: "", threshold: 0.8 }
            FOREIGN KEY(brand_profile_id) REFERENCES ce_brand_profiles(id)
        );

        CREATE TABLE IF NOT EXISTS ce_merged_catalog (
            id TEXT PRIMARY KEY,
            pricelist_id TEXT NOT NULL,
            brand_profile_id TEXT, -- Denormalized for easier query
            web_product_id INTEGER, -- Nullable FK to ce_web_products
            final_sku TEXT,
            final_name TEXT,
            final_price REAL,
            match_confidence INTEGER DEFAULT 0,
            match_method TEXT,
            status TEXT DEFAULT 'draft', -- draft, approved, rejected
            FOREIGN KEY(pricelist_id) REFERENCES ce_pricelists(id),
            FOREIGN KEY(web_product_id) REFERENCES ce_web_products(id)
        );
    `);
    console.log('[Catalog Enricher] Database Schema Initialized');
};
