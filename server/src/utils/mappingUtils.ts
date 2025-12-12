import { ImportMapping, FieldMapping } from "../odoo/types";

/**
 * Maps a single row of data to an Odoo payload based on a provided mapping.
 * 
 * @param row - The source data row (key-value pair from Excel)
 * @param mapping - A dictionary where keys are Odoo field names and values are either Excel column headers (string) or advanced mapping objects.
 * @returns An object ready to be sent to Odoo.
 */
export const buildOdooPayloadFromRow = (row: any, mapping: ImportMapping): any => {
    const payload: any = {};

    for (const [odooField, rule] of Object.entries(mapping)) {
        let value: any = undefined;

        // Backward compatibility: Simple string mapping (Field -> Column)
        if (typeof rule === 'string') {
            if (rule && row.hasOwnProperty(rule)) {
                value = row[rule];
            }
        }
        // Advanced Mapping (Object)
        else if (typeof rule === 'object' && rule !== null) {
            const mapRule = rule as FieldMapping;
            switch (mapRule.mode) {
                case 'column':
                    if (mapRule.column && row.hasOwnProperty(mapRule.column)) {
                        value = row[mapRule.column];
                    }
                    break;
                case 'constant':
                    value = mapRule.constantValue;
                    break;
                case 'booleanConstant':
                    value = mapRule.booleanValue;
                    break;
                case 'concat':
                    if (mapRule.columns && Array.isArray(mapRule.columns)) {
                        const parts = mapRule.columns.map(col => row.hasOwnProperty(col) ? row[col] : '').filter(v => v !== undefined && v !== null && v !== '');
                        value = parts.join(mapRule.separator || ' ');
                    }
                    break;
            }
        }

        if (value !== undefined) {
            // Basic trimming for strings
            if (typeof value === 'string') {
                value = value.trim();
            }
            payload[odooField] = value;
        }
    }

    return payload;
};


/**
 * Validates that all required fields are present in the payload.
 * 
 * @param values - The Odoo payload
 * @param requiredFields - Array of required field names
 * @returns Array of error messages
 */
export const validateRequiredFields = (values: any, requiredFields: string[]): string[] => {
    const errors: string[] = [];
    for (const field of requiredFields) {
        if (values[field] === undefined || values[field] === null || values[field] === "") {
            errors.push(`Missing required field: ${field}`);
        }
    }
    return errors;
};

