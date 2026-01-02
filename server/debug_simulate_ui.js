
const axios = require('axios');

async function testUiScan() {
    const url = 'https://www.ritmonio.it/en/bath-shower/bath/';
    const domain = 'www.ritmonio.it';

    console.log(`[UI Sim] Requesting Structure (Deep=true) for: ${url}`);

    try {
        const res = await axios.post('http://localhost:4000/api/catalog-enricher/crawler/scan-structure', {
            url: url,
            domain: domain,
            deep: true // Simulating user checking "Deep Scan" or similar
        });

        const tree = res.data.tree;
        console.log(`[UI Sim] Response Code: ${res.status}`);
        console.log(`[UI Sim] Roots Found: ${tree.length}`);

        const printNode = (node, indent = '') => {
            console.log(`${indent}- [${node.type}] ${node.name} (${node.url})`);
            if (node.children && node.children.length) {
                node.children.forEach(c => printNode(c, indent + '  '));
            }
        };

        tree.forEach(n => printNode(n));

    } catch (e) {
        console.error(`[UI Sim] Failed:`, e.response ? e.response.data : e.message);
    }
}

testUiScan();
