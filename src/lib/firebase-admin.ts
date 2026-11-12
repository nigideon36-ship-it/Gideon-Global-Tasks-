import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

let firebaseConfig: any = {};
try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (e) {
  console.warn('Could not read firebase-applet-config.json', e);
}

if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId || process.env.FIREBASE_PROJECT_ID || 'jovial-loader-fvc14',
  });
}

export const adminAuth = getAuth();
