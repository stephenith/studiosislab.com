import admin from "firebase-admin";

const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim();

function requireAdminEnv(): void {
  const missing: string[] = [];
  if (!projectId) missing.push("FIREBASE_PROJECT_ID");
  if (!clientEmail) missing.push("FIREBASE_CLIENT_EMAIL");
  if (!privateKeyRaw?.trim()) missing.push("FIREBASE_PRIVATE_KEY");
  if (!bucket) missing.push("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
  if (missing.length) {
    throw new Error(
      `Missing Firebase Admin env vars: ${missing.join(", ")}. ` +
        "Set them before using server APIs that require Firebase Admin."
    );
  }
}

let app: admin.app.App;

if (!admin.apps.length) {
  requireAdminEnv();

  const privateKey = privateKeyRaw!.replace(/\\n/g, "\n");

  app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: projectId!,
      clientEmail: clientEmail!,
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
