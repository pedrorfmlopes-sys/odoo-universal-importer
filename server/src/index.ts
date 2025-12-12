import dotenv from 'dotenv';
dotenv.config();

import { createExpressApp } from './server';

const PORT = process.env.PORT || 4000;
const app = createExpressApp();

app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
});
