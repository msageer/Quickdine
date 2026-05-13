const http = require('http');
const jwt = require('jsonwebtoken');

const token = jwt.sign({ id: 1, role: 'admin', restaurant_id: null }, 'quickdine-super-secret-key-48h', { expiresIn: '48h' });

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/admin/users/1/verify',
  method: 'PATCH',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('STATUS:', res.statusCode, 'BODY:', data));
});

req.on('error', e => console.error(e));
req.end();
