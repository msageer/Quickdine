import Database from 'better-sqlite3';

const db = new Database('quickdine.db');
const items = db.prepare("SELECT id FROM menu_items LIMIT 5").all();
console.log(items);
