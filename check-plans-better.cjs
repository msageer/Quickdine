const Database = require('better-sqlite3');
const db = new Database('database.sqlite');
console.log(JSON.stringify(db.prepare('SELECT * FROM subscription_plans').all(), null, 2));
