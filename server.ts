import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Prevent self-signed cert issues on Vercel
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import path from 'path';
import { fileURLToPath } from 'url';
import { Resend } from 'resend';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import fs from 'fs';
import crypto from 'crypto';

import nodemailer from 'nodemailer';

const rootDir = process.cwd();
const JWT_SECRET = process.env.JWT_SECRET || 'quickdine-super-secret-key-48h';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Configure Nodemailer transporter
const mailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  tls: {
    rejectUnauthorized: false
  },
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const defaultFrom = process.env.SMTP_FROM || 'QuickDine <noreply@quickdine.example.com>';

async function sendPlatformEmail(to: string, subject: string, html: string) {
  if (resend) {
    try {
      const { data, error } = await resend.emails.send({
        from: 'QuickDine <onboarding@resend.dev>', // Users must change this to their verified domain
        to,
        subject,
        html,
      });
      if (error) {
        console.error(`[Resend] Failed to send email to ${to}:`, error);
      } else {
        console.log(`[Resend] Email sent to ${to}`);
        return;
      }
    } catch (e) {
      console.error(`[Resend] Exception sending email to ${to}:`, e);
    }
  }

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      await mailTransporter.sendMail({
        from: defaultFrom,
        to,
        subject,
        html,
      });
      console.log(`[SMTP] Email sent to ${to}`);
      return;
    } catch (e) {
      console.error(`[SMTP] Failed to send email to ${to}:`, e);
    }
  }

  console.log(`[EMAIL MOCK] To: ${to} | Subject: ${subject}`);
  console.log(`[EMAIL MOCK HTML] ${html}`);
}

const uploadDir = process.env.VERCEL ? path.join('/tmp', 'uploads') : path.join(rootDir, 'uploads');
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

const PORT = 3000;

import { db } from './src/db.js';

let isInitialized = false;
let initPromise: Promise<void> | null = null;

