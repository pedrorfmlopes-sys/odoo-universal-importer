export interface OdooConfig {
    url: string;
    db: string;
    userEmail: string;
    apiKey: string;
    importMode?: "basic" | "pro";

    // AI Configuration
    aiProvider?: string; // 'openai', 'anthropic', 'gemini', 'ollama'
    aiApiKey?: string;
    aiModel?: string;
}

export interface OdooFieldMeta {
    name: string;
    string: string;
    type: string;
    required: boolean;
    readonly?: boolean;
    help?: string;
    hint?: string;
    selection?: [string, string][]; // For selection fields
    relation?: string; // For relational fields
}


export type FieldMappingMode =
    | "column"          // value comes from a single Excel column
    | "constant"        // value is a fixed constant string
    | "concat"          // concatenation of multiple Excel columns
    | "booleanConstant" // always true or false
    | "relationalFromColumn"       // read display value from Excel, match/create related record
    | "relationalConstantExisting" // always use a specific related record ID
    | "relationalConstantNew";     // use a single display value, create/search once

export interface RelationalMappingConfig {
    mainModel: string;       // e.g. "product.template"
    relatedModel: string;    // e.g. "uom.uom"
    displayField: string;    // e.g. "name"
    createIfNotFound?: boolean;
    fixedId?: number;        // for "relationalConstantExisting"
}

export interface FieldMapping {
    mode: FieldMappingMode;
    column?: string;          // for "column" mode
    columns?: string[];       // for "concat" mode
    constantValue?: string;   // for "constant" mode
    booleanValue?: boolean;   // for "booleanConstant" mode
    separator?: string;       // for "concat" (e.g. " - ")
    relational?: RelationalMappingConfig;
}

export type ImportMapping = Record<string, string | FieldMapping>;
