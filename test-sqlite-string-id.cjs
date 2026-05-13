const Database = require('better-sqlite3');
const db = new Database('./quickdine.db');

try {
  const result = db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run("1");
  console.log("Changes with string id:", result.changes);
} catch (e) {
  console.error("error:", e);
}
