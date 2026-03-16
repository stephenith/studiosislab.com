import admin from "firebase-admin";

let app: admin.app.App;

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (!projectId || !clientEmail || !privateKeyRaw || !bucket) {
    // eslint-disable-next-line no-console
    console.warn(
      "[firebaseAdmin] Missing Firebase admin env vars. " +
        "Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET."
    );
  }

  const privateKey = privateKeyRaw?.replace(/\\n/g, "\n");

  app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
    storageBucket: bucket,
  });
} else {
  app = admin.app();
}

export const adminApp = app;
export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
export const adminStorage = admin.storage().bucket();

