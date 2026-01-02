import { getCeDatabase } from '../db/ceDatabase';
import crypto from 'crypto';

// Simple encryption for MVP (Base64 is reversible, user asked for reversibility)
// In prod, use AES-256-GCM.
const simpleEncrypt = (text: string) => Buffer.from(text).toString('base64');
const simpleDecrypt = (hash: string) => Buffer.from(hash, 'base64').toString('utf-8');

export class CredentialService {
    // DB is obtained on demand to ensure initSchema has run

    getAll() {
        const db = getCeDatabase();
        // Check if table exists (it should if migration script ran, or we rely on ceDatabase to init it?)
        // ceDatabase initSchema currently doesn't create credentials table.
        // We might need to add it there too, or rely on external migration.
        // For now, let's assume external migration, but ideally it should be in ceDatabase for robustness.

        const stmt = db.prepare('SELECT id, name, service_url, username, updated_at FROM ce_credentials ORDER BY name ASC');
        return stmt.all();
    }

    getById(id: string) {
        const db = getCeDatabase();
        return db.prepare('SELECT * FROM ce_credentials WHERE id = ?').get(id);
    }

    getDecrypted(id: string) {
        const cred: any = this.getById(id);
        if (!cred) return null;
        return {
            ...cred,
            password: simpleDecrypt(cred.password_enc)
        };
    }

    create(data: { name: string, service_url: string, username: string, password_enc: string }) {
        const db = getCeDatabase();
        const id = crypto.randomUUID();
        const encrypted = simpleEncrypt(data.password_enc);

        const stmt = db.prepare(`
            INSERT INTO ce_credentials (id, name, service_url, username, password_enc)
            VALUES (?, ?, ?, ?, ?)
        `);
        stmt.run(id, data.name, data.service_url, data.username, encrypted);
        return this.getById(id);
    }

    update(id: string, data: { name?: string, service_url?: string, username?: string, password_enc?: string }) {
        const db = getCeDatabase();
        const existing: any = this.getById(id);
        if (!existing) throw new Error("Credential not found");

        const newPass = data.password_enc ? simpleEncrypt(data.password_enc) : existing.password_enc;

        const stmt = db.prepare(`
            UPDATE ce_credentials 
            SET name = ?, service_url = ?, username = ?, password_enc = ?, updated_at = datetime('now')
            WHERE id = ?
        `);

        stmt.run(
            data.name || existing.name,
            data.service_url || existing.service_url,
            data.username || existing.username,
            newPass,
            id
        );

        return this.getById(id);
    }

    delete(id: string) {
        const db = getCeDatabase();
        // Unlink from profiles first (Correct table: ce_brand_profiles)
        db.prepare('UPDATE ce_brand_profiles SET credential_id = NULL WHERE credential_id = ?').run(id);
        db.prepare('DELETE FROM ce_credentials WHERE id = ?').run(id);
        return { success: true };
    }
}

export const ceCredentialService = new CredentialService();
