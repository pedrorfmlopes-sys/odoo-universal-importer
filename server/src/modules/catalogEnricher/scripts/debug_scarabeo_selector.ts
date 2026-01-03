
import axios from 'axios';
import * as cheerio from 'cheerio';

const TARGET_URL = 'https://scarabeoceramiche.it/categoria-prodotto/tipologie/lavabi/';

async function debug() {
    try {
        const { data } = await axios.get(TARGET_URL);
        const $ = cheerio.load(data);
        const items = $('.product');
        console.log("Items found with .product:", items.length);

        if (items.length === 0) {
            console.log("Body classes:", $('body').attr('class'));
            console.log("First 500 chars of body:", $('body').html()?.substring(0, 500));
            const classNames = new Set();
            $('*').each((i, el) => {
                const c = $(el).attr('class');
                if (c) classNames.add(c);
            });
            console.log("Sample classes:", Array.from(classNames).slice(0, 20));
        }
    } catch (e) {
        console.error(e);
    }
}
debug();
