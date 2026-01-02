
import { v4 as uuidv4 } from 'uuid';
import { getCeDatabase } from '../db/ceDatabase';

export interface BrandProfile {
    id: string;
    name: string;
    domain_root?: string;
    auth_required: number; // boolean stored as number in sqlite
    auth_login_url?: string;
    auth_user?: string;
    auth_pass?: string;
    url_pattern_template?: string;
    extraction_rules_json?: string;
    createdAt?: string;
}

export const ceProfileService = {

    getAllProfiles(): BrandProfile[] {
        const db = getCeDatabase();
        return db.prepare('SELECT * FROM ce_brand_profiles ORDER BY name ASC').all() as BrandProfile[];
    },

    getProfile(id: string): BrandProfile | undefined {
        const db = getCeDatabase();
        return db.prepare('SELECT * FROM ce_brand_profiles WHERE id = ?').get(id) as BrandProfile;
    },

    createProfile(data: Partial<BrandProfile>): BrandProfile {
        const db = getCeDatabase();
        const id = uuidv4();
        const now = new Date().toISOString();

        const profile: BrandProfile = {
            id,
            name: data.name || 'New Brand',
            domain_root: data.domain_root,
            auth_required: data.auth_required ? 1 : 0,
            auth_login_url: data.auth_login_url,
            auth_user: data.auth_user,
            auth_pass: data.auth_pass,
            url_pattern_template: data.url_pattern_template,
            extraction_rules_json: data.extraction_rules_json,
            createdAt: now
        };

        const stmt = db.prepare(`
            INSERT INTO ce_brand_profiles (
                id, name, domain_root, auth_required, auth_login_url, auth_user, auth_pass,
                url_pattern_template, extraction_rules_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            profile.id, profile.name, profile.domain_root, profile.auth_required,
            profile.auth_login_url, profile.auth_user, profile.auth_pass,
            profile.url_pattern_template, profile.extraction_rules_json,
            profile.createdAt, now
        );

        return profile;
    },

    updateProfile(id: string, data: Partial<BrandProfile>) {
        const db = getCeDatabase();
        const setQuery: string[] = [];
        const params: any[] = [];
        const now = new Date().toISOString();

        // Dynamically build update query
        const fields = ['name', 'domain_root', 'auth_required', 'auth_login_url', 'auth_user', 'auth_pass', 'url_pattern_template', 'extraction_rules_json'];
        for (const f of fields) {
            const val = data[f as keyof BrandProfile];
            if (val !== undefined) {
                setQuery.push(`${f} = ?`);

                // Fix: SQLite needs 0/1 for booleans
                if (f === 'auth_required' && typeof val === 'boolean') {
                    params.push(val ? 1 : 0);
                } else {
                    params.push(val);
                }
            }
        }

        setQuery.push('updated_at = ?');
        params.push(now);
        params.push(id);

        if (setQuery.length > 1) { // at least one field + updated_at
            db.prepare(`UPDATE ce_brand_profiles SET ${setQuery.join(', ')} WHERE id = ?`).run(...params);
        }

        return this.getProfile(id);
    },

    deleteProfile(id: string) {
        const db = getCeDatabase();

        // GOD MODE: Disable Foreign Keys to allow cleanup of circular/complex dependencies
        const wasForeignKeysOn = db.pragma('foreign_keys', { simple: true });
        db.pragma('foreign_keys = OFF');

        try {
            const transaction = db.transaction(() => {
                console.log(`[ProfileService] Deleting profile ${id} (FK DISABLED)...`);

                // 1. Find Jobs linked to this profile
                let jobs: { id: string }[] = [];
                try {
                    jobs = db.prepare('SELECT id FROM ce_jobs WHERE profile_id = ?').all(id) as { id: string }[];
                } catch (e) {
                    // Fallback try w/o profile_id filter or assume empty if error (migration issue safety)
                    console.error("Error finding jobs", e);
                }

                for (const job of jobs) {
                    try { db.prepare('DELETE FROM ce_job_items WHERE job_id = ?').run(job.id); } catch (e) { }
                    try { db.prepare('DELETE FROM ce_crawler_staging WHERE job_id = ?').run(job.id); } catch (e) { }
                    try { db.prepare('DELETE FROM ce_assets WHERE job_id = ?').run(job.id); } catch (e) { }
                }

                // 2. Delete ALL Dependencies
                try { db.prepare('DELETE FROM ce_assets WHERE brand_profile_id = ?').run(id); } catch (e) { }
                try { db.prepare('DELETE FROM ce_jobs WHERE profile_id = ?').run(id); } catch (e) { }
                try { db.prepare('DELETE FROM ce_taxonomy WHERE brand_profile_id = ?').run(id); } catch (e) { }
                try { db.prepare('DELETE FROM ce_web_products WHERE brand_profile_id = ?').run(id); } catch (e) { }
                try { db.prepare('DELETE FROM ce_missing_products WHERE brand_profile_id = ?').run(id); } catch (e) { }

                // 3. Finally Delete Profile
                db.prepare('DELETE FROM ce_brand_profiles WHERE id = ?').run(id);

                console.log(`[ProfileService] FORCE Deleted profile ${id}`);
            });

            transaction();
        } catch (err) {
            console.error("[ProfileService] Delete failed:", err);
            // Re-enable before throwing
            if (wasForeignKeysOn) db.pragma('foreign_keys = ON');
            throw err;
        }

        // Restore FK state
        if (wasForeignKeysOn) db.pragma('foreign_keys = ON');

        return { success: true };
    },

    // -------------------------------------------------------------------------
    // INTELLIGENCE
    // -------------------------------------------------------------------------

    /**
     * Attempts to find specific column values inside the example URL to reverse-engineer a pattern.
     */
    detectUrlPattern(row: Record<string, string>, exampleUrl: string): { template: string, matches: string[] } {
        let template = exampleUrl;
        const matches: string[] = [];

        // Normalize URL for consistency (decode URI components)
        try { template = decodeURIComponent(template); } catch { }

        // Sort keys by value length (descending) to match longest specific strings first
        // Avoids matching "1" inside "123" if both are present
        const sortedKeys = Object.keys(row).sort((a, b) => {
            const valA = String(row[a] || '');
            const valB = String(row[b] || '');
            return valB.length - valA.length;
        });

        for (const colName of sortedKeys) {
            const rawValue = String(row[colName]).trim();
            if (!rawValue || rawValue.length < 2) continue; // Skip very short values to avoid false positives

            // 1. Direct Match
            if (template.includes(rawValue)) {
                template = template.replace(rawValue, `{{${colName}}}`);
                matches.push(`Found direct match for column '${colName}'`);
                continue;
            }

            // 2. Slug Match (e.g. Value: "Super Drill", URL: "super-drill")
            const slugValue = rawValue.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
            if (slugValue.length > 2 && template.includes(slugValue)) {
                // Check if we have a template syntax for slugify
                template = template.replace(slugValue, `{{slug(${colName})}}`);
                matches.push(`Found slug match for column '${colName}'`);
                continue;
            }

            // 3. Lowercase Match
            const lowerValue = rawValue.toLowerCase();
            if (lowerValue.length > 2 && template.toLowerCase().includes(lowerValue)) {
                // CASE SENSITIVE REPLACEMENT IN TEMPLATE
                // Find the exact substring in template that matches lowerValue (ignoring case)
                const regex = new RegExp(lowerValue.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
                template = template.replace(regex, `{{lower(${colName})}}`);
                matches.push(`Found lowercase match for column '${colName}'`);
            }
        }

        // Clean up: If no matches found, return original or warning
        if (matches.length === 0) {
            return { template: exampleUrl, matches: ['No patterns detected. Template is static.'] };
        }

        return { template, matches };
    },

    /**
     * Applies a template to a row to verify it generates a valid URL
     */
    applyPattern(row: Record<string, string>, template: string): string {
        let url = template;

        // Regex to find tokens like {{Column}} or {Column} or {{slug(Column)}}
        url = url.replace(/\{+([^}]+)\}+/g, (match, content) => {
            // Check modifier
            let col = content;
            let modifier = '';

            if (content.startsWith('slug(') && content.endsWith(')')) {
                modifier = 'slug';
                col = content.slice(5, -1);
            } else if (content.startsWith('lower(') && content.endsWith(')')) {
                modifier = 'lower';
                col = content.slice(6, -1);
            }

            const val = String(row[col] || '').trim();

            if (modifier === 'slug') {
                return val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
            } else if (modifier === 'lower') {
                return val.toLowerCase();
            }
            return encodeURIComponent(val); // Default: URL encode
        });

        return url;
    }
};
