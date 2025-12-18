import { Router, Request, Response, NextFunction } from 'express';
import { buildOdooPayloadFromRow } from '../utils/mappingUtils';
import { resolveRelationalFieldsForRow } from '../utils/relationalUtils';
import { getOdooConfig } from '../config/odooConfigStore';

import { OdooClient } from '../odoo/odooClient';

const router = Router();

import { ImportMapping } from '../odoo/types';

interface ImportRequest {
    model: string;
    mapping: ImportMapping;
    options: {
        keyField?: string;
        createIfNotExists?: boolean;
    };
    rows: any[];
}


router.post('/import/dry-run', (req: Request, res: Response, next: NextFunction) => {
    try {
        const { model, mapping, options, rows } = req.body as ImportRequest;

        if (!model || !mapping || !rows) {
            res.status(400).json({ message: "Missing required fields" });
            return;
        }

        const errors: any[] = [];
        let validCount = 0;

        // In a real scenario, we could fetch model definition to know required fields.
        // For now, we assume client might send them or we just validate payload is not empty.
        // const requiredFields = ...; 

        rows.forEach((row, index) => {
            const payload = buildOdooPayloadFromRow(row, mapping);
            const rowErrors: string[] = [];

            if (Object.keys(payload).length === 0) {
                rowErrors.push("Empty payload generated (check mapping)");
            }

            // Example usage if we had required fields:
            // const missing = validateRequiredFields(payload, requiredFields);
            // rowErrors.push(...missing);

            if (rowErrors.length > 0) {
                errors.push({ rowIndex: index, messages: rowErrors });
            } else {
                validCount++;
            }
        });

        res.json({
            totalRows: rows.length,
            validCount,
            errorCount: errors.length,
            errors
        });


    } catch (err) {
        next(err);
    }
});

router.post('/import/run', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { model, mapping, options, rows } = req.body as ImportRequest;

        const config = await getOdooConfig();
        if (!config) {
            res.status(500).json({ message: "Server config missing" });
            return;
        }

        const client = new OdooClient(config);
        const summary = {
            created: 0,
            updated: 0,
            failed: 0,
            failures: [] as any[]
        };

        const relationalCache = new Map<string, number>();

        // Process sequentially to avoid overwhelming Odoo (and handle dependencies if any)
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];

            // Map standard fields (non-relational modes)
            const basePayload = buildOdooPayloadFromRow(row, mapping);

            // Map relational fields (search/create)
            let relationalPayload = {};
            try {
                relationalPayload = await resolveRelationalFieldsForRow(model, row, mapping, client, relationalCache);
            } catch (relErr: any) {
                summary.failed++;
                summary.failures.push({ rowIndex: i, message: `Relational error: ${relErr.message}` });
                continue;
            }

            const payload = { ...basePayload, ...relationalPayload };

            if (Object.keys(payload).length === 0) {
                summary.failed++;
                summary.failures.push({ rowIndex: i, message: "Empty payload generated" });
                continue;
            }

            try {
                if (options.keyField && payload[options.keyField]) {
                    // UPDATE Logic
                    // 1. Search for existing record
                    // Note: We search assuming string/number equality. 
                    const domain = [[options.keyField, '=', payload[options.keyField]]];

                    // We only need the ID to write
                    const searchResult = await client.search(model, domain);

                    if (searchResult.length > 0) {
                        // Found -> Update
                        const idToUpdate = searchResult[0]; // Take the first one
                        await client.write(model, [idToUpdate], payload);
                        summary.updated++;
                    } else {
                        // Not Found -> Create (if allowed)
                        if (options.createIfNotExists !== false) {
                            await client.create(model, payload);
                            summary.created++;
                        } else {
                            summary.failed++;
                            summary.failures.push({ rowIndex: i, message: `Record not found for key ${options.keyField}='${payload[options.keyField]}' and create disabled` });
                        }
                    }
                } else {
                    // CREATE Logic (Always create if no keyField provided)
                    await client.create(model, payload);
                    summary.created++;
                }
            } catch (err: any) {
                // Capture row-level errors without stopping the whole process
                summary.failed++;
                summary.failures.push({ rowIndex: i, message: err.message || "Unknown error" });
            }
        }


        res.json(summary);

    } catch (err) {
        next(err);
    }
});

export default router;
