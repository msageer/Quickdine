async function test() {
  console.log("Waiting for server...");
  let success = false;
  for (let i = 0; i < 5; i++) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      const res = await fetch('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `new${Date.now()}@example.com`, password: 'w', restaurantName: 'w' })
      });
      console.log("Status:", res.status);
      const text = await res.text();
      console.log("Body:", text);
      success = true;
      break;
    } catch(e) {
      console.error("Fetch failed:", e.message);
    }
  }
  if (!success) {
    console.log("Failed all attempts.");
  }
  process.exit(0);
}
test();
