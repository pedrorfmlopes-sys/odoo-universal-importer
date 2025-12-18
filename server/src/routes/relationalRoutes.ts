
import express from 'express';
import { getOdooClient } from '../config/odooConfigStore';
import { RELATIONAL_FIELDS } from '../config/relationalFields';

const router = express.Router();

router.get('/relational-options', async (req, res) => {
    try {
        const { model, field, q } = req.query;

        if (!model || !field) {
            return res.status(400).json({ error: 'Missing model or field parameter' });
        }

        const modelConfig = RELATIONAL_FIELDS[String(model)];
        if (!modelConfig) {
            return res.status(400).json({ error: `No relational config for model ${model}` });
        }

        const fieldConfig = modelConfig[String(field)];
        if (!fieldConfig) {
            return res.status(400).json({ error: `No relational config for field ${field} on model ${model}` });
        }

        const client = await getOdooClient();
        if (!client) {

            return res.status(500).json({ error: 'Odoo not connected' });
        }

        const { relatedModel, displayField } = fieldConfig;

        // Build domain
        // If q is present, filter. Else fetch all (limit 50).
        // Standard Odoo search is case insensitive for 'ilike' usually.
        const domain = q ? [[displayField, 'ilike', String(q)]] : [];

        // Using search_read to get id and display name
        const records = await client.searchRead(relatedModel, domain, [displayField], 50);


        // Map to format
        const items = records.map((r: any) => ({
            id: r.id,
            name: r[displayField] || `(Record ${r.id})`
        }));

        res.json({ items });

    } catch (err: any) {
        console.error('Relational options error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
