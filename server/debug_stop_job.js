const http = require('http');

const data = JSON.stringify({ deleteData: true });

const options = {
    hostname: 'localhost',
    port: 4000,
    path: '/api/catalog-enricher/crawler/jobs/bulk_1766689505404/stop',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.on('data', (d) => {
        process.stdout.write(d);
    });
});

req.on('error', (e) => {
    console.error(`Problem: ${e.message}`);
});

req.write(data);
req.end();
