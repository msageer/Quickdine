import Database from 'better-sqlite3';

const db = new Database('quickdine.db');

try {
  const meals = db.prepare(`
    SELECT m.*, r.name as restaurant_name, r.currency as restaurant_currency 
    FROM menu_items m 
    JOIN restaurants r ON m.restaurant_id = r.id 
    WHERE m.status = 'Available' AND r.status = 'Active'
  `).all();
  console.log('Meals:', meals);

  const restaurants = db.prepare(`
    SELECT r.*, u.email as owner_email
    FROM restaurants r
    LEFT JOIN users u ON r.id = u.restaurant_id AND u.role = 'restaurant'
  `).all();
  console.log('Restaurants:', restaurants);
} catch (e) {
  console.error('Error:', e);
}
