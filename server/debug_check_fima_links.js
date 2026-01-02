
const axios = require('axios');
const cheerio = require('cheerio');

async function checkFima() {
    try {
        const url = 'https://fimacf.com/en/';
        console.log(`Checking ${url}...`);
        const res = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });
        const $ = cheerio.load(res.data);

        console.log('\n--- MAIN MENU LINKS ---');
        $('a').each((i, el) => {
            const href = $(el).attr('href');
            const text = $(el).text().trim();
            if (href && (href.includes('tipologia') || href.includes('ambiente') || href.includes('coleccion') || href.includes('collection') || href.includes('collezione'))) {
                console.log(`[${text}] -> ${href}`);
            }
        });

        const typologyUrl = 'https://fimacf.com/en/tipologia/';
        console.log(`\nChecking ${typologyUrl}...`);
        const res2 = await axios.get(typologyUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });
        const $2 = cheerio.load(res2.data);
        console.log('\n--- TYPOLOGY SUB-LINKS ---');
        $2('a').each((i, el) => {
            const href = $2(el).attr('href');
            const text = $2(el).text().trim();
            if (href && href.startsWith('https://fimacf.com/en/tipologia/')) {
                console.log(`[${text}] -> ${href}`);
            }
        });

    } catch (e) {
        console.error(e.message);
    }
}

checkFima();