async function initializeDatabase() {
// Initialize DB schema
await db.exec(`
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
const alterQueries = [
  "ALTER TABLE restaurants ADD COLUMN status TEXT DEFAULT 'Pending'",
  "ALTER TABLE orders ADD COLUMN customer_email TEXT",
  "ALTER TABLE orders ADD COLUMN customer_name TEXT",
  "ALTER TABLE orders ADD COLUMN customer_address TEXT",
  "ALTER TABLE orders ADD COLUMN special_instructions TEXT",
  "ALTER TABLE orders ADD COLUMN order_number TEXT",
  "ALTER TABLE restaurants ADD COLUMN waiter_allocation_enabled INTEGER DEFAULT 0",
  "ALTER TABLE orders ADD COLUMN waiter_id INTEGER REFERENCES users(id)",
  "ALTER TABLE restaurants ADD COLUMN logo_url TEXT",
  "ALTER TABLE restaurants ADD COLUMN description TEXT",
  "ALTER TABLE restaurants ADD COLUMN address TEXT",
  "ALTER TABLE restaurants ADD COLUMN phone TEXT",
  "ALTER TABLE restaurants ADD COLUMN email TEXT",
  "ALTER TABLE restaurants ADD COLUMN currency TEXT DEFAULT 'USD'",
  "ALTER TABLE restaurants ADD COLUMN tax_rate REAL DEFAULT 0.0",
  "ALTER TABLE restaurants ADD COLUMN payment_cash_enabled INTEGER DEFAULT 1",
  "ALTER TABLE restaurants ADD COLUMN payment_paystack_enabled INTEGER DEFAULT 0",
  "ALTER TABLE restaurants ADD COLUMN paystack_public_key TEXT",
  "ALTER TABLE restaurants ADD COLUMN paystack_secret_key TEXT",
  "ALTER TABLE restaurants ADD COLUMN operating_hours TEXT",
  "ALTER TABLE platform_settings ADD COLUMN payment_paystack_enabled INTEGER DEFAULT 0",
  "ALTER TABLE platform_settings ADD COLUMN paystack_public_key TEXT",
  "ALTER TABLE platform_settings ADD COLUMN paystack_secret_key TEXT",
  "ALTER TABLE platform_settings ADD COLUMN payment_monnify_enabled INTEGER DEFAULT 0",
  "ALTER TABLE platform_settings ADD COLUMN monnify_api_key TEXT",
  "ALTER TABLE platform_settings ADD COLUMN monnify_secret_key TEXT",
  "ALTER TABLE platform_settings ADD COLUMN monnify_contract_code TEXT",
  "ALTER TABLE platform_settings ADD COLUMN payment_flutterwave_enabled INTEGER DEFAULT 0",
  "ALTER TABLE platform_settings ADD COLUMN flutterwave_public_key TEXT",
  "ALTER TABLE platform_settings ADD COLUMN flutterwave_secret_key TEXT",
  "ALTER TABLE restaurants ADD COLUMN account_number TEXT",
  "ALTER TABLE restaurants ADD COLUMN bank_name TEXT",
  "ALTER TABLE restaurants ADD COLUMN account_name TEXT",
  "ALTER TABLE restaurants ADD COLUMN account_verified INTEGER DEFAULT 0",
  "ALTER TABLE restaurants ADD COLUMN payment_monnify_enabled INTEGER DEFAULT 0",
  "ALTER TABLE restaurants ADD COLUMN slug TEXT UNIQUE",
  "ALTER TABLE restaurants ADD COLUMN monnify_api_key TEXT",
  "ALTER TABLE restaurants ADD COLUMN monnify_secret_key TEXT",
  "ALTER TABLE restaurants ADD COLUMN monnify_contract_code TEXT",
  "ALTER TABLE restaurants ADD COLUMN payment_flutterwave_enabled INTEGER DEFAULT 0",
  "ALTER TABLE restaurants ADD COLUMN flutterwave_public_key TEXT",
  "ALTER TABLE restaurants ADD COLUMN flutterwave_secret_key TEXT",
  "ALTER TABLE tables ADD COLUMN address TEXT",
  "ALTER TABLE tables ADD COLUMN is_room INTEGER DEFAULT 0",
  "ALTER TABLE users ADD COLUMN name TEXT",
  "ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'Cash'",
  "ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'Pending'",
  "ALTER TABLE orders ADD COLUMN paystack_reference TEXT",
  "ALTER TABLE orders ADD COLUMN monnify_reference TEXT",
  "ALTER TABLE orders ADD COLUMN flutterwave_reference TEXT",
  "ALTER TABLE restaurants ADD COLUMN business_type TEXT DEFAULT 'restaurant'",
  "ALTER TABLE orders ADD COLUMN tip_amount REAL DEFAULT 0.0",
  "ALTER TABLE menu_items ADD COLUMN dietary_badges TEXT",
  "ALTER TABLE menu_items ADD COLUMN modifiers TEXT",
  "ALTER TABLE order_items ADD COLUMN notes TEXT",
  "ALTER TABLE order_items ADD COLUMN modifiers TEXT",
  "ALTER TABLE subscription_plans ADD COLUMN can_use_online_payments INTEGER DEFAULT 0",
  "ALTER TABLE restaurants ADD COLUMN tin_number TEXT",
  "ALTER TABLE restaurants ADD COLUMN is_hotel INTEGER DEFAULT 0",
  "ALTER TABLE menu_items ADD COLUMN cogs REAL DEFAULT 0.0",
  "ALTER TABLE orders ADD COLUMN subtotal REAL DEFAULT 0.0",
  "ALTER TABLE orders ADD COLUMN vat_amount REAL DEFAULT 0.0",
  "ALTER TABLE orders ADD COLUMN state_tax_amount REAL DEFAULT 0.0",
  "ALTER TABLE orders ADD COLUMN service_charge REAL DEFAULT 0.0",
  "ALTER TABLE orders ADD COLUMN net_total REAL DEFAULT 0.0",
  "ALTER TABLE orders ADD COLUMN payment_method TEXT",
  "ALTER TABLE orders ADD COLUMN guest_last_name TEXT",
  "ALTER TABLE orders ADD COLUMN room_number TEXT",
  "ALTER TABLE subscription_plans ADD COLUMN max_monthly_gmv REAL DEFAULT 0.0",
  "ALTER TABLE restaurants ADD COLUMN subscription_plan_id INTEGER DEFAULT 1",
  "ALTER TABLE restaurants ADD COLUMN subscription_status TEXT DEFAULT 'Active'",
  "ALTER TABLE restaurants ADD COLUMN subscription_billing_cycle TEXT DEFAULT 'monthly'",
  "ALTER TABLE restaurants ADD COLUMN subscription_expiry_date TEXT",
  "ALTER TABLE restaurants ADD COLUMN vat_rate REAL DEFAULT 0",
  "ALTER TABLE restaurants ADD COLUMN state_tax_rate REAL DEFAULT 0",
  "ALTER TABLE restaurants ADD COLUMN is_tax_inclusive INTEGER DEFAULT 0",
  "ALTER TABLE restaurants ADD COLUMN receipt_footer TEXT",
  "ALTER TABLE orders ADD COLUMN gross_total REAL DEFAULT 0",
  "ALTER TABLE orders ADD COLUMN net_total REAL DEFAULT 0",
  "ALTER TABLE orders ADD COLUMN vat_amount REAL DEFAULT 0",
  "ALTER TABLE orders ADD COLUMN state_tax_amount REAL DEFAULT 0",
  "ALTER TABLE orders ADD COLUMN discount_amount REAL DEFAULT 0",
  "ALTER TABLE orders ADD COLUMN discount_reason TEXT",
  "ALTER TABLE users ADD COLUMN phone_number TEXT",
  "ALTER TABLE users ADD COLUMN pin TEXT",
  "ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0",
  "ALTER TABLE users ADD COLUMN phone_verified INTEGER DEFAULT 0",
  "ALTER TABLE users ADD COLUMN otp_code TEXT",
  "ALTER TABLE users ADD COLUMN otp_expires_at DATETIME",
  "ALTER TABLE users ADD COLUMN verification_token TEXT",
  "ALTER TABLE users ADD COLUMN verification_expires DATETIME",
  "ALTER TABLE platform_settings ADD COLUMN global_copyright_footer TEXT DEFAULT 'Powered by QuickDine'",
  "ALTER TABLE platform_settings ADD COLUMN simulate_order_enabled INTEGER DEFAULT 0"
];

const alterPromises = alterQueries.map(q => db.exec(q).catch(() => {}));
await Promise.all(alterPromises);

// Backfill slugs
try {
  const restaurants = await db.all("SELECT id, name FROM restaurants WHERE slug IS NULL") as any[];
  const updateSlug = db.prepare("UPDATE restaurants SET slug = ? WHERE id = ?");
  for (const r of restaurants) {
    const slug = r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + r.id;
    await updateSlug.run(slug, r.id);
  }
} catch (e) {}

// --- NEW SCHEMA UPDATES FOR TIER ENGINE & TAX READINESS ---
try { 
  await db.exec(`CREATE TABLE IF NOT EXISTS subscription_plans (
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

try { await db.exec("ALTER TABLE subscription_plans ADD COLUMN can_use_online_payments INTEGER DEFAULT 0"); } catch (e) {}

try { await db.exec("ALTER TABLE restaurants ADD COLUMN tin_number TEXT"); } catch (e) {}
try { await db.exec("ALTER TABLE restaurants ADD COLUMN is_hotel INTEGER DEFAULT 0"); } catch (e) {}
try { await db.exec("ALTER TABLE menu_items ADD COLUMN cogs REAL DEFAULT 0.0"); } catch (e) {}
try { await db.exec("ALTER TABLE orders ADD COLUMN subtotal REAL DEFAULT 0.0"); } catch (e) {}
try { await db.exec("ALTER TABLE orders ADD COLUMN vat_amount REAL DEFAULT 0.0"); } catch (e) {}
try { await db.exec("ALTER TABLE orders ADD COLUMN state_tax_amount REAL DEFAULT 0.0"); } catch (e) {}
try { await db.exec("ALTER TABLE orders ADD COLUMN service_charge REAL DEFAULT 0.0"); } catch (e) {}
try { await db.exec("ALTER TABLE orders ADD COLUMN net_total REAL DEFAULT 0.0"); } catch (e) {}
try { await db.exec("ALTER TABLE orders ADD COLUMN payment_method TEXT"); } catch (e) {}
try { await db.exec("ALTER TABLE orders ADD COLUMN guest_last_name TEXT"); } catch (e) {}
try { await db.exec("ALTER TABLE orders ADD COLUMN room_number TEXT"); } catch (e) {}
try { await db.exec("ALTER TABLE subscription_plans ADD COLUMN max_monthly_gmv REAL DEFAULT 0.0"); } catch (e) {}

try {
  await db.exec(`CREATE TABLE IF NOT EXISTS order_logs (
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
try { await db.exec("ALTER TABLE restaurants ADD COLUMN subscription_plan_id INTEGER DEFAULT 1"); } catch (e) {}
try { await db.exec("ALTER TABLE restaurants ADD COLUMN subscription_status TEXT DEFAULT 'Active'"); } catch (e) {}
try { await db.exec("ALTER TABLE restaurants ADD COLUMN subscription_billing_cycle TEXT DEFAULT 'monthly'"); } catch (e) {}
try { await db.exec("ALTER TABLE restaurants ADD COLUMN subscription_expiry_date TEXT"); } catch (e) {}
try { await db.exec("ALTER TABLE restaurants ADD COLUMN vat_rate REAL DEFAULT 0"); } catch (e) {}
try { await db.exec("ALTER TABLE restaurants ADD COLUMN state_tax_rate REAL DEFAULT 0"); } catch (e) {}
try { await db.exec("ALTER TABLE restaurants ADD COLUMN is_tax_inclusive INTEGER DEFAULT 0"); } catch (e) {}
try { await db.exec("ALTER TABLE restaurants ADD COLUMN receipt_footer TEXT"); } catch (e) {}

try { await db.exec("ALTER TABLE orders ADD COLUMN gross_total REAL DEFAULT 0"); } catch (e) {}
try { await db.exec("ALTER TABLE orders ADD COLUMN net_total REAL DEFAULT 0"); } catch (e) {}
try { await db.exec("ALTER TABLE orders ADD COLUMN vat_amount REAL DEFAULT 0"); } catch (e) {}
try { await db.exec("ALTER TABLE orders ADD COLUMN state_tax_amount REAL DEFAULT 0"); } catch (e) {}
try { await db.exec("ALTER TABLE orders ADD COLUMN discount_amount REAL DEFAULT 0"); } catch (e) {}
try { await db.exec("ALTER TABLE orders ADD COLUMN discount_reason TEXT"); } catch (e) {}
// payment_method already exists, but we can ensure it supports POS_Transfer in logic

try { await db.exec("ALTER TABLE users ADD COLUMN phone_number TEXT"); } catch (e) {}
try { await db.exec("ALTER TABLE users ADD COLUMN pin TEXT"); } catch (e) {}
try { await db.exec("ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0"); } catch (e) {}
try { await db.exec("ALTER TABLE users ADD COLUMN phone_verified INTEGER DEFAULT 0"); } catch (e) {}
try { await db.exec("ALTER TABLE users ADD COLUMN otp_code TEXT"); } catch (e) {}
try { await db.exec("ALTER TABLE users ADD COLUMN otp_expires_at DATETIME"); } catch (e) {}
try { await db.exec("ALTER TABLE users ADD COLUMN verification_token TEXT"); } catch (e) {}
try { await db.exec("ALTER TABLE users ADD COLUMN verification_expires DATETIME"); } catch (e) {}
try { await db.exec("ALTER TABLE platform_settings ADD COLUMN global_copyright_footer TEXT DEFAULT 'Powered by QuickDine'"); } catch (e) {}
try { await db.exec("ALTER TABLE platform_settings ADD COLUMN simulate_order_enabled INTEGER DEFAULT 0"); } catch (e) {}

// Ensure super admin exists
try {
  const superAdmin = await db.get('SELECT * FROM users WHERE email = ?', ['msagirgroup@gmail.com']);
  if (!superAdmin) {
    await db.run('INSERT INTO users (email, password, role, restaurant_id, email_verified) VALUES (?, ?, ?, ?, 1)', ['msagirgroup@gmail.com', 'admin1234', 'admin', null]);
  } else {
    await db.run("UPDATE users SET password = ?, role = 'admin', email_verified = 1 WHERE email = ?", ['admin1234', 'msagirgroup@gmail.com']);
  }
} catch (e) {
  console.error("Failed to seed super admin:", e);
}

// Seed default plans
try {
  const planCount = await db.get("SELECT COUNT(*) as count FROM subscription_plans") as any;
  if (planCount.count === 0) {
    const insertPlan = db.prepare("INSERT INTO subscription_plans (plan_name, price_monthly, price_annual, max_waiters, max_monthly_orders, analytics_retention_days, can_export_tax_reports, is_vip_featured, can_use_online_payments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    await insertPlan.run('Starter', 0, 0, 1, 100, 7, 0, 0, 0);
    await insertPlan.run('Professional', 15000, 150000, 10, 999999, 365, 1, 0, 1);
    await insertPlan.run('Enterprise', 35000, 350000, 999999, 999999, 365, 1, 1, 1);
  } else {
    // Update existing plans to match new specs if they haven't been updated
    await db.run("UPDATE subscription_plans SET plan_name = 'Starter', max_waiters = 1, can_use_online_payments = 0 WHERE id = 1");
    await db.run("UPDATE subscription_plans SET plan_name = 'Professional', max_monthly_orders = 999999, can_use_online_payments = 1 WHERE id = 2");
    await db.run("UPDATE subscription_plans SET plan_name = 'Enterprise', max_waiters = 999999, can_use_online_payments = 1 WHERE id = 3");
  }
} catch (e) {}

// Function to check and downgrade expired subscriptions
const checkExpiredSubscriptions = async () => {
  try {
    const now = new Date().toISOString();
    const expiredRestaurants = await db.all(`
      SELECT id FROM restaurants 
      WHERE subscription_expiry_date IS NOT NULL 
      AND subscription_expiry_date < ? 
      AND subscription_status = 'Active'
    `, [now]) as any[];

    if (expiredRestaurants.length > 0) {
      const starterPlan = await db.get("SELECT id FROM subscription_plans WHERE plan_name = 'Starter' LIMIT 1") as any;
      const starterPlanId = starterPlan ? starterPlan.id : 1;

      const updateStmt = db.prepare(`
        UPDATE restaurants 
        SET subscription_plan_id = ?, subscription_status = 'Expired', subscription_expiry_date = NULL 
        WHERE id = ?
      `);

      const transaction = db.transaction(async (restaurants) => {
        for (const r of restaurants) {
          await updateStmt.run(starterPlanId, r.id);
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
  const settingsCount = await db.get('SELECT COUNT(*) as count FROM platform_settings') as { count: number };
  if (settingsCount.count === 0) {
    await db.run('INSERT INTO platform_settings (default_currency, notifications_enabled) VALUES (?, ?)', ['USD', 1]);
  }
} catch (e) {}

// Ensure Demo Restaurant and Users exist
try {
  let demoRes = await db.get('SELECT * FROM restaurants WHERE name = ?', ['The Great Burger']) as any;
  if (!demoRes) {
    const insertRestaurant = db.prepare("INSERT INTO restaurants (name, status) VALUES (?, 'Active')");
    const resId = (await insertRestaurant.run('The Great Burger')).lastInsertRowid;
    demoRes = { id: resId };
    
    const insertCategory = db.prepare('INSERT INTO menu_categories (restaurant_id, name) VALUES (?, ?)');
    const catId = (await insertCategory.run(resId, 'Burgers')).lastInsertRowid;
    
    const insertItem = db.prepare('INSERT INTO menu_items (restaurant_id, category_id, name, description, price, status, prep_time) VALUES (?, ?, ?, ?, ?, ?, ?)');
    await insertItem.run(resId, catId, 'Classic Cheeseburger', 'Beef patty with cheese, lettuce, and tomato', 12.99, 'Available', 15);
    await insertItem.run(resId, catId, 'Double Bacon Burger', 'Two beef patties with bacon and cheese', 16.99, 'Available', 20);
    
    const insertTable = db.prepare('INSERT INTO tables (restaurant_id, table_number, qr_token) VALUES (?, ?, ?)');
    await insertTable.run(resId, '1', 'table-1-token-xyz');
    await insertTable.run(resId, '2', 'table-2-token-abc');
  }

  const resId = demoRes.id;

  const demoOwner = await db.get('SELECT * FROM users WHERE email = ?', ['owner@greatburger.com']);
  if (!demoOwner) {
    await db.run('INSERT INTO users (email, password, role, restaurant_id, email_verified) VALUES (?, ?, ?, ?, 1)', ['owner@greatburger.com', 'owner123', 'restaurant', resId]);
  } else {
    await db.run("UPDATE users SET password = ?, restaurant_id = ? WHERE email = ?", ['owner123', resId, 'owner@greatburger.com']);
  }

  const demoWaiter = await db.get('SELECT * FROM users WHERE phone_number = ?', ['1234567890']);
  if (!demoWaiter) {
    await db.run("INSERT INTO users (name, email, password, phone_number, pin, role, restaurant_id, email_verified) VALUES (?, ?, ?, ?, ?, 'waiter', ?, 1)", ['Demo Waiter', 'waiter@greatburger.com', 'waiter123', '1234567890', '1234', resId]);
  } else {
    await db.run("UPDATE users SET pin = ?, restaurant_id = ? WHERE phone_number = ?", ['1234', resId, '1234567890']);
  }
} catch (e) {
  console.error("Failed to seed demo credentials:", e);
}

const count = await db.get('SELECT COUNT(*) as count FROM restaurants') as { count: number };
if (count.count === 0) {
  // Empty db handler can remain but demo is handled above
}
} // close initializeDatabase

app.use(async (req, res, next) => {
  if (!isInitialized) {
    if (!initPromise) initPromise = initializeDatabase();
    try {
      await initPromise;
      isInitialized = true;
    } catch (e) {
      initPromise = null; // allow retry
      return next(e);
    }
  }
  next();
});

app.use(express.json());

// API Routes
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await db.get('SELECT * FROM users WHERE email = ? AND password = ?', [email, password]) as any;
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (user.role === 'restaurant' && !user.email_verified) {
    const restaurant = await db.get('SELECT account_verified FROM restaurants WHERE id = ?', [user.restaurant_id]) as any;
    if (!restaurant || restaurant.account_verified !== 1) {
      return res.status(403).json({ error: 'Please verify your email before logging in. Check your inbox for the verification link.' });
    }
  }
  
  try {
    await db.run('INSERT INTO user_logins (user_id) VALUES (?)', [user.id]);
  } catch (e) {
    console.error('Error logging user login:', e);
  }
  
  const token = jwt.sign({ id: user.id, role: user.role, restaurant_id: user.restaurant_id }, JWT_SECRET, { expiresIn: '48h' });
  res.json({ success: true, user, token });
});

app.post('/api/auth/waiter-login', async (req, res) => {
  const { phone_number, pin } = req.body;
  const user = await db.get("SELECT * FROM users WHERE phone_number = ? AND pin = ? AND role = 'waiter'", [phone_number, pin]) as any;
  if (!user) {
    return res.status(401).json({ error: 'Invalid phone number or PIN' });
  }
  try {
    await db.run('INSERT INTO user_logins (user_id) VALUES (?)', [user.id]);
  } catch (e) {}
  
  const token = jwt.sign({ id: user.id, role: user.role, restaurant_id: user.restaurant_id }, JWT_SECRET, { expiresIn: '48h' });
  res.json({ success: true, user, token });
});

app.post('/api/auth/signup', async (req, res) => {
  const { email, password, restaurantName, businessType } = req.body;
  
  try {
    const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(400).json({ error: 'Email already exists.' });
    }

    const settings = await db.get('SELECT default_currency FROM platform_settings LIMIT 1') as any;
    const defaultCurrency = settings ? settings.default_currency : 'USD';

    // Get the Professional plan ID for testing
    const proPlan = await db.get("SELECT id FROM subscription_plans WHERE plan_name = 'Professional' LIMIT 1") as any;
    const planId = proPlan ? proPlan.id : 2;
    
    // Calculate expiry date (1 month from now)
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 1);
    const expiryDateStr = expiryDate.toISOString();

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date();
    verificationExpires.setHours(verificationExpires.getHours() + 24); // 24 hours

    const transaction = db.transaction(async () => {
      const insertRestaurant = db.prepare('INSERT INTO restaurants (name, status, currency, subscription_plan_id, subscription_status, subscription_expiry_date, business_type) VALUES (?, ?, ?, ?, ?, ?, ?)');
      const resId = (await insertRestaurant.run(restaurantName, 'Pending', defaultCurrency, planId, 'Active', expiryDateStr, businessType || 'restaurant')).lastInsertRowid;
      
      const insertUser = db.prepare('INSERT INTO users (email, password, role, restaurant_id, verification_token, verification_expires) VALUES (?, ?, ?, ?, ?, ?)');
      await insertUser.run(email, password, 'restaurant', resId, verificationToken, verificationExpires.toISOString());
      
      return resId;
    });
    
    const resId = await transaction();
    
    const verificationUrl = `${process.env.APP_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;
    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
        <h2 style="color: #333;">Verify Your QuickDine Account</h2>
        <p style="font-size: 16px; color: #555;">Hello,</p>
        <p style="font-size: 16px; color: #555;">Thank you for registering your restaurant (${restaurantName}) on QuickDine.</p>
        <p style="font-size: 16px; color: #555;">Please click the button below to verify your email address:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="background-color: #F27D26; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Verify Email</a>
        </div>
        <p style="font-size: 14px; color: #999;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `;
    
    await sendPlatformEmail(email, 'Verify Your QuickDine Account', emailHtml);

    res.json({ success: true, message: 'Signup successful. Please check your email to verify your account.' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Signup failed. Email might already be in use.' });
  }
});

app.post('/api/auth/verify-email', async (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.status(400).json({ error: 'Verification token is required' });
  }

  try {
    const user = await db.get('SELECT * FROM users WHERE verification_token = ?', [token]) as any;
    
    if (!user) {
      return res.status(400).json({ error: 'Invalid verification token' });
    }

    if (new Date(user.verification_expires) < new Date()) {
      return res.status(400).json({ error: 'Verification token has expired' });
    }

    await db.run('UPDATE users SET email_verified = 1, verification_token = NULL, verification_expires = NULL WHERE id = ?', [user.id]);
    
    res.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Failed to verify email' });
  }
});

app.patch('/api/admin/restaurants/:id/status', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const { status } = req.body;
  const restaurantId = req.params.id;
  
  await db.run('UPDATE restaurants SET status = ? WHERE id = ?', [status, restaurantId]);
  res.json({ success: true, status });
});

app.patch('/api/admin/restaurants/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
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
    await db.run(`UPDATE restaurants SET ${setClauses.join(', ')} WHERE id = ?`, [...values]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating restaurant:', error);
    res.status(500).json({ error: 'Failed to update restaurant' });
  }
});

app.get('/api/admin/analytics', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let dateFilter = '';
    let params: any[] = [];
    
    if (startDate && endDate) {
      dateFilter = 'AND created_at >= ? AND created_at <= ?';
      params = [startDate, endDate + ' 23:59:59'];
    }

    const totalRestaurants = await db.get('SELECT COUNT(*) as count FROM restaurants WHERE status = \'Active\'') as any;
    const totalOrders = await db.get(`SELECT COUNT(*) as count FROM orders WHERE 1=1 ${dateFilter}`, [...params]) as any;
    const totalRevenue = await db.get(`SELECT SUM(total_amount) as total FROM orders WHERE status != 'Cancelled' ${dateFilter}`, [...params]) as any;
    
    let trendDateFilter = `created_at >= date('now', '-7 days')`;
    let trendParams: any[] = [];
    if (startDate && endDate) {
      trendDateFilter = `created_at >= ? AND created_at <= ?`;
      trendParams = [startDate, endDate + ' 23:59:59'];
    }

    const recentRevenue = await db.all(`
      SELECT date(created_at) as date, SUM(total_amount) as revenue, COUNT(*) as orders
      FROM orders
      WHERE ${trendDateFilter} AND status != 'Cancelled'
      GROUP BY date(created_at)
      ORDER BY date(created_at) ASC
    `, [...trendParams]);

    const topRestaurants = await db.all(`
      SELECT r.name, COUNT(o.id) as order_count, SUM(o.total_amount) as revenue
      FROM restaurants r
      JOIN orders o ON r.id = o.restaurant_id
      WHERE o.status != 'Cancelled' ${dateFilter.replace(/created_at/g, 'o.created_at')}
      GROUP BY r.id
      ORDER BY order_count DESC
      LIMIT 5
    `, [...params]);

    const topMenuItems = await db.all(`
      SELECT m.name, SUM(oi.quantity) as total_sold
      FROM order_items oi
      JOIN menu_items m ON oi.menu_item_id = m.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status != 'Cancelled' ${dateFilter.replace(/created_at/g, 'o.created_at')}
      GROUP BY m.id
      ORDER BY total_sold DESC
      LIMIT 5
    `, [...params]);

    const topWaiters = await db.all(`
      SELECT u.name, COUNT(o.id) as orders_handled
      FROM users u
      JOIN orders o ON u.id = o.waiter_id
      WHERE o.status != 'Cancelled' ${dateFilter.replace(/created_at/g, 'o.created_at')}
      GROUP BY u.id
      ORDER BY orders_handled DESC
      LIMIT 5
    `, [...params]);

    const dailyOrderVolumes = await db.all(`
      SELECT date(created_at) as date, COUNT(*) as volume
      FROM orders
      WHERE ${trendDateFilter}
      GROUP BY date(created_at)
      ORDER BY date(created_at) ASC
    `, [...trendParams]);

    const recentLogins = await db.all(`
      SELECT date(login_time) as date, COUNT(*) as logins
      FROM user_logins
      WHERE ${trendDateFilter.replace(/created_at/g, 'login_time')}
      GROUP BY date(login_time)
      ORDER BY date(login_time) ASC
    `, [...trendParams]);

    const aov = await db.get(`SELECT AVG(total_amount) as average FROM orders WHERE status != 'Cancelled' ${dateFilter}`, [...params]) as any;
    
    const customerRetention = await db.get(`
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
    `, [...params]) as any;

    const recentWaiterCalls = await db.all(`
      SELECT date(created_at) as date, COUNT(*) as calls
      FROM waiter_calls
      WHERE ${trendDateFilter}
      GROUP BY date(created_at)
      ORDER BY date(created_at) ASC
    `, [...trendParams]);

    const recentSignups = await db.all(`
      SELECT date(created_at) as date, COUNT(*) as signups
      FROM restaurants
      WHERE ${trendDateFilter}
      GROUP BY date(created_at)
      ORDER BY date(created_at) ASC
    `, [...trendParams]);

    // Platform GMV (Gross Merchandise Value)
    const platformGmv = await db.get(`SELECT SUM(total_amount) as gmv FROM orders WHERE status != 'Cancelled' ${dateFilter}`, [...params]) as any;
    
    // MRR (Monthly Recurring Revenue) - sum of active subscriptions
    const mrr = await db.get(`
      SELECT SUM(s.price_monthly) as mrr
      FROM restaurants r
      JOIN subscription_plans s ON r.subscription_plan_id = s.id
      WHERE r.subscription_status = 'Active' AND r.subscription_billing_cycle = 'monthly'
    `) as any;

    const arr = await db.get(`
      SELECT SUM(s.price_annual) as arr
      FROM restaurants r
      JOIN subscription_plans s ON r.subscription_plan_id = s.id
      WHERE r.subscription_status = 'Active' AND r.subscription_billing_cycle = 'annual'
    `) as any;

    const totalMrr = (mrr?.mrr || 0) + ((arr?.arr || 0) / 12);

    // Total Platform Tax Liability Processed
    const totalTaxLiability = await db.get(`
      SELECT SUM(vat_amount + state_tax_amount) as tax
      FROM orders
      WHERE status != 'Cancelled'
    `) as any;

    // Churn Indicator (restaurants with no login/activity in 48 hours)
    // We'll use the latest order as a proxy for activity
    const churnRiskRestaurants = await db.all(`
      SELECT r.id, r.name, r.email, MAX(o.created_at) as last_activity
      FROM restaurants r
      LEFT JOIN orders o ON r.id = o.restaurant_id
      WHERE r.status = 'Active'
      GROUP BY r.id
      HAVING last_activity IS NULL OR last_activity < datetime('now', '-48 hours')
    `);

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

app.get('/api/admin/settings', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const settings = await db.get('SELECT * FROM platform_settings LIMIT 1');
    res.json(settings || { default_currency: 'USD', notifications_enabled: 1 });
  } catch (error) {
    console.error('Error fetching admin settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.get('/api/admin/plans', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const plans = await db.all('SELECT * FROM subscription_plans ORDER BY id ASC');
    res.json(plans);
  } catch (error) {
    console.error('Error fetching admin plans:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

app.post('/api/admin/plans', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const { plan_name, price_monthly, price_annual, max_waiters, max_monthly_orders, analytics_retention_days, can_export_tax_reports, is_vip_featured, can_use_online_payments } = req.body;
  
  try {
    const result = await db.run(`
      INSERT INTO subscription_plans (plan_name, price_monthly, price_annual, max_waiters, max_monthly_orders, analytics_retention_days, can_export_tax_reports, is_vip_featured, can_use_online_payments)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [plan_name, price_monthly, price_annual, max_waiters, max_monthly_orders, analytics_retention_days, can_export_tax_reports ? 1 : 0, is_vip_featured ? 1 : 0, can_use_online_payments ? 1 : 0]);
    
    const newPlan = await db.get('SELECT * FROM subscription_plans WHERE id = ?', [result.lastInsertRowid]);
    res.json(newPlan);
  } catch (error) {
    console.error('Error creating plan:', error);
    res.status(500).json({ error: 'Failed to create plan' });
  }
});

app.put('/api/admin/plans/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const { id } = req.params;
  const { price_monthly, price_annual, max_waiters, max_monthly_orders, analytics_retention_days, can_export_tax_reports, is_vip_featured, can_use_online_payments } = req.body;
  
  try {
    await db.run(`
      UPDATE subscription_plans 
      SET price_monthly = ?, price_annual = ?, max_waiters = ?, max_monthly_orders = ?, analytics_retention_days = ?, can_export_tax_reports = ?, is_vip_featured = ?, can_use_online_payments = ?
      WHERE id = ?
    `, [price_monthly, price_annual, max_waiters, max_monthly_orders, analytics_retention_days, can_export_tax_reports ? 1 : 0, is_vip_featured ? 1 : 0, can_use_online_payments ? 1 : 0, id]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating plan:', error);
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

app.patch('/api/admin/settings', authenticateToken, authorizeRole(['admin']), async (req, res) => {
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
  await db.run(query, [...values]);
  
  // Apply the new default currency to all restaurants
  if (default_currency) {
    await db.run('UPDATE restaurants SET currency = ?', [default_currency]);
  }
  
  res.json({ success: true });
});

app.patch('/api/admin/profile', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const { email, password } = req.body;
  // Assuming admin is the user with role 'admin'
  const adminUser = await db.get("SELECT id FROM users WHERE role = 'admin' LIMIT 1") as any;
  if (!adminUser) return res.status(404).json({ error: 'Admin not found' });
  
  if (email && password) {
    await db.run('UPDATE users SET email = ?, password = ? WHERE id = ?', [email, password, adminUser.id]);
  } else if (email) {
    await db.run('UPDATE users SET email = ? WHERE id = ?', [email, adminUser.id]);
  } else if (password) {
    await db.run('UPDATE users SET password = ? WHERE id = ?', [password, adminUser.id]);
  }
  
  res.json({ success: true });
});

app.get('/api/public/settings', async (req, res) => {
  try {
    const settings = await db.get('SELECT simulate_order_enabled, global_copyright_footer FROM platform_settings LIMIT 1');
    res.json(settings || { simulate_order_enabled: 0 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch public settings' });
  }
});

app.get('/api/restaurants', async (req, res) => {
  try {
    const restaurants = await db.all(`
      SELECT r.*, u.email as owner_email
      FROM restaurants r
      LEFT JOIN users u ON r.id = u.restaurant_id AND u.role = 'restaurant'
    `) as any[];
    
    const platformSettings = await db.get('SELECT payment_paystack_enabled, paystack_public_key, payment_monnify_enabled, monnify_api_key, monnify_contract_code, payment_flutterwave_enabled, flutterwave_public_key FROM platform_settings LIMIT 1') as any;
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

app.get('/api/meals', async (req, res) => {
  try {
    const meals = await db.all(`
      SELECT m.*, r.name as restaurant_name, r.currency as restaurant_currency 
      FROM menu_items m 
      JOIN restaurants r ON m.restaurant_id = r.id 
      WHERE m.status = 'Available' AND r.status = 'Active'
    `);
    res.json(meals);
  } catch (error) {
    console.error('Error fetching meals:', error);
    res.status(500).json({ error: 'Failed to fetch meals' });
  }
});

app.get('/api/restaurants/:id', async (req, res) => {
  try {
    const restaurant = await db.get('SELECT * FROM restaurants WHERE id = ?', [req.params.id]) as any;
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    
    const platformSettings = await db.get('SELECT payment_paystack_enabled, paystack_public_key, payment_monnify_enabled, monnify_api_key, monnify_contract_code, payment_flutterwave_enabled, flutterwave_public_key FROM platform_settings LIMIT 1') as any;
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

app.get('/api/restaurants/:id/menu', async (req, res) => {
  try {
    const categories = await db.all('SELECT * FROM menu_categories WHERE restaurant_id = ?', [req.params.id]);
    const items = await db.all('SELECT * FROM menu_items WHERE restaurant_id = ?', [req.params.id]);
    res.json({ categories, items });
  } catch (error) {
    console.error('Error fetching menu:', error);
    res.status(500).json({ error: 'Failed to fetch menu' });
  }
});

app.post('/api/restaurants/:id/menu/bulk', authenticateToken, requireRestaurantAccess, async (req, res) => {
  const { items } = req.body;
  const restaurant_id = req.params.id;
  
  try {
    const transaction = db.transaction(async () => {
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
            cat_id = (await catInsert.run(restaurant_id, item.category_name)).lastInsertRowid;
          }
          categoriesMap.set(item.category_name, cat_id);
        }
        
        await itemInsert.run(restaurant_id, cat_id, item.name, item.description || null, item.price, item.prep_time || 15, 'Available');
      }
    });

    await transaction();
    res.json({ success: true });
  } catch (err: any) {
    console.error('Bulk upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/restaurants/:id/menu', authenticateToken, requireRestaurantAccess, upload.single('image'), async (req, res) => {
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
    
    const result = await insertItem.run(
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
    
    const newItem = await db.get('SELECT * FROM menu_items WHERE id = ?', [result.lastInsertRowid]);
    res.json(newItem);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add menu item' });
  }
});

app.put('/api/restaurants/:id/menu/:itemId', authenticateToken, requireRestaurantAccess, upload.single('image'), async (req, res) => {
  const { name, description, price, cogs, category_id, prep_time, status, dietary_badges, modifiers } = req.body;
  const { itemId } = req.params;
  
  let image_url = req.body.image_url;
  if (req.file) {
    image_url = `/uploads/${req.file.filename}`;
  }
  
  try {
    await db.run(`
      UPDATE menu_items 
      SET name = ?, description = ?, price = ?, cogs = ?, category_id = ?, image_url = ?, prep_time = ?, status = ?, dietary_badges = ?, modifiers = ?
      WHERE id = ?
    `, [
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
    ]);
    
    const updatedItem = await db.get('SELECT * FROM menu_items WHERE id = ?', [itemId]);
    res.json(updatedItem);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update menu item' });
  }
});

app.delete('/api/restaurants/:id/menu/:itemId', authenticateToken, requireRestaurantAccess, async (req, res) => {
  const { itemId } = req.params;
  try {
    await db.run('DELETE FROM menu_items WHERE id = ?', [itemId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete menu item' });
  }
});

app.post('/api/restaurants/:id/categories', authenticateToken, requireRestaurantAccess, async (req, res) => {
  const { name } = req.body;
  const restaurant_id = req.params.id;
  
  try {
    const insertCategory = db.prepare('INSERT INTO menu_categories (restaurant_id, name) VALUES (?, ?)');
    const result = await insertCategory.run(restaurant_id, name);
    
    const newCategory = await db.get('SELECT * FROM menu_categories WHERE id = ?', [result.lastInsertRowid]);
    res.json(newCategory);
  } catch (error: any) {
    console.error('Error adding category:', error);
    res.status(500).json({ error: 'Failed to add category', details: error.message });
  }
});

app.get('/api/restaurants/:id/waiters', authenticateToken, requireRestaurantAccess, async (req, res) => {
  try {
    const waiters = await db.all("SELECT id, name, email, phone_number, restaurant_id FROM users WHERE restaurant_id = ? AND role = 'waiter'", [req.params.id]);
    res.json(waiters);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch waiters' });
  }
});

app.post('/api/restaurants/:id/waiters', authenticateToken, requireRestaurantAccess, async (req, res) => {
  const { name, email, password, phone_number, pin } = req.body;
  const restaurant_id = req.params.id;
  
  try {
    // Check waiter limits
    const restaurant = await db.get(`
      SELECT r.*, s.max_waiters 
      FROM restaurants r 
      LEFT JOIN subscription_plans s ON r.subscription_plan_id = s.id 
      WHERE r.id = ?
    `, [restaurant_id]) as any;

    if (restaurant && restaurant.max_waiters) {
      const waiterCount = await db.get(`
        SELECT COUNT(*) as count FROM users 
        WHERE restaurant_id = ? AND role = 'waiter'
      `, [restaurant_id]) as { count: number };

      if (waiterCount.count >= restaurant.max_waiters) {
        return res.status(403).json({ error: 'UpgradeRequired', message: 'Maximum number of waiters reached. Please upgrade your subscription.' });
      }
    }

    const finalEmail = email || `waiter_${Date.now()}_${Math.floor(Math.random() * 1000)}@quickdine.app`;
    const finalPassword = password || `waiter_${Date.now()}`;

    const insertWaiter = db.prepare("INSERT INTO users (name, email, password, phone_number, pin, role, restaurant_id) VALUES (?, ?, ?, ?, ?, 'waiter', ?)");
    const result = await insertWaiter.run(name, finalEmail, finalPassword, phone_number || null, pin || null, restaurant_id);
    
    const newWaiter = await db.get("SELECT id, name, email, phone_number, restaurant_id FROM users WHERE id = ?", [result.lastInsertRowid]);
    res.json(newWaiter);
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || (error.code === '23505') || (error.message && error.message.includes('duplicate key'))) {
      return res.status(400).json({ error: 'Email or phone number already exists' });
    }
    res.status(500).json({ error: 'Failed to add waiter' });
  }
});

app.delete('/api/restaurants/:id/waiters/:waiterId', authenticateToken, requireRestaurantAccess, async (req, res) => {
  const { waiterId } = req.params;
  try {
    await db.run("DELETE FROM users WHERE id = ? AND role = 'waiter'", [waiterId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete waiter' });
  }
});

app.patch('/api/restaurants/:id/settings', authenticateToken, requireRestaurantAccess, upload.single('logo'), async (req, res) => {
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
      const restaurant = await db.get(`
        SELECT s.can_use_online_payments 
        FROM restaurants r 
        LEFT JOIN subscription_plans s ON r.subscription_plan_id = s.id 
        WHERE r.id = ?
      `, [restaurant_id]) as any;

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

    const currentRestaurant = await db.get('SELECT account_number, bank_name, account_name FROM restaurants WHERE id = ?', [restaurant_id]) as any;
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
      const result = await db.run(`UPDATE restaurants SET ${updates.join(', ')} WHERE id = ?`, [...values]);
      // @ts-ignore
    if (result.changes === 0) {
        return res.status(404).json({ error: 'Restaurant not found' });
      }
    }
    
    const updatedRestaurant = await db.get('SELECT * FROM restaurants WHERE id = ?', [restaurant_id]);
    res.json(updatedRestaurant);
  } catch (error: any) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings: ' + error.message });
  }
});

app.post('/api/admin/restaurants', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const { name, owner_email, owner_password, business_type } = req.body;
  if (!name || !owner_email || !owner_password) {
    return res.status(400).json({ error: 'Name, owner email, and owner password are required' });
  }

  try {
    const defaultCurrency = await db.get('SELECT default_currency FROM platform_settings LIMIT 1') as any;
    const plan = await db.get("SELECT id FROM subscription_plans WHERE plan_name = 'Starter' LIMIT 1") as any;
    
    const transaction = db.transaction(async () => {
      const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [owner_email]);
      if (existingUser) throw new Error('Email already in use');

      const resId = (await db.run('INSERT INTO restaurants (name, status, currency, subscription_plan_id, subscription_status, business_type) VALUES (?, ?, ?, ?, ?, ?)', [
        name, 'Active', defaultCurrency ? defaultCurrency.default_currency : 'USD', plan ? plan.id : 1, 'Active', business_type || 'restaurant'
      ])).lastInsertRowid;
      
      await db.run('INSERT INTO users (email, password, role, restaurant_id, email_verified) VALUES (?, ?, ?, ?, 1)', [owner_email, owner_password, 'restaurant', resId]);
      
      return resId;
    });
    
    await transaction();
    res.json({ success: true, message: 'Restaurant created successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create restaurant' });
  }
});

app.post('/api/admin/restaurants/:id/reset-password', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const { new_password } = req.body;
  if (!new_password) return res.status(400).json({ error: 'New password is required' });

  try {
    const result = await db.run('UPDATE users SET password = ? WHERE restaurant_id = ? AND role = \'restaurant\'', [new_password, req.params.id]);
    // @ts-ignore
    if (result.changes > 0) {
      res.json({ success: true, message: 'Password reset successfully' });
    } else {
      res.status(404).json({ error: 'Owner account not found for this restaurant' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

app.delete('/api/admin/restaurants/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const restaurant_id = req.params.id;
  try {
    const transaction = db.transaction(async () => {
      // Delete child records first to maintain data integrity
      await db.run('DELETE FROM order_logs WHERE order_id IN (SELECT id FROM orders WHERE restaurant_id = ?)', [restaurant_id]);
      await db.run('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE restaurant_id = ?)', [restaurant_id]);
      await db.run('DELETE FROM waiter_calls WHERE restaurant_id = ?', [restaurant_id]);
      await db.run('DELETE FROM orders WHERE restaurant_id = ?', [restaurant_id]);
      await db.run('DELETE FROM menu_items WHERE category_id IN (SELECT id FROM menu_categories WHERE restaurant_id = ?)', [restaurant_id]);
      await db.run('DELETE FROM menu_categories WHERE restaurant_id = ?', [restaurant_id]);
      await db.run('DELETE FROM tables WHERE restaurant_id = ?', [restaurant_id]);
      await db.run('DELETE FROM user_logins WHERE user_id IN (SELECT id FROM users WHERE restaurant_id = ? AND role != \'admin\')', [restaurant_id]);
      await db.run('DELETE FROM users WHERE restaurant_id = ? AND role != \'admin\'', [restaurant_id]);
      const result = await db.run('DELETE FROM restaurants WHERE id = ?', [restaurant_id]);
      return result;
    });
    
    const result = await transaction();
    
    // @ts-ignore
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

app.patch('/api/admin/restaurants/:id/verify-account', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const { status } = req.body; // 0=Pending, 1=Verified, 2=Rejected
  const restaurant_id = parseInt(req.params.id);
  
  try {
    const transaction = db.transaction(async () => {
      const result = await db.run('UPDATE restaurants SET account_verified = ? WHERE id = ?', [status, restaurant_id]);
      // @ts-ignore
    if (result.changes === 0) {
        return false;
      }
      if (status === 1) {
        await db.run('UPDATE users SET email_verified = 1 WHERE restaurant_id = ? AND role = ?', [restaurant_id, 'restaurant']);
      }
      return true;
    });

    if (!transaction()) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Verify account error:', error);
    res.status(500).json({ error: 'Failed to update verification status' });
  }
});

app.patch('/api/orders/:id/waiter', authenticateToken, async (req, res) => {
  const { waiter_id } = req.body;
  const order_id = req.params.id;
  
  try {
    const order = await db.get("SELECT restaurant_id FROM orders WHERE id = ?", [order_id]) as any;
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    // Check if user has access to this restaurant
    if ((req as any).user?.role !== 'admin' && (req as any).user?.restaurant_id !== order.restaurant_id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await db.run("UPDATE orders SET waiter_id = ? WHERE id = ?", [waiter_id, order_id]);
    
    io.to(`restaurant_${order.restaurant_id}`).emit('order_waiter_assigned', { orderId: parseInt(order_id), waiter_id });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to assign waiter' });
  }
});

app.put('/api/restaurants/:id/categories/:categoryId', authenticateToken, requireRestaurantAccess, async (req, res) => {
  const { categoryId } = req.params;
  const { name } = req.body;
  try {
    await db.run('UPDATE menu_categories SET name = ? WHERE id = ?', [name, categoryId]);
    const updatedCategory = await db.get('SELECT * FROM menu_categories WHERE id = ?', [categoryId]);
    res.json(updatedCategory);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update category' });
  }
});

app.delete('/api/restaurants/:id/categories/:categoryId', authenticateToken, requireRestaurantAccess, async (req, res) => {
  const { categoryId } = req.params;
  try {
    // Check if category is in use
    const count = await db.get('SELECT COUNT(*) as count FROM menu_items WHERE category_id = ?', [categoryId]) as { count: number };
    if (count.count > 0) {
      return res.status(400).json({ error: 'Cannot delete category with existing menu items' });
    }
    
    await db.run('DELETE FROM menu_categories WHERE id = ?', [categoryId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

app.get('/api/restaurants/:id/tables', authenticateToken, requireRestaurantAccess, async (req, res) => {
  try {
    const tables = await db.all('SELECT * FROM tables WHERE restaurant_id = ?', [req.params.id]);
    res.json(tables);
  } catch (error) {
    console.error('Error fetching tables:', error);
    res.status(500).json({ error: 'Failed to fetch tables' });
  }
});

// -- Admin User Management --
app.get('/api/admin/users', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const users = await db.all(`
      SELECT u.id, u.email, u.role, u.name, u.phone_number, u.email_verified, r.name as restaurant_name
      FROM users u
      LEFT JOIN restaurants r ON u.restaurant_id = r.id
      ORDER BY u.id DESC
    `);
    res.json(users);
  } catch (error) {
    console.error('Error fetching admin users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/api/admin/users', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { email, password, role, name, restaurant_id } = req.body;
    
    // Check if email already exists
    const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const insert = db.prepare(`
      INSERT INTO users (email, password, role, name, restaurant_id, email_verified)
      VALUES (?, ?, ?, ?, ?, 1)
    `);
    
    const result = await insert.run(email, password, role, name || null, restaurant_id || null);
    const newUser = await db.get(`
      SELECT u.id, u.email, u.role, u.name, u.phone_number, u.email_verified, r.name as restaurant_name
      FROM users u
      LEFT JOIN restaurants r ON u.restaurant_id = r.id
      WHERE u.id = ?
    `, [result.lastInsertRowid]);
    
    res.json(newUser);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.put('/api/admin/users/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
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
    
    await db.run(query, [...params]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.delete('/api/admin/users/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Prevent self deletion
    if ((req as any).user?.id === parseInt(id)) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    await db.run('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

app.patch('/api/admin/users/:id/verify', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const transaction = db.transaction(async () => {
      const result = await db.run('UPDATE users SET email_verified = 1 WHERE id = ?', [id]);
      // @ts-ignore
    if (result.changes === 0) {
        return false;
      }
      
      const user = await db.get('SELECT role, restaurant_id FROM users WHERE id = ?', [id]) as any;
      if (user && user.restaurant_id) {
        await db.run("UPDATE restaurants SET account_verified = 1, status = 'Active' WHERE id = ?", [user.restaurant_id]);
      }
      
      return true;
    });

    if (!transaction()) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error verifying user:', error);
    res.status(500).json({ error: 'Failed to verify user: ' + error.message });
  }
});

app.post('/api/restaurants/:id/tables', authenticateToken, requireRestaurantAccess, async (req, res) => {
  const { table_number, address, is_room } = req.body;
  const restaurant_id = req.params.id;
  
  // Generate a unique token
  const qr_token = `table-${restaurant_id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  
  try {
    const insertTable = db.prepare('INSERT INTO tables (restaurant_id, table_number, qr_token, address, is_room) VALUES (?, ?, ?, ?, ?)');
    const result = await insertTable.run(restaurant_id, table_number, qr_token, address || null, is_room ? 1 : 0);
    
    const newTable = await db.get('SELECT * FROM tables WHERE id = ?', [result.lastInsertRowid]);
    res.json(newTable);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add table' });
  }
});

app.put('/api/restaurants/:id/tables/:tableId', authenticateToken, requireRestaurantAccess, async (req, res) => {
  const { table_number, address, is_room } = req.body;
  const { tableId } = req.params;
  
  try {
    await db.run('UPDATE tables SET table_number = ?, address = ?, is_room = ? WHERE id = ?', [table_number, address || null, is_room ? 1 : 0, tableId]);
    const updatedTable = await db.get('SELECT * FROM tables WHERE id = ?', [tableId]);
    res.json(updatedTable);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update table' });
  }
});

app.delete('/api/restaurants/:id/tables/:tableId', authenticateToken, requireRestaurantAccess, async (req, res) => {
  const { tableId } = req.params;
  
  try {
    await db.run('DELETE FROM tables WHERE id = ?', [tableId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete table' });
  }
});

app.get('/api/tables/validate/:token', async (req, res) => {
  try {
    const table = await db.get('SELECT * FROM tables WHERE qr_token = ?', [req.params.token]);
    if (!table) return res.status(404).json({ error: 'Invalid QR code' });
    res.json(table);
  } catch (error) {
    console.error('Error validating table token:', error);
    res.status(500).json({ error: 'Failed to validate table' });
  }
});

app.get('/api/orders/:id/track', async (req, res) => {
  try {
    const order = await db.get(`
      SELECT o.*, r.name as restaurant_name, r.currency as restaurant_currency
      FROM orders o
      JOIN restaurants r ON o.restaurant_id = r.id
      WHERE o.id = ?
    `, [req.params.id]) as any;
    
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    const items = await db.all('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    res.json({ order, items });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order details' });
  }
});

app.post('/api/orders', async (req, res) => {
  const { restaurant_id, table_id, items, total_amount, customer_email, customer_name, customer_address, special_instructions, payment_method, payment_status, paystack_reference, monnify_reference, flutterwave_reference, tip_amount, waiter_id, guest_last_name, room_number } = req.body;
  
  try {
    // Check GMV limits
    const restaurant = await db.get(`
      SELECT r.*, s.max_monthly_gmv, s.plan_name
      FROM restaurants r 
      LEFT JOIN subscription_plans s ON r.subscription_plan_id = s.id 
      WHERE r.id = ?
    `, [restaurant_id]) as any;

    if (restaurant && restaurant.max_monthly_gmv && restaurant.max_monthly_gmv > 0) {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const currentGmv = await db.get(`
        SELECT SUM(total_amount) as gmv FROM orders 
        WHERE restaurant_id = ? AND strftime('%Y-%m', created_at) = ? AND status != 'Cancelled'
      `, [restaurant_id, currentMonth]) as { gmv: number };

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
  
  const transaction = db.transaction(async () => {
    let final_table_id = Number(table_id);
    if (!final_table_id) {
      // Find or create 'Takeaway/Online' table
      const existingTable = await db.get('SELECT id FROM tables WHERE restaurant_id = ? AND table_number = ?', [restaurant_id, 'Takeaway/Online']) as any;
      if (existingTable) {
        final_table_id = existingTable.id;
      } else {
        const token = crypto.randomBytes(16).toString('hex');
        const newTable = await db.run('INSERT INTO tables (restaurant_id, table_number, qr_token) VALUES (?, ?, ?)', [restaurant_id, 'Takeaway/Online', token]);
        final_table_id = Number(newTable.lastInsertRowid);
      }
    }

    // Calculate tax splits
    const restaurant = await db.get('SELECT vat_rate FROM restaurants WHERE id = ?', [restaurant_id]) as any;
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

    const orderResult = await insertOrder.run(
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
    // @ts-ignore
    const orderId = orderResult.lastInsertRowid;
    
    for (const item of items) {
      await insertOrderItem.run(orderId, item.id, item.quantity, item.price, item.notes || null, item.modifiers ? JSON.stringify(item.modifiers) : null);
    }
    
    return orderId;
  });
  
  try {
    const orderId = await transaction();
    const newOrder = await db.get(`
      SELECT o.*, t.table_number 
      FROM orders o 
      LEFT JOIN tables t ON o.table_id = t.id 
      WHERE o.id = ?
    `, [orderId]) as any;
    
    const newOrderItems = await db.all(`
      SELECT oi.*, m.name 
      FROM order_items oi 
      JOIN menu_items m ON oi.menu_item_id = m.id 
      WHERE oi.order_id = ?
    `, [orderId]);
    
    // Notify restaurant via WebSocket
    io.to(`restaurant_${restaurant_id}`).emit('new_order', { order: newOrder, items: newOrderItems });
    
    if (newOrder.customer_email) {
      const parsedItems = newOrderItems as any[];
      const itemsList = parsedItems.map(i => `<li>${i.quantity}x ${i.name} - ₦${i.price}</li>`).join('');
      const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
        <h2 style="color: #333;">Order Received</h2>
        <p style="font-size: 16px; color: #555;">Hello ${newOrder.customer_name || 'Valued Customer'},</p>
        <p style="font-size: 16px; color: #555;">Thank you for your order! Your order <strong>#${newOrder.order_number}</strong> has been received and is being processed.</p>
        <h3>Order Details:</h3>
        <ul>${itemsList}</ul>
        <p><strong>Total: ₦${newOrder.total_amount}</strong></p>
        <p style="font-size: 14px; color: #999; margin-top: 20px;">We will notify you when your order status updates.</p>
      </div>
      `;
      sendPlatformEmail(newOrder.customer_email, `Order Confirmation: #${newOrder.order_number}`, emailHtml);
    }
    
    res.json({ success: true, orderId, orderNumber: order_number });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ error: 'Failed to create order', details: error instanceof Error ? error.message : String(error) });
  }
});

app.post('/api/restaurants/:id/tables/:tableId/call', async (req, res) => {
  const { type } = req.body; // 'call' or 'bill'
  const restaurant_id = req.params.id;
  const table_id = req.params.tableId;
  
  try {
    const actualTableId = table_id === 'simulate' ? 0 : table_id;
    const insertCall = db.prepare(`
      INSERT INTO waiter_calls (restaurant_id, table_id, type, status)
      VALUES (?, ?, ?, 'pending')
    `);
    const result = await insertCall.run(restaurant_id, actualTableId, type);
    
    const newCall = await db.get(`
      SELECT wc.*, t.table_number 
      FROM waiter_calls wc
      LEFT JOIN tables t ON wc.table_id = t.id
      WHERE wc.id = ?
    `, [result.lastInsertRowid]);
    
    // Notify waiters via socket
    io.to(`restaurant_${restaurant_id}`).emit('new_waiter_call', newCall);
    
    res.json(newCall);
  } catch (error) {
    console.error('Error creating waiter call:', error);
    res.status(500).json({ error: 'Failed to call waiter' });
  }
});

app.get('/api/restaurants/:id/waiter-calls', authenticateToken, requireRestaurantAccess, async (req, res) => {
  try {
    const calls = await db.all(`
      SELECT wc.*, t.table_number 
      FROM waiter_calls wc
      JOIN tables t ON wc.table_id = t.id
      WHERE wc.restaurant_id = ? AND wc.status = 'pending'
      ORDER BY wc.created_at ASC
    `, [req.params.id]);
    res.json(calls);
  } catch (error) {
    console.error('Error fetching waiter calls:', error);
    res.status(500).json({ error: 'Failed to fetch waiter calls' });
  }
});

app.put('/api/waiter-calls/:callId/resolve', authenticateToken, async (req, res) => {
  try {
    const call = await db.get('SELECT * FROM waiter_calls WHERE id = ?', [req.params.callId]) as any;
    if (!call) return res.status(404).json({ error: 'Call not found' });
    
    if ((req as any).user?.role !== 'admin' && (req as any).user?.restaurant_id !== call.restaurant_id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await db.run(`UPDATE waiter_calls SET status = 'resolved' WHERE id = ?`, [req.params.callId]);
    
    io.to(`restaurant_${call.restaurant_id}`).emit('waiter_call_resolved', call.id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error resolving waiter call:', error);
    res.status(500).json({ error: 'Failed to resolve waiter call' });
  }
});

app.get('/api/restaurants/:id/orders', authenticateToken, requireRestaurantAccess, async (req, res) => {
  try {
    const restaurant = await db.get(`
      SELECT r.*, s.analytics_retention_days 
      FROM restaurants r 
      LEFT JOIN subscription_plans s ON r.subscription_plan_id = s.id 
      WHERE r.id = ?
    `, [req.params.id]) as any;

    let retentionDays = 7; // Default
    if (restaurant && restaurant.analytics_retention_days) {
      retentionDays = restaurant.analytics_retention_days;
    }

    const orders = await db.all(`
      SELECT o.*, t.table_number, t.is_room, w.name as waiter_name
      FROM orders o 
      LEFT JOIN tables t ON o.table_id = t.id 
      LEFT JOIN users w ON o.waiter_id = w.id
      WHERE o.restaurant_id = ? AND o.created_at >= date('now', '-${retentionDays} days')
      ORDER BY o.created_at DESC
    `, [req.params.id]);
    
    const orderIds = orders.map((o: any) => o.id);
    let orderItems = [];
    if (orderIds.length > 0) {
      const placeholders = orderIds.map(() => '?').join(',');
      orderItems = await db.all(`
        SELECT oi.*, m.name 
        FROM order_items oi 
        JOIN menu_items m ON oi.menu_item_id = m.id 
        WHERE oi.order_id IN (${placeholders})
      `, [...orderIds]);
    }
    
    res.json({ orders, orderItems });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

app.patch('/api/orders/:id/payment_status', authenticateToken, async (req, res) => {
  const { payment_status } = req.body;
  const orderId = parseInt(req.params.id, 10);
  
  try {
    const order = await db.get('SELECT * FROM orders WHERE id = ?', [orderId]) as any;
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    if ((req as any).user?.role !== 'admin' && (req as any).user?.restaurant_id !== order.restaurant_id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await db.run('UPDATE orders SET payment_status = ? WHERE id = ?', [payment_status, orderId]);
    
    io.to(`order_${orderId}`).emit('order_payment_update', { orderId, payment_status });
    io.to(`restaurant_${order.restaurant_id}`).emit('order_payment_update', { orderId, payment_status });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to update payment status:', error);
    res.status(500).json({ error: 'Failed to update payment status' });
  }
});

app.patch('/api/orders/:id/confirm-transfer', authenticateToken, async (req, res) => {
  const orderId = parseInt(req.params.id, 10);
  try {
    const order = await db.get("SELECT * FROM orders WHERE id = ?", [orderId]) as any;
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    if ((req as any).user?.role !== 'admin' && (req as any).user?.restaurant_id !== order.restaurant_id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await db.run("UPDATE orders SET payment_status = 'Paid', status = 'Preparing' WHERE id = ?", [orderId]);
    io.to(`restaurant_${order.restaurant_id}`).emit('order_status_updated', { orderId, status: 'Preparing' });
    io.to(`order_${orderId}`).emit('order_status_update', { orderId, status: 'Preparing' });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/subscription-plans', async (req, res) => {
  try {
    const plans = await db.all('SELECT * FROM subscription_plans');
    res.json(plans);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/restaurants/:id/subscription', authenticateToken, requireRestaurantAccess, async (req, res) => {
  const { id } = req.params;
  const { plan_id, billing_cycle } = req.body;
  try {
    await db.run('UPDATE restaurants SET subscription_plan_id = ?, subscription_billing_cycle = ?, subscription_expiry_date = NULL WHERE id = ?', [plan_id, billing_cycle, id]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/restaurants/:id/analytics', authenticateToken, requireRestaurantAccess, async (req, res) => {
  const { id } = req.params;
  try {
    const { startDate, endDate } = req.query;
    let dateFilter = '';
    let params: any[] = [id];
    
    if (startDate && endDate) {
      dateFilter = 'AND created_at >= ? AND created_at <= ?';
      params.push(startDate, endDate + ' 23:59:59');
    }

    const totalOrders = await db.get(`SELECT COUNT(*) as count FROM orders WHERE restaurant_id = ? ${dateFilter}`, [...params]) as any;
    const totalRevenue = await db.get(`SELECT SUM(total_amount) as total FROM orders WHERE restaurant_id = ? AND status != 'Cancelled' ${dateFilter}`, [...params]) as any;
    
    let trendDateFilter = `created_at >= date('now', '-7 days')`;
    let trendParams: any[] = [id];
    if (startDate && endDate) {
      trendDateFilter = `created_at >= ? AND created_at <= ?`;
      trendParams.push(startDate, endDate + ' 23:59:59');
    }

    const recentRevenue = await db.all(`
      SELECT date(created_at) as date, SUM(total_amount) as revenue, COUNT(*) as orders
      FROM orders
      WHERE restaurant_id = ? AND ${trendDateFilter} AND status != 'Cancelled'
      GROUP BY date(created_at)
      ORDER BY date(created_at) ASC
    `, [...trendParams]);

    const topItems = await db.all(`
      SELECT m.name, SUM(oi.quantity) as total_sold
      FROM order_items oi
      JOIN menu_items m ON oi.menu_item_id = m.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.restaurant_id = ? AND o.status != 'Cancelled' ${dateFilter.replace(/created_at/g, 'o.created_at')}
      GROUP BY m.id
      ORDER BY total_sold DESC
      LIMIT 5
    `, [...params]);

    const aov = await db.get(`SELECT AVG(total_amount) as average FROM orders WHERE restaurant_id = ? AND status != 'Cancelled' ${dateFilter}`, [...params]) as any;

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

app.get('/api/restaurants/:id/z-report', authenticateToken, requireRestaurantAccess, async (req, res) => {
  const { id } = req.params;
  const { date } = req.query; // YYYY-MM-DD
  
  try {
    const restaurant = await db.get('SELECT * FROM restaurants WHERE id = ?', [id]) as any;
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

    const targetDate = date || new Date().toISOString().slice(0, 10);
    
    const orders = await db.all(`
      SELECT total_amount, subtotal, vat_amount, state_tax_amount, service_charge, tip_amount, payment_method 
      FROM orders 
      WHERE restaurant_id = ? AND date(created_at) = ? AND status != 'Cancelled'
    `, [id, targetDate]) as any[];

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

app.get('/api/restaurants/:id/tax-report.csv', authenticateToken, requireRestaurantAccess, async (req, res) => {
  const { id } = req.params;
  const { month } = req.query; // YYYY-MM
  
  try {
    const restaurant = await db.get(`
      SELECT r.*, s.can_export_tax_reports 
      FROM restaurants r 
      LEFT JOIN subscription_plans s ON r.subscription_plan_id = s.id 
      WHERE r.id = ?
    `, [id]) as any;

    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    if (!restaurant.can_export_tax_reports) {
      return res.status(403).json({ error: 'UpgradeRequired', message: 'Tax exports are only available on Pro and Premium plans.' });
    }

    const targetMonth = month || new Date().toISOString().slice(0, 7);
    const orders = await db.all(`
      SELECT * FROM orders 
      WHERE restaurant_id = ? AND strftime('%Y-%m', created_at) = ? AND status != 'Cancelled'
    `, [id, targetMonth]) as any[];
    
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



app.patch('/api/orders/:id/discount', authenticateToken, async (req, res) => {
  const { discount_amount, reason } = req.body;
  const orderId = parseInt(req.params.id, 10);
  
  const order = await db.get('SELECT * FROM orders WHERE id = ?', [orderId]) as any;
  if (!order) return res.status(404).json({ error: 'Order not found' });
  
  if ((req as any).user?.role !== 'admin' && (req as any).user?.restaurant_id !== order.restaurant_id) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const discount = parseFloat(discount_amount);
  if (isNaN(discount) || discount < 0 || discount > order.total_amount) {
    return res.status(400).json({ error: 'Invalid discount amount' });
  }

  const newTotal = order.total_amount - discount;

  await db.run('UPDATE orders SET discount_amount = ?, discount_reason = ?, total_amount = ? WHERE id = ?', [discount, reason, newTotal, orderId]);
  const updatedOrder = await db.get('SELECT * FROM orders WHERE id = ?', [orderId]) as any;
  
  try {
    await db.run('INSERT INTO order_logs (order_id, staff_id, action, reason, previous_total, new_total) VALUES (?, ?, ?, ?, ?, ?)', [
      orderId,
      (req as any).user?.id || null,
      'DISCOUNT',
      reason || `Applied discount of ${discount}`,
      order.total_amount,
      newTotal
    ]);
  } catch (e) {
    console.error('Failed to log discount:', e);
  }

  io.to(`restaurant_${order.restaurant_id}`).emit('order_updated', updatedOrder);
  io.to(`order_${orderId}`).emit('order_updated', updatedOrder);
  
  res.json(updatedOrder);
});

app.patch('/api/orders/:id/status', authenticateToken, async (req, res) => {
  const { status, reason } = req.body;
  const orderId = parseInt(req.params.id, 10);
  
  const order = await db.get('SELECT * FROM orders WHERE id = ?', [orderId]) as any;
  if (!order) return res.status(404).json({ error: 'Order not found' });
  
  if ((req as any).user?.role !== 'admin' && (req as any).user?.restaurant_id !== order.restaurant_id) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  await db.run('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);
  const updatedOrder = await db.get('SELECT * FROM orders WHERE id = ?', [orderId]) as any;
  
  if (status === 'Cancelled' || status === 'Voided') {
    try {
      await db.run('INSERT INTO order_logs (order_id, staff_id, action, reason, previous_total, new_total) VALUES (?, ?, ?, ?, ?, ?)', [
        orderId,
        (req as any).user?.id || null,
        status.toUpperCase(),
        reason || 'Status changed to ' + status,
        order.total_amount,
        order.total_amount
      ]);
    } catch (e) {
      console.error('Error logging order status change:', e);
    }
  }

  // Notify customer via WebSocket
  io.to(`order_${orderId}`).emit('order_status_update', { orderId, status });
  io.to(`restaurant_${updatedOrder.restaurant_id}`).emit('order_status_update', { orderId, status });
  
  if (updatedOrder.customer_email) {
    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
        <h2 style="color: #333;">Order Status Update</h2>
        <p style="font-size: 16px; color: #555;">Hello,</p>
        <p style="font-size: 16px; color: #555;">Your order <strong>#${updatedOrder.order_number || updatedOrder.id}</strong> is now <strong>${status}</strong>.</p>
        <p style="font-size: 16px; color: #555;">Thank you for using QuickDine!</p>
      </div>
    `;
    sendPlatformEmail(updatedOrder.customer_email, `Order Update: #${updatedOrder.order_number || updatedOrder.id}`, emailHtml);
  }
  
  res.json({ success: true, status });
});

app.get('/api/customer/orders', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    
    const orders = await db.all(`
      SELECT o.*, t.table_number, t.is_room, r.name as restaurant_name, r.currency as restaurant_currency
      FROM orders o 
      LEFT JOIN tables t ON o.table_id = t.id 
      JOIN restaurants r ON o.restaurant_id = r.id
      WHERE o.customer_email = ? 
      ORDER BY o.created_at DESC
    `, [email]);
    
    const orderIds = orders.map((o: any) => o.id);
    let orderItems = [];
    if (orderIds.length > 0) {
      const placeholders = orderIds.map(() => '?').join(',');
      orderItems = await db.all(`
        SELECT oi.*, m.name 
        FROM order_items oi 
        JOIN menu_items m ON oi.menu_item_id = m.id 
        WHERE oi.order_id IN (${placeholders})
      `, [...orderIds]);
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
  await initializeDatabase();
  app.use('/uploads', express.static(path.join(rootDir, 'uploads')));

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(rootDir, 'dist');
    app.use(express.static(distPath));
    app.get('*', async (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!process.env.VERCEL) {
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Global Error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

if (!process.env.VERCEL) {
  startServer();
}

export default app;
