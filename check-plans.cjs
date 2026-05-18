const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new sqlite3.Database(dbPath);
db.all('SELECT * FROM subscription_plans', [], (err, rows) => {
  console.log(JSON.stringify(rows, null, 2));
});
