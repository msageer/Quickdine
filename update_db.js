import Database from 'better-sqlite3';
const db = new Database('quickdine.db');
db.prepare("UPDATE users SET role = 'restaurant' WHERE role = 'restaurant_owner'").run();
console.log('updated DB roles');
