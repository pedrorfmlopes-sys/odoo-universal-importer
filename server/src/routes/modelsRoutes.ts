import { Router } from 'express';
import { ODOO_MODELS, ODOO_MACROS } from '../config/odooModels';

const router = Router();


// GET /api/models: Returns flat list of supported entities
router.get('/models', (req, res) => {
    res.json(ODOO_MODELS);
});

// GET /api/macros: Returns hierarchical structure of macros -> entities
router.get('/macros', (req, res) => {
    res.json(ODOO_MACROS);
});


export default router;
