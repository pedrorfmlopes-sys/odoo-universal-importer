export interface RelationalFieldConfig {
    relatedModel: string;        // e.g. "uom.uom"
    displayField: string;        // e.g. "name"
    createIfNotFound?: boolean;  // allow create when not found
}

// Per "main model", map specific fields to relational config
export const RELATIONAL_FIELDS: Record<string, Record<string, RelationalFieldConfig>> = {
    "product.template": {
        uom_id: {
            relatedModel: "uom.uom",
            displayField: "name",
            createIfNotFound: false, // usually we do not auto-create UoMs
        },
        uom_po_id: {
            relatedModel: "uom.uom",
            displayField: "name",
            createIfNotFound: false,
        },
        categ_id: {
            relatedModel: "product.category",
            displayField: "name",
            createIfNotFound: true,
        },
    },
    // Extendable to other models/fields in the future
};
