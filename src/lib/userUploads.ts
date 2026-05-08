import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
  uploadBytesResumable,
  type StorageReference,
  type UploadMetadata,
  type UploadTaskSnapshot,
} from "firebase/storage";
import { db, storage } from "@/lib/firebase";

export type UserUpload = {
  id: string;
  uid: string;
  storagePath: string;
  downloadURL: string;
  name: string;
  size: number;
  contentType: string;
  status: "ready";
  createdAt: unknown;
  updatedAt: unknown;
};

type UploadUserImageParams = {
  uid: string;
  file: File | Blob;
  onProgress?: (percent: number, snapshot: UploadTaskSnapshot) => void;
};

type ListUserUploadsParams = {
  uid: string;
  limitCount?: number;
};

const buildAssetId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function sanitizeFileName(name: string): string {
  const raw = String(name || "upload").trim();
  const cleaned = raw.replace(/[\\/\u0000-\u001f\u007f]+/g, "_");
  const bounded = cleaned.slice(0, 180);
  return bounded || "upload";
}

function inferImageTypeFromName(name: string): string | null {
  const lower = String(name || "").toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".bmp")) return "image/bmp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".heic")) return "image/heic";
  if (lower.endsWith(".heif")) return "image/heif";
  return null;
}

function resolveImageContentType(fileOrBlob: File | Blob, fileName: string): string | null {
  const fromBlob = String(fileOrBlob.type || "").toLowerCase();
  if (fromBlob.startsWith("image/")) return fromBlob;
  return inferImageTypeFromName(fileName);
}

function normalizeUploadInput(fileOrBlob: File | Blob): {
  blob: Blob;
  fileName: string;
  size: number;
} {
  if (fileOrBlob instanceof File) {
    return {
      blob: fileOrBlob,
      fileName: sanitizeFileName(fileOrBlob.name || "upload"),
      size: Number(fileOrBlob.size || 0),
    };
  }

  const ext =
    fileOrBlob.type === "image/jpeg"
      ? ".jpg"
      : fileOrBlob.type === "image/png"
        ? ".png"
        : fileOrBlob.type === "image/webp"
          ? ".webp"
          : fileOrBlob.type === "image/gif"
            ? ".gif"
            : fileOrBlob.type === "image/svg+xml"
              ? ".svg"
              : "";

  return {
    blob: fileOrBlob,
    fileName: sanitizeFileName(`upload-${Date.now()}${ext}`),
    size: Number(fileOrBlob.size || 0),
  };
}

function toErrorDetails(err: any) {
  return {
    code: err?.code,
    name: err?.name,
    message: err?.message,
    serverResponse: err?.serverResponse,
    customData: err?.customData,
    status: err?.status_,
  };
}

function isResumableUnknown400(err: any): boolean {
  const code = err?.code;
  const msg = String(err?.message || "");
  const status = err?.status_ ?? err?.customData?.status ?? null;
  const body = err?.serverResponse ?? err?.customData?.serverResponse ?? "";

  return (
    code === "storage/unknown" &&
    (status === 400 || msg.includes("400")) &&
    (body == null || String(body).trim() === "")
  );
}

async function uploadWithResumableFallback(params: {
  ref: StorageReference;
  data: Blob | File;
  metadata: UploadMetadata;
  onProgress?: (percent: number, snapshot: UploadTaskSnapshot) => void;
}) {
  const { ref, data, metadata, onProgress } = params;

  try {
    const task = uploadBytesResumable(ref, data, metadata);

    await new Promise<void>((resolve, reject) => {
      task.on(
        "state_changed",
        (snapshot) => {
          if (!onProgress) return;

          const total = snapshot.totalBytes || 1;
          const percent = Math.min(
            100,
            Math.round((snapshot.bytesTransferred / total) * 100)
          );

          onProgress(percent, snapshot);
        },
        reject,
        resolve
      );
    });

    return task.snapshot;
  } catch (err: any) {
    if (!isResumableUnknown400(err)) throw err;

    console.warn("[upload fallback triggered]", err);

    const snap = await uploadBytes(ref, data, metadata);

    if (onProgress) {
      onProgress(100, snap as unknown as UploadTaskSnapshot);
    }

    return snap;
  }
}

export async function uploadUserImage({ uid, file, onProgress }: UploadUserImageParams) {
  if (!uid) {
    throw new Error("Missing uid for upload.");
  }
  if (!(file instanceof File || file instanceof Blob)) {
    throw new Error("Invalid upload input: expected File or Blob.");
  }

  const { blob, fileName, size } = normalizeUploadInput(file);
  if (size <= 0) {
    throw new Error("Selected file is empty.");
  }
  if (size > MAX_UPLOAD_BYTES) {
    throw new Error("Image exceeds 10MB size limit.");
  }

  const contentType = resolveImageContentType(file, fileName);
  if (!contentType || !contentType.startsWith("image/")) {
    throw new Error("Unsupported file type. Please upload a valid image.");
  }

  const assetId = buildAssetId();
  const path = `users/${uid}/uploads/${assetId}/${fileName}`;
  const fileRef = storageRef(storage, path);
  let uploaded = false;

  try {
    const metadata = { contentType };

    const snapshot = await uploadWithResumableFallback({
      ref: fileRef,
      data: blob,
      metadata,
      onProgress,
    });

    uploaded = true;
    const downloadURL = await getDownloadURL(snapshot.ref);
    const uploadRef = doc(db, "users", uid, "uploads", assetId);
    await setDoc(uploadRef, {
      uid,
      storagePath: path,
      downloadURL,
      name: fileName,
      size: Math.trunc(size),
      contentType,
      status: "ready",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { assetId, downloadURL };
  } catch (err: any) {
    if (uploaded) {
      try {
        await deleteObject(fileRef);
      } catch (cleanupErr: any) {
        console.error("[upload] cleanup failed", cleanupErr, cleanupErr?.serverResponse);
      }
    }
    console.error("[upload] failed", err, err?.serverResponse, toErrorDetails(err));
    throw err;
  }
}

export async function listUserUploads({ uid, limitCount = 50 }: ListUserUploadsParams) {
  const uploadsCol = collection(db, "users", uid, "uploads");
  const q = query(uploadsCol, orderBy("createdAt", "desc"), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<UserUpload, "id">) }));
}
