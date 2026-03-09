import admin from "firebase-admin";

let app: admin.app.App | null = null;

function getAdminApp(): admin.app.App {
  if (app) return app;

  if (!admin.apps.length) {
    // Prefer application default credentials (GOOGLE_APPLICATION_CREDENTIALS).
    app = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  } else {
    app = admin.app();
  }

  return app!;
}

export const adminApp = getAdminApp();
export const adminAuth = adminApp.auth();
export const adminDb = adminApp.firestore();
export const adminStorage = adminApp.storage();

