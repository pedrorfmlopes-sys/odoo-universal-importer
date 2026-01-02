
const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, 'importer.db');

console.log('Checking DB at:', dbPath);

if (fs.existsSync(dbPath)) {
    const stats = fs.statSync(dbPath);
    console.log('Size:', stats.size, 'bytes');
    console.log('Last Modified:', stats.mtime);
} else {
    console.log('DB file NOT FOUND!');
}
