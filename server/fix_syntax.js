const fs = require('fs');
const path = require('path');

const filePath = 'c:\\Users\\pedro\\OneDrive\\APPS\\GitHub\\odoo-universal-importer\\server\\src\\modules\\catalogEnricher\\services\\cePuppeteerService.ts';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\r\n'); // Windows EOL? Or \n? checking both.
// It seems view_file output uses \n usually but file might have CRLF.
// Safer split.
const splitLines = content.indexOf('\r\n') > -1 ? content.split('\r\n') : content.split('\n');

console.log(`Total lines: ${splitLines.length}`);

// Target: Delete from Line 732 to 801 (1-based)
// Index: 731 to 800
const startLine = 732;
const endLine = 801;

const startIndex = startLine - 1;
const count = endLine - startLine + 1;

console.log(`Deleting lines ${startLine} to ${endLine} (Indices ${startIndex} to ${startIndex + count - 1})`);
console.log(`Line ${startLine} content: "${splitLines[startIndex]}"`);
console.log(`Line ${endLine} content: "${splitLines[startIndex + count - 1]}"`);

// Verification
if (!splitLines[startIndex].includes('let debugInfo: any = null;')) {
    console.error(`START LINE MISMATCH! Found: ${splitLines[startIndex]}`);
    process.exit(1);
}
// Line 801 is "                };" closing return object.
if (!splitLines[startIndex + count - 1].trim().endsWith('};')) {
    console.error(`END LINE MISMATCH! Found: ${splitLines[startIndex + count - 1]}`);
    process.exit(1);
}

// Insert minimal replacement
const replacementLines = [
    '                return {',
    '                    url: currentUrl,',
    '                    page_kind: "unknown",',
    '                    subcategory_urls_found: [],',
    '                    product_family_urls_found: [],',
    '                    debug_counts: { links_total: 0, subcats_found: 0, products_found: 0 },',
    '                    extracted_data: {}',
    '                };'
];

splitLines.splice(startIndex, count, ...replacementLines);

console.log(`New total lines: ${splitLines.length}`);
fs.writeFileSync(filePath, splitLines.join(content.indexOf('\r\n') > -1 ? '\r\n' : '\n'));
console.log("File saved.");
