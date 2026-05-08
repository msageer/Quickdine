import http from 'http';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'quickdine-super-secret-key-48h';
const token = jwt.sign({ id: 1, role: 'admin' }, JWT_SECRET, { expiresIn: '48h' });

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/restaurants/1/settings',
  method: 'PATCH',
  headers: {
    'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
    'Authorization': 'Bearer ' + token
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('STATUS:', res.statusCode, '\nBODY:', data));
});

req.write('------WebKitFormBoundary7MA4YWxkTrZu0gW\r\n');
req.write('Content-Disposition: form-data; name="account_number"\r\n\r\n');
req.write('1234\r\n');
req.write('------WebKitFormBoundary7MA4YWxkTrZu0gW--\r\n');
req.end();
