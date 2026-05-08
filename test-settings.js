const http = require('http');

const data = JSON.stringify({
  name: 'Test Restaurant',
  payment_cash_enabled: 1,
  payment_paystack_enabled: 1,
  paystack_public_key: 'pk_test_123',
  paystack_secret_key: 'sk_test_123'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/restaurants/1/settings',
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
