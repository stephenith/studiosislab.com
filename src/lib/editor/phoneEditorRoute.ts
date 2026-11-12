/**
 * One phone-versus-desktop decision for resume editing.
 *
 * iPhone Safari can inflate the layout viewport. `window.innerWidth` and a
 * max-width media query then both look wider than the phone, so neither one
 * is enough on its own. An iPhone or Android-phone user agent still identifies
 * the device. So does a phone-sized screen short side with a coarse pointer or
 * touch points: that stays phone-sized when the layout viewport grows, and it
 * stays above 767px on iPad and laptop screens.
 *
 * An honest layout viewport still uses the 767px rule, including a narrow
 * desktop window. Landscape phones also match the coarse, no-hover, short
 * height query when the layout width is real.
 *
 * Saved resumes stay on the phone route. The document id is a `doc` query so
 * refresh and sign-in return keep the same id. The template id stays in the
 * path when the caller knows it.
 */

export const PHONE_EDITOR_MEDIA_QUERY =
  "(max-width: 767px), ((pointer: coarse) and (hover: none) and (max-width: 1000px) and (max-height: 520px))";

const RESUME_DOC_ID = /^[A-Za-z0-9_-]{1,128}$/;

export type PhoneEditorSignals = {
  match: (query: string) => boolean;
  userAgent?: string;
  screenWidth?: number;
  screenHeight?: number;
  maxTouchPoints?: number;
};

export function isResumeDocumentId(value: string | null | undefined): boolean {
  return RESUME_DOC_ID.test(String(value || "").trim());
}

function asSignals(input: ((query: string) => boolean) | PhoneEditorSignals): PhoneEditorSignals {
  return typeof input === "function" ? { match: input } : input;
}

function isPhoneUserAgent(userAgent: string): boolean {
  if (/iPhone|iPod/i.test(userAgent)) return true;
  return /Android/i.test(userAgent) && /Mobile/i.test(userAgent);
}

function phoneSizedTouchScreen(signals: PhoneEditorSignals): boolean {
  const width = Number(signals.screenWidth) || 0;
  const height = Number(signals.screenHeight) || 0;
  if (width <= 0 || height <= 0) return false;
  if (Math.min(width, height) > 767) return false;
  const coarse = signals.match("(pointer: coarse)") && signals.match("(hover: none)");
  return coarse || (signals.maxTouchPoints ?? 0) > 0;
}

export function wantsPhoneEditor(input: ((query: string) => boolean) | PhoneEditorSignals): boolean {
  const signals = asSignals(input);
  if (isPhoneUserAgent(signals.userAgent || "")) return true;
  if (phoneSizedTouchScreen(signals)) return true;
  return signals.match(PHONE_EDITOR_MEDIA_QUERY);
}

export function phoneEditorViewportMatch(): boolean {
  if (typeof window === "undefined") return false;
  return wantsPhoneEditor({
    match: (query) => window.matchMedia(query).matches,
    userAgent: navigator.userAgent,
    screenWidth: window.screen?.width,
    screenHeight: window.screen?.height,
    maxTouchPoints: navigator.maxTouchPoints,
  });
}

export type EditorOpenTarget = {
  templateId?: string | null;
  docId?: string | null;
  blank?: boolean;
};

function cleanTemplateId(templateId: string | null | undefined): string {
  const value = String(templateId || "").trim().toLowerCase();
  if (!value || value === "blank" || value === "new") return "resume";
  return value;
}

export function editorHrefForViewport(target: EditorOpenTarget, phone: boolean): string {
  const docId = String(target.docId || "").trim();
  if (phone) {
    if (docId) {
      const templateId = cleanTemplateId(target.templateId);
      return `/editor/mobile/template/${encodeURIComponent(templateId)}?doc=${encodeURIComponent(docId)}`;
    }
    if (target.blank || !target.templateId) return "/editor/mobile/template/blank";
    return `/editor/mobile/template/${encodeURIComponent(String(target.templateId).trim().toLowerCase())}`;
  }
  if (docId) return `/editor/doc/${encodeURIComponent(docId)}`;
  if (target.blank || !target.templateId) return "/editor/new";
  return `/editor/template/${encodeURIComponent(String(target.templateId).trim().toLowerCase())}`;
}

export function phoneEditorHrefFromDesktopPath(pathname: string): string | null {
  const path = String(pathname || "").split("?")[0];
  const template = path.match(/^\/editor\/template\/([^/]+)$/);
  if (template) {
    return editorHrefForViewport({ templateId: decodeURIComponent(template[1]) }, true);
  }
  const doc = path.match(/^\/editor\/doc\/([^/]+)$/);
  if (doc) {
    return editorHrefForViewport({ docId: decodeURIComponent(doc[1]) }, true);
  }
  if (path === "/editor" || path === "/editor/new") {
    return editorHrefForViewport({ blank: true }, true);
  }
  return null;
}
