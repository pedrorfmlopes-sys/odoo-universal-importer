export interface MergeRule {
    id: string;
    brand_profile_id: string;
    rule_type: 'exact' | 'regex' | 'fuzzy';
    web_field: 'guessed_code' | 'product_name' | 'product_url';
    excel_field: 'sku' | 'name' | 'ean';
    priority: number;
    parameters_json: string; // JSON string of RuleParameters
}

export interface RuleParameters {
    pattern?: string;
    replacement?: string;
    threshold?: number; // 0.0 to 1.0 for fuzzy
    caseSensitive?: boolean;
}

export interface Pricelist {
    id: string;
    brand_profile_id: string;
    filename: string;
    uploaded_at: string;
    row_count: number;
    columns_json: string; // JSON string of ColumnMapping
    data_path: string;
}

export interface ColumnMapping {
    sku?: string;
    name?: string;
    price?: string;
    ean?: string;
    description?: string;
    [key: string]: string | undefined;
}

export interface MergedItem {
    id: string;
    pricelist_id: string;
    brand_profile_id: string;
    web_product_id: number | null;
    final_sku: string;
    final_name: string;
    final_price: number;
    match_confidence: number;
    match_method: string;
    status: 'draft' | 'approved' | 'rejected' | 'ignored';
}
