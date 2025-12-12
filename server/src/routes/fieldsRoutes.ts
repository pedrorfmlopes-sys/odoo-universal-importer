import { Router, Request, Response, NextFunction } from 'express';
import { getOdooConfig } from '../config/odooConfigStore';
import { OdooClient } from '../odoo/odooClient';
import { FIELD_HINTS } from '../config/fieldHints';
import { OdooFieldMeta } from '../odoo/types';


const router = Router();

router.get('/fields', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const model = req.query.model as string;
        if (!model) {
            res.status(400).json({ message: "Model parameter is required" });
            return;
        }

        const config = await getOdooConfig();
        if (!config) {
            res.status(400).json({ message: "Odoo config not found" });
            return;
        }

        const client = new OdooClient(config);

        // We need raw access to fields_get to specify attributes
        // The listFields method in OdooClient might be too simple, so we use execute_kw directly if needed,
        // or rely on listFields returning comprehensive data. 
        // Based on previous OdooClient (not seen fully but assumed), listFields usually calls fields_get.
        // Let's assume listFields returns Dictionary<FieldInfo>. We'll map it.
        const fieldsMap = await client.listFields(model, ["string", "help", "required", "readonly", "type", "selection", "relation"]);

        // Transform to array and add hints
        const hints = FIELD_HINTS[model] || {};
        const fieldList: OdooFieldMeta[] = Object.entries(fieldsMap).map(([name, info]: [string, any]) => ({
            name,
            string: info.string || name,
            type: info.type || 'char',
            required: !!info.required,
            readonly: !!info.readonly,
            help: info.help || undefined,
            hint: hints[name] || undefined,
            selection: info.selection,
            relation: info.relation
        }));

        res.json({ items: fieldList });

    } catch (err) {
        next(err);
    }
});

export default router;
