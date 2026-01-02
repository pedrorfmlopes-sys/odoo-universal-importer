import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
// Routes imports will go here as they are created
import configRoutes from './routes/configRoutes';
import modelsRoutes from './routes/modelsRoutes';
import fieldsRoutes from './routes/fieldsRoutes';
import uploadRoutes from './routes/uploadRoutes';
import importRoutes from './routes/importRoutes';
import relationalRoutes from './routes/relationalRoutes';

// Module Imports
import { mountCatalogEnricher } from './modules/catalogEnricher';


export const createExpressApp = () => {
    const app = express();

    app.use(cors());
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ limit: '50mb', extended: true }));

    // Health Check
    app.get('/', (req, res) => {
        res.json({ status: "ok", message: "Odoo Universal Importer API is running" });
    });


    // Mount routes
    app.use('/api', configRoutes);
    app.use('/api', modelsRoutes);
    app.use('/api', fieldsRoutes);
    app.use('/api', uploadRoutes);
    app.use('/api', importRoutes);
    app.use('/api', relationalRoutes);

    // Mount Modules
    mountCatalogEnricher(app);


    // Global Error Handler
    app.use(errorHandler);

    return app;
};
