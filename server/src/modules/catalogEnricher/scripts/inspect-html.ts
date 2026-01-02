
import * as fs from 'fs';

const html = fs.readFileSync('debug_bette.html', 'utf-8');

function findPattern(pattern: string | RegExp) {
    console.log(`\n--- Searching for: ${pattern} ---`);
    let regex = typeof pattern === 'string' ? new RegExp(pattern, 'gi') : pattern;
    let match;
    let count = 0;
    while ((match = regex.exec(html)) !== null) {
        count++;
        if (count > 5) break;
        const start = Math.max(0, match.index - 100);
        const end = Math.min(html.length, match.index + 100);
        console.log(`Match ${count}: ...${html.substring(start, end).replace(/\s+/g, ' ')}...`);
    }
    if (count === 0) console.log("Not found.");
}

findPattern(/byJ\s*=/); // Variable found in previous step
findPattern(/articleNumber["']?\s*:/i);
findPattern(/orderNumber["']?\s*:/i);
findPattern(/modelNumber["']?\s*:/i);
findPattern(/matNo["']?\s*:/i);
findPattern(/var\s+[a-zA-Z0-9]{2,3}\s*=\s*\{/); // Minified var defs like var byJ = {
