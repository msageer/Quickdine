import express from 'express';
import { db } from '../src/firebaseAdmin.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const querySnapshot = await db.collection('restaurants').get();
    const restaurants: any[] = [];
    querySnapshot.forEach(doc => {
      restaurants.push({ id: doc.id, ...doc.data() });
    });
    
    // You could fetch platform_settings and append them just like before
    res.json(restaurants);
  } catch (error) {
    console.error('Error fetching restaurants:', error);
    res.status(500).json({ error: 'Failed to fetch restaurants' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const docRef = db.collection('restaurants').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error('Error fetching restaurant:', error);
    res.status(500).json({ error: 'Failed to fetch restaurant' });
  }
});

export default router;
