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

export type PhoneResumeLoadStage =
  | "auth"
  | "canvas"
  | "document_read"
  | "template_lookup"
  | "template_json"
  | "hydrate_render"
  | "unknown";

export type PhoneResumeLoadSource = "template" | "blank" | "document";

export type PhoneResumeLoadFailure = {
  message: string;
  reason: PhoneResumeLoadReason;
  stage: PhoneResumeLoadStage;
  source: PhoneResumeLoadSource;
  errorName: string;
  errorCode: string;
};

export const PHONE_LOAD_ERROR_ACTION_MIN_PX = 44;
export const PHONE_LOAD_ERROR_ACTION_GAP_PX = 12;

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

export function phoneResumeLoadSource(input: {
  decision: PhoneResumeLoadDecision;
  blank?: boolean;
  templateId?: string | null;
}): PhoneResumeLoadSource {
  if (input.decision.type === "document") return "document";
  if (input.blank || !String(input.templateId || "").trim()) return "blank";
  return "template";
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
  if (isTemplateChunkLoadError(err) || lower.includes("invalid template json")) {
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

function safeDiagnosticToken(value: unknown): string {
  const text = String(value || "").trim().slice(0, 64);
  if (!text) return "";
  return /^[A-Za-z0-9._:-]+$/.test(text) ? text : "";
}

export function describePhoneResumeLoadFailure(input: {
  err?: unknown;
  stage: PhoneResumeLoadStage;
  source: PhoneResumeLoadSource;
  classified?: { reason: PhoneResumeLoadReason; message: string };
}): PhoneResumeLoadFailure {
  const classified = input.classified ?? classifyPhoneResumeLoadError(input.err);
  const value = input.err as { code?: unknown; name?: unknown } | undefined;
  return {
    message: classified.message,
    reason: classified.reason,
    stage: input.stage,
    source: input.source,
    errorName: safeDiagnosticToken(value?.name),
    errorCode: safeDiagnosticToken(value?.code),
  };
}

export function phoneResumeLoadFailureLog(failure: PhoneResumeLoadFailure): {
  stage: PhoneResumeLoadStage;
  reason: PhoneResumeLoadReason;
  name: string;
  code: string;
  source: PhoneResumeLoadSource;
} {
  return {
    stage: failure.stage,
    reason: failure.reason,
    name: failure.errorName,
    code: failure.errorCode,
    source: failure.source,
  };
}

export function phoneLoadErrorActionRects(cardInnerWidth: number): {
  tryAgain: { left: number; top: number; width: number; height: number };
  hub: { left: number; top: number; width: number; height: number };
  overlap: boolean;
} {
  const width = Math.max(0, cardInnerWidth);
  const tryAgain = { left: 0, top: 0, width, height: PHONE_LOAD_ERROR_ACTION_MIN_PX };
  const hub = {
    left: 0,
    top: PHONE_LOAD_ERROR_ACTION_MIN_PX + PHONE_LOAD_ERROR_ACTION_GAP_PX,
    width,
    height: PHONE_LOAD_ERROR_ACTION_MIN_PX,
  };
  const overlap =
    tryAgain.left < hub.left + hub.width &&
    tryAgain.left + tryAgain.width > hub.left &&
    tryAgain.top < hub.top + hub.height &&
    tryAgain.top + tryAgain.height > hub.top;
  return { tryAgain, hub, overlap };
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
  | {
      ok: false;
      reason: PhoneResumeLoadReason;
      message: string;
      errorName?: string;
      errorCode?: string;
    };

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
    const diagnostic = describePhoneResumeLoadFailure({
      err,
      stage: "document_read",
      source: "document",
      classified:
        classified.reason === "missing"
          ? { reason: "error", message: PHONE_RESUME_LOAD_MESSAGES.generic }
          : classified,
    });
    if (classified.reason === "missing") {
      return {
        ok: false,
        reason: "error",
        message: PHONE_RESUME_LOAD_MESSAGES.generic,
        errorName: diagnostic.errorName,
        errorCode: diagnostic.errorCode,
      };
    }
    return {
      ok: false,
      reason: classified.reason,
      message: classified.message,
      errorName: diagnostic.errorName,
      errorCode: diagnostic.errorCode,
    };
  }
}

export function isTemplateChunkLoadError(err: unknown): boolean {
  const lower = errorText(err).toLowerCase();
  const name = String((err as { name?: unknown })?.name || "").toLowerCase();
  return (
    name === "chunkloaderror" ||
    lower.includes("chunkloaderror") ||
    lower.includes("failed to fetch dynamically imported module") ||
    lower.includes("error loading dynamically imported module") ||
    lower.includes("importing a module script failed") ||
    lower.includes("load failed")
  );
}

export function unwrapTemplateSnapshot(raw: unknown): unknown {
  if (raw == null) return raw;
  if (typeof raw === "string") {
    try {
      return unwrapTemplateSnapshot(JSON.parse(raw));
    } catch {
      return raw;
    }
  }
  if (Array.isArray(raw)) {
    const page = raw.find((item) => item && typeof item === "object" && Array.isArray((item as { objects?: unknown }).objects));
    return unwrapTemplateSnapshot(page ?? raw[0]);
  }
  if (typeof raw !== "object") return raw;
  if ("objects" in raw && Array.isArray((raw as { objects?: unknown }).objects)) return raw;
  const nested = (raw as { default?: unknown; canvas?: unknown }).default ?? (raw as { canvas?: unknown }).canvas;
  if (nested && typeof nested === "object") return unwrapTemplateSnapshot(nested);
  return raw;
}

export async function loadPublishedTemplateJson(
  load: () => Promise<unknown>,
  attempts = 2
): Promise<unknown> {
  const tries = Math.max(1, attempts);
  let last: unknown = new Error("Invalid template JSON: expected { objects: [] }");
  for (let index = 0; index < tries; index += 1) {
    try {
      return unwrapTemplateSnapshot(await load());
    } catch (err) {
      last = err;
      if (!isTemplateChunkLoadError(err) || index === tries - 1) throw err;
    }
  }
  throw last;
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
