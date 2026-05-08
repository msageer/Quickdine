import http from 'http';

const endpoints = [
  '/api/meals',
  '/api/restaurants',
  '/api/admin/orders',
  '/api/admin/settings',
  '/api/admin/analytics'
];

endpoints.forEach(endpoint => {
  http.get('http://localhost:3000' + endpoint, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      console.log(endpoint, 'Status Code:', res.statusCode);
      if (res.statusCode !== 200) {
        console.log(endpoint, 'Response:', data);
      }
    });
  }).on('error', (err) => {
    console.error(endpoint, 'Error:', err.message);
  });
});
