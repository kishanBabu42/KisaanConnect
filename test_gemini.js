const http = require('http');

const body = JSON.stringify({ message: 'What should I do for tomato late blight disease?', role: 'farmer' });

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/ai-chat',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
    }
};

const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const parsed = JSON.parse(data);
        console.log('\n=== GEMINI AI TEST RESULT ===');
        console.log('Model:', parsed.model);
        console.log('Reply preview:', parsed.reply ? parsed.reply.slice(0, 300) : 'NO REPLY');
        console.log('=============================\n');
    });
});

req.on('error', (e) => console.error('Error:', e.message));
req.write(body);
req.end();
