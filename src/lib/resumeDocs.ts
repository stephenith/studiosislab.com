import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const COLLECTION = "resume_docs";

const isPlainObject = (v: any) => {
  if (!v || typeof v !== "object") return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

/** Recursively removes all keys with value === undefined. */
const sanitizeJSON = (value: any): any => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) {
    return value.map(sanitizeJSON).filter((v) => v !== undefined);
  }
  if (isPlainObject(value)) {
    const out: any = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;
      const cleaned = sanitizeJSON(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return out;
  }
  return value;
};

const stripUndefinedDeep = (value: any): any => sanitizeJSON(value);

/** Sanitize Fabric object: remove invalid path/image, delete undefined path. */
const sanitizeFabricObject = (obj: any): any | null => {
  if (!obj || typeof obj !== "object") return obj;
  if (obj.type === "path" && (!Array.isArray(obj.path) || obj.path.length === 0)) return null;
  if (obj.type === "image" && !obj.src) return null;
  const cleaned = { ...obj };
  if (cleaned.path === undefined) delete cleaned.path;
  return sanitizeJSON(cleaned);
};

/** Sanitize pagesData before Firestore write. */
function sanitizeFabricPagesData(pagesData: any[]): any[] {
  if (!Array.isArray(pagesData)) return [];
  return pagesData.map((page) => {
    if (!page || typeof page !== "object") return page;
    const cleanedPage = { ...page };
    if (Array.isArray(cleanedPage.objects)) {
      cleanedPage.objects = cleanedPage.objects
        .map((o: any) => sanitizeFabricObject(o))
        .filter((o: any) => o != null);
    }
    return sanitizeJSON(cleanedPage);
  });
}

/** Sanitize canvas JSON before Firestore write. */
function sanitizeFabricCanvasJson(json: any): any {
  if (!json || typeof json !== "object") return json;
  const cleaned = { ...json };
  if (Array.isArray(cleaned.objects)) {
    cleaned.objects = cleaned.objects
      .map((o: any) => sanitizeFabricObject(o))
      .filter((o: any) => o != null);
  }
  return sanitizeJSON(cleaned);
}

export async function createResumeDoc(params: {
  uid: string;
  title: string;
  sourceTemplateId?: string | null;
  canvasJson?: any;
  pagesData?: any[];
  pageSize?: string;
  zoom?: number;
  docId?: string | null;
}) {
  const { uid, title, sourceTemplateId, canvasJson, pagesData, pageSize, zoom, docId } = params;
  const id =
    docId ||
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : String(Date.now()));
  const payload: Record<string, any> = {
    uid,
    title: title ?? "Untitled Resume",
    sourceTemplateId: sourceTemplateId ?? "blank",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (pagesData != null) {
    payload.pagesData = sanitizeFabricPagesData(pagesData);
    if (pageSize != null) payload.pageSize = pageSize;
    if (zoom != null) payload.zoom = zoom;
  } else if (canvasJson != null) {
    payload.canvasJson = typeof canvasJson === "string" ? canvasJson : sanitizeFabricCanvasJson(canvasJson);
  }
  const cleanPayload = stripUndefinedDeep(payload);
  const ref = doc(db, "users", uid, COLLECTION, id);
  await setDoc(ref, cleanPayload, { merge: true });
  return id;
}

export async function updateResumeDoc(params: {
  uid: string;
  docId: string;
  title: string;
  canvasJson?: any;
  pagesData?: any[];
  pageSize?: string;
  zoom?: number;
}) {
  const { uid, docId, title, canvasJson, pagesData, pageSize, zoom } = params;
  const ref = doc(db, "users", uid, COLLECTION, docId);
  const payload: Record<string, any> = {
    uid,
    title: title ?? "Untitled Resume",
    updatedAt: serverTimestamp(),
  };
  if (pagesData != null) {
    payload.pagesData = sanitizeFabricPagesData(pagesData);
    if (pageSize != null) payload.pageSize = pageSize;
    if (zoom != null) payload.zoom = zoom;
  } else if (canvasJson != null) {
    payload.canvasJson = typeof canvasJson === "string" ? canvasJson : sanitizeFabricCanvasJson(canvasJson);
  }
  const cleanPayload = stripUndefinedDeep(payload);
  await updateDoc(ref, cleanPayload);
}

export async function getResumeDoc(params: { uid: string; docId: string }) {
  const { uid, docId } = params;
  const ref = doc(db, "users", uid, COLLECTION, docId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as any;
  if (data?.uid && data.uid !== uid) return null;
  const pagesData = data?.pagesData;
  const canvasJson = data?.canvasJson;
  return {
    title: data?.title ?? "Untitled Resume",
    canvasJson: canvasJson ?? (Array.isArray(pagesData) && pagesData.length > 0 ? null : { objects: [] }),
    pagesData: Array.isArray(pagesData) ? pagesData : null,
    zoom: typeof data?.zoom === "number" ? data.zoom : null,
    updatedAt: data?.updatedAt ?? null,
    createdAt: data?.createdAt ?? null,
    sourceTemplateId: data?.sourceTemplateId ?? null,
    pageSize: data?.pageSize ?? null,
  };
}
