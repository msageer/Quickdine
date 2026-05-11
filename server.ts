import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { Resend } from 'resend';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import fs from 'fs';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET || 'quickdine-super-secret-key-48h';

const uploadDir = process.env.VERCEL ? path.join('/tmp', 'uploads') : path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
});

const upload = multer({ storage: storage });

// Auth Middleware
const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
    (req as any).user = user;
    next();
  });
};

// Role-based authorization middleware
const authorizeRole = (roles: string[]) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as any).user;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
};

// Tenant isolation middleware
const requireRestaurantAccess = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = (req as any).user;
  const restaurantId = req.params.id || req.body.restaurant_id;
  
  if (user.role === 'admin') {
    return next(); // Admins can access any restaurant
  }
  
  if (user.restaurant_id && user.restaurant_id.toString() === restaurantId?.toString()) {
    return next();
  }
  
  return res.status(403).json({ error: 'Access denied. You do not have permission to access this restaurant.' });
};

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const PORT = 3000;

// Database setup
const dbPath = process.env.VERCEL ? '/tmp/quickdine.db' : 'quickdine.db';
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Initialize DB schema
db.exec(`
  CREATE TABLE IF NOT EXISTS restaurants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    logo_url TEXT,
    status TEXT DEFAULT 'Pending', -- Pending, Active, Suspended
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL, -- admin, restaurant
    restaurant_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(restaurant_id) REFERENCES restaurants(id)
  );

  CREATE TABLE IF NOT EXISTS menu_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    FOREIGN KEY(restaurant_id) REFERENCES restaurants(id)
  );

  CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    image_url TEXT,
    status TEXT DEFAULT 'Available', -- Available, Not Available, Out of Stock
    prep_time INTEGER, -- in minutes
    FOREIGN KEY(restaurant_id) REFERENCES restaurants(id),
    FOREIGN KEY(category_id) REFERENCES menu_categories(id)
  );

  CREATE TABLE IF NOT EXISTS tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    table_number TEXT NOT NULL,
    qr_token TEXT NOT NULL UNIQUE,
    FOREIGN KEY(restaurant_id) REFERENCES restaurants(id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    table_id INTEGER NOT NULL,
    total_amount REAL NOT NULL,
    status TEXT DEFAULT 'Pending', -- Pending, Accepted, Preparing, Ready, Delivered, Cancelled
    payment_status TEXT DEFAULT 'Pending', -- Pending, Paid
    customer_email TEXT,
    customer_name TEXT,
    customer_address TEXT,
    special_instructions TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(restaurant_id) REFERENCES restaurants(id),
    FOREIGN KEY(table_id) REFERENCES tables(id)
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    menu_item_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    FOREIGN KEY(order_id) REFERENCES orders(id),
    FOREIGN KEY(menu_item_id) REFERENCES menu_items(id)
  );

  CREATE TABLE IF NOT EXISTS waiters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    FOREIGN KEY(restaurant_id) REFERENCES restaurants(id)
  );

  CREATE TABLE IF NOT EXISTS waiter_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    table_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(restaurant_id) REFERENCES restaurants(id),
    FOREIGN KEY(table_id) REFERENCES tables(id)
  );

  CREATE TABLE IF NOT EXISTS platform_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    default_currency TEXT DEFAULT 'USD',
    notifications_enabled INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS user_logins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Seed initial data if empty
try {
  db.exec("ALTER TABLE restaurants ADD COLUMN status TEXT DEFAULT 'Pending'");
} catch (e) {
  // Column might already exist
}

try { db.exec("ALTER TABLE orders ADD COLUMN customer_email TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE orders ADD COLUMN customer_name TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE orders ADD COLUMN customer_address TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE orders ADD COLUMN special_instructions TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE orders ADD COLUMN order_number TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE restaurants ADD COLUMN waiter_allocation_enabled INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE orders ADD COLUMN waiter_id INTEGER REFERENCES users(id)"); } catch (e) {}
try { db.exec("ALTER TABLE restaurants ADD COLUMN logo_url TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE restaurants ADD COLUMN description TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE restaurants ADD COLUMN address TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE restaurants ADD COLUMN phone TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE restaurants ADD COLUMN email TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE restaurants ADD COLUMN currency TEXT DEFAULT 'USD'"); } catch (e) {}
try { db.exec("ALTER TABLE restaurants ADD COLUMN tax_rate REAL DEFAULT 0.0"); } catch (e) {}
try { db.exec("ALTER TABLE restaurants ADD COLUMN payment_cash_enabled INTEGER DEFAULT 1"); } catch (e) {}
try { db.exec("ALTER TABLE restaurants ADD COLUMN payment_paystack_enabled INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE restaurants ADD COLUMN paystack_public_key TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE restaurants ADD COLUMN paystack_secret_key TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE restaurants ADD COLUMN operating_hours TEXT"); } catch (e) {}

try { db.exec("ALTER TABLE platform_settings ADD COLUMN payment_paystack_enabled INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE platform_settings ADD COLUMN paystack_public_key TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE platform_settings ADD COLUMN paystack_secret_key TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE platform_settings ADD COLUMN payment_monnify_enabled INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE platform_settings ADD COLUMN monnify_api_key TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE platform_settings ADD COLUMN monnify_secret_key TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE platform_settings ADD COLUMN monnify_contract_code TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE platform_settings ADD COLUMN payment_flutterwave_enabled INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE platform_settings ADD COLUMN flutterwave_public_key TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE platform_settings ADD COLUMN flutterwave_secret_key TEXT"); } catch (e) {}

try { db.exec("ALTER TABLE restaurants ADD COLUMN account_number TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE restaurants ADD COLUMN bank_name TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE restaurants ADD COLUMN account_name TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE restaurants ADD COLUMN account_verified INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE restaurants ADD COLUMN payment_monnify_enabled INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE restaurants ADD COLUMN slug TEXT UNIQUE"); } catch (e) {}

// Backfill slugs
try {
  const restaurants = db.prepare("SELECT id, name FROM restaurants WHERE slug IS NULL").all() as any[];
  const updateSlug = db.prepare("UPDATE restaurants SET slug = ? WHERE id = ?");
  restaurants.forEach(r => {
    const slug = r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + r.id;
    updateSlug.run(slug, r.id);
  });
} catch (e) {}
try { db.exec("ALTER TABLE restaurants ADD COLUMN monnify_api_key TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE restaurants ADD COLUMN monnify_secret_key TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE restaurants ADD COLUMN monnify_contract_code TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE restaurants ADD COLUMN payment_flutterwave_enabled INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE restaurants ADD COLUMN flutterwave_public_key TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE restaurants ADD COLUMN flutterwave_secret_key TEXT"); } catch (e) {}

try { db.exec("ALTER TABLE tables ADD COLUMN address TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE tables ADD COLUMN is_room INTEGER DEFAULT 0"); } catch (e) {}

try { db.exec("ALTER TABLE users ADD COLUMN name TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'Cash'"); } catch (e) {}
try { db.exec("ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'Pending'"); } catch (e) {}
try { db.exec("ALTER TABLE orders ADD COLUMN paystack_reference TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE orders ADD COLUMN monnify_reference TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE orders ADD COLUMN flutterwave_reference TEXT"); } catch (e) {}

try { db.exec("ALTER TABLE restaurants ADD COLUMN business_type TEXT DEFAULT 'restaurant'"); } catch (e) {}

try { db.exec("ALTER TABLE orders ADD COLUMN tip_amount REAL DEFAULT 0.0"); } catch (e) {}
try { db.exec("ALTER TABLE menu_items ADD COLUMN dietary_badges TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE menu_items ADD COLUMN modifiers TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE order_items ADD COLUMN notes TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE order_items ADD COLUMN modifiers TEXT"); } catch (e) {}

// --- NEW SCHEMA UPDATES FOR TIER ENGINE & TAX READINESS ---
try { 
  db.exec(`CREATE TABLE IF NOT EXISTS subscription_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_name TEXT NOT NULL,
    price_monthly REAL NOT NULL,
    price_annual REAL NOT NULL,
    max_waiters INTEGER NOT NULL,
    max_monthly_orders INTEGER NOT NULL,
    analytics_retention_days INTEGER NOT NULL,
    can_export_tax_reports INTEGER DEFAULT 0,
    is_vip_featured INTEGER DEFAULT 0,
    can_use_online_payments INTEGER DEFAULT 0
  )`); 
} catch (e) {}

try { db.exec("ALTER TABLE subscription_plans ADD COLUMN can_use_online_payments INTEGER DEFAULT 0"); } catch (e) {}

try { db.exec("ALTER TABLE restaurants ADD COLUMN tin_number TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE restaurants ADD COLUMN is_hotel INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE menu_items ADD COLUMN cogs REAL DEFAULT 0.0"); } catch (e) {}
try { db.exec("ALTER TABLE orders ADD COLUMN subtotal REAL DEFAULT 0.0"); } catch (e) {}
try { db.exec("ALTER TABLE orders ADD COLUMN vat_amount REAL DEFAULT 0.0"); } catch (e) {}
try { db.exec("ALTER TABLE orders ADD COLUMN state_tax_amount REAL DEFAULT 0.0"); } catch (e) {}
try { db.exec("ALTER TABLE orders ADD COLUMN service_charge REAL DEFAULT 0.0"); } catch (e) {}
try { db.exec("ALTER TABLE orders ADD COLUMN net_total REAL DEFAULT 0.0"); } catch (e) {}
try { db.exec("ALTER TABLE orders ADD COLUMN payment_method TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE orders ADD COLUMN guest_last_name TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE orders ADD COLUMN room_number TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE subscription_plans ADD COLUMN max_monthly_gmv REAL DEFAULT 0.0"); } catch (e) {}

try {
  db.exec(`CREATE TABLE IF NOT EXISTS order_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    staff_id INTEGER,
    action TEXT NOT NULL,
    reason TEXT,
    previous_total REAL,
    new_total REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(order_id) REFERENCES orders(id),
    FOREIGN KEY(staff_id) REFERENCES users(id)
  )`);
} catch (e) {}
try { db.exec("ALTER TABLE restaurants ADD COLUMN subscription_plan_id INTEGER DEFAULT 1"); } catch (e) {}
try { db.exec("ALTER TABLE restaurants ADD COLUMN subscription_status TEXT DEFAULT 'Active'"); } catch (e) {}
try { db.exec("ALTER TABLE restaurants ADD COLUMN subscription_billing_cycle TEXT DEFAULT 'monthly'"); } catch (e) {}
try { db.exec("ALTER TABLE restaurants ADD COLUMN subscription_expiry_date TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE restaurants ADD COLUMN vat_rate REAL DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE restaurants ADD COLUMN state_tax_rate REAL DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE restaurants ADD COLUMN is_tax_inclusive INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE restaurants ADD COLUMN receipt_footer TEXT"); } catch (e) {}

try { db.exec("ALTER TABLE orders ADD COLUMN gross_total REAL DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE orders ADD COLUMN net_total REAL DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE orders ADD COLUMN vat_amount REAL DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE orders ADD COLUMN state_tax_amount REAL DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE orders ADD COLUMN discount_amount REAL DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE orders ADD COLUMN discount_reason TEXT"); } catch (e) {}
// payment_method already exists, but we can ensure it supports POS_Transfer in logic

try { db.exec("ALTER TABLE users ADD COLUMN phone_number TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN pin TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN phone_verified INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN otp_code TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN otp_expires_at DATETIME"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN verification_token TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN verification_expires DATETIME"); } catch (e) {}
try { db.exec("ALTER TABLE platform_settings ADD COLUMN global_copyright_footer TEXT DEFAULT 'Powered by QuickDine'"); } catch (e) {}
try { db.exec("ALTER TABLE platform_settings ADD COLUMN simulate_order_enabled INTEGER DEFAULT 0"); } catch (e) {}

// Ensure super admin exists
try {
  const superAdmin = db.prepare('SELECT * FROM users WHERE email = ?').get('msagirgroup@gmail.com');
  if (!superAdmin) {
    db.prepare('INSERT INTO users (email, password, role, restaurant_id, email_verified) VALUES (?, ?, ?, ?, 1)').run('msagirgroup@gmail.com', 'admin1234', 'admin', null);
  } else {
    db.prepare("UPDATE users SET password = ?, role = 'admin', email_verified = 1 WHERE email = ?").run('admin1234', 'msagirgroup@gmail.com');
  }
} catch (e) {
  console.error("Failed to seed super admin:", e);
}

// Seed default plans
try {
  const planCount = db.prepare("SELECT COUNT(*) as count FROM subscription_plans").get() as any;
  if (planCount.count === 0) {
    const insertPlan = db.prepare("INSERT INTO subscription_plans (plan_name, price_monthly, price_annual, max_waiters, max_monthly_orders, analytics_retention_days, can_export_tax_reports, is_vip_featured, can_use_online_payments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    insertPlan.run('Starter', 0, 0, 1, 100, 7, 0, 0, 0);
    insertPlan.run('Professional', 15000, 150000, 10, 999999, 365, 1, 0, 1);
    insertPlan.run('Enterprise', 35000, 350000, 999999, 999999, 365, 1, 1, 1);
  } else {
    // Update existing plans to match new specs if they haven't been updated
    db.prepare("UPDATE subscription_plans SET plan_name = 'Starter', max_waiters = 1, can_use_online_payments = 0 WHERE id = 1").run();
    db.prepare("UPDATE subscription_plans SET plan_name = 'Professional', max_monthly_orders = 999999, can_use_online_payments = 1 WHERE id = 2").run();
    db.prepare("UPDATE subscription_plans SET plan_name = 'Enterprise', max_waiters = 999999, can_use_online_payments = 1 WHERE id = 3").run();
  }
} catch (e) {}

// Function to check and downgrade expired subscriptions
const checkExpiredSubscriptions = () => {
  try {
    const now = new Date().toISOString();
    const expiredRestaurants = db.prepare(`
      SELECT id FROM restaurants 
      WHERE subscription_expiry_date IS NOT NULL 
      AND subscription_expiry_date < ? 
      AND subscription_status = 'Active'
    `).all(now) as any[];

    if (expiredRestaurants.length > 0) {
      const starterPlan = db.prepare("SELECT id FROM subscription_plans WHERE plan_name = 'Starter' LIMIT 1").get() as any;
      const starterPlanId = starterPlan ? starterPlan.id : 1;

      const updateStmt = db.prepare(`
        UPDATE restaurants 
        SET subscription_plan_id = ?, subscription_status = 'Expired', subscription_expiry_date = NULL 
        WHERE id = ?
      `);

      const transaction = db.transaction((restaurants) => {
        for (const r of restaurants) {
          updateStmt.run(starterPlanId, r.id);
        }
      });

      transaction(expiredRestaurants);
      console.log(`Downgraded ${expiredRestaurants.length} expired subscriptions to Starter plan.`);
    }
  } catch (error) {
    console.error('Error checking expired subscriptions:', error);
  }
};

// Run it periodically, e.g., every hour
setInterval(checkExpiredSubscriptions, 60 * 60 * 1000);
// And run it once on startup
checkExpiredSubscriptions();
// ----------------------------------------------------------

try {
  const settingsCount = db.prepare('SELECT COUNT(*) as count FROM platform_settings').get() as { count: number };
  if (settingsCount.count === 0) {
    db.prepare('INSERT INTO platform_settings (default_currency, notifications_enabled) VALUES (?, ?)').run('USD', 1);
  }
} catch (e) {}

// Ensure Demo Restaurant and Users exist
try {
  let demoRes = db.prepare('SELECT * FROM restaurants WHERE name = ?').get('The Great Burger') as any;
  if (!demoRes) {
    const insertRestaurant = db.prepare("INSERT INTO restaurants (name, status) VALUES (?, 'Active')");
    const resId = insertRestaurant.run('The Great Burger').lastInsertRowid;
    demoRes = { id: resId };
    
    const insertCategory = db.prepare('INSERT INTO menu_categories (restaurant_id, name) VALUES (?, ?)');
    const catId = insertCategory.run(resId, 'Burgers').lastInsertRowid;
    
    const insertItem = db.prepare('INSERT INTO menu_items (restaurant_id, category_id, name, description, price, status, prep_time) VALUES (?, ?, ?, ?, ?, ?, ?)');
    insertItem.run(resId, catId, 'Classic Cheeseburger', 'Beef patty with cheese, lettuce, and tomato', 12.99, 'Available', 15);
    insertItem.run(resId, catId, 'Double Bacon Burger', 'Two beef patties with bacon and cheese', 16.99, 'Available', 20);
    
    const insertTable = db.prepare('INSERT INTO tables (restaurant_id, table_number, qr_token) VALUES (?, ?, ?)');
    insertTable.run(resId, '1', 'table-1-token-xyz');
    insertTable.run(resId, '2', 'table-2-token-abc');
  }

  const resId = demoRes.id;

  const demoOwner = db.prepare('SELECT * FROM users WHERE email = ?').get('owner@greatburger.com');
  if (!demoOwner) {
    db.prepare('INSERT INTO users (email, password, role, restaurant_id, email_verified) VALUES (?, ?, ?, ?, 1)').run('owner@greatburger.com', 'owner123', 'restaurant', resId);
  } else {
    db.prepare("UPDATE users SET password = ?, restaurant_id = ? WHERE email = ?").run('owner123', resId, 'owner@greatburger.com');
  }

  const demoWaiter = db.prepare('SELECT * FROM users WHERE phone_number = ?').get('1234567890');
  if (!demoWaiter) {
    db.prepare("INSERT INTO users (name, email, password, phone_number, pin, role, restaurant_id, email_verified) VALUES (?, ?, ?, ?, ?, 'waiter', ?, 1)").run('Demo Waiter', 'waiter@greatburger.com', 'waiter123', '1234567890', '1234', resId);
  } else {
    db.prepare("UPDATE users SET pin = ?, restaurant_id = ? WHERE phone_number = ?").run('1234', resId, '1234567890');
  }
} catch (e) {
  console.error("Failed to seed demo credentials:", e);
}

const count = db.prepare('SELECT COUNT(*) as count FROM restaurants').get() as { count: number };
if (count.count === 0) {
  // Empty db handler can remain but demo is handled above
}


app.use(express.json());

// API Routes
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND password = ?').get(email, password) as any;
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (user.role === 'restaurant' && !user.email_verified) {
    return res.status(403).json({ error: 'Please verify your email before logging in. Check your inbox for the verification link.' });
  }
  
  try {
    db.prepare('INSERT INTO user_logins (user_id) VALUES (?)').run(user.id);
  } catch (e) {
    console.error('Error logging user login:', e);
  }
  
  const token = jwt.sign({ id: user.id, role: user.role, restaurant_id: user.restaurant_id }, JWT_SECRET, { expiresIn: '48h' });
  res.json({ success: true, user, token });
});

app.post('/api/auth/waiter-login', (req, res) => {
  const { phone_number, pin } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE phone_number = ? AND pin = ? AND role = 'waiter'").get(phone_number, pin) as any;
  if (!user) {
    return res.status(401).json({ error: 'Invalid phone number or PIN' });
  }
  try {
    db.prepare('INSERT INTO user_logins (user_id) VALUES (?)').run(user.id);
  } catch (e) {}
  
  const token = jwt.sign({ id: user.id, role: user.role, restaurant_id: user.restaurant_id }, JWT_SECRET, { expiresIn: '48h' });
  res.json({ success: true, user, token });
});

app.post('/api/auth/signup', (req, res) => {
  const { email, password, restaurantName, businessType } = req.body;
  
  try {
    const settings = db.prepare('SELECT default_currency FROM platform_settings LIMIT 1').get() as any;
    const defaultCurrency = settings ? settings.default_currency : 'USD';

    // Get the Professional plan ID for testing
    const proPlan = db.prepare("SELECT id FROM subscription_plans WHERE plan_name = 'Professional' LIMIT 1").get() as any;
    const planId = proPlan ? proPlan.id : 2;
    
    // Calculate expiry date (1 month from now)
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 1);
    const expiryDateStr = expiryDate.toISOString();

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date();
    verificationExpires.setHours(verificationExpires.getHours() + 24); // 24 hours

    const transaction = db.transaction(() => {
      const insertRestaurant = db.prepare('INSERT INTO restaurants (name, status, currency, subscription_plan_id, subscription_status, subscription_expiry_date, business_type) VALUES (?, ?, ?, ?, ?, ?, ?)');
      const resId = insertRestaurant.run(restaurantName, 'Pending', defaultCurrency, planId, 'Active', expiryDateStr, businessType || 'restaurant').lastInsertRowid;
      
      const insertUser = db.prepare('INSERT INTO users (email, password, role, restaurant_id, verification_token, verification_expires) VALUES (?, ?, ?, ?, ?, ?)');
      insertUser.run(email, password, 'restaurant', resId, verificationToken, verificationExpires.toISOString());
      
      return resId;
    });
    
    const resId = transaction();
    
    // In a real app, send email here. For now, we log it.
    console.log(`[EMAIL MOCK] Verification link for ${email}: /verify-email?token=${verificationToken}`);

    res.json({ success: true, message: 'Signup successful. Please check your email to verify your account.' });
  } catch (error) {
    res.status(500).json({ error: 'Signup failed. Email might already be in use.' });
  }
});

app.post('/api/auth/verify-email', (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.status(400).json({ error: 'Verification token is required' });
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE verification_token = ?').get(token) as any;
    
    if (!user) {
      return res.status(400).json({ error: 'Invalid verification token' });
    }

    if (new Date(user.verification_expires) < new Date()) {
      return res.status(400).json({ error: 'Verification token has expired' });
    }

    db.prepare('UPDATE users SET email_verified = 1, verification_token = NULL, verification_expires = NULL WHERE id = ?').run(user.id);
    
    res.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Failed to verify email' });
  }
});

app.patch('/api/admin/restaurants/:id/status', authenticateToken, authorizeRole(['admin']), (req, res) => {
  const { status } = req.body;
  const restaurantId = req.params.id;
  
  db.prepare('UPDATE restaurants SET status = ? WHERE id = ?').run(status, restaurantId);
  res.json({ success: true, status });
});

app.patch('/api/admin/restaurants/:id', authenticateToken, authorizeRole(['admin']), (req, res) => {
  const restaurantId = req.params.id;
  const updates = req.body;
  
  const allowedFields = [
    'name', 'description', 'address', 'phone', 'email', 'currency', 'tax_rate',
    'payment_cash_enabled', 'payment_paystack_enabled', 'paystack_public_key', 'paystack_secret_key',
    'payment_monnify_enabled', 'monnify_api_key', 'monnify_secret_key', 'monnify_contract_code',
    'payment_flutterwave_enabled', 'flutterwave_public_key', 'flutterwave_secret_key',
    'operating_hours', 'account_number', 'bank_name', 'account_name', 'receipt_footer',
    'subscription_plan_id', 'waiter_allocation_enabled'
  ];

  const setClauses: string[] = [];
  const values: any[] = [];

  for (const key of Object.keys(updates)) {
    if (allowedFields.includes(key)) {
      setClauses.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }

  if (setClauses.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  values.push(restaurantId);

  try {
    db.prepare(`UPDATE restaurants SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating restaurant:', error);
    res.status(500).json({ error: 'Failed to update restaurant' });
  }
});

