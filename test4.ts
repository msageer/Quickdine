import Database from 'better-sqlite3';

const db = new Database('database.sqlite');
const fks = db.prepare('PRAGMA foreign_key_list(orders)').all();
console.log(fks);
