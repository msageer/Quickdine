import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json'; // adjust path if needed

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Use firestoreDatabaseId if specified, otherwise default
const dbId = firebaseConfig.firestoreDatabaseId;
export const db = dbId ? getFirestore(app, dbId) : getFirestore(app);
export const storage = getStorage(app);
