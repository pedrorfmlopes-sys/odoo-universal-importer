
import axios from 'axios';
import * as cheerio from 'cheerio';

const targetUrl = process.argv[2];

if (!targetUrl) {
    console.error('Please provide a URL');
    process.exit(1);
}

const run = async () => {
    console.log(`🔍 Analyzing ${targetUrl}...`);
    try {
        const { data } = await axios.get(targetUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });
        const $ = cheerio.load(data);

        console.log(`HTML Length: ${data.length} chars`);
        console.log(`Title: ${$('title').text()}`);

        const imgs = $('img');
        console.log(`Found ${imgs.length} images.`);

        // Analyze Images
        let withSrc = 0;
        let withDataSrc = 0;
        let withDataSrcset = 0;

        imgs.each((_, el) => {
            if ($(el).attr('src')) withSrc++;
            if ($(el).attr('data-src')) withDataSrc++;
            if ($(el).attr('data-srcset')) withDataSrcset++;
        });

        console.log(`Images with src: ${withSrc}`);
        console.log(`Images with data-src: ${withDataSrc} (Lazy Loading candidate)`);
        console.log(`Images with data-srcset: ${withDataSrcset}`);

        // Analyze Links
        const links = $('a');
        console.log(`Found ${links.length} links.`);

        // Check for Grid Structures
        const potentialGrids = ['.product', '.card', '.item', '.grid', '.list', 'article', 'li'];
        potentialGrids.forEach(cls => {
            const count = $(cls).length;
            if (count > 0) console.log(`Selector '${cls}': ${count} occurrences`);
        });

        // Sample first 3 images HTML
        console.log('\n--- Sample Images HTML ---');
        imgs.slice(0, 3).each((_, el) => {
            console.log($.html(el));
        });

    } catch (e: any) {
        console.error('Error:', e.message);
    }
};

run();
