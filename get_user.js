import Database from 'better-sqlite3';
const db = new Database('quickdine.db');
const user = db.prepare('SELECT id, email, role, restaurant_id, email_verified FROM users WHERE email = ?').get('msageertv@gmail.com');
console.log(user);
