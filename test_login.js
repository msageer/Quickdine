import Database from 'better-sqlite3';
const db = new Database('quickdine.db');
const res = db.prepare('SELECT id, name, email FROM users').all();
console.log(res);
