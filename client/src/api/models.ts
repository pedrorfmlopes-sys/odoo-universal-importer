export type MacroId = "commercial" | "sales_crm" | "purchasing_inventory" | "projects_services" | "accounting" | "hr" | "other";

export interface OdooEntityConfig {
    id: string;
    label: string;
    model: string;
    subgroup?: string;
}

export interface MacroConfig {
    id: MacroId;
    label: string;
    description?: string;
    entities: OdooEntityConfig[];
}

export interface OdooFieldMeta {
    name: string;
    string: string;
    type: string;
    required: boolean;
    readonly?: boolean;
    help?: string;
    hint?: string;
}


export interface ImportDryRunResult {
    totalRows: number;
    validCount: number;
    errorCount: number;
    errors: { rowIndex: number; messages: string[] }[];
}

export interface ImportRunResult {
    totalRows: number;
    created: number;
    updated: number;
    failed: number;
    failures: { rowIndex: number; message: string }[];
}

export type FieldMappingMode =
    | "column"
    | "constant"
    | "concat"
    | "booleanConstant"
    | "relationalFromColumn"
    | "relationalConstantExisting"
    | "relationalConstantNew";

export interface RelationalMappingConfig {
    mainModel: string;
    relatedModel: string;
    displayField: string;
    createIfNotFound?: boolean;
    fixedId?: number;
}

export interface FieldMapping {
    mode: FieldMappingMode;
    column?: string;
    columns?: string[];
    constantValue?: string;
    booleanValue?: boolean;
    separator?: string;
    relational?: RelationalMappingConfig;
}

export type ImportMapping = Record<string, FieldMapping>;

