fetch('http://localhost:3000/api/auth/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'new2@example.com', password: 'w', restaurantName: 'w' })
})
  .then(r => r.text())
  .then(console.log);
