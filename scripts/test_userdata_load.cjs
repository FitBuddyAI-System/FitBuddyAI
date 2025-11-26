const http = require('http');

const data = JSON.stringify({ userId: 'bab2b330-5bc4-47b8-8970-fe8b16cf8612' });

const options = {
  hostname: 'localhost',
  port: 5174,
  path: '/api/userdata/load',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    'x-debug-userdata': '1'
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log('HEADERS:', res.headers);
  let body = '';
  res.setEncoding('utf8');
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => { console.log('BODY:', body); });
});

req.on('error', (e) => { console.error('problem with request:', e); });
req.write(data);
req.end();
