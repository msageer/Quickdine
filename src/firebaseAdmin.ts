import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from './firebase-applet-config.json' with { type: "json" };

const apps = getApps();

if (!apps.length) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

export const db = getFirestore();
export const authAdmin = getAuth();
