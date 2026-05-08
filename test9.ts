import fetch from 'node-fetch';

async function testOrder() {
  const res = await fetch('http://localhost:3000/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      restaurant_id: 1,
      table_id: "0",
      items: [{ id: 1, quantity: 1, price: 10, notes: '', modifiers: null }],
      total_amount: 10,
      tip_amount: 0,
      special_instructions: '',
      customer_email: '',
      payment_method: 'Cash',
      payment_status: 'Pending',
      waiter_id: null,
      guest_last_name: null,
      room_number: null
    })
  });
  const data = await res.json();
  console.log(res.status, data);
}
testOrder();
