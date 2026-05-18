import fetch from 'node-fetch';

async function test() {
  const res = await fetch('http://localhost:3000/api/restaurants');
  const restaurants = await res.json();
  const id = restaurants[0].id;
  const menuRes = await fetch(`http://localhost:3000/api/restaurants/${id}/menu`);
  const menu = await menuRes.json();
  console.log(menu);
}
test();
