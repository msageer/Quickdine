import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db, authAdmin } from '../src/firebaseAdmin.js'; // Adjust path if needed

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Mock/implement setting fetching
const getSettings = async () => {
  const snapshot = await db.collection('platform_settings').limit(1).get();
  return snapshot.empty ? { default_currency: 'USD' } : snapshot.docs[0].data();
};

const getProfessionalPlanId = async () => {
  const snapshot = await db.collection('subscription_plans').where('plan_name', '==', 'Professional').limit(1).get();
  return snapshot.empty ? '2' : snapshot.docs[0].id;
};

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const usersRef = await db.collection('users').where('email', '==', email).where('password', '==', password).get();
    if (usersRef.empty) return res.status(401).json({ error: 'Invalid credentials' });
    
    const user = { id: usersRef.docs[0].id, ...usersRef.docs[0].data() } as any;
    
    if (user.role === 'restaurant' && !user.email_verified) {
      return res.status(403).json({ error: 'Please verify your email before logging in. Check your inbox for the verification link.' });
    }
    
    await db.collection('user_logins').add({ user_id: user.id, login_time: new Date().toISOString() });
    
    const token = jwt.sign({ id: user.id, role: user.role, restaurant_id: user.restaurant_id }, JWT_SECRET, { expiresIn: '48h' });
    res.json({ success: true, user, token });
  } catch (error) {
    res.status(500).json({ error: 'Login parsing error' });
  }
});

router.post('/waiter-login', async (req, res) => {
  const { phone_number, pin } = req.body;
  try {
    const usersRef = await db.collection('users')
                             .where('phone_number', '==', phone_number)
                             .where('pin', '==', pin)
                             .where('role', '==', 'waiter').get();
    if (usersRef.empty) return res.status(401).json({ error: 'Invalid phone number or PIN' });
    
    const user = { id: usersRef.docs[0].id, ...usersRef.docs[0].data() } as any;
    
    await db.collection('user_logins').add({ user_id: user.id, login_time: new Date().toISOString() });
    
    const token = jwt.sign({ id: user.id, role: user.role, restaurant_id: user.restaurant_id }, JWT_SECRET, { expiresIn: '48h' });
    res.json({ success: true, user, token });
  } catch(error) {
    res.status(500).json({ error: 'Waiter Login error' });
  }
});

router.post('/signup', async (req, res) => {
  const { email, password, restaurantName, businessType } = req.body;
  try {
    // Check if user exists
    const existing = await db.collection('users').where('email', '==', email).get();
    if (!existing.empty) return res.status(400).json({ error: 'Email already in use' });

    const settings = await getSettings();
    const planId = await getProfessionalPlanId();
    
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 1);
    
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date();
    verificationExpires.setHours(verificationExpires.getHours() + 24);

    const restaurantRef = db.collection('restaurants').doc();
    await restaurantRef.set({
      name: restaurantName, status: 'Pending', currency: settings.default_currency || 'USD',
      subscription_plan_id: planId, subscription_status: 'Active',
      subscription_expiry_date: expiryDate.toISOString(), business_type: businessType || 'restaurant', created_at: new Date().toISOString()
    });

    const userRef = db.collection('users').doc();
    await userRef.set({
      email, password, role: 'restaurant', restaurant_id: restaurantRef.id,
      verification_token: verificationToken, verification_expires: verificationExpires.toISOString()
    });

    console.log(`[EMAIL MOCK] Verification link for ${email}: /verify-email?token=${verificationToken}`);
    res.json({ success: true, message: 'Signup successful. Please check your email to verify your account.' });
  } catch (error) {
    res.status(500).json({ error: 'Signup failed. Internal error.' });
  }
});

router.post('/verify-email', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Verification token is required' });
  
  try {
    const userRef = await db.collection('users').where('verification_token', '==', token).get();
    if (userRef.empty) return res.status(400).json({ error: 'Invalid verification token' });
    
    const userDoc = userRef.docs[0];
    const user = userDoc.data();
    
    if (new Date(user.verification_expires) < new Date()) {
      return res.status(400).json({ error: 'Verification token has expired' });
    }
    
    await db.collection('users').doc(userDoc.id).update({
      email_verified: 1, verification_token: null, verification_expires: null
    });
    
    res.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Failed to verify email' });
  }
});

export default router;
