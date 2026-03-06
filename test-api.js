const http = require('http');
const fs = require('fs');

const req = http.request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/pdf/4fa8af28-677f-4450-9207-cbf28d582f55',
    method: 'GET'
}, (res) => {
    console.log(`Status: ${res.statusCode}`);
    const file = fs.createWriteStream("test-output.pdf");
    res.pipe(file);
    file.on('finish', () => {
        file.close();
        console.log("PDF saved to test-output.pdf");
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
});

req.end();
