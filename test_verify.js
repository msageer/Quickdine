const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/admin/restaurants/1/verify-account',
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Body: ${data}`);
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(JSON.stringify({ status: 1 }));
req.end();
