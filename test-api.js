const http = require('http');

const data = JSON.stringify({
    name: "John Doe",
    email: "john@example.com",
    phone: "11999999999",
    company: "Inova Corp",
    role: "CTO",
    segment: "Tecnologia",
    teamSize: "1-10",
    volumeDay: "Menos de 100",
    channels: ["WhatsApp"],
    stack: ["CRM (Hubspot, RD, Salesforce, etc)"],
    pains: ["Tempo de resposta lento"],
    urgency: "Baixa - Exploratória",
    goal: "Aumentar vendas",
    whatsappConsent: true
});

const req = http.request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/assessment',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
    }
}, (res) => {
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log(`Body: ${rawData}`);
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
});

req.write(data);
req.end();
