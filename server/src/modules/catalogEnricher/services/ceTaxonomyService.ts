
import { getCeDatabase } from '../db/ceDatabase';
import { v4 as uuidv4 } from 'uuid';

export interface TaxonomyNode {
    id: string;
    brand_profile_id: string;
    parent_id?: string;
    name: string;
    url?: string;
    type: 'category' | 'collection' | 'variant' | 'product_family' | 'category_with_products' | 'facet';
    level: number;
    children?: TaxonomyNode[];
}

export const ceTaxonomyService = {
    getTree: (profileId: string) => {
        const db = getCeDatabase();
        const rows = db.prepare('SELECT * FROM ce_taxonomy WHERE brand_profile_id = ? ORDER BY level, name').all(profileId) as TaxonomyNode[];

        // Build tree
        const map = new Map<string, TaxonomyNode>();
        const roots: TaxonomyNode[] = [];

        rows.forEach(row => {
            row.children = [];
            map.set(row.id, row);
        });

        rows.forEach(row => {
            if (row.parent_id && map.has(row.parent_id)) {
                map.get(row.parent_id)!.children!.push(row);
            } else {
                roots.push(row);
            }
        });

        return roots;
    },

    addNode: (node: Omit<TaxonomyNode, 'id'>) => {
        const db = getCeDatabase();
        const id = uuidv4();
        db.prepare(`
            INSERT INTO ce_taxonomy (id, brand_profile_id, parent_id, name, url, type, level)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(id, node.brand_profile_id, node.parent_id || null, node.name, node.url || '', node.type, node.level || 0);
        return { id, ...node };
    },

    clearTaxonomy: (profileId: string) => {
        const db = getCeDatabase();
        db.prepare('DELETE FROM ce_taxonomy WHERE brand_profile_id = ?').run(profileId);
        return { success: true };
    },

    saveTaxonomyTree: (profileId: string, tree: Omit<TaxonomyNode, 'id'>[]) => {
        const db = getCeDatabase();

        // Transaction to ensure atomicity
        const transaction = db.transaction((nodes: typeof tree) => {
            // 1. Clear existing
            db.prepare('DELETE FROM ce_taxonomy WHERE brand_profile_id = ?').run(profileId);

            // 2. Recursive insert
            const insertNode = (node: any, parentId: string | null = null, level: number = 0) => {
                const id = uuidv4();

                db.prepare(`
                    INSERT INTO ce_taxonomy (id, brand_profile_id, parent_id, name, url, type, level)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(
                    id,
                    profileId,
                    parentId,
                    node.name,
                    node.url || '',
                    node.type || 'category',
                    level
                );

                if (node.children && Array.isArray(node.children)) {
                    for (const child of node.children) {
                        insertNode(child, id, level + 1);
                    }
                }
            };

            for (const rootNode of nodes) {
                insertNode(rootNode);
            }
        });

        try {
            transaction(tree);
            return { success: true };
        } catch (err: any) {
            console.error("Save Taxonomy Failed:", err);
            throw err;
        }
    }
};
