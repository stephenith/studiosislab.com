/**
 * DESTRUCTIVE maintenance script:
 * Deletes ALL documents in Firestore `esign_documents` (and their `invites` subcollection),
 * plus related objects in Firebase Storage under:
 * - esign/original/{documentId}.{pdf|docx|doc}
 * - signed_esign/{ownerUid}/{documentId}/** (prefix delete)
 *
 * Run (from repo root):
 *   npx ts-node --transpile-only scripts/clean-esign-all.ts
 *
 * Requires the same Firebase Admin env vars as the app:
 * - FIREBASE_PROJECT_ID
 * - FIREBASE_CLIENT_EMAIL
 * - FIREBASE_PRIVATE_KEY
 * - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
 */

import type { Query } from "firebase-admin/firestore";
import { adminDb, adminStorage } from "../src/lib/firebaseAdmin";

type ErrorEntry = { documentId: string; stage: string; message: string };

function logError(errors: ErrorEntry[], documentId: string, stage: string, err: unknown) {
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err);
  errors.push({ documentId, stage, message });
  // eslint-disable-next-line no-console
  console.error(`[clean-esign] ERROR doc=${documentId} stage=${stage}: ${message}`);
}

async function deleteQueryInBatches(query: Query): Promise<number> {
  let deleted = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await query.limit(500).get();
    if (snap.empty) return deleted;

    const batch = adminDb.batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    deleted += snap.size;
  }
}

async function deleteInvitesSubcollection(documentId: string, errors: ErrorEntry[]): Promise<number> {
  try {
    const invitesCol = adminDb.collection("esign_documents").doc(documentId).collection("invites");
    return await deleteQueryInBatches(invitesCol);
  } catch (e) {
    logError(errors, documentId, "delete_invites_subcollection", e);
    return 0;
  }
}

async function deleteOriginalStorageObjects(
  documentId: string,
  errors: ErrorEntry[]
): Promise<number> {
  const exts = [".pdf", ".docx", ".doc"] as const;
  let deleted = 0;

  for (const ext of exts) {
    const objectPath = `esign/original/${documentId}${ext}`;
    try {
      const file = adminStorage.file(objectPath);
      const [exists] = await file.exists();
      if (!exists) continue;
      await file.delete();
      deleted += 1;
    } catch (e) {
      logError(errors, documentId, `delete_original_storage:${objectPath}`, e);
    }
  }

  return deleted;
}

async function deleteSignedFolderPrefix(
  documentId: string,
  ownerUid: string | undefined,
  errors: ErrorEntry[]
): Promise<number> {
  if (!ownerUid) {
    // eslint-disable-next-line no-console
    console.warn(
      `[clean-esign] WARN doc=${documentId}: missing ownerUid; skipping signed_esign/{ownerUid}/${documentId}/ prefix delete`
    );
    return 0;
  }

  const prefix = `signed_esign/${ownerUid}/${documentId}/`;
  let deleted = 0;

  try {
    const [files] = await adminStorage.getFiles({ prefix });
    for (const f of files) {
      try {
        await f.delete();
        deleted += 1;
      } catch (e) {
        logError(errors, documentId, `delete_signed_storage:${f.name}`, e);
      }
    }
  } catch (e) {
    logError(errors, documentId, `list_signed_storage:${prefix}`, e);
  }

  return deleted;
}

async function main() {
  const errors: ErrorEntry[] = [];

  let documentsSeen = 0;
  let documentsDeleted = 0;
  let inviteDocsDeleted = 0;
  let storageObjectsDeleted = 0;

  // eslint-disable-next-line no-console
  console.log("[clean-esign] Starting cleanup of Firestore `esign_documents` + related Storage objects…");

  const snap = await adminDb.collection("esign_documents").get();
  documentsSeen = snap.docs.length;
  // eslint-disable-next-line no-console
  console.log(`[clean-esign] Found ${documentsSeen} esign_documents rows`);

  for (const doc of snap.docs) {
    const documentId = doc.id;
    const data = doc.data() as Record<string, unknown>;
    const ownerUid = typeof data.ownerUid === "string" ? data.ownerUid : undefined;

    // Storage deletes (best-effort; never stop)
    storageObjectsDeleted += await deleteOriginalStorageObjects(documentId, errors);
    storageObjectsDeleted += await deleteSignedFolderPrefix(documentId, ownerUid, errors);

    // Firestore deletes
    inviteDocsDeleted += await deleteInvitesSubcollection(documentId, errors);

    try {
      await adminDb.collection("esign_documents").doc(documentId).delete();
      documentsDeleted += 1;
    } catch (e) {
      logError(errors, documentId, "delete_esign_document", e);
    }
  }

  // eslint-disable-next-line no-console
  console.log("[clean-esign] DONE");
  // eslint-disable-next-line no-console
  console.log(`[clean-esign] documentsSeen=${documentsSeen}`);
  // eslint-disable-next-line no-console
  console.log(`[clean-esign] documentsDeleted=${documentsDeleted}`);
  // eslint-disable-next-line no-console
  console.log(`[clean-esign] storageObjectsDeleted=${storageObjectsDeleted}`);
  // eslint-disable-next-line no-console
  console.log(`[clean-esign] inviteDocsDeleted=${inviteDocsDeleted}`);
  // eslint-disable-next-line no-console
  console.log(`[clean-esign] errors=${errors.length}`);

  if (errors.length) {
    // eslint-disable-next-line no-console
    console.log("[clean-esign] Error details (first 50):");
    for (const e of errors.slice(0, 50)) {
      // eslint-disable-next-line no-console
      console.log(`- doc=${e.documentId} stage=${e.stage}: ${e.message}`);
    }
    if (errors.length > 50) {
      // eslint-disable-next-line no-console
      console.log(`… ${errors.length - 50} more errors omitted`);
    }
  }
}

void main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("[clean-esign] FATAL:", e);
  process.exitCode = 1;
});
