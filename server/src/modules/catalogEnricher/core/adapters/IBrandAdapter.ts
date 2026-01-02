import { IDriver } from '../drivers/IDriver';

export interface ProductItem {
    productRef: string;
    name?: string;
    productUrl?: string; // If discovered from a list or crawl
    rawRow?: any;       // The original excel row if applicable
}

export interface ExtractedAsset {
    type: 'image' | 'pdf' | 'cad' | 'other';
    role: string; // 'main', 'gallery', 'tech_sheet'
    url: string;
}

export interface JobScope {
    type: 'list' | 'collection' | 'all';
    items?: any[]; // List of rows from Excel
    profileConfig?: any; // The brand profile configuration
    primaryKey?: string; // The specific column name to use as Product Code
}

export interface IBrandAdapter {
    /**
     * Phase 1: Discover products based on scope.
     * Can yield items one by one (generator) to support large lists/crawls.
     */
    discover(scope: JobScope): AsyncGenerator<ProductItem>;

    /**
     * Phase 2: Extract assets for a single product.
     * Uses the driver to fetch/parse the product page if needed.
     */
    extract(product: ProductItem, driver: IDriver): Promise<ExtractedAsset[]>;
}
