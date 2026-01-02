const http = require('http');

const req = http.request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/catalog-enricher/crawler/active-jobs',
    method: 'GET'
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log('API Response Code:', res.statusCode);
        console.log('API Response Body:', data);
    });
});

req.on('error', (e) => {
    console.error('Request error:', e.message);
});

req.end();
