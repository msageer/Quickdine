async function test() {
  const res = await fetch('http://localhost:3000/uploads/1779044508206-649067720.jpg');
  console.log(res.status, res.headers.get('content-type'));
}
test();
