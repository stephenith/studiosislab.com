import { createStore, del, entries, get, set } from "idb-keyval";

export type LocalAssetRecord = {
  assetId: string;
  uid: string;
  docId: string;
  blob: Blob;
  contentType: string;
  createdAt: number;
  lastAccessAt: number;
};

const DB_NAME = "slb-local-assets";
const STORE_NAME = "assets";
const assetStore = createStore(DB_NAME, STORE_NAME);

function buildAssetId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function saveAsset(params: {
  uid: string;
  docId: string;
  file: File | Blob;
}): Promise<string> {
  const { uid, docId, file } = params;
  if (!(file instanceof File || file instanceof Blob)) {
    throw new Error("Expected File or Blob for local asset.");
  }
  const now = Date.now();
  const assetId = buildAssetId();
  const record: LocalAssetRecord = {
    assetId,
    uid: String(uid || "anonymous"),
    docId: String(docId || "draft"),
    blob: file,
    contentType: String(file.type || "application/octet-stream"),
    createdAt: now,
    lastAccessAt: now,
  };
  await set(assetId, record, assetStore);
  return assetId;
}

export async function getAsset(assetId: string): Promise<Blob | null> {
  if (!assetId) return null;
  const row = (await get(assetId, assetStore)) as LocalAssetRecord | undefined;
  if (!row || !(row.blob instanceof Blob)) return null;
  return row.blob;
}

export async function updateLastAccess(assetId: string): Promise<void> {
  if (!assetId) return;
  const row = (await get(assetId, assetStore)) as LocalAssetRecord | undefined;
  if (!row) return;
  row.lastAccessAt = Date.now();
  await set(assetId, row, assetStore);
}

export async function deleteOldAssets(ttlDays: number): Promise<number> {
  const ttlMs = Math.max(1, Number(ttlDays || 0)) * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - ttlMs;
  const all = (await entries(assetStore)) as Array<[string, LocalAssetRecord]>;
  let removed = 0;
  await Promise.all(
    all.map(async ([key, value]) => {
      const ts = Number(value?.lastAccessAt || value?.createdAt || 0);
      if (!ts || ts >= cutoff) return;
      await del(key, assetStore);
      removed += 1;
    })
  );
  return removed;
}

export async function listAssets(uid: string): Promise<LocalAssetRecord[]> {
  const all = (await entries(assetStore)) as Array<[string, LocalAssetRecord]>;
  return all
    .map(([, value]) => value as LocalAssetRecord)
    .filter((item) => item.uid === uid)
    .sort((a, b) => b.lastAccessAt - a.lastAccessAt);
}
