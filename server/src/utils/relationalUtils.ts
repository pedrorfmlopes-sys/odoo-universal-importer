
import { ImportMapping, FieldMapping } from "../odoo/types";
import { RELATIONAL_FIELDS } from "../config/relationalFields";
import { OdooClient } from "../odoo/odooClient";

export async function resolveRelationalFieldsForRow(
    mainModel: string,
    row: any,
    mapping: ImportMapping,
    odoo: OdooClient,
    cache: Map<string, number>
): Promise<Record<string, number>> {
    const result: Record<string, number> = {};

    const configForModel = RELATIONAL_FIELDS[mainModel] || {};

    for (const [fieldName, val] of Object.entries(mapping)) {
        // Mapping values can be string (legacy/basic) or FieldMapping object
        if (typeof val === 'string') continue;

        const fieldMapping = val as FieldMapping;
        const relConfig = fieldMapping.relational;

        // Process only if it has relational config and is configured in known RELATIONAL_FIELDS
        if (!relConfig) continue;
        if (!configForModel[fieldName]) continue;

        // Use the config from request (relConfig) but can fallback/validate with configForModel
        // The relConfig comes from frontend so it should match
        const { relatedModel, displayField, createIfNotFound } = relConfig;

        switch (fieldMapping.mode) {
            case "relationalConstantExisting": {
                if (relConfig.fixedId) {
                    result[fieldName] = relConfig.fixedId;
                }
                break;
            }

            case "relationalConstantNew": {
                const displayValue = fieldMapping.constantValue?.trim();
                if (!displayValue) break;

                const cacheKey = `${relatedModel}:${displayField}:${displayValue}`;
                if (cache.has(cacheKey)) {
                    result[fieldName] = cache.get(cacheKey)!;
                    break;
                }

                // search
                const found = await odoo.searchRead(relatedModel, [[displayField, "=", displayValue]], [displayField], 1);

                let id: number | null = null;

                if (found.length > 0) {
                    id = found[0].id;
                } else if (createIfNotFound) {
                    id = await odoo.create(relatedModel, { [displayField]: displayValue });
                }

                if (id != null) {
                    cache.set(cacheKey, id);
                    result[fieldName] = id;
                }

                break;
            }

            case "relationalFromColumn": {
                if (!fieldMapping.column) break;
                const raw = row[fieldMapping.column];
                const displayValue = typeof raw === "string" ? raw.trim() : (raw ? String(raw) : "");
                if (!displayValue) break;

                const cacheKey = `${relatedModel}:${displayField}:${displayValue}`;
                if (cache.has(cacheKey)) {
                    result[fieldName] = cache.get(cacheKey)!;
                    break;
                }

                const found = await odoo.searchRead(relatedModel, [[displayField, "=", displayValue]], [displayField], 1);

                let id: number | null = null;

                if (found.length > 0) {
                    id = found[0].id;
                } else if (createIfNotFound) {
                    id = await odoo.create(relatedModel, { [displayField]: displayValue });
                }

                if (id != null) {
                    cache.set(cacheKey, id);
                    result[fieldName] = id;
                }

                break;
            }

            default:
                break;
        }
    }

    return result;
}
