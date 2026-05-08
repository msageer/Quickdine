import Database from 'better-sqlite3';
const db = new Database('quickdine.db');
db.prepare('UPDATE users SET email_verified = 1 WHERE email = ?').run('msageertv@gmail.com');
console.log('updated email_verified');
