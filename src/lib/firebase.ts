import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const missingFirebaseClientEnv: string[] = [];
if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim()) {
  missingFirebaseClientEnv.push("NEXT_PUBLIC_FIREBASE_API_KEY");
}
if (!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim()) {
  missingFirebaseClientEnv.push("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
}
if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim()) {
  missingFirebaseClientEnv.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
}
if (!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim()) {
  missingFirebaseClientEnv.push("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID");
}
if (!process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim()) {
  missingFirebaseClientEnv.push("NEXT_PUBLIC_FIREBASE_APP_ID");
}

if (missingFirebaseClientEnv.length) {
  throw new Error(
    `Missing Firebase client env vars: ${missingFirebaseClientEnv.join(", ")}`
  );
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: "studiosislab.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const storage = getStorage(app);

let _db: ReturnType<typeof getFirestore> | null = null;
function initDb() {
  if (_db) return _db;
  try {
    _db = initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      experimentalForceLongPolling: true,
    });
  } catch {
    _db = getFirestore(app);
  }
  return _db;
}
export const db = initDb();
