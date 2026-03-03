"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFabricEditor } from "@/components/editor/useFabricEditor";
import { toHexColor } from "@/lib/color";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

/** Recursively removes all keys with value === undefined. */
function sanitizeJSON(value: any): any {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  if (Array.isArray(value)) {
    return value.map(sanitizeJSON).filter((v) => v !== undefined);
  }
  if (value && typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;
    const out: any = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;
      const cleaned = sanitizeJSON(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return out;
  }
  return value;
}

/** Validates and cleans a single Fabric object for save. Returns null to skip. */
function sanitizeFabricObject(obj: any): any | null {
  if (!obj || typeof obj !== "object") return obj;

  // Skip invalid path objects
  if (obj.type === "path" && (!Array.isArray(obj.path) || obj.path.length === 0)) {
    console.warn("[save] Skipping invalid path object");
    return null;
  }

  // Skip image objects without src
  if (obj.type === "image" && !obj.src) {
    console.warn("[save] Skipping image object without src");
    return null;
  }

  // Clone and remove undefined path (common in Fabric image objects)
  const cleaned = { ...obj };
  if (cleaned.path === undefined) delete cleaned.path;

  // Recursively sanitize nested structures
  return sanitizeJSON(cleaned);
}

/** Sanitize pagesData for Firestore. Removes undefined, invalid path/image objects. */
function sanitizeFabricPagesData(pagesData: any[]): any[] {
  if (!Array.isArray(pagesData)) return [];
  return pagesData.map((page) => {
    if (!page || typeof page !== "object") return page;
    const cleanedPage = { ...page };
    if (Array.isArray(cleanedPage.objects)) {
      cleanedPage.objects = cleanedPage.objects
        .map((obj: any) => sanitizeFabricObject(obj))
        .filter((obj: any) => obj != null);
    }
    return sanitizeJSON(cleanedPage);
  });
}

/** Sanitize single-page canvas JSON for Firestore. */
function sanitizeFabricCanvasJson(json: any): any {
  if (!json || typeof json !== "object") return json;
  const cleaned = { ...json };
  if (Array.isArray(cleaned.objects)) {
    cleaned.objects = cleaned.objects
      .map((obj: any) => sanitizeFabricObject(obj))
      .filter((obj: any) => obj != null);
  }
  return sanitizeJSON(cleaned);
}

function stripUndefinedDeep(value: any): any {
  return sanitizeJSON(value);
}

function findUndefinedPaths(value: any, prefix: string[] = []): string[] {
  if (value === undefined) return [prefix.join(".") || "(root)"];
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => findUndefinedPaths(v, [...prefix, String(i)]));
  }
  if (value && typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return [];
    return Object.entries(value).flatMap(([k, v]) =>
      findUndefinedPaths(v, [...prefix, k])
    );
  }
  return [];
}

function isAbortError(err: any) {
  const name = err?.name || "";
  const msg = typeof err?.message === "string" ? err.message : "";
  return name === "AbortError" || msg.toLowerCase().includes("aborted");
}

function makeThumbnailFromCanvasEl(canvasEl: HTMLCanvasElement, maxW = 360): string | null {
  try {
    const w = canvasEl.width || 1;
    const h = canvasEl.height || 1;

    const scale = Math.min(1, maxW / w);
    const outW = Math.max(1, Math.round(w * scale));
    const outH = Math.max(1, Math.round(h * scale));

    const out = document.createElement("canvas");
    out.width = outW;
    out.height = outH;

    const ctx = out.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(canvasEl, 0, 0, outW, outH);

    return out.toDataURL("image/png");
  } catch {
    return null;
  }
}

type EditorShellProps = {
  initialTemplateId?: string | null;
  docId?: string | null;
  mode: "template" | "new";
};

