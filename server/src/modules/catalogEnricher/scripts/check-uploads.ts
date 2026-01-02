
import { getCeDatabase } from '../db/ceDatabase';
import path from 'path';

// Fix path for script execution context - TSX magic usually handles imports relative to file, but let's be safe.
// If ../db/ceDatabase fails, it might be an issue with how tsx is invoked vs file location
// Let's rely on standard node module resolution which should work if cwd is server/

process.env.CE_DB_PATH = path.join(__dirname, '../../../../../../ce_database.sqlite');
console.log('DB Path:', process.env.CE_DB_PATH);

try {
    const db = getCeDatabase();
    const lastUpload = db.prepare('SELECT * FROM ce_uploads ORDER BY created_at DESC LIMIT 1').get();
    console.log('Last Upload:', lastUpload);
} catch (e) {
    console.log('Error:', e);
}
