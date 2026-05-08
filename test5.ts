import Database from 'better-sqlite3';

const db = new Database('database.sqlite');
const schema = db.prepare("SELECT sql FROM sqlite_master WHERE name='orders'").get();
console.log(schema);
