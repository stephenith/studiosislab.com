/**
 * Phone Resume Editor load decisions and error mapping.
 * Kept out of the desktop editor. Firestore rules stay owner-only.
 */

export const PHONE_RESUME_LOAD_MESSAGES = {
  missing:
    "That saved resume could not be found in this account. Sign in with the account that owns it, or open it from Recents.",
  denied:
    "This account does not have access to that saved resume. Sign in with the account that owns it.",
  unauthenticated: "Sign in again to open this saved resume.",
  invalidTemplate: "That Resume Template ID is not available.",
  invalidTemplateJson: "That Resume Template could not be loaded. Please try again.",
  canvas: "The editor canvas could not start. Please try again.",
  generic: "We couldn't load this resume. Please try again.",
} as const;

export type PhoneResumeLoadReason =
  | "missing"
  | "denied"
  | "unauthenticated"
  | "invalid_template"
  | "invalid_template_json"
  | "canvas"
  | "error";

export type PhoneResumeLoadDecision =
  | { type: "wait" }
  | { type: "template" }
  | { type: "denied"; message: string }
  | { type: "document"; uid: string; docId: string };

export function phoneResumeLoadDecision(input: {
  docId: string | null | undefined;
  authReady: boolean;
  uid: string | null | undefined;
}): PhoneResumeLoadDecision {
  const docId = String(input.docId || "").trim();
  if (!docId) return { type: "template" };
  if (!input.authReady) return { type: "wait" };
  const uid = String(input.uid || "").trim();
  if (!uid) {
    return { type: "denied", message: PHONE_RESUME_LOAD_MESSAGES.unauthenticated };
  }
  return { type: "document", uid, docId };
}

function errorText(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  const value = err as { code?: unknown; message?: unknown; name?: unknown };
  return [value.code, value.message, value.name].map((part) => String(part || "")).join(" ");
}

export function isAuthPermissionResumeError(err: unknown): boolean {
  const text = errorText(err).toLowerCase();
  return (
    text.includes("permission-denied") ||
    text.includes("permission_denied") ||
    text.includes("unauthenticated") ||
    text.includes("missing or insufficient permissions")
  );
}

export function classifyPhoneResumeLoadError(err: unknown): {
  reason: PhoneResumeLoadReason;
  message: string;
} {
  const text = errorText(err);
  const lower = text.toLowerCase();
  if (!text) return { reason: "error", message: PHONE_RESUME_LOAD_MESSAGES.generic };
  if (lower.includes("invalid template json") || lower.includes("failed to fetch dynamically imported module")) {
    return { reason: "invalid_template_json", message: PHONE_RESUME_LOAD_MESSAGES.invalidTemplateJson };
  }
  if (lower.includes("template not found") || lower.includes("not available in the system catalog")) {
    return { reason: "invalid_template", message: PHONE_RESUME_LOAD_MESSAGES.invalidTemplate };
  }
  if (lower.includes("canvas failed to initialize") || lower.includes("could not start")) {
    return { reason: "canvas", message: PHONE_RESUME_LOAD_MESSAGES.canvas };
  }
  if (lower.includes("unauthenticated")) {
    return { reason: "unauthenticated", message: PHONE_RESUME_LOAD_MESSAGES.unauthenticated };
  }
  if (isAuthPermissionResumeError(err)) {
    return { reason: "denied", message: PHONE_RESUME_LOAD_MESSAGES.denied };
  }
  if (lower.includes("not-found") || lower.includes("not_found")) {
    return { reason: "missing", message: PHONE_RESUME_LOAD_MESSAGES.missing };
  }
  if (lower.includes("unavailable") || lower.includes("offline") || lower.includes("network")) {
    return { reason: "error", message: PHONE_RESUME_LOAD_MESSAGES.generic };
  }
  return { reason: "error", message: PHONE_RESUME_LOAD_MESSAGES.generic };
}

export type PhoneResumeRecord = {
  title?: string;
  canvasJson?: unknown;
  pagesData?: unknown[] | null;
  autosaveRevision?: number;
  updatedAt?: unknown;
  sourceTemplateId?: string | null;
};

export type PhoneResumeReadResult =
  | { ok: true; record: PhoneResumeRecord }
  | { ok: false; reason: PhoneResumeLoadReason; message: string };

export async function readPhoneResumeDoc(input: {
  load: () => Promise<PhoneResumeRecord | null>;
}): Promise<PhoneResumeReadResult> {
  try {
    const record = await input.load();
    if (!record) {
      return { ok: false, reason: "missing", message: PHONE_RESUME_LOAD_MESSAGES.missing };
    }
    return { ok: true, record };
  } catch (err) {
    const classified = classifyPhoneResumeLoadError(err);
    if (classified.reason === "missing") {
      return { ok: false, reason: "error", message: PHONE_RESUME_LOAD_MESSAGES.generic };
    }
    return { ok: false, reason: classified.reason, message: classified.message };
  }
}

export function unwrapTemplateSnapshot(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  if ("objects" in raw && Array.isArray((raw as { objects?: unknown }).objects)) return raw;
  const nested = (raw as { default?: unknown }).default;
  if (nested && typeof nested === "object") return unwrapTemplateSnapshot(nested);
  return raw;
}

export async function loadOwnedResumeWithAuthRetry(input: {
  load: () => Promise<PhoneResumeRecord | null>;
  refreshAuth?: () => Promise<unknown> | undefined;
}): Promise<PhoneResumeReadResult> {
  try {
    const record = await input.load();
    if (!record) {
      return { ok: false, reason: "missing", message: PHONE_RESUME_LOAD_MESSAGES.missing };
    }
    return { ok: true, record };
  } catch (err) {
    if (!input.refreshAuth || !isAuthPermissionResumeError(err)) {
      return readPhoneResumeDoc({ load: async () => Promise.reject(err) });
    }
    try {
      await input.refreshAuth();
      return await readPhoneResumeDoc({ load: input.load });
    } catch (retryErr) {
      return readPhoneResumeDoc({ load: async () => Promise.reject(retryErr) });
    }
  }
}
