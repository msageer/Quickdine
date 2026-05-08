import Database from 'better-sqlite3';

const db = new Database('quickdine.db');
const schema = db.prepare("SELECT sql FROM sqlite_master WHERE name='order_items'").get();
console.log(schema);
