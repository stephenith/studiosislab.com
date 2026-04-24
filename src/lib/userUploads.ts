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
  uploadBytesResumable,
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
  file: File;
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

export async function uploadUserImage({ uid, file, onProgress }: UploadUserImageParams) {
  const assetId = buildAssetId();
  const fileName = file.name || "upload";
  const path = `users/${uid}/uploads/${assetId}/${fileName}`;
  const fileRef = storageRef(storage, path);
  let uploaded = false;

  try {
    console.log("[upload] uid:", uid);
    const task = uploadBytesResumable(fileRef, file, {
      contentType: file.type || "application/octet-stream",
    });

    await new Promise<void>((resolve, reject) => {
      task.on(
        "state_changed",
        (snapshot) => {
          if (!onProgress) return;
          const total = snapshot.totalBytes || 1;
          const percent = Math.min(100, Math.round((snapshot.bytesTransferred / total) * 100));
          onProgress(percent, snapshot);
        },
        reject,
        () => resolve()
      );
    });

    uploaded = true;
    const downloadURL = await getDownloadURL(task.snapshot.ref);
    const uploadRef = doc(db, "users", uid, "uploads", assetId);
    await setDoc(uploadRef, {
      uid,
      storagePath: path,
      downloadURL,
      name: file.name || "upload",
      size: file.size ?? 0,
      contentType: file.type || "application/octet-stream",
      status: "ready",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    console.log("[upload] success:", downloadURL);
    return { assetId, downloadURL };
  } catch (err) {
    if (uploaded) {
      try {
        await deleteObject(fileRef);
      } catch (cleanupErr) {
        console.error("[upload] cleanup failed:", cleanupErr);
      }
    }
    console.error("[upload] failed:", err);
    throw err;
  }
}

export async function listUserUploads({ uid, limitCount = 50 }: ListUserUploadsParams) {
  const uploadsCol = collection(db, "users", uid, "uploads");
  const q = query(uploadsCol, orderBy("createdAt", "desc"), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<UserUpload, "id">) }));
}
