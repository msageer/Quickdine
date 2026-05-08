import { JSDOM } from 'jsdom';

const dom = new JSDOM(`
  <form id="myform">
    <input type="checkbox" name="payment_cash_enabled" />
    <input type="checkbox" name="payment_paystack_enabled" checked />
    <input type="text" name="paystack_public_key" value="pk_test_123" />
  </form>
`);

const form = dom.window.document.getElementById('myform');
const formData = new dom.window.FormData(form);

console.log('payment_cash_enabled:', formData.get('payment_cash_enabled'));
console.log('payment_paystack_enabled:', formData.get('payment_paystack_enabled'));
console.log('paystack_public_key:', formData.get('paystack_public_key'));
