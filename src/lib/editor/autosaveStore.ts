export type AutosaveDraftRecord = {
  key: string;
  snapshot: any;
  hash: string;
  revision: number;
  updatedAt: number;
  history?: {
    undo: any[];
    redo: any[];
  };
};

const DB_NAME = "slb-editor-autosave";
const STORE_NAME = "drafts";
const DB_VERSION = 1;

let openDbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (openDbPromise) return openDbPromise;
  openDbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"));
  });
  return openDbPromise;
}

export async function saveAutosaveDraft(record: AutosaveDraftRecord): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Failed to store autosave draft"));
    tx.onabort = () => reject(tx.error || new Error("Autosave draft write aborted"));
  });
}

export async function readAutosaveDraft(key: string): Promise<AutosaveDraftRecord | null> {
  const db = await openDb();
  return await new Promise<AutosaveDraftRecord | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve((request.result as AutosaveDraftRecord | undefined) || null);
    request.onerror = () => reject(request.error || new Error("Failed to read autosave draft"));
  });
}

export async function deleteAutosaveDraft(key: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Failed to delete autosave draft"));
    tx.onabort = () => reject(tx.error || new Error("Autosave draft delete aborted"));
  });
}
