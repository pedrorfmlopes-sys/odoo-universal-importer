
import { Page } from 'puppeteer';

export interface ProductVariant {
    dimension: string;
    dimension_normalized: string;
    variant_code: string;
    sku_real?: string | null;
    internal_variant_code?: string;
    pdf_urls?: string[];
    image_url?: string; // NEW V3
    source: 'json-ld' | 'select' | 'table' | 'regex-js' | 'ui-interactive';
    sku_source?: 'dom_after_select' | 'dom_static' | 'unknown' | 'synthetic';
    score?: number;
    strategy_id?: string;
}

export interface DimensionOption {
    label: string;
    value?: string;
    index?: number;
    meta?: any; // element handle or other data
}

export interface VariantStrategy {
    id: string;
    detect(ctx: { url: string; hostname: string; page: Page }): Promise<boolean>;
    getDimensionOptions(page: Page): Promise<DimensionOption[]>;
    selectDimension(page: Page, opt: DimensionOption): Promise<void>;
    readSkuReal(page: Page): Promise<string | null>;
    readPdfUrls(page: Page): Promise<string[]>;
    waitForUpdate(page: Page, prev: { sku: string | null; pdfHash: string }): Promise<void>;
}
