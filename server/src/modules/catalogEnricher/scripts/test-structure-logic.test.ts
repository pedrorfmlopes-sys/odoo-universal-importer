
import { ceAiService } from '../services/ceAiService';
import { analyzePage } from '../services/cePuppeteerService';

// Mock Modules
jest.mock('../services/cePuppeteerService');
jest.mock('axios');

describe('Structural Scan with Product Families', () => {

    it('should promote product families to children nodes when detected', async () => {
        // MOCK: analyzePage returning products with NAMES
        (analyzePage as jest.Mock).mockResolvedValue({
            html: '<html>Mock Page</html>',
            metadata: {
                page_kind: 'product_list',
                product_family_urls_found: ['http://site.com/p1', 'http://site.com/p2'],
                product_family_refs_found: [
                    { url: 'http://site.com/p1', name: 'Lavabo Rectangular XP' },
                    { url: 'http://site.com/p2', name: 'Lavabo Circular Y' }
                ],
                subcategory_urls_found: ['http://site.com/filter-rectangulares'] // Should be ignored
            }
        });

        // We need to bypass the "Root" scan logic or mock it essentially.
        // scanStructure calls analyzePage for "Level 1" nodes (children of root).
        // So we need a root scan that returns a node for us to process deep.

        // However, ceAiService.scanStructure does internal things.
        // Let's use a specialized test that calls the scan logic.
        // But since we can't easily export internal `processNode`, we test via `scanStructure(deep=true)`.

        // Mock the initial AI Scan to return a Root with one child "Lavabos"
        // This brings us to "Level 1" processing where our new logic lives.
        const mockAiScan = jest.spyOn(ceAiService as any, 'cleanHtmlForAi').mockReturnValue('');

        // We mock axios for the ROOT call to return a tree
        const axios = require('axios');
        axios.post.mockResolvedValueOnce({
            data: {
                choices: [{
                    message: {
                        content: JSON.stringify({
                            tree: [{
                                name: "Lavabos",
                                url: "http://site.com/lavabos",
                                type: "category",
                                children: []
                            }]
                        })
                    }
                }]
            }
        });

        const structure = await ceAiService.scanStructure('site.com', '<html>Root</html>', true);

        const lavabosNode = structure[0];

        console.log("Structure Result:", JSON.stringify(structure, null, 2));

        expect(lavabosNode.name).toBe('Lavabos');
        expect(lavabosNode.children.length).toBe(2);
        expect(lavabosNode.children[0].name).toBe('Lavabo Rectangular XP');
        expect(lavabosNode.children[0].type).toBe('product_family');
        expect(lavabosNode.children[1].name).toBe('Lavabo Circular Y');

        // Ensure Facets were ignored
        const facets = lavabosNode.children.filter((c: any) => c.url.includes('filter'));
        expect(facets.length).toBe(0);
    });

});
