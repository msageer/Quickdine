import Database from 'better-sqlite3';

const db = new Database('quickdine.db');

try {
  const currentRestaurant = db.prepare('SELECT account_number, bank_name, account_name FROM restaurants WHERE id = ?').get(1);
  console.log(currentRestaurant);
  
  const result = db.prepare('UPDATE restaurants SET account_name = ? WHERE id = ?').run('test', 1);
  console.log('Result:', result);
} catch (err) {
  console.error('SQL Error:', err);
}
