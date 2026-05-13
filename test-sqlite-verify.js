const Database = require('better-sqlite3');
const db = new Database('./quickdine.db');

try {
  const transaction = db.transaction(() => {
    const status = 1;
    const restaurant_id = "1";
    const result = db.prepare('UPDATE restaurants SET account_verified = ? WHERE id = ?').run(status, restaurant_id);
    console.log("Restaurant changed:", result.changes);
    if (result.changes === 0) {
      return false;
    }
    if (status === 1) {
      const uRes = db.prepare('UPDATE users SET email_verified = 1 WHERE restaurant_id = ? AND role = ?').run(restaurant_id, 'restaurant');
      console.log("Users changed:", uRes.changes);
    }
    return true;
  });

  const res = transaction();
  console.log("Transaction res:", res);
} catch (e) {
  console.error("error:", e);
}
