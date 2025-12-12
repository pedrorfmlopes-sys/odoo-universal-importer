import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
// Routes imports will go here as they are created
import configRoutes from './routes/configRoutes';
import modelsRoutes from './routes/modelsRoutes';
import fieldsRoutes from './routes/fieldsRoutes';
import uploadRoutes from './routes/uploadRoutes';
import importRoutes from './routes/importRoutes';

export const createExpressApp = () => {
    const app = express();

    app.use(cors());
    app.use(express.json());

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

    // Global Error Handler
    app.use(errorHandler);

    return app;
};
