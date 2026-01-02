
export type JobType = 'enrich' | 'update' | 'analyze' | 'targeted_enrichment';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';
export type ItemStatus = 'pending' | 'ok' | 'not_found' | 'ambiguous' | 'error';

export interface CeJob {
    id: string;
    type: JobType;
    status: JobStatus;
    progress: number;
    counters?: { found: number, processed: number, total: number };
    params?: any;
    resultSummary?: any;
    errorText?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CeJobItem {
    jobId: string;
    rowId: string;
    keyValue: string;
    status: ItemStatus;
    confidence: number;
    productUrl?: string;
    assets?: any;
    evidence?: any;
    notes?: string;
}

export interface ProbeResult {
    url: string;
    accessible: boolean;
    statusCode?: number;
    title?: string;
    server?: string;
    contentType?: string;
    requiresJs: boolean; // simplistic detection
}

export type PageKind =
    | 'category_hub'
    | 'product_list'
    | 'product_detail'
    | 'collection_hub'
    | 'collection_page'
    | 'unknown';

export interface PageAnalysisResult {
    url: string;
    page_kind?: PageKind;
    canonical_url?: string;

    // Link Harvester (Raw Data)
    subcategory_urls_found?: string[];
    product_family_urls_found?: string[];
    product_family_refs_found?: { url: string, name: string }[];

    // Optional (Phase 2 readiness)
    asset_urls_found?: {
        pdf?: string[];
        images?: string[];
    };

    // Extracted Detail Data
    extracted_data?: {
        name?: string;
        description?: string;
        code?: string;
        guessed_code?: string; // New V2
        main_image?: string;
        tech_sheet_url?: string;
        gallery?: string[]; // New V2
        files?: { name: string, url: string, type: string, local_path?: string, error?: string }[]; // New V2
        variants?: { name: string, image: string, code?: string }[]; // NEW V3
        associated_products?: { name: string, url: string, is_required?: boolean }[]; // NEW V3
        specs?: Record<string, string>;
    };

    debug_counts?: {
        links_total: number;
        subcats_found: number;
        products_found: number;
        pdf_found?: number;
    };
}
