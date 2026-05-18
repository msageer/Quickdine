const fs = require('fs');

if (!fs.existsSync(__dirname + '/uploads')) {
  fs.mkdirSync(__dirname + '/uploads');
}
fs.writeFileSync(__dirname + '/uploads/test.txt', 'hello world');

async function run() {
  const fetch = (await import('node-fetch')).default;
  const res = await fetch('http://localhost:3000/uploads/test.txt');
  console.log(res.status);
  console.log(await res.text());
}
run();