app.get('/api/admin/analytics', authenticateToken, authorizeRole(['admin']), (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let dateFilter = '';
    let params: any[] = [];
    
    if (startDate && endDate) {
      dateFilter = 'AND created_at >= ? AND created_at <= ?';
      params = [startDate, endDate + ' 23:59:59'];
    }

    const totalRestaurants = db.prepare('SELECT COUNT(*) as count FROM restaurants WHERE status = \'Active\'').get() as any;
    const totalOrders = db.prepare(`SELECT COUNT(*) as count FROM orders WHERE 1=1 ${dateFilter}`).get(...params) as any;
    const totalRevenue = db.prepare(`SELECT SUM(total_amount) as total FROM orders WHERE status != 'Cancelled' ${dateFilter}`).get(...params) as any;
    
    let trendDateFilter = `created_at >= date('now', '-7 days')`;
    let trendParams: any[] = [];
    if (startDate && endDate) {
      trendDateFilter = `created_at >= ? AND created_at <= ?`;
      trendParams = [startDate, endDate + ' 23:59:59'];
    }

    const recentRevenue = db.prepare(`
      SELECT date(created_at) as date, SUM(total_amount) as revenue, COUNT(*) as orders
      FROM orders
      WHERE ${trendDateFilter} AND status != 'Cancelled'
      GROUP BY date(created_at)
      ORDER BY date(created_at) ASC
    `).all(...trendParams);

    const topRestaurants = db.prepare(`
      SELECT r.name, COUNT(o.id) as order_count, SUM(o.total_amount) as revenue
      FROM restaurants r
      JOIN orders o ON r.id = o.restaurant_id
      WHERE o.status != 'Cancelled' ${dateFilter.replace(/created_at/g, 'o.created_at')}
      GROUP BY r.id
      ORDER BY order_count DESC
      LIMIT 5
    `).all(...params);

    const topMenuItems = db.prepare(`
      SELECT m.name, SUM(oi.quantity) as total_sold
      FROM order_items oi
      JOIN menu_items m ON oi.menu_item_id = m.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status != 'Cancelled' ${dateFilter.replace(/created_at/g, 'o.created_at')}
      GROUP BY m.id
      ORDER BY total_sold DESC
      LIMIT 5
    `).all(...params);

    const topWaiters = db.prepare(`
      SELECT u.name, COUNT(o.id) as orders_handled
      FROM users u
      JOIN orders o ON u.id = o.waiter_id
      WHERE o.status != 'Cancelled' ${dateFilter.replace(/created_at/g, 'o.created_at')}
      GROUP BY u.id
      ORDER BY orders_handled DESC
      LIMIT 5
    `).all(...params);

    const dailyOrderVolumes = db.prepare(`
      SELECT date(created_at) as date, COUNT(*) as volume
      FROM orders
      WHERE ${trendDateFilter}
      GROUP BY date(created_at)
      ORDER BY date(created_at) ASC
    `).all(...trendParams);

    const recentLogins = db.prepare(`
      SELECT date(login_time) as date, COUNT(*) as logins
      FROM user_logins
      WHERE ${trendDateFilter.replace(/created_at/g, 'login_time')}
      GROUP BY date(login_time)
      ORDER BY date(login_time) ASC
    `).all(...trendParams);

    const aov = db.prepare(`SELECT AVG(total_amount) as average FROM orders WHERE status != 'Cancelled' ${dateFilter}`).get(...params) as any;
    
    const customerRetention = db.prepare(`
      WITH CustomerOrders AS (
        SELECT customer_email, COUNT(*) as order_count
        FROM orders
        WHERE customer_email IS NOT NULL AND customer_email != '' ${dateFilter}
        GROUP BY customer_email
      )
      SELECT 
        SUM(CASE WHEN order_count = 1 THEN 1 ELSE 0 END) as new_customers,
        SUM(CASE WHEN order_count > 1 THEN 1 ELSE 0 END) as returning_customers
      FROM CustomerOrders
    `).get(...params) as any;

    const recentWaiterCalls = db.prepare(`
      SELECT date(created_at) as date, COUNT(*) as calls
      FROM waiter_calls
      WHERE ${trendDateFilter}
      GROUP BY date(created_at)
      ORDER BY date(created_at) ASC
    `).all(...trendParams);

    const recentSignups = db.prepare(`
      SELECT date(created_at) as date, COUNT(*) as signups
      FROM restaurants
      WHERE ${trendDateFilter}
      GROUP BY date(created_at)
      ORDER BY date(created_at) ASC
    `).all(...trendParams);

    // Platform GMV (Gross Merchandise Value)
    const platformGmv = db.prepare(`SELECT SUM(total_amount) as gmv FROM orders WHERE status != 'Cancelled' ${dateFilter}`).get(...params) as any;
    
    // MRR (Monthly Recurring Revenue) - sum of active subscriptions
    const mrr = db.prepare(`
      SELECT SUM(s.price_monthly) as mrr
      FROM restaurants r
      JOIN subscription_plans s ON r.subscription_plan_id = s.id
      WHERE r.subscription_status = 'Active' AND r.subscription_billing_cycle = 'monthly'
    `).get() as any;

    const arr = db.prepare(`
      SELECT SUM(s.price_annual) as arr
      FROM restaurants r
      JOIN subscription_plans s ON r.subscription_plan_id = s.id
      WHERE r.subscription_status = 'Active' AND r.subscription_billing_cycle = 'annual'
    `).get() as any;

    const totalMrr = (mrr?.mrr || 0) + ((arr?.arr || 0) / 12);

    // Total Platform Tax Liability Processed
    const totalTaxLiability = db.prepare(`
      SELECT SUM(vat_amount + state_tax_amount) as tax
      FROM orders
      WHERE status != 'Cancelled'
    `).get() as any;

    // Churn Indicator (restaurants with no login/activity in 48 hours)
    // We'll use the latest order as a proxy for activity
    const churnRiskRestaurants = db.prepare(`
      SELECT r.id, r.name, r.email, MAX(o.created_at) as last_activity
      FROM restaurants r
      LEFT JOIN orders o ON r.id = o.restaurant_id
      WHERE r.status = 'Active'
      GROUP BY r.id
      HAVING last_activity IS NULL OR last_activity < datetime('now', '-48 hours')
    `).all();

    res.json({
      totalRestaurants: totalRestaurants.count,
      totalOrders: totalOrders.count,
      totalRevenue: totalRevenue.total || 0,
      recentRevenue,
      topRestaurants,
      topMenuItems,
      topWaiters,
      dailyOrderVolumes,
      recentLogins,
      averageOrderValue: aov.average || 0,
      customerRetention: {
        new: customerRetention.new_customers || 0,
        returning: customerRetention.returning_customers || 0
      },
      recentWaiterCalls,
      recentSignups,
      platformGmv: platformGmv.gmv || 0,
      mrr: totalMrr,
      totalTaxLiability: totalTaxLiability.tax || 0,
      churnRiskCount: churnRiskRestaurants.length,
      churnRiskRestaurants
    });
  } catch (error) {
    console.error('Error fetching admin analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

app.get('/api/admin/settings', authenticateToken, authorizeRole(['admin']), (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM platform_settings LIMIT 1').get();
    res.json(settings || { default_currency: 'USD', notifications_enabled: 1 });
  } catch (error) {
    console.error('Error fetching admin settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.get('/api/admin/plans', authenticateToken, authorizeRole(['admin']), (req, res) => {
  try {
    const plans = db.prepare('SELECT * FROM subscription_plans ORDER BY id ASC').all();
    res.json(plans);
  } catch (error) {
    console.error('Error fetching admin plans:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

app.post('/api/admin/plans', authenticateToken, authorizeRole(['admin']), (req, res) => {
  const { plan_name, price_monthly, price_annual, max_waiters, max_monthly_orders, analytics_retention_days, can_export_tax_reports, is_vip_featured, can_use_online_payments } = req.body;
  
  try {
    const result = db.prepare(`
      INSERT INTO subscription_plans (plan_name, price_monthly, price_annual, max_waiters, max_monthly_orders, analytics_retention_days, can_export_tax_reports, is_vip_featured, can_use_online_payments)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(plan_name, price_monthly, price_annual, max_waiters, max_monthly_orders, analytics_retention_days, can_export_tax_reports ? 1 : 0, is_vip_featured ? 1 : 0, can_use_online_payments ? 1 : 0);
    
    const newPlan = db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(result.lastInsertRowid);
    res.json(newPlan);
  } catch (error) {
    console.error('Error creating plan:', error);
    res.status(500).json({ error: 'Failed to create plan' });
  }
});

app.put('/api/admin/plans/:id', authenticateToken, authorizeRole(['admin']), (req, res) => {
  const { id } = req.params;
  const { price_monthly, price_annual, max_waiters, max_monthly_orders, analytics_retention_days, can_export_tax_reports, is_vip_featured, can_use_online_payments } = req.body;
  
  try {
    db.prepare(`
      UPDATE subscription_plans 
      SET price_monthly = ?, price_annual = ?, max_waiters = ?, max_monthly_orders = ?, analytics_retention_days = ?, can_export_tax_reports = ?, is_vip_featured = ?, can_use_online_payments = ?
      WHERE id = ?
    `).run(price_monthly, price_annual, max_waiters, max_monthly_orders, analytics_retention_days, can_export_tax_reports ? 1 : 0, is_vip_featured ? 1 : 0, can_use_online_payments ? 1 : 0, id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating plan:', error);
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

app.patch('/api/admin/settings', authenticateToken, authorizeRole(['admin']), (req, res) => {
  const { default_currency, notifications_enabled, payment_paystack_enabled, paystack_public_key, paystack_secret_key, payment_monnify_enabled, monnify_api_key, monnify_secret_key, monnify_contract_code, payment_flutterwave_enabled, flutterwave_public_key, flutterwave_secret_key, simulate_order_enabled } = req.body;
  
  const updates = ['default_currency = ?', 'notifications_enabled = ?'];
  const values = [default_currency, notifications_enabled ? 1 : 0];
  
  if (simulate_order_enabled !== undefined) {
    updates.push('simulate_order_enabled = ?');
    values.push(simulate_order_enabled ? 1 : 0);
  }
  
  if (payment_paystack_enabled !== undefined) {
    updates.push('payment_paystack_enabled = ?');
    values.push(payment_paystack_enabled ? 1 : 0);
  }
  if (paystack_public_key !== undefined) {
    updates.push('paystack_public_key = ?');
    values.push(paystack_public_key);
  }
  if (paystack_secret_key !== undefined) {
    updates.push('paystack_secret_key = ?');
    values.push(paystack_secret_key);
  }
  if (payment_monnify_enabled !== undefined) {
    updates.push('payment_monnify_enabled = ?');
    values.push(payment_monnify_enabled ? 1 : 0);
  }
  if (monnify_api_key !== undefined) {
    updates.push('monnify_api_key = ?');
    values.push(monnify_api_key);
  }
  if (monnify_secret_key !== undefined) {
    updates.push('monnify_secret_key = ?');
    values.push(monnify_secret_key);
  }
  if (monnify_contract_code !== undefined) {
    updates.push('monnify_contract_code = ?');
    values.push(monnify_contract_code);
  }
  if (payment_flutterwave_enabled !== undefined) {
    updates.push('payment_flutterwave_enabled = ?');
    values.push(payment_flutterwave_enabled ? 1 : 0);
  }
  if (flutterwave_public_key !== undefined) {
    updates.push('flutterwave_public_key = ?');
    values.push(flutterwave_public_key);
  }
  if (flutterwave_secret_key !== undefined) {
    updates.push('flutterwave_secret_key = ?');
    values.push(flutterwave_secret_key);
  }
  
  const query = `UPDATE platform_settings SET ${updates.join(', ')}`;
  db.prepare(query).run(...values);
  
  // Apply the new default currency to all restaurants
  if (default_currency) {
    db.prepare('UPDATE restaurants SET currency = ?').run(default_currency);
  }
  
  res.json({ success: true });
});

app.patch('/api/admin/profile', authenticateToken, authorizeRole(['admin']), (req, res) => {
  const { email, password } = req.body;
  // Assuming admin is the user with role 'admin'
  const adminUser = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get() as any;
  if (!adminUser) return res.status(404).json({ error: 'Admin not found' });
  
  if (email && password) {
    db.prepare('UPDATE users SET email = ?, password = ? WHERE id = ?').run(email, password, adminUser.id);
  } else if (email) {
    db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email, adminUser.id);
  } else if (password) {
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(password, adminUser.id);
  }
  
  res.json({ success: true });
});

app.get('/api/public/settings', (req, res) => {
  try {
    const settings = db.prepare('SELECT simulate_order_enabled, global_copyright_footer FROM platform_settings LIMIT 1').get();
    res.json(settings || { simulate_order_enabled: 0 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch public settings' });
  }
});

app.get('/api/restaurants', (req, res) => {
  try {
    const restaurants = db.prepare(`
      SELECT r.*, u.email as owner_email
      FROM restaurants r
      LEFT JOIN users u ON r.id = u.restaurant_id AND u.role = 'restaurant'
    `).all() as any[];
    
    const platformSettings = db.prepare('SELECT payment_paystack_enabled, paystack_public_key, payment_monnify_enabled, monnify_api_key, monnify_contract_code, payment_flutterwave_enabled, flutterwave_public_key FROM platform_settings LIMIT 1').get() as any;
    if (platformSettings) {
      restaurants.forEach(r => {
        r.platform_paystack_enabled = platformSettings.payment_paystack_enabled;
        r.platform_monnify_enabled = platformSettings.payment_monnify_enabled;
        r.platform_flutterwave_enabled = platformSettings.payment_flutterwave_enabled;
        r.payment_paystack_enabled = platformSettings.payment_paystack_enabled === 1 ? r.payment_paystack_enabled : 0;
        r.paystack_public_key = platformSettings.paystack_public_key;
        r.payment_monnify_enabled = platformSettings.payment_monnify_enabled === 1 ? r.payment_monnify_enabled : 0;
        r.monnify_api_key = platformSettings.monnify_api_key;
        r.monnify_contract_code = platformSettings.monnify_contract_code;
        r.payment_flutterwave_enabled = platformSettings.payment_flutterwave_enabled === 1 ? r.payment_flutterwave_enabled : 0;
        r.flutterwave_public_key = platformSettings.flutterwave_public_key;
      });
    }
    
    res.json(restaurants);
  } catch (error) {
    console.error('Error fetching restaurants:', error);
    res.status(500).json({ error: 'Failed to fetch restaurants' });
  }
});

app.get('/api/meals', (req, res) => {
  try {
    const meals = db.prepare(`
      SELECT m.*, r.name as restaurant_name, r.currency as restaurant_currency 
      FROM menu_items m 
      JOIN restaurants r ON m.restaurant_id = r.id 
      WHERE m.status = 'Available' AND r.status = 'Active'
    `).all();
    res.json(meals);
  } catch (error) {
    console.error('Error fetching meals:', error);
    res.status(500).json({ error: 'Failed to fetch meals' });
  }
});

app.get('/api/restaurants/:id', (req, res) => {
  try {
    const restaurant = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(req.params.id) as any;
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    
    const platformSettings = db.prepare('SELECT payment_paystack_enabled, paystack_public_key, payment_monnify_enabled, monnify_api_key, monnify_contract_code, payment_flutterwave_enabled, flutterwave_public_key FROM platform_settings LIMIT 1').get() as any;
    if (platformSettings) {
      restaurant.platform_paystack_enabled = platformSettings.payment_paystack_enabled;
      restaurant.platform_monnify_enabled = platformSettings.payment_monnify_enabled;
      restaurant.platform_flutterwave_enabled = platformSettings.payment_flutterwave_enabled;
      restaurant.payment_paystack_enabled = platformSettings.payment_paystack_enabled === 1 ? restaurant.payment_paystack_enabled : 0;
      restaurant.paystack_public_key = platformSettings.paystack_public_key;
      restaurant.payment_monnify_enabled = platformSettings.payment_monnify_enabled === 1 ? restaurant.payment_monnify_enabled : 0;
      restaurant.monnify_api_key = platformSettings.monnify_api_key;
      restaurant.monnify_contract_code = platformSettings.monnify_contract_code;
      restaurant.payment_flutterwave_enabled = platformSettings.payment_flutterwave_enabled === 1 ? restaurant.payment_flutterwave_enabled : 0;
      restaurant.flutterwave_public_key = platformSettings.flutterwave_public_key;
    }
    
    res.json(restaurant);
  } catch (error) {
    console.error('Error fetching restaurant details:', error);
    res.status(500).json({ error: 'Failed to fetch restaurant details' });
  }
});

app.get('/api/restaurants/:id/menu', (req, res) => {
  try {
    const categories = db.prepare('SELECT * FROM menu_categories WHERE restaurant_id = ?').all(req.params.id);
    const items = db.prepare('SELECT * FROM menu_items WHERE restaurant_id = ?').all(req.params.id);
    res.json({ categories, items });
  } catch (error) {
    console.error('Error fetching menu:', error);
    res.status(500).json({ error: 'Failed to fetch menu' });
  }
});

app.post('/api/restaurants/:id/menu/bulk', authenticateToken, requireRestaurantAccess, (req, res) => {
  const { items } = req.body;
  const restaurant_id = req.params.id;
  
  try {
    const transaction = db.transaction(() => {
      const categoriesMap = new Map();
      const catQuery = db.prepare('SELECT id FROM menu_categories WHERE restaurant_id = ? AND name = ?');
      const catInsert = db.prepare('INSERT INTO menu_categories (restaurant_id, name) VALUES (?, ?)');
      const itemInsert = db.prepare('INSERT INTO menu_items (restaurant_id, category_id, name, description, price, prep_time, status) VALUES (?, ?, ?, ?, ?, ?, ?)');

      for (const item of items) {
        if (!item.category_name || !item.name || item.price === undefined) continue;

        let cat_id = categoriesMap.get(item.category_name);
        if (!cat_id) {
          const cat = catQuery.get(restaurant_id, item.category_name) as any;
          if (cat) {
            cat_id = cat.id;
          } else {
            cat_id = catInsert.run(restaurant_id, item.category_name).lastInsertRowid;
          }
          categoriesMap.set(item.category_name, cat_id);
        }
        
        itemInsert.run(restaurant_id, cat_id, item.name, item.description || null, item.price, item.prep_time || 15, 'Available');
      }
    });

    transaction();
    res.json({ success: true });
  } catch (err: any) {
    console.error('Bulk upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/restaurants/:id/menu', authenticateToken, requireRestaurantAccess, upload.single('image'), (req, res) => {
  const { name, description, price, cogs, category_id, prep_time, dietary_badges, modifiers } = req.body;
  const restaurant_id = req.params.id;
  
  let image_url = req.body.image_url;
  if (req.file) {
    image_url = `/uploads/${req.file.filename}`;
  }
  
  try {
    const insertItem = db.prepare(`
      INSERT INTO menu_items (restaurant_id, category_id, name, description, price, cogs, image_url, prep_time, status, dietary_badges, modifiers) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Available', ?, ?)
    `);
    
    const result = insertItem.run(
      restaurant_id, 
      category_id, 
      name, 
      description || null, 
      parseFloat(price), 
      cogs ? parseFloat(cogs) : 0,
      image_url || null, 
      prep_time ? parseInt(prep_time) : null,
      dietary_badges || null,
      modifiers || null
    );
    
    const newItem = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(result.lastInsertRowid);
    res.json(newItem);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add menu item' });
  }
});

app.put('/api/restaurants/:id/menu/:itemId', authenticateToken, requireRestaurantAccess, upload.single('image'), (req, res) => {
  const { name, description, price, cogs, category_id, prep_time, status, dietary_badges, modifiers } = req.body;
  const { itemId } = req.params;
  
  let image_url = req.body.image_url;
  if (req.file) {
    image_url = `/uploads/${req.file.filename}`;
  }
  
  try {
    db.prepare(`
      UPDATE menu_items 
      SET name = ?, description = ?, price = ?, cogs = ?, category_id = ?, image_url = ?, prep_time = ?, status = ?, dietary_badges = ?, modifiers = ?
      WHERE id = ?
    `).run(
      name, 
      description || null, 
      parseFloat(price), 
      cogs ? parseFloat(cogs) : 0,
      category_id,
      image_url || null, 
      prep_time ? parseInt(prep_time) : null,
      status || 'Available',
      dietary_badges || null,
      modifiers || null,
      itemId
    );
    
    const updatedItem = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(itemId);
    res.json(updatedItem);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update menu item' });
  }
});

app.delete('/api/restaurants/:id/menu/:itemId', authenticateToken, requireRestaurantAccess, (req, res) => {
  const { itemId } = req.params;
  try {
    db.prepare('DELETE FROM menu_items WHERE id = ?').run(itemId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete menu item' });
  }
});

app.post('/api/restaurants/:id/categories', authenticateToken, requireRestaurantAccess, (req, res) => {
  const { name } = req.body;
  const restaurant_id = req.params.id;
  
  try {
    const insertCategory = db.prepare('INSERT INTO menu_categories (restaurant_id, name) VALUES (?, ?)');
    const result = insertCategory.run(restaurant_id, name);
    
    const newCategory = db.prepare('SELECT * FROM menu_categories WHERE id = ?').get(result.lastInsertRowid);
    res.json(newCategory);
  } catch (error: any) {
    console.error('Error adding category:', error);
    res.status(500).json({ error: 'Failed to add category', details: error.message });
  }
});

app.get('/api/restaurants/:id/waiters', authenticateToken, requireRestaurantAccess, (req, res) => {
  try {
    const waiters = db.prepare("SELECT id, name, email, phone_number, restaurant_id FROM users WHERE restaurant_id = ? AND role = 'waiter'").all(req.params.id);
    res.json(waiters);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch waiters' });
  }
});

app.post('/api/restaurants/:id/waiters', authenticateToken, requireRestaurantAccess, (req, res) => {
  const { name, email, password, phone_number, pin } = req.body;
  const restaurant_id = req.params.id;
  
  try {
    // Check waiter limits
    const restaurant = db.prepare(`
      SELECT r.*, s.max_waiters 
      FROM restaurants r 
      LEFT JOIN subscription_plans s ON r.subscription_plan_id = s.id 
      WHERE r.id = ?
    `).get(restaurant_id) as any;

    if (restaurant && restaurant.max_waiters) {
      const waiterCount = db.prepare(`
        SELECT COUNT(*) as count FROM users 
        WHERE restaurant_id = ? AND role = 'waiter'
      `).get(restaurant_id) as { count: number };

      if (waiterCount.count >= restaurant.max_waiters) {
        return res.status(403).json({ error: 'UpgradeRequired', message: 'Maximum number of waiters reached. Please upgrade your subscription.' });
      }
    }

    const finalEmail = email || `waiter_${Date.now()}_${Math.floor(Math.random() * 1000)}@quickdine.app`;
    const finalPassword = password || `waiter_${Date.now()}`;

    const insertWaiter = db.prepare("INSERT INTO users (name, email, password, phone_number, pin, role, restaurant_id) VALUES (?, ?, ?, ?, ?, 'waiter', ?)");
    const result = insertWaiter.run(name, finalEmail, finalPassword, phone_number || null, pin || null, restaurant_id);
    
    const newWaiter = db.prepare("SELECT id, name, email, phone_number, restaurant_id FROM users WHERE id = ?").get(result.lastInsertRowid);
    res.json(newWaiter);
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'Email or phone number already exists' });
    }
    res.status(500).json({ error: 'Failed to add waiter' });
  }
});

app.delete('/api/restaurants/:id/waiters/:waiterId', authenticateToken, requireRestaurantAccess, (req, res) => {
  const { waiterId } = req.params;
  try {
    db.prepare("DELETE FROM users WHERE id = ? AND role = 'waiter'").run(waiterId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete waiter' });
  }
});

app.patch('/api/restaurants/:id/settings', authenticateToken, requireRestaurantAccess, upload.single('logo'), (req, res) => {
  const { 
    waiter_allocation_enabled, 
    business_type,
    name,
    description,
    address,
    phone,
    email,
    currency,
    tax_rate,
    payment_cash_enabled,
    payment_paystack_enabled,
    payment_monnify_enabled,
    payment_flutterwave_enabled,
    account_number,
    bank_name,
    account_name,
    operating_hours,
    subscription_plan_id,
    subscription_billing_cycle,
    status,
    is_hotel
  } = req.body;
  const restaurant_id = req.params.id;
  
  let logo_url = req.body.logo_url;
  if (req.file) {
    logo_url = `/uploads/${req.file.filename}`;
  }
  
  try {
    // Check payment gateway lock
    if (payment_paystack_enabled || payment_monnify_enabled || payment_flutterwave_enabled) {
      const restaurant = db.prepare(`
        SELECT s.can_use_online_payments 
        FROM restaurants r 
        LEFT JOIN subscription_plans s ON r.subscription_plan_id = s.id 
        WHERE r.id = ?
      `).get(restaurant_id) as any;

      if (!restaurant || !restaurant.can_use_online_payments) {
        return res.status(403).json({ error: 'UpgradeRequired', message: 'Online payments are not available on your current plan. Please upgrade.' });
      }
    }

    const updates: string[] = [];
    const values: any[] = [];
    
    if (waiter_allocation_enabled !== undefined) {
      updates.push("waiter_allocation_enabled = ?");
      values.push(waiter_allocation_enabled ? 1 : 0);
    }

    if (is_hotel !== undefined) {
      updates.push("is_hotel = ?");
      values.push(is_hotel ? 1 : 0);
    }
    
    if (business_type !== undefined) {
      updates.push("business_type = ?");
      values.push(business_type);
    }
    
    if (logo_url !== undefined) {
      updates.push("logo_url = ?");
      values.push(logo_url);
    }
    
    if (name !== undefined) {
      updates.push("name = ?");
      values.push(name);
    }

    if (subscription_plan_id !== undefined) {
      updates.push("subscription_plan_id = ?");
      values.push(subscription_plan_id);
      // Clear expiry date when upgrading/changing plan
      updates.push("subscription_expiry_date = NULL");
    }

    if (subscription_billing_cycle !== undefined) {
      updates.push("subscription_billing_cycle = ?");
      values.push(subscription_billing_cycle);
    }

    if (description !== undefined) {
      updates.push("description = ?");
      values.push(description);
    }

    if (address !== undefined) {
      updates.push("address = ?");
      values.push(address);
    }

    if (phone !== undefined) {
      updates.push("phone = ?");
      values.push(phone);
    }

    if (email !== undefined) {
      updates.push("email = ?");
      values.push(email);
    }

    if (operating_hours !== undefined) {
      updates.push("operating_hours = ?");
      values.push(operating_hours);
    }

    if (currency !== undefined) {
      updates.push("currency = ?");
      values.push(currency);
    }

    if (tax_rate !== undefined) {
      updates.push("tax_rate = ?");
      values.push(tax_rate);
    }

    if (payment_cash_enabled !== undefined) {
      updates.push("payment_cash_enabled = ?");
      values.push(payment_cash_enabled);
    }

    if (payment_paystack_enabled !== undefined) {
      updates.push("payment_paystack_enabled = ?");
      values.push(payment_paystack_enabled ? 1 : 0);
    }

    if (payment_monnify_enabled !== undefined) {
      updates.push("payment_monnify_enabled = ?");
      values.push(payment_monnify_enabled ? 1 : 0);
    }

    if (payment_flutterwave_enabled !== undefined) {
      updates.push("payment_flutterwave_enabled = ?");
      values.push(payment_flutterwave_enabled ? 1 : 0);
    }

    const currentRestaurant = db.prepare('SELECT account_number, bank_name, account_name FROM restaurants WHERE id = ?').get(restaurant_id) as any;
    let accountDetailsChanged = false;

    if (account_number !== undefined) {
      updates.push("account_number = ?");
      values.push(account_number);
      if (currentRestaurant && currentRestaurant.account_number !== account_number) accountDetailsChanged = true;
    }

    if (bank_name !== undefined) {
      updates.push("bank_name = ?");
      values.push(bank_name);
      if (currentRestaurant && currentRestaurant.bank_name !== bank_name) accountDetailsChanged = true;
    }

    if (account_name !== undefined) {
      updates.push("account_name = ?");
      values.push(account_name);
      if (currentRestaurant && currentRestaurant.account_name !== account_name) accountDetailsChanged = true;
    }
    
    if (accountDetailsChanged) {
      updates.push("account_verified = ?");
      values.push(0);
    }
    
    if (status !== undefined) {
      updates.push("status = ?");
      values.push(status);
    }

    if (updates.length > 0) {
      values.push(restaurant_id);
      const result = db.prepare(`UPDATE restaurants SET ${updates.join(', ')} WHERE id = ?`).run(...values);
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Restaurant not found' });
      }
    }
    
    const updatedRestaurant = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(restaurant_id);
    res.json(updatedRestaurant);
  } catch (error: any) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings: ' + error.message });
  }
});

app.delete('/api/admin/restaurants/:id', authenticateToken, authorizeRole(['admin']), (req, res) => {
  const restaurant_id = req.params.id;
  try {
    const transaction = db.transaction(() => {
      // In a real system, we'd probably soft delete or cascade appropriately.
      // But we will delete everything linked to this restaurant.
      db.prepare('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE restaurant_id = ?)').run(restaurant_id);
      db.prepare('DELETE FROM orders WHERE restaurant_id = ?').run(restaurant_id);
      db.prepare('DELETE FROM menu_items WHERE category_id IN (SELECT id FROM menu_categories WHERE restaurant_id = ?)').run(restaurant_id);
      db.prepare('DELETE FROM menu_categories WHERE restaurant_id = ?').run(restaurant_id);
      db.prepare('DELETE FROM tables WHERE restaurant_id = ?').run(restaurant_id);
      db.prepare('DELETE FROM users WHERE restaurant_id = ? AND role != \'admin\'').run(restaurant_id);
      db.prepare('DELETE FROM waitlist WHERE restaurant_id = ?').run(restaurant_id);
      const result = db.prepare('DELETE FROM restaurants WHERE id = ?').run(restaurant_id);
      return result;
    });
    
    const result = transaction();
    
    if (result.changes > 0) {
      res.json({ message: 'Restaurant deleted successfully' });
    } else {
      res.status(404).json({ error: 'Restaurant not found' });
    }
  } catch (error: any) {
    console.error('Error deleting restaurant:', error);
    res.status(500).json({ error: 'Failed to delete restaurant: ' + error.message });
  }
});

app.patch('/api/admin/restaurants/:id/verify-account', authenticateToken, authorizeRole(['admin']), (req, res) => {
  const { status } = req.body; // 0=Pending, 1=Verified, 2=Rejected
  const restaurant_id = req.params.id;
  
  try {
    const result = db.prepare('UPDATE restaurants SET account_verified = ? WHERE id = ?').run(status, restaurant_id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update verification status' });
  }
});

app.patch('/api/orders/:id/waiter', authenticateToken, (req, res) => {
  const { waiter_id } = req.body;
  const order_id = req.params.id;
  
  try {
    const order = db.prepare("SELECT restaurant_id FROM orders WHERE id = ?").get(order_id) as any;
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    // Check if user has access to this restaurant
    if ((req as any).user?.role !== 'admin' && (req as any).user?.restaurant_id !== order.restaurant_id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    db.prepare("UPDATE orders SET waiter_id = ? WHERE id = ?").run(waiter_id, order_id);
    
    io.to(`restaurant_${order.restaurant_id}`).emit('order_waiter_assigned', { orderId: parseInt(order_id), waiter_id });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to assign waiter' });
  }
});

app.put('/api/restaurants/:id/categories/:categoryId', authenticateToken, requireRestaurantAccess, (req, res) => {
  const { categoryId } = req.params;
  const { name } = req.body;
  try {
    db.prepare('UPDATE menu_categories SET name = ? WHERE id = ?').run(name, categoryId);
    const updatedCategory = db.prepare('SELECT * FROM menu_categories WHERE id = ?').get(categoryId);
    res.json(updatedCategory);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update category' });
  }
});

app.delete('/api/restaurants/:id/categories/:categoryId', authenticateToken, requireRestaurantAccess, (req, res) => {
  const { categoryId } = req.params;
  try {
    // Check if category is in use
    const count = db.prepare('SELECT COUNT(*) as count FROM menu_items WHERE category_id = ?').get(categoryId) as { count: number };
    if (count.count > 0) {
      return res.status(400).json({ error: 'Cannot delete category with existing menu items' });
    }
    
    db.prepare('DELETE FROM menu_categories WHERE id = ?').run(categoryId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

app.get('/api/restaurants/:id/tables', authenticateToken, requireRestaurantAccess, (req, res) => {
  try {
    const tables = db.prepare('SELECT * FROM tables WHERE restaurant_id = ?').all(req.params.id);
    res.json(tables);
  } catch (error) {
    console.error('Error fetching tables:', error);
    res.status(500).json({ error: 'Failed to fetch tables' });
  }
});

// -- Admin User Management --
app.get('/api/admin/users', authenticateToken, authorizeRole(['admin']), (req, res) => {
  try {
    const users = db.prepare(`
      SELECT u.id, u.email, u.role, u.name, u.phone_number, u.email_verified, r.name as restaurant_name
      FROM users u
      LEFT JOIN restaurants r ON u.restaurant_id = r.id
      ORDER BY u.id DESC
    `).all();
    res.json(users);
  } catch (error) {
    console.error('Error fetching admin users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/api/admin/users', authenticateToken, authorizeRole(['admin']), (req, res) => {
  try {
    const { email, password, role, name, restaurant_id } = req.body;
    
    // Check if email already exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const insert = db.prepare(`
      INSERT INTO users (email, password, role, name, restaurant_id, email_verified)
      VALUES (?, ?, ?, ?, ?, 1)
    `);
    
    const result = insert.run(email, password, role, name || null, restaurant_id || null);
    const newUser = db.prepare(`
      SELECT u.id, u.email, u.role, u.name, u.phone_number, u.email_verified, r.name as restaurant_name
      FROM users u
      LEFT JOIN restaurants r ON u.restaurant_id = r.id
      WHERE u.id = ?
    `).get(result.lastInsertRowid);
    
    res.json(newUser);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.put('/api/admin/users/:id', authenticateToken, authorizeRole(['admin']), (req, res) => {
  try {
    const { id } = req.params;
    const { role, name, password, restaurant_id } = req.body;
    
    let query = 'UPDATE users SET role = ?, name = ?, restaurant_id = ?';
    const params: any[] = [role, name || null, restaurant_id || null];
    
    if (password) {
      query += ', password = ?';
      params.push(password);
    }
    
    query += ' WHERE id = ?';
    params.push(id);
    
    db.prepare(query).run(...params);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.delete('/api/admin/users/:id', authenticateToken, authorizeRole(['admin']), (req, res) => {
  try {
    const { id } = req.params;
    
    // Prevent self deletion
    if ((req as any).user?.id === parseInt(id)) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

app.patch('/api/admin/users/:id/verify', authenticateToken, authorizeRole(['admin']), (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error verifying user:', error);
    res.status(500).json({ error: 'Failed to verify user' });
  }
});

app.post('/api/restaurants/:id/tables', authenticateToken, requireRestaurantAccess, (req, res) => {
  const { table_number, address, is_room } = req.body;
  const restaurant_id = req.params.id;
  
  // Generate a unique token
  const qr_token = `table-${restaurant_id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  
  try {
    const insertTable = db.prepare('INSERT INTO tables (restaurant_id, table_number, qr_token, address, is_room) VALUES (?, ?, ?, ?, ?)');
    const result = insertTable.run(restaurant_id, table_number, qr_token, address || null, is_room ? 1 : 0);
    
    const newTable = db.prepare('SELECT * FROM tables WHERE id = ?').get(result.lastInsertRowid);
    res.json(newTable);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add table' });
  }
});

app.put('/api/restaurants/:id/tables/:tableId', authenticateToken, requireRestaurantAccess, (req, res) => {
  const { table_number, address, is_room } = req.body;
  const { tableId } = req.params;
  
  try {
    db.prepare('UPDATE tables SET table_number = ?, address = ?, is_room = ? WHERE id = ?').run(table_number, address || null, is_room ? 1 : 0, tableId);
    const updatedTable = db.prepare('SELECT * FROM tables WHERE id = ?').get(tableId);
    res.json(updatedTable);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update table' });
  }
});

app.delete('/api/restaurants/:id/tables/:tableId', authenticateToken, requireRestaurantAccess, (req, res) => {
  const { tableId } = req.params;
  
  try {
    db.prepare('DELETE FROM tables WHERE id = ?').run(tableId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete table' });
  }
});

app.get('/api/tables/validate/:token', (req, res) => {
  try {
    const table = db.prepare('SELECT * FROM tables WHERE qr_token = ?').get(req.params.token);
    if (!table) return res.status(404).json({ error: 'Invalid QR code' });
    res.json(table);
  } catch (error) {
    console.error('Error validating table token:', error);
    res.status(500).json({ error: 'Failed to validate table' });
  }
});

app.get('/api/orders/:id/track', (req, res) => {
  try {
    const order = db.prepare(`
      SELECT o.*, r.name as restaurant_name, r.currency as restaurant_currency
      FROM orders o
      JOIN restaurants r ON o.restaurant_id = r.id
      WHERE o.id = ?
    `).get(req.params.id) as any;
    
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    res.json({ order, items });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order details' });
  }
});

app.post('/api/orders', (req, res) => {
  const { restaurant_id, table_id, items, total_amount, customer_email, customer_name, customer_address, special_instructions, payment_method, payment_status, paystack_reference, monnify_reference, flutterwave_reference, tip_amount, waiter_id, guest_last_name, room_number } = req.body;
  
  try {
    // Check GMV limits
    const restaurant = db.prepare(`
      SELECT r.*, s.max_monthly_gmv, s.plan_name
      FROM restaurants r 
      LEFT JOIN subscription_plans s ON r.subscription_plan_id = s.id 
      WHERE r.id = ?
    `).get(restaurant_id) as any;

    if (restaurant && restaurant.max_monthly_gmv && restaurant.max_monthly_gmv > 0) {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const currentGmv = db.prepare(`
        SELECT SUM(total_amount) as gmv FROM orders 
        WHERE restaurant_id = ? AND strftime('%Y-%m', created_at) = ? AND status != 'Cancelled'
      `).get(restaurant_id, currentMonth) as { gmv: number };

      const proposedTotal = total_amount || 0;
      if (((currentGmv.gmv || 0) + proposedTotal) > restaurant.max_monthly_gmv) {
        io.to(`restaurant_${restaurant_id}`).emit('limit_reached', { type: 'gmv', message: `Your current plan (${restaurant.plan_name}) limits you to ₦${restaurant.max_monthly_gmv} GMV per month. Please upgrade to accept this order.` });
        return res.status(403).json({ error: 'UpgradeRequired', message: `Your current plan limits you to ₦${restaurant.max_monthly_gmv} GMV per month. Please upgrade to accept this order.` });
      }
    }
  } catch (e) {
    console.error('Error checking GMV limit:', e);
  }

  // Generate order number YYYYMMDD-ABC
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const randomChars = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const order_number = `${dateStr}-${randomChars}`;
  
  const insertOrder = db.prepare('INSERT INTO orders (restaurant_id, table_id, total_amount, customer_email, customer_name, customer_address, special_instructions, order_number, payment_method, payment_status, paystack_reference, monnify_reference, flutterwave_reference, tip_amount, waiter_id, subtotal, vat_amount, state_tax_amount, service_charge, net_total, guest_last_name, room_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertOrderItem = db.prepare('INSERT INTO order_items (order_id, menu_item_id, quantity, price, notes, modifiers) VALUES (?, ?, ?, ?, ?, ?)');
  
  const transaction = db.transaction(() => {
    let final_table_id = Number(table_id);
    if (!final_table_id) {
      // Find or create 'Takeaway/Online' table
      const existingTable = db.prepare('SELECT id FROM tables WHERE restaurant_id = ? AND table_number = ?').get(restaurant_id, 'Takeaway/Online') as any;
      if (existingTable) {
        final_table_id = existingTable.id;
      } else {
        const token = crypto.randomBytes(16).toString('hex');
        const newTable = db.prepare('INSERT INTO tables (restaurant_id, table_number, qr_token) VALUES (?, ?, ?)').run(restaurant_id, 'Takeaway/Online', token);
        final_table_id = Number(newTable.lastInsertRowid);
      }
    }

    // Calculate tax splits
    const restaurant = db.prepare('SELECT vat_rate FROM restaurants WHERE id = ?').get(restaurant_id) as any;
    const vat_rate = restaurant?.vat_rate || 0;
    const state_tax_rate = 0; // Or get from restaurant if added
    const service_charge_rate = 0; // Or get from restaurant if added

    let calculated_subtotal = 0;
    for (const item of items) {
      calculated_subtotal += item.price * item.quantity;
    }
    
    const calculated_vat = calculated_subtotal * (vat_rate / 100);
    const calculated_state_tax = calculated_subtotal * (state_tax_rate / 100);
    const calculated_service_charge = calculated_subtotal * (service_charge_rate / 100);
    const calculated_net_total = calculated_subtotal;
    const calculated_total = calculated_subtotal + calculated_vat + calculated_state_tax + calculated_service_charge + (tip_amount || 0);

    const orderResult = insertOrder.run(
      restaurant_id, 
      final_table_id, 
      calculated_total, 
      customer_email || null, 
      customer_name || null,
      customer_address || null,
      special_instructions || null, 
      order_number,
      payment_method || 'Cash',
      payment_status || 'Pending',
      paystack_reference || null,
      monnify_reference || null,
      flutterwave_reference || null,
      tip_amount || 0.0,
      waiter_id || null,
      calculated_subtotal,
      calculated_vat,
      calculated_state_tax,
      calculated_service_charge,
      calculated_net_total,
      guest_last_name || null,
      room_number || null
    );
    const orderId = orderResult.lastInsertRowid;
    
    for (const item of items) {
      insertOrderItem.run(orderId, item.id, item.quantity, item.price, item.notes || null, item.modifiers ? JSON.stringify(item.modifiers) : null);
    }
    
    return orderId;
  });
  
  try {
    const orderId = transaction();
    const newOrder = db.prepare(`
      SELECT o.*, t.table_number 
      FROM orders o 
      LEFT JOIN tables t ON o.table_id = t.id 
      WHERE o.id = ?
    `).get(orderId);
    
    const newOrderItems = db.prepare(`
      SELECT oi.*, m.name 
      FROM order_items oi 
      JOIN menu_items m ON oi.menu_item_id = m.id 
      WHERE oi.order_id = ?
    `).all(orderId);
    
    // Notify restaurant via WebSocket
    io.to(`restaurant_${restaurant_id}`).emit('new_order', { order: newOrder, items: newOrderItems });
    
    res.json({ success: true, orderId, orderNumber: order_number });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ error: 'Failed to create order', details: error instanceof Error ? error.message : String(error) });
  }
});

app.post('/api/restaurants/:id/tables/:tableId/call', (req, res) => {
  const { type } = req.body; // 'call' or 'bill'
  const restaurant_id = req.params.id;
  const table_id = req.params.tableId;
  
  try {
    const actualTableId = table_id === 'simulate' ? 0 : table_id;
    const insertCall = db.prepare(`
      INSERT INTO waiter_calls (restaurant_id, table_id, type, status)
      VALUES (?, ?, ?, 'pending')
    `);
    const result = insertCall.run(restaurant_id, actualTableId, type);
    
    const newCall = db.prepare(`
      SELECT wc.*, t.table_number 
      FROM waiter_calls wc
      LEFT JOIN tables t ON wc.table_id = t.id
      WHERE wc.id = ?
    `).get(result.lastInsertRowid);
    
    // Notify waiters via socket
    io.to(`restaurant_${restaurant_id}`).emit('new_waiter_call', newCall);
    
    res.json(newCall);
  } catch (error) {
    console.error('Error creating waiter call:', error);
    res.status(500).json({ error: 'Failed to call waiter' });
  }
});

app.get('/api/restaurants/:id/waiter-calls', authenticateToken, requireRestaurantAccess, (req, res) => {
  try {
    const calls = db.prepare(`
      SELECT wc.*, t.table_number 
      FROM waiter_calls wc
      JOIN tables t ON wc.table_id = t.id
      WHERE wc.restaurant_id = ? AND wc.status = 'pending'
      ORDER BY wc.created_at ASC
    `).all(req.params.id);
    res.json(calls);
  } catch (error) {
    console.error('Error fetching waiter calls:', error);
    res.status(500).json({ error: 'Failed to fetch waiter calls' });
  }
});

app.put('/api/waiter-calls/:callId/resolve', authenticateToken, (req, res) => {
  try {
    const call = db.prepare('SELECT * FROM waiter_calls WHERE id = ?').get(req.params.callId) as any;
    if (!call) return res.status(404).json({ error: 'Call not found' });
    
    if ((req as any).user?.role !== 'admin' && (req as any).user?.restaurant_id !== call.restaurant_id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    db.prepare(`UPDATE waiter_calls SET status = 'resolved' WHERE id = ?`).run(req.params.callId);
    
    io.to(`restaurant_${call.restaurant_id}`).emit('waiter_call_resolved', call.id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error resolving waiter call:', error);
    res.status(500).json({ error: 'Failed to resolve waiter call' });
  }
});

app.get('/api/restaurants/:id/orders', authenticateToken, requireRestaurantAccess, (req, res) => {
  try {
    const restaurant = db.prepare(`
      SELECT r.*, s.analytics_retention_days 
      FROM restaurants r 
      LEFT JOIN subscription_plans s ON r.subscription_plan_id = s.id 
      WHERE r.id = ?
    `).get(req.params.id) as any;

    let retentionDays = 7; // Default
    if (restaurant && restaurant.analytics_retention_days) {
      retentionDays = restaurant.analytics_retention_days;
    }

    const orders = db.prepare(`
      SELECT o.*, t.table_number, t.is_room, w.name as waiter_name
      FROM orders o 
      LEFT JOIN tables t ON o.table_id = t.id 
      LEFT JOIN users w ON o.waiter_id = w.id
      WHERE o.restaurant_id = ? AND o.created_at >= date('now', '-${retentionDays} days')
      ORDER BY o.created_at DESC
    `).all(req.params.id);
    
    const orderIds = orders.map((o: any) => o.id);
    let orderItems = [];
    if (orderIds.length > 0) {
      const placeholders = orderIds.map(() => '?').join(',');
      orderItems = db.prepare(`
        SELECT oi.*, m.name 
        FROM order_items oi 
        JOIN menu_items m ON oi.menu_item_id = m.id 
        WHERE oi.order_id IN (${placeholders})
      `).all(...orderIds);
    }
    
    res.json({ orders, orderItems });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

app.patch('/api/orders/:id/payment_status', authenticateToken, (req, res) => {
  const { payment_status } = req.body;
  const orderId = parseInt(req.params.id, 10);
  
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    if ((req as any).user?.role !== 'admin' && (req as any).user?.restaurant_id !== order.restaurant_id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    db.prepare('UPDATE orders SET payment_status = ? WHERE id = ?').run(payment_status, orderId);
    
    io.to(`order_${orderId}`).emit('order_payment_update', { orderId, payment_status });
    io.to(`restaurant_${order.restaurant_id}`).emit('order_payment_update', { orderId, payment_status });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to update payment status:', error);
    res.status(500).json({ error: 'Failed to update payment status' });
  }
});

app.patch('/api/orders/:id/confirm-transfer', authenticateToken, (req, res) => {
  const orderId = parseInt(req.params.id, 10);
  try {
    const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as any;
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    if ((req as any).user?.role !== 'admin' && (req as any).user?.restaurant_id !== order.restaurant_id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    db.prepare("UPDATE orders SET payment_status = 'Paid', status = 'Preparing' WHERE id = ?").run(orderId);
    io.to(`restaurant_${order.restaurant_id}`).emit('order_status_updated', { orderId, status: 'Preparing' });
    io.to(`order_${orderId}`).emit('order_status_update', { orderId, status: 'Preparing' });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/subscription-plans', (req, res) => {
  try {
    const plans = db.prepare('SELECT * FROM subscription_plans').all();
    res.json(plans);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/restaurants/:id/subscription', authenticateToken, requireRestaurantAccess, (req, res) => {
  const { id } = req.params;
  const { plan_id, billing_cycle } = req.body;
  try {
    db.prepare('UPDATE restaurants SET subscription_plan_id = ?, subscription_billing_cycle = ?, subscription_expiry_date = NULL WHERE id = ?').run(plan_id, billing_cycle, id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/restaurants/:id/analytics', authenticateToken, requireRestaurantAccess, (req, res) => {
  const { id } = req.params;
  try {
    const { startDate, endDate } = req.query;
    let dateFilter = '';
    let params: any[] = [id];
    
    if (startDate && endDate) {
      dateFilter = 'AND created_at >= ? AND created_at <= ?';
      params.push(startDate, endDate + ' 23:59:59');
    }

    const totalOrders = db.prepare(`SELECT COUNT(*) as count FROM orders WHERE restaurant_id = ? ${dateFilter}`).get(...params) as any;
    const totalRevenue = db.prepare(`SELECT SUM(total_amount) as total FROM orders WHERE restaurant_id = ? AND status != 'Cancelled' ${dateFilter}`).get(...params) as any;
    
    let trendDateFilter = `created_at >= date('now', '-7 days')`;
    let trendParams: any[] = [id];
    if (startDate && endDate) {
      trendDateFilter = `created_at >= ? AND created_at <= ?`;
      trendParams.push(startDate, endDate + ' 23:59:59');
    }

    const recentRevenue = db.prepare(`
      SELECT date(created_at) as date, SUM(total_amount) as revenue, COUNT(*) as orders
      FROM orders
      WHERE restaurant_id = ? AND ${trendDateFilter} AND status != 'Cancelled'
      GROUP BY date(created_at)
      ORDER BY date(created_at) ASC
    `).all(...trendParams);

    const topItems = db.prepare(`
      SELECT m.name, SUM(oi.quantity) as total_sold
      FROM order_items oi
      JOIN menu_items m ON oi.menu_item_id = m.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.restaurant_id = ? AND o.status != 'Cancelled' ${dateFilter.replace(/created_at/g, 'o.created_at')}
      GROUP BY m.id
      ORDER BY total_sold DESC
      LIMIT 5
    `).all(...params);

    const aov = db.prepare(`SELECT AVG(total_amount) as average FROM orders WHERE restaurant_id = ? AND status != 'Cancelled' ${dateFilter}`).get(...params) as any;

    res.json({
      totalOrders: totalOrders.count,
      totalRevenue: totalRevenue.total || 0,
      recentRevenue,
      topItems,
      averageOrderValue: aov.average || 0
    });
  } catch (error) {
    console.error('Error fetching restaurant analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

app.get('/api/restaurants/:id/z-report', authenticateToken, requireRestaurantAccess, (req, res) => {
  const { id } = req.params;
  const { date } = req.query; // YYYY-MM-DD
  
  try {
    const restaurant = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(id) as any;
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

    const targetDate = date || new Date().toISOString().slice(0, 10);
    
    const orders = db.prepare(`
      SELECT total_amount, subtotal, vat_amount, state_tax_amount, service_charge, tip_amount, payment_method 
      FROM orders 
      WHERE restaurant_id = ? AND date(created_at) = ? AND status != 'Cancelled'
    `).all(id, targetDate) as any[];

    let grossSales = 0;
    let netSales = 0;
    let totalVat = 0;
    let totalStateTax = 0;
    let totalServiceCharge = 0;
    let totalTips = 0;
    const salesByPaymentMethod: Record<string, number> = {};

    orders.forEach(order => {
      grossSales += order.total_amount || 0;
      netSales += order.subtotal || 0;
      totalVat += order.vat_amount || 0;
      totalStateTax += order.state_tax_amount || 0;
      totalServiceCharge += order.service_charge || 0;
      totalTips += order.tip_amount || 0;
      
      const method = order.payment_method || 'Unknown';
      if (!salesByPaymentMethod[method]) {
        salesByPaymentMethod[method] = 0;
      }
      salesByPaymentMethod[method] += order.total_amount || 0;
    });

    res.json({
      date: targetDate,
      grossSales,
      netSales,
      vat: totalVat,
      stateTax: totalStateTax,
      serviceCharge: totalServiceCharge,
      totalTips,
      salesByPaymentMethod
    });
  } catch (error) {
    console.error('Error generating Z-Report:', error);
    res.status(500).json({ error: 'Failed to generate Z-Report' });
  }
});

app.get('/api/restaurants/:id/tax-report.csv', authenticateToken, requireRestaurantAccess, (req, res) => {
  const { id } = req.params;
  const { month } = req.query; // YYYY-MM
  
  try {
    const restaurant = db.prepare(`
      SELECT r.*, s.can_export_tax_reports 
      FROM restaurants r 
      LEFT JOIN subscription_plans s ON r.subscription_plan_id = s.id 
      WHERE r.id = ?
    `).get(id) as any;

    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    if (!restaurant.can_export_tax_reports) {
      return res.status(403).json({ error: 'UpgradeRequired', message: 'Tax exports are only available on Pro and Premium plans.' });
    }

    const targetMonth = month || new Date().toISOString().slice(0, 7);
    const orders = db.prepare(`
      SELECT * FROM orders 
      WHERE restaurant_id = ? AND strftime('%Y-%m', created_at) = ? AND status != 'Cancelled'
    `).all(id, targetMonth) as any[];
    
    let csv = 'Order ID,Date,Gross Total,Net Total,VAT,State Tax,Payment Method\n';
    orders.forEach(o => {
      csv += `${o.order_number || o.id},${o.created_at},${o.gross_total || o.total_amount},${o.net_total || o.total_amount},${o.vat_amount || 0},${o.state_tax_amount || 0},${o.payment_method || 'Cash'}\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=tax_report_${targetMonth}.csv`);
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});



app.patch('/api/orders/:id/discount', authenticateToken, (req, res) => {
  const { discount_amount, reason } = req.body;
  const orderId = parseInt(req.params.id, 10);
  
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
  if (!order) return res.status(404).json({ error: 'Order not found' });
  
  if ((req as any).user?.role !== 'admin' && (req as any).user?.restaurant_id !== order.restaurant_id) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const discount = parseFloat(discount_amount);
  if (isNaN(discount) || discount < 0 || discount > order.total_amount) {
    return res.status(400).json({ error: 'Invalid discount amount' });
  }

  const newTotal = order.total_amount - discount;

  db.prepare('UPDATE orders SET discount_amount = ?, discount_reason = ?, total_amount = ? WHERE id = ?').run(discount, reason, newTotal, orderId);
  const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
  
  try {
    db.prepare('INSERT INTO order_logs (order_id, staff_id, action, reason, previous_total, new_total) VALUES (?, ?, ?, ?, ?, ?)').run(
      orderId,
      (req as any).user?.id || null,
      'DISCOUNT',
      reason || `Applied discount of ${discount}`,
      order.total_amount,
      newTotal
    );
  } catch (e) {
    console.error('Failed to log discount:', e);
  }

  io.to(`restaurant_${order.restaurant_id}`).emit('order_updated', updatedOrder);
  io.to(`order_${orderId}`).emit('order_updated', updatedOrder);
  
  res.json(updatedOrder);
});

app.patch('/api/orders/:id/status', authenticateToken, (req, res) => {
  const { status, reason } = req.body;
  const orderId = parseInt(req.params.id, 10);
  
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
  if (!order) return res.status(404).json({ error: 'Order not found' });
  
  if ((req as any).user?.role !== 'admin' && (req as any).user?.restaurant_id !== order.restaurant_id) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, orderId);
  const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
  
  if (status === 'Cancelled' || status === 'Voided') {
    try {
      db.prepare('INSERT INTO order_logs (order_id, staff_id, action, reason, previous_total, new_total) VALUES (?, ?, ?, ?, ?, ?)').run(
        orderId,
        (req as any).user?.id || null,
        status.toUpperCase(),
        reason || 'Status changed to ' + status,
        order.total_amount,
        order.total_amount
      );
    } catch (e) {
      console.error('Error logging order status change:', e);
    }
  }

  // Notify customer via WebSocket
  io.to(`order_${orderId}`).emit('order_status_update', { orderId, status });
  io.to(`restaurant_${updatedOrder.restaurant_id}`).emit('order_status_update', { orderId, status });
  
  if (updatedOrder.customer_email) {
    if (resend) {
      resend.emails.send({
        from: 'QuickDine <onboarding@resend.dev>',
        to: updatedOrder.customer_email,
        subject: `Order Update: #${updatedOrder.order_number || updatedOrder.id}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
            <h2 style="color: #333;">Order Status Update</h2>
            <p style="font-size: 16px; color: #555;">Hello,</p>
            <p style="font-size: 16px; color: #555;">Your order <strong>#${updatedOrder.order_number || updatedOrder.id}</strong> is now <strong>${status}</strong>.</p>
            <p style="font-size: 16px; color: #555;">Thank you for using QuickDine!</p>
          </div>
        `
      }).then(() => {
        console.log(`[EMAIL SENT] Successfully sent status update to ${order.customer_email}`);
      }).catch(err => {
        console.error(`[EMAIL ERROR] Failed to send email to ${order.customer_email}:`, err);
      });
    } else {
      console.log(`[EMAIL MOCK] Sending status update to ${order.customer_email}: Order ${order.order_number || order.id} is now ${status}`);
    }
  }
  
  res.json({ success: true, status });
});

app.get('/api/customer/orders', (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    
    const orders = db.prepare(`
      SELECT o.*, t.table_number, t.is_room, r.name as restaurant_name, r.currency as restaurant_currency
      FROM orders o 
      LEFT JOIN tables t ON o.table_id = t.id 
      JOIN restaurants r ON o.restaurant_id = r.id
      WHERE o.customer_email = ? 
      ORDER BY o.created_at DESC
    `).all(email);
    
    const orderIds = orders.map((o: any) => o.id);
    let orderItems = [];
    if (orderIds.length > 0) {
      const placeholders = orderIds.map(() => '?').join(',');
      orderItems = db.prepare(`
        SELECT oi.*, m.name 
        FROM order_items oi 
        JOIN menu_items m ON oi.menu_item_id = m.id 
        WHERE oi.order_id IN (${placeholders})
      `).all(...orderIds);
    }
    
    res.json({ orders, orderItems });
  } catch (error) {
    console.error('Error fetching customer orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('join_restaurant', (restaurantId) => {
    socket.join(`restaurant_${restaurantId}`);
    console.log(`Socket ${socket.id} joined restaurant_${restaurantId}`);
  });
  
  socket.on('join_order', (orderId) => {
    socket.join(`order_${orderId}`);
    console.log(`Socket ${socket.id} joined order_${orderId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

async function startServer() {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const viteModule = await import('vite');
    const vite = await viteModule.createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    // Provide a basic 404 for missing APIs rather than returning HTML
    app.use('/api', (req, res) => {
      res.status(404).json({ error: 'API route not found' });
    });
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled Global Error:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  });

  if (!process.env.VERCEL) {
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