export default function EditorShell({
  initialTemplateId,
  docId,
  mode,
}: EditorShellProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);

  const [filename, setFilename] = useState("Untitled Resume");
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const [isAdOpen, setIsAdOpen] = useState(false);
  const [pendingExport, setPendingExport] = useState<
    null | { format: "pdf" | "png"; pages: number[] }
  >(null);

  const [adCountdown, setAdCountdown] = useState(15);
  const [selectedDownloadFormat, setSelectedDownloadFormat] = useState<"pdf" | "png">(
    "pdf"
  );
  const [selectedPages, setSelectedPages] = useState<number[]>([0]); // 0-based page indexes
  const [tool, setTool] = useState<
    "select" | "text" | "shape" | "line" | "image" | "imageFrameSquare" | "imageFrameCircle" | "templates"
  >("select");
  const [showFrameDeleteModal, setShowFrameDeleteModal] = useState(false);

  const [resumeId, setResumeId] = useState<string | null>(null);
  const [resumeCreatedAt, setResumeCreatedAt] = useState<any>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const editor = useFabricEditor({ mode, initialTemplateId, docId });

  useEffect(() => {
    if (editor?.docTitle) setFilename(editor.docTitle);
  }, [editor?.docTitle]);

  useEffect(() => {
    const el = editor.viewportRef?.current as HTMLDivElement | null;
    if (!el) return;

    requestAnimationFrame(() => {
      el.scrollTop = 0;
      el.scrollLeft = 0;
    });
  }, []);

  useEffect(() => {
    if (!saveNotice) return;
    const id = window.setTimeout(() => setSaveNotice(null), 2000);
    return () => window.clearTimeout(id);
  }, [saveNotice]);

  useEffect(() => {
    if (editor?.docId) setResumeId(editor.docId);
    if (editor?.docCreatedAt) setResumeCreatedAt(editor.docCreatedAt);
  }, [editor?.docId, editor?.docCreatedAt]);

  const handleAdComplete = useCallback(() => {
    if (!pendingExport) {
      setIsAdOpen(false);
      return;
    }
    const { format, pages } = pendingExport;
    setPendingExport(null);
    setIsAdOpen(false);
    if (format === "pdf") editor?.exportPDF?.(pages);
    else editor?.exportPNG?.(pages);
  }, [editor, pendingExport]);

  const rawZoomPercent =
    editor?.getZoomPercent?.() ?? Math.round((editor?.zoom ?? 1) * 100);
  const zoomPercent = Number.isFinite(rawZoomPercent) ? rawZoomPercent : 100;
  const zoomLabel = `${zoomPercent}%`;

  const pageSizePx = editor.getPageSizePx();
  const zoom = editor?.zoom ?? 1;
  const pageDisplayW = Math.round(pageSizePx.w * zoom);
  const pageDisplayH = Math.round(pageSizePx.h * zoom);
  const [customUnit, setCustomUnit] = useState<"mm" | "cm" | "in" | "px" | "pt">("mm");
  const [customWidth, setCustomWidth] = useState("");
  const [customHeight, setCustomHeight] = useState("");

  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingLayerValue, setEditingLayerValue] = useState("");

  const pageRefs = useRef(new Map<string, HTMLDivElement>());

  const setPageRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) pageRefs.current.set(id, el);
    else pageRefs.current.delete(id);
  }, []);

  const scrollToPage = useCallback((id: string) => {
    const el = pageRefs.current.get(id);
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const toPx = useCallback((value: number, unit: typeof customUnit) => {
    if (!Number.isFinite(value)) return 0;
    switch (unit) {
      case "mm":
        return (value / 25.4) * 96;
      case "cm":
        return (value / 2.54) * 96;
      case "in":
        return value * 96;
      case "pt":
        return (value / 72) * 96;
      case "px":
      default:
        return value;
    }
  }, []);

  const fromPx = useCallback((value: number, unit: typeof customUnit) => {
    if (!Number.isFinite(value)) return 0;
    switch (unit) {
      case "mm":
        return (value / 96) * 25.4;
      case "cm":
        return (value / 96) * 2.54;
      case "in":
        return value / 96;
      case "pt":
        return (value / 96) * 72;
      case "px":
      default:
        return value;
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = (t as any)?.tagName;
      if (
        t?.closest?.('[data-layer-rename="1"]') ||
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (t as any)?.isContentEditable
      ) {
        return;
      }
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if ((e.key === "Delete" || e.key === "Backspace") && !mod) {
        e.preventDefault();
        if (editor.isImageFrameSelected?.()) {
          setShowFrameDeleteModal(true);
        } else {
          editor.deleteSelected();
        }
      }

      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        editor.undo();
      }

      if (mod && e.key.toLowerCase() === "z" && e.shiftKey) {
        e.preventDefault();
        editor.redo();
      }

      if (mod && e.key.toLowerCase() === "c") {
        e.preventDefault();
        editor.copy();
      }

      if (mod && e.key.toLowerCase() === "v") {
        e.preventDefault();
        editor.paste();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editor]);

  useEffect(() => {
    if (!isAdOpen) return;
    setAdCountdown(15);
    const id = window.setInterval(() => {
      setAdCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [isAdOpen]);

  useEffect(() => {
    if (!editor?.setViewportEl) return;
    editor.setViewportEl(editor.viewportRef?.current ?? null);
    return () => editor.setViewportEl?.(null);
  }, [editor.setViewportEl, editor.viewportRef]);

  useEffect(() => {
    const el = canvasWrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    if (editor.pageSize === "Custom") return;
    const w = fromPx(pageSizePx.w, customUnit);
    const h = fromPx(pageSizePx.h, customUnit);
    setCustomWidth(w.toFixed(2).replace(/\.00$/, ""));
    setCustomHeight(h.toFixed(2).replace(/\.00$/, ""));
  }, [customUnit, editor.pageSize, pageSizePx.h, pageSizePx.w, fromPx]);

  useEffect(() => {
    if (editor.pageSize !== "Custom") return;
    const id = window.setTimeout(() => {
      const w = Number(customWidth);
      const h = Number(customHeight);
      if (!Number.isFinite(w) || !Number.isFinite(h)) return;
      const wPx = toPx(w, customUnit);
      const hPx = toPx(h, customUnit);
      if (wPx > 0 && hPx > 0) editor.setPageSizePx(wPx, hPx);
    }, 200);
    return () => window.clearTimeout(id);
  }, [customHeight, customUnit, customWidth, editor, toPx]);

  const toolButtonBase =
    "h-11 w-11 rounded-xl border shadow-sm flex items-center justify-center transition-all duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400";
  const toolButtonActive =
    "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-md";
  const toolButtonIdle =
    "bg-white border-zinc-200 text-zinc-700 hover:-translate-y-0.5 hover:shadow-md hover:border-zinc-300";

  if (!editor.isDocDataReady) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-neutral-100">
        <div className="text-zinc-600 animate-pulse">Loading resume…</div>
        {editor.loadError && (
          <div className="mt-2 text-sm text-amber-600">{editor.loadError}</div>
        )}
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Banner Ad Bar */}
      <div className="h-14 shrink-0 sticky top-0 z-[60] border-b bg-white">
        <div className="h-full w-full flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <img
              src="/brand/Studiosis Logo.svg"
              alt="Studiosis Lab"
              className="h-9 w-9 rounded object-contain"
            />
            <div className="text-xs text-zinc-600">Studiosis Lab</div>
          </div>

          <div className="h-7 flex-1 mx-4 rounded bg-zinc-100 border border-zinc-200 flex items-center justify-center text-[11px] text-zinc-500">
            Banner Ad Placeholder (728×90 or responsive)
          </div>
        </div>
      </div>

      {/* Top Bar */}
      <div className="h-14 shrink-0 sticky top-0 z-50 border-b bg-white">
        <div className="h-full flex items-center justify-between px-4">
          <button onClick={() => router.back()} className="rounded border px-3 py-1 text-sm">
            Back
          </button>

          <input
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            className="w-64 rounded border px-2 py-1 text-sm text-center"
            aria-label="Filename"
          />

          <div className="flex items-center gap-2">
            <button onClick={editor.undo} className="rounded border px-2 py-1 text-sm">
              Undo
            </button>
            <button onClick={editor.redo} className="rounded border px-2 py-1 text-sm">
              Redo
            </button>

            {saveNotice && <div className="text-xs text-zinc-500">{saveNotice}</div>}

            <div className="text-sm text-zinc-600">{zoomLabel}</div>

            <button
              className="rounded border px-2 py-1 text-sm"
              onClick={() => {
                editor.setManualZooming(true);
                const next = Math.max(10, Math.min(400, zoomPercent - 10));
                if (editor?.setZoomPercent) editor.setZoomPercent(next);
                else if (editor?.setZoom) editor.setZoom(next / 100);
              }}
            >
              –
            </button>

            <button
              className="rounded border px-2 py-1 text-sm"
              onClick={() => {
                editor.setManualZooming(true);
                const next = Math.max(10, Math.min(400, zoomPercent + 10));
                if (editor?.setZoomPercent) editor.setZoomPercent(next);
                else if (editor?.setZoom) editor.setZoom(next / 100);
              }}
            >
              +
            </button>

            <button
              onClick={() => setIsDownloadOpen(true)}
              className="rounded bg-black px-3 py-1 text-sm text-white"
            >
              Download
            </button>

            <button
              onClick={async () => {
                let saved = false;
                let rawPayload: Record<string, any> | null = null;

                try {
                  const u = auth.currentUser;
                  if (!u) {
                    alert("Please log in to save");
                    return;
                  }

                  const safeName = (filename || "Untitled").trim() || "Untitled";
                  const existingId = resumeId ?? editor.docId ?? null;

                  const newDocId =
                    existingId ||
                    (typeof crypto !== "undefined" && "randomUUID" in crypto
                      ? crypto.randomUUID()
                      : String(Date.now()));

                  const rawPagesData = editor.getPagesJsonForSave?.();
                  const hasMultiplePages = Array.isArray(rawPagesData) && rawPagesData.length > 1;
                  const rawJson = hasMultiplePages ? null : editor.getCanvasJson?.();
                  if (!rawPagesData && !rawJson) {
                    alert("Canvas not ready");
                    return;
                  }

                  const sanitizedPagesData = hasMultiplePages
                    ? sanitizeFabricPagesData(rawPagesData)
                    : null;
                  const sanitizedJson = !hasMultiplePages && rawJson
                    ? sanitizeFabricCanvasJson(rawJson)
                    : null;

                  const ref = doc(db, "users", u.uid, "resume_docs", newDocId);
                  const templateId = initialTemplateId ?? "blank";

                  const zoomBeforeSave = editor.getZoom?.() ?? editor.zoom ?? 1;
                  console.log("[save] zoom before save:", zoomBeforeSave);

                  rawPayload = {
                    title: safeName,
                    templateId: templateId ?? "blank",
                    sourceTemplateId: templateId ?? "blank",
                    pageSize: editor.pageSize ?? "A4",
                    updatedAt: serverTimestamp(),
                    zoom: zoomBeforeSave,
                  };
                  if (hasMultiplePages && sanitizedPagesData) {
                    rawPayload.pagesData = sanitizedPagesData;
                  } else if (sanitizedJson) {
                    rawPayload.canvasJson = JSON.stringify(sanitizedJson);
                  }

                  // ---- THUMBNAIL GENERATION ----
                  try {
                    const fabricCanvas = editor?.getCanvas?.();
                    let canvasEl =
                     (fabricCanvas as any)?.lowerCanvasEl ||
                     (fabricCanvas as any)?.getElement?.() ||
                     undefined;

                    console.log("[thumb] canvas found?", !!canvasEl);

                    // DOM fallback (when hook doesn't expose Fabric canvas)
                    if (!canvasEl) {
                     const activePageId = editor?.pages?.[editor?.activePageIndex || 0]?.id;
                     const selector = activePageId
                       ? `[data-editor-viewport="${activePageId}"] canvas`
                       : `#slb-editor-viewport canvas`;

                     const domCanvas = document.querySelector(selector) as HTMLCanvasElement | null;
                     canvasEl = domCanvas || undefined;

                     console.log("[thumb] DOM canvas found?", !!canvasEl, "selector:", selector);
                    } 

                   if (canvasEl) {
                     const thumb = makeThumbnailFromCanvasEl(canvasEl, 360);
                     if (thumb) {
                      rawPayload.thumbnail = thumb;
                      console.log("Thumbnail generated ✅");
                     } else {
                      console.warn("Thumbnail generation returned null");
                     }
                   } else {
                     console.warn("No canvas element found for thumbnail");
                   }
                  } catch (e) {
                    console.warn("Thumbnail generation failed", e);
                  }

                  const isNewDoc = !existingId;
                  if (isNewDoc && !resumeCreatedAt) {
                    rawPayload.createdAt = serverTimestamp();
                  }

                  // =========================
                  // THUMBNAIL (store in Firestore)
                  // =========================
                  let thumbDataUrl: string | undefined;

                  try {
                    // Try a few possible places depending on your hook implementation
                    const anyEditor = editor as any;
                    const c =
                      anyEditor?.canvas ||
                      anyEditor?.fabricCanvas ||
                      anyEditor?.canvases?.[anyEditor?.activePageIndex ?? 0] ||
                      anyEditor?.pages?.[anyEditor?.activePageIndex ?? 0]?.canvas;

                    console.log("[thumb] canvas found?", !!c);
                    console.log("[thumb] has toDataURL?", typeof c?.toDataURL);

                    if (c?.toDataURL) {
                      // 0.25 = small preview. Increase if you want clearer thumbs.
                      thumbDataUrl = c.toDataURL({ format: "png", multiplier: 0.25 });
                    }
                  } catch (e) {
                    console.warn("Thumbnail export failed", e);
                  }

                  if (thumbDataUrl) {
                    rawPayload.thumbnail = thumbDataUrl; // this is the field you should render on /resume
                    console.log("[thumb] length", thumbDataUrl.length);
                  } else {
                    console.log("[thumb] NO thumbnail created");
                  }
                  // =========================

                  const payload = stripUndefinedDeep(rawPayload);

                  const undefinedPaths = findUndefinedPaths(payload);
                  if (undefinedPaths.length > 0) {
                    console.error("[save] Aborting: payload still has undefined after sanitization:", undefinedPaths);
                    setSaveNotice("Save failed: corrupted data");
                    return;
                  }

                  console.log("SAVE uid", u.uid);
                  console.log("SAVE path", ref.path);
                  if (process.env.NODE_ENV === "development") {
                    console.log("[save] payload keys", Object.keys(payload || {}));
                  }

                  await setDoc(ref, payload, { merge: true });

                  saved = true;
                  setResumeId(newDocId);
                  setSaveNotice("Saved");

                  const zoomAfterSave = editor.getZoom?.() ?? editor.zoom ?? 1;
                  console.log("[save] zoom after save:", zoomAfterSave);

                  if (!existingId) {
                    router.replace(`/editor/${newDocId}`);
                  }
                } catch (err: any) {
                  console.error("[save] Failed:", err?.name, err?.message, err);

                  if (isAbortError(err)) {
                    setSaveNotice(saved ? "Saved" : "Save interrupted (aborted)");
                    return;
                  }

                  const message = typeof err?.message === "string" ? err.message : "";
                  if (message.toLowerCase().includes("insufficient permissions")) {
                    setSaveNotice("No permission to save (check Firestore rules)");
                  } else {
                    setSaveNotice("Save interrupted");
                  }

                  if (message.toLowerCase().includes("unsupported field value: undefined")) {
                    const paths = rawPayload ? findUndefinedPaths(rawPayload) : [];
                    console.log("[save] undefined paths", paths);
                  }
                }
              }}
              className="rounded border px-3 py-1 text-sm"
            >
              Save
            </button>
          </div>
        </div>
      </div>

      {editor.loadError && (
        <div className="border-b bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {editor.loadError}
        </div>
      )}

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left Toolbar */}
        <aside className="w-[72px] shrink-0 border-r bg-white flex flex-col items-center gap-3 py-4">
          <button
            type="button"
            title="Select"
            aria-label="Select tool"
            onClick={() => setTool("select")}
            className={`${toolButtonBase} ${tool === "select" ? toolButtonActive : toolButtonIdle}`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 3l7 17 2-6 6-2L4 3z" />
            </svg>
          </button>

          <button
            type="button"
            title="Text"
            aria-label="Text tool"
            onClick={() => {
              setTool("text");
              editor.addText();
            }}
            className={`${toolButtonBase} ${tool === "text" ? toolButtonActive : toolButtonIdle}`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 6h14M12 6v12M8 18h8" />
            </svg>
          </button>

          <button
            type="button"
            title="Shapes"
            aria-label="Shapes tool"
            onClick={() => {
              setTool("shape");
              editor.addRect();
            }}
            className={`${toolButtonBase} ${tool === "shape" ? toolButtonActive : toolButtonIdle}`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="5" y="5" width="14" height="14" rx="2" />
            </svg>
          </button>

          <button
            type="button"
            title="Line"
            aria-label="Line tool"
            onClick={() => {
              setTool("line");
              editor.addLine();
            }}
            className={`${toolButtonBase} ${tool === "line" ? toolButtonActive : toolButtonIdle}`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 19L19 5" />
            </svg>
          </button>

          <button
            type="button"
            title="Image"
            aria-label="Image tool"
            onClick={() => {
              setTool("image");
              fileInputRef.current?.click();
            }}
            className={`${toolButtonBase} ${tool === "image" ? toolButtonActive : toolButtonIdle}`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="4" y="5" width="16" height="14" rx="2" />
              <circle cx="9" cy="10" r="1.8" />
              <path d="M4 17l5-5 4 4 3-3 4 4" />
            </svg>
          </button>

          <button
            type="button"
            title="Square Image Frame"
            aria-label="Square Image Frame"
            onClick={() => {
              setTool("imageFrameSquare");
              editor.addImageFrame?.("square");
            }}
            className={`${toolButtonBase} ${tool === "imageFrameSquare" ? toolButtonActive : toolButtonIdle}`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="5" y="5" width="14" height="14" rx="2" />
              <rect x="8" y="8" width="8" height="8" rx="1" strokeDasharray="2 2" fill="none" />
            </svg>
          </button>

          <button
            type="button"
            title="Circle Image Frame"
            aria-label="Circle Image Frame"
            onClick={() => {
              setTool("imageFrameCircle");
              editor.addImageFrame?.("circle");
            }}
            className={`${toolButtonBase} ${tool === "imageFrameCircle" ? toolButtonActive : toolButtonIdle}`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="5" strokeDasharray="2 2" fill="none" />
            </svg>
          </button>

          <button
            type="button"
            title="Templates"
            aria-label="Templates"
            onClick={() => {
              setTool("templates");
              router.push("/resume");
            }}
            className={`${toolButtonBase} ${tool === "templates" ? toolButtonActive : toolButtonIdle}`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="4" y="4" width="7" height="7" rx="1" />
              <rect x="13" y="4" width="7" height="7" rx="1" />
              <rect x="4" y="13" width="7" height="7" rx="1" />
              <rect x="13" y="13" width="7" height="7" rx="1" />
            </svg>
          </button>
        </aside>

        {/* Center Canvas */}
        <div className="flex-1 min-h-0 min-w-0 flex flex-col" ref={canvasWrapRef}>
          <div
            ref={editor.viewportRef}
            id="slb-editor-viewport"
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-neutral-100 [scrollbar-gutter:stable] flex flex-col items-center"
          >
            <div
              className="flex flex-col items-center gap-6 py-4 shrink-0"
              style={{ width: pageDisplayW }}
            >
              {editor.pages.map((page, idx) => (
                <div
                  key={page.id}
                  ref={(el) => setPageRef(page.id, el)}
                  className="flex flex-col items-center shrink-0"
                  style={{ width: pageDisplayW }}
                  onMouseDown={() => editor.setActivePageIndex(idx)}
                  onClick={() => editor.setActivePageIndex(idx)}
                >
                  <div data-editor-viewport={page.id} className="flex justify-center shrink-0" style={{ width: pageDisplayW, height: pageDisplayH }}>
                    <canvas ref={(el) => editor.attachCanvasEl(page.id, el)} className="block" />
                  </div>
                  <div className="mt-1.5 flex justify-center gap-2 w-full">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const newId = editor.addPageAfter(idx);
                          if (newId) scrollToPage(newId);
                        }}
                        className="rounded border px-3 py-1.5 text-sm bg-white hover:bg-zinc-50"
                      >
                        Add Page
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const newId = editor.duplicatePage(idx);
                          if (newId) scrollToPage(newId);
                        }}
                        className="rounded border px-3 py-1.5 text-sm bg-white hover:bg-zinc-50"
                      >
                        Duplicate
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          editor.deletePage(idx);
                        }}
                        disabled={editor.pages.length <= 1}
                        className="rounded border px-3 py-1.5 text-sm bg-white hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
        </div>

        {/* Right Panel */}
        <aside className="w-[300px] shrink-0 h-full overflow-y-auto border-l bg-white p-4 space-y-6">
          {editor.selectionType === "text" && (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase text-zinc-500">Text</div>
              <select
                className="w-full rounded border px-2 py-1 text-sm"
                value={editor.textProps.fontFamily}
                onChange={(e) => editor.setTextProp({ fontFamily: e.target.value })}
              >
                {["Poppins", "Inter", "Montserrat", "Roboto"].map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={8}
                max={96}
                className="w-full rounded border px-2 py-1 text-sm"
                value={editor.textProps.fontSize}
                onChange={(e) => editor.setTextProp({ fontSize: Number(e.target.value) })}
              />
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    editor.setTextProp({
                      fontWeight: editor.textProps.fontWeight === "bold" ? "normal" : "bold",
                    })
                  }
                  className="rounded border px-2 py-1 text-sm"
                >
                  B
                </button>
                <button
                  onClick={() =>
                    editor.setTextProp({
                      fontStyle: editor.textProps.fontStyle === "italic" ? "normal" : "italic",
                    })
                  }
                  className="rounded border px-2 py-1 text-sm"
                >
                  I
                </button>
                <button
                  onClick={() => editor.setTextProp({ underline: !editor.textProps.underline })}
                  className="rounded border px-2 py-1 text-sm"
                >
                  U
                </button>
              </div>
              <input
                type="color"
                value={toHexColor(editor.textProps.fill, "#000000")}
                onChange={(e) => editor.setTextProp({ fill: e.target.value })}
                className="h-10 w-full rounded border"
              />
              <select
                className="w-full rounded border px-2 py-1 text-sm"
                value={editor.textProps.textAlign}
                onChange={(e) => editor.setTextProp({ textAlign: e.target.value as any })}
              >
                {["left", "center", "right", "justify"].map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded border px-2 py-1 text-sm"
                value={editor.textProps.lineHeight}
                onChange={(e) => editor.setTextProp({ lineHeight: Number(e.target.value) })}
              >
                {[1.0, 1.15, 1.3, 1.5, 1.8, 2.0].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          )}

          {editor.selectionType === "shape" && (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase text-zinc-500">Shape</div>
              <input
                type="color"
                value={toHexColor(editor.shapeProps.fill, "#000000")}
                onChange={(e) => editor.updateActiveObject({ fill: e.target.value })}
                className="h-10 w-full rounded border"
              />
              <input
                type="color"
                value={toHexColor(editor.shapeProps.stroke, "#000000")}
                onChange={(e) => editor.updateActiveObject({ stroke: e.target.value })}
                className="h-10 w-full rounded border"
              />
              <input
                type="number"
                min={0}
                max={20}
                value={editor.shapeProps.strokeWidth}
                onChange={(e) => editor.updateActiveObject({ strokeWidth: Number(e.target.value) })}
                className="w-full rounded border px-2 py-1 text-sm"
              />
              <input
                type="number"
                min={0}
                max={60}
                value={editor.shapeProps.cornerRadius}
                onChange={(e) =>
                  editor.updateActiveObject({
                    rx: Number(e.target.value),
                    ry: Number(e.target.value),
                  })
                }
                className="w-full rounded border px-2 py-1 text-sm"
              />
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={editor.shapeProps.opacity}
                onChange={(e) => editor.updateActiveObject({ opacity: Number(e.target.value) })}
                className="w-full rounded border px-2 py-1 text-sm"
              />
            </div>
          )}

          {editor.selectionType === "none" && (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase text-zinc-500">Page</div>
              <select
                className="w-full rounded border px-2 py-1 text-sm"
                value={editor.pageSize}
                onChange={(e) => {
                  const next = e.target.value as any;
                  editor.setPageSize(next);
                  if (next === "Custom") {
                    if (!customWidth || !customHeight) {
                      const w = fromPx(pageSizePx.w, customUnit);
                      const h = fromPx(pageSizePx.h, customUnit);
                      setCustomWidth(w.toFixed(2).replace(/\.00$/, ""));
                      setCustomHeight(h.toFixed(2).replace(/\.00$/, ""));
                    }
                  }
                }}
              >
                {["A4", "Letter", "Custom"].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>

              {editor.pageSize === "Custom" && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min={1}
                      step={0.1}
                      value={customWidth}
                      onChange={(e) => setCustomWidth(e.target.value)}
                      placeholder="Width"
                      className="w-full rounded border px-2 py-1 text-sm"
                    />
                    <input
                      type="number"
                      min={1}
                      step={0.1}
                      value={customHeight}
                      onChange={(e) => setCustomHeight(e.target.value)}
                      placeholder="Height"
                      className="w-full rounded border px-2 py-1 text-sm"
                    />
                  </div>
                  <select
                    className="w-full rounded border px-2 py-1 text-sm"
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value as any)}
                  >
                    {["mm", "cm", "in", "px", "pt"].map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <input
                type="color"
                value={toHexColor(editor.bgColor, "#f3f4f6")}
                onChange={(e) => editor.setPageBackground(e.target.value)}
                className="h-10 w-full rounded border"
              />

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editor.gridEnabled}
                  onChange={(e) => {
                    editor.setGridEnabled(e.target.checked);
                    editor.applyGrid(e.target.checked);
                  }}
                />
                Grid
              </label>
            </div>
          )}

          {editor.selectionType === "image" && (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase text-zinc-500">Image</div>
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={editor.imageProps.opacity}
                onChange={(e) => editor.updateActiveObject({ opacity: Number(e.target.value) })}
                className="w-full rounded border px-2 py-1 text-sm"
              />
            </div>
          )}

          {(editor.selectionType === "frame" || editor.isInImageFrameCropMode) && (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase text-zinc-500">
                {editor.isInImageFrameCropMode ? "Editing Image in Frame" : "Image Frame"}
              </div>
              <div className="flex flex-col gap-2">
                {editor.isInImageFrameCropMode ? (
                  <button
                    type="button"
                    className="w-full rounded bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700"
                    onClick={() => editor.exitImageFrameCropMode?.()}
                  >
                    Done editing
                  </button>
                ) : editor.selectedFrameHasImage ? (
                  <button
                    type="button"
                    className="w-full rounded bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700"
                    onClick={() => editor.enterImageFrameCropMode?.()}
                  >
                    Edit Image (position & zoom)
                  </button>
                ) : null}
                {!editor.isInImageFrameCropMode && (
                  <>
                    {editor.selectedFrameHasImage && (
                      <button
                        type="button"
                        className="w-full rounded border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50"
                        onClick={() => editor.removeImageFromFrame?.()}
                      >
                        Remove Image
                      </button>
                    )}
                    <button
                      type="button"
                      className="w-full rounded bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
                      onClick={() => editor.deleteFrameEntirely?.()}
                    >
                      Delete Frame
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="mt-4">
            <div className="text-xs font-semibold text-zinc-500 mb-2">ALIGN</div>
            <div className="grid grid-cols-3 gap-2">
              <button
                className="rounded border px-2 py-1 text-xs disabled:opacity-50"
                onClick={() => editor.alignSelected?.("left")}
                disabled={!editor?.hasSelection}
              >
                Left
              </button>
              <button
                className="rounded border px-2 py-1 text-xs disabled:opacity-50"
                onClick={() => editor.alignSelected?.("centerX")}
                disabled={!editor?.hasSelection}
              >
                Center
              </button>
              <button
                className="rounded border px-2 py-1 text-xs disabled:opacity-50"
                onClick={() => editor.alignSelected?.("right")}
                disabled={!editor?.hasSelection}
              >
                Right
              </button>
              <button
                className="rounded border px-2 py-1 text-xs disabled:opacity-50"
                onClick={() => editor.alignSelected?.("top")}
                disabled={!editor?.hasSelection}
              >
                Top
              </button>
              <button
                className="rounded border px-2 py-1 text-xs disabled:opacity-50"
                onClick={() => editor.alignSelected?.("middle")}
                disabled={!editor?.hasSelection}
              >
                Middle
              </button>
              <button
                className="rounded border px-2 py-1 text-xs disabled:opacity-50"
                onClick={() => editor.alignSelected?.("bottom")}
                disabled={!editor?.hasSelection}
              >
                Bottom
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-zinc-500">Layers</div>
            <div className="space-y-2">
              {editor.layers.map((layer, idx) => (
                <div
                  key={layer.id}
                  onClick={() => editor.selectLayerById(layer.id)}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", String(idx))}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = Number(e.dataTransfer.getData("text/plain"));
                    if (Number.isFinite(from)) editor.reorderLayer(from, idx);
                  }}
                  className={`flex items-center justify-between rounded px-2 py-1 text-xs ${
                    editor.selectedLayerId === layer.id ? "bg-zinc-200 text-zinc-900" : "hover:bg-zinc-100"
                  }`}
                >
                  {editingLayerId === layer.id ? (
                    <input
                      className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-1 py-0.5 text-xs"
                      value={editingLayerValue}
                      onChange={(e) => setEditingLayerValue(e.target.value)}
                      onKeyDownCapture={(e) => {
                        e.stopPropagation();
                        (e.nativeEvent as any)?.stopImmediatePropagation?.();
                      }}
                      onBlur={() => {
                        editor.renameLayer(layer.id, editingLayerValue);
                        setEditingLayerId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          editor.renameLayer(layer.id, editingLayerValue);
                          setEditingLayerId(null);
                        }
                        if (e.key === "Escape") setEditingLayerId(null);
                      }}
                      data-layer-rename="1"
                      autoFocus
                    />
                  ) : (
                    <button
                      className="min-w-0 flex-1 truncate text-left"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingLayerId(layer.id);
                        setEditingLayerValue(layer.displayName || "");
                      }}
                      title="Rename layer"
                    >
                      {layer.displayName}
                    </button>
                  )}

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        editor.layerBringToFront(layer.id);
                      }}
                      className="rounded border px-1.5 py-0.5"
                      title="Bring to front"
                      aria-label="Bring to front"
                    >
                      ⬆️
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        editor.layerSendToBack(layer.id);
                      }}
                      className="rounded border px-1.5 py-0.5"
                      title="Send to back"
                      aria-label="Send to back"
                    >
                      ⬇️
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        editor.layerBringForward(layer.id);
                      }}
                      className="rounded border px-1.5 py-0.5"
                      title="Bring forward"
                      aria-label="Bring forward"
                    >
                      ↑
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        editor.layerSendBackward(layer.id);
                      }}
                      className="rounded border px-1.5 py-0.5"
                      title="Send backward"
                      aria-label="Send backward"
                    >
                      ↓
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        editor.setLayerVisible(layer.id, !layer.visible);
                      }}
                      className="rounded border px-2 py-0.5"
                    >
                      {layer.visible ? "👁" : "🚫"}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        editor.setLayerLocked(layer.id, !layer.locked);
                      }}
                      className="rounded border px-2 py-0.5"
                    >
                      {layer.locked ? "🔒" : "🔓"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {isDownloadOpen && (
        <div className="fixed inset-0 z-[9999] flex items-start justify-end p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setIsDownloadOpen(false)} />

          <div className="relative w-[320px] rounded-xl bg-white shadow-xl border p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Download</div>
              <button className="rounded border px-2 py-1 text-xs" onClick={() => setIsDownloadOpen(false)}>
                Close
              </button>
            </div>

            <div className="mt-3 space-y-3">
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase text-zinc-500">Format</div>
                <select
                  className="w-full rounded border px-2 py-2 text-sm"
                  value={selectedDownloadFormat}
                  onChange={(e) => setSelectedDownloadFormat(e.target.value as "pdf" | "png")}
                >
                  <option value="pdf">PDF</option>
                  <option value="png">PNG</option>
                </select>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase text-zinc-500">Pages</div>

                <div className="max-h-40 overflow-auto rounded border p-2 space-y-2">
                  {editor.pages.map((_, i) => {
                    const checked = selectedPages.includes(i);
                    return (
                      <label key={i} className="flex items-center justify-between text-sm">
                        <span>Page {i + 1}</span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const nextChecked = e.target.checked;
                            setSelectedPages((prev) => {
                              if (nextChecked) return Array.from(new Set([...prev, i])).sort((a, b) => a - b);
                              const next = prev.filter((x) => x !== i);
                              return next.length ? next : [0];
                            });
                          }}
                        />
                      </label>
                    );
                  })}
                </div>

                <button
                  className="text-xs underline text-zinc-600"
                  onClick={() => setSelectedPages(editor.pages.map((_, i) => i))}
                  type="button"
                >
                  Select all
                </button>
              </div>

              <button
                className="w-full rounded bg-black px-3 py-2 text-sm text-white"
                onClick={() => {
                  setIsDownloadOpen(false);
                  setPendingExport({ format: selectedDownloadFormat, pages: selectedPages });
                  setIsAdOpen(true);
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {showFrameDeleteModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowFrameDeleteModal(false)}
          />
          <div className="relative w-[320px] rounded-xl bg-white shadow-xl border p-4">
            <div className="text-sm font-semibold mb-3">Delete Image Frame</div>
            <p className="text-sm text-zinc-600 mb-4">
              What would you like to do?
            </p>
            <div className="flex flex-col gap-2">
              <button
                className="w-full rounded bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
                onClick={() => {
                  editor.deleteFrameEntirely?.();
                  setShowFrameDeleteModal(false);
                }}
              >
                Delete Frame (remove entirely)
              </button>
              <button
                className="w-full rounded border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50"
                onClick={() => {
                  editor.removeImageFromFrame?.();
                  setShowFrameDeleteModal(false);
                }}
              >
                Remove Image Only (keep frame)
              </button>
              <button
                className="w-full rounded border border-zinc-200 px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-50"
                onClick={() => setShowFrameDeleteModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isAdOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" />

          <div className="relative w-[860px] max-w-[95vw] rounded-2xl bg-white shadow-2xl border p-6">
            <div className="flex items-center justify-between">
              <div className="text-base font-semibold">Sponsored</div>
              <button
                className="text-sm text-zinc-500 hover:text-zinc-700"
                onClick={() => setIsAdOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="mt-4 rounded-xl bg-zinc-100 overflow-hidden">
              <div className="aspect-video w-full flex items-center justify-center text-sm text-zinc-500">
                Ad placeholder (landscape video)
              </div>
            </div>

            <div className="mt-4 text-sm text-zinc-700">
              {adCountdown > 0 ? `Please wait ${adCountdown}s...` : "Ready to download"}
            </div>

            <button
              className="mt-4 w-full rounded-xl bg-black px-4 py-3 text-sm text-white disabled:opacity-50"
              disabled={adCountdown > 0}
              onClick={handleAdComplete}
              type="button"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) editor.addImage(file);
        }}
      />
    </div>
  );
}
