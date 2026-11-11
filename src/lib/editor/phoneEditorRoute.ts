/**
 * One phone-versus-desktop decision for resume editing.
 *
 * Portrait phones match the existing 767px width rule.
 * Landscape phones are wider than 767px and shorter than about 520px,
 * with a coarse pointer and no hover. That includes large phones in
 * landscape (about 844×390 through 932×430) and excludes iPad and laptop
 * windows, which are taller or report a fine pointer.
 *
 * Saved resumes stay on the existing phone route. The document id is a
 * `doc` query so refresh and sign-in return keep the same id.
 */

export const PHONE_EDITOR_MEDIA_QUERY =
  "(max-width: 767px), ((pointer: coarse) and (hover: none) and (max-width: 1000px) and (max-height: 520px))";

const RESUME_DOC_ID = /^[A-Za-z0-9_-]{1,128}$/;

export function isResumeDocumentId(value: string | null | undefined): boolean {
  return RESUME_DOC_ID.test(String(value || "").trim());
}

export function wantsPhoneEditor(match: (query: string) => boolean): boolean {
  return match(PHONE_EDITOR_MEDIA_QUERY);
}

export function phoneEditorViewportMatch(): boolean {
  if (typeof window === "undefined") return false;
  return wantsPhoneEditor((query) => window.matchMedia(query).matches);
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
