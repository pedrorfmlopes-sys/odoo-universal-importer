
import { getCeDatabase } from '../db/ceDatabase';
import { RunResult } from 'better-sqlite3';

export const getCatalogProducts = (
    page: number = 1,
    limit: number = 50,
    search: string = '',
    brandProfileId?: string
) => {
    const db = getCeDatabase();
    const offset = (page - 1) * limit;

    let query = `SELECT * FROM ce_web_products WHERE 1=1`;
    const params: any[] = [];

    if (brandProfileId) {
        query += ` AND brand_profile_id = ?`;
        params.push(brandProfileId);
    }

    if (search) {
        query += ` AND (product_name LIKE ? OR guessed_code LIKE ? OR product_url LIKE ?)`;
        const term = `%${search}%`;
        params.push(term, term, term);
    }

    // Count Total
    const countQuery = query.replace('SELECT *', 'SELECT count(*) as total');
    const total = (db.prepare(countQuery).get(...params) as any).total;

    // Fetch Page
    query += ` ORDER BY crawled_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const items = db.prepare(query).all(...params);

    return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
    };
};

export const getMissingProducts = (page: number = 1, limit: number = 50) => {
    const db = getCeDatabase();
    const offset = (page - 1) * limit;

    const total = (db.prepare('SELECT count(*) as total FROM ce_missing_products').get() as any).total;
    const items = db.prepare('SELECT * FROM ce_missing_products ORDER BY last_seen_at DESC LIMIT ? OFFSET ?').all(limit, offset);

    return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
    };
};

export const getCatalogCategories = (brandProfileId?: string) => {
    const db = getCeDatabase();
    let query = `
        SELECT 
            p.category_name as raw_path, 
            p.brand_profile_id,
            b.name as brand_name,
            count(*) as count 
        FROM ce_web_products p
        LEFT JOIN ce_brand_profiles b ON p.brand_profile_id = b.id
        WHERE 1=1
    `;
    const params: any[] = [];

    if (brandProfileId) {
        query += ` AND p.brand_profile_id = ?`;
        params.push(brandProfileId);
    }

    query += ` GROUP BY p.brand_profile_id, p.category_name ORDER BY b.name ASC, p.category_name ASC`;

    const flat = db.prepare(query).all(...params) as any[];

    // Transform to Tree
    const tree: any[] = [];

    console.log(`[Catalog] Transforming ${flat.length} flat categories to tree...`);

    const findOrCreate = (parentArray: any[], name: string) => {
        let node = parentArray.find(n => n.name === name);
        if (!node) {
            node = { name, count: 0, children: [] };
            parentArray.push(node);
        }
        return node;
    };

    flat.forEach(item => {
        // Handle Brand as root if not filtered by profile
        let currentLevel = tree;
        if (!brandProfileId && item.brand_name) {
            const brandNode = findOrCreate(tree, item.brand_name);
            currentLevel = brandNode.children;
            // Note: brandNode.count will be summed up correctly by segments logic
        }

        const path = (item.raw_path || 'Uncategorized').split(/[/>]+/).map((s: string) => s.trim()).filter(Boolean);

        let pointer = currentLevel;
        path.forEach((seg: string, idx: number) => {
            const node = findOrCreate(pointer, seg);
            node.count += item.count;
            pointer = node.children;
        });

        // If we added brand node, we need to increment its count too (segment logic handles children of brand)
        if (!brandProfileId && item.brand_name) {
            const brandNode = tree.find(n => n.name === item.brand_name);
            if (brandNode) brandNode.count += item.count;
        }
    });

    return tree;
};

export const clearProfileProducts = (profileId: string) => {
    const db = getCeDatabase();
    // Safety check
    if (!profileId || profileId.length < 2) throw new Error("Invalid Profile ID");
    const info = db.prepare('DELETE FROM ce_web_products WHERE brand_profile_id = ?').run(profileId);
    return { deleted: info.changes };
};

export const deleteProduct = (id: number) => {
    const db = getCeDatabase();
    const info = db.prepare('DELETE FROM ce_web_products WHERE id = ?').run(id);
    return { success: info.changes > 0 };
};

export const updateProduct = (id: number, data: { product_name: string, guessed_code: string }) => {
    const db = getCeDatabase();
    const info = db.prepare(`
        UPDATE ce_web_products 
        SET product_name = ?, guessed_code = ?
        WHERE id = ?
    `).run(data.product_name, data.guessed_code, id);
    return { success: info.changes > 0 };
};
