import fetch from 'node-fetch';

async function test() {
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@quickdine.app', password: 'admin' })
  });
  const login = await loginRes.json();
  const token = login.token;

  const getRes = await fetch('http://localhost:3000/api/restaurants');
  const resList = await getRes.json();
  const resId = resList[0].id;
  
  // Set to something
  const form = new URLSearchParams();
  form.append('name', 'My Restaurant Changed');
  form.append('business_type', 'joint');
  
  const reqRes = await fetch(`http://localhost:3000/api/restaurants/${resId}/settings`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}` },
    body: form
  });
  
  const text = await reqRes.text();
  console.log(reqRes.status, text);
}
test();
