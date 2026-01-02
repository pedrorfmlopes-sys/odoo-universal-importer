
const axios = require('axios');
const cheerio = require('cheerio');

async function inspectFima() {
    try {
        const url = 'https://fimacf.com/en/collezioni/bagno/';
        const res = await axios.get(url);
        const $ = cheerio.load(res.data);

        console.log('--- BUTTONS ---');
        $('button, a, div[role="button"]').each((i, el) => {
            const text = $(el).text().trim();
            const cls = $(el).attr('class');
            const id = $(el).attr('id');
            if (text.length > 0 && text.length < 50) {
                console.log(`[${text}] Cls: ${cls}, Id: ${id}`);
            }
        });

        console.log('\n--- SCRIPTS (Looking for load-more) ---');
        $('script').each((i, el) => {
            const src = $(el).attr('src');
            if (src && src.includes('load-more')) console.log(`Script: ${src}`);
        });

    } catch (e) { console.error(e); }
}
inspectFima();
