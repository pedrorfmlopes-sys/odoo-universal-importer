export interface OdooConfig {
    url: string;
    db: string;
    userEmail: string;
    apiKey: string;
    importMode?: "basic" | "pro";
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
    | "booleanConstant";// always true or false

export interface FieldMapping {
    mode: FieldMappingMode;
    column?: string;          // for "column" mode
    columns?: string[];       // for "concat" mode
    constantValue?: string;   // for "constant" mode
    booleanValue?: boolean;   // for "booleanConstant" mode
    separator?: string;       // for "concat" (e.g. " - ")
}

export type ImportMapping = Record<string, string | FieldMapping>;

