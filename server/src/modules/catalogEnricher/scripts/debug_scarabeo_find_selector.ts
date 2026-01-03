
import axios from 'axios';
import * as cheerio from 'cheerio';

const TARGET_URL = 'https://scarabeoceramiche.it/categoria-prodotto/tipologie/lavabi/';

async function debug() {
    try {
        console.log("Fetching " + TARGET_URL);
        const { data } = await axios.get(TARGET_URL);
        const $ = cheerio.load(data);

        console.log("--- Links Analysis ---");
        // Print first 10 links that look like products
        const links = $('a[href*="/prodotto/"]').map((i, el) => $(el).attr('href')).get();
        console.log("Found product links:", links.slice(0, 10));

        if (links.length > 0) {
            // Find common parent
            const firstLink = $('a[href="' + links[0] + '"]').first();
            console.log("Parent of first link:", firstLink.parent().attr('class'));
            console.log("Grandparent:", firstLink.parent().parent().attr('class'));
            console.log("Li Parent?", firstLink.closest('li').attr('class'));
        }
    } catch (e) {
        console.error(e);
    }
}
debug();
