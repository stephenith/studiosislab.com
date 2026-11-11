"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Canvas } from "fabric";
import { getSystemTemplateById } from "@/data/systemTemplates/registry";
import { initFabricCanvas } from "@/lib/editor/canvasInitializer";
import { exportToDataURL, buildPDFFromPages } from "@/lib/editor/exportCanvas";
import {
  applyMobileInteractionLocks,
  applyMobileViewportTransform,
  ensurePageBackground,
  fabricSavePayloadHasDataImageSrc,
  findEditableTargetAtContainerPoint,
  fitCanvasToViewport,
  getPageBounds,
  loadSnapshotOntoCanvas,
  MOBILE_TAP_MAX_DURATION_MS,
  MOBILE_TAP_MOVE_THRESHOLD_PX,
  selectionFrameForObject,
  serializeCanvasForSave,
  type MobileSelectionFrame,
  type MobileViewportState,
  zoomViewportAroundPoint,
} from "@/lib/editor/mobileEditorUtils";
import {
  mergePreservedImages,
  mobileSavePayload,
  pagesFromResumeRecord,
  resumeHasLocalOnlyImage,
  savedPagePixelSize,
  updatedAtToken,
} from "@/lib/editor/mobileDocument";
import { processLocalImageFiles } from "@/components/editor/processLocalImageFiles";
import {
  addMobileFrame,
  addMobileImage,
  addMobileShape,
  addMobileTable,
  addMobileText,
  applyMobileTextStyle,
  deleteMobileObject,
  duplicateMobileObject,
  exitCanvasText,
  focusCanvasText,
  readTextStyle,
  resizeMobileObject,
} from "@/components/editor/mobile/mobileCanvasActions";
import { getSkillBarModel, setSkillBarValueOnGroup } from "@/lib/editor/skillBar/skillBarFactory";
import {
  getStarRatingModel,
  resolveStarRatingValueFromPointer,
  setStarRatingValueOnGroup,
} from "@/lib/editor/starRating/starRatingFactory";
import { commitMobileResumeDoc, getResumeDoc, updateResumeThumbnail } from "@/lib/resumeDocs";
import { generateResumeThumbnail } from "@/lib/resumePreviewExport";
import { getAsset } from "@/lib/localAssets";
import { useAuth } from "@/lib/useAuth";
import type { PageSize, TextProps } from "@/types/editor";

export type MobileSaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error" | "stale";

export type MobileTextEditState = { draft: string } | null;

export type MobileSkillBarEditState = {
  draftValue: number;
  max: number;
  label: string;
  originalValue: number;
} | null;

type UseMobileFabricEditorOptions = {
  templateId: string | null;
  docId: string | null;
  blank?: boolean;
};

type GestureMode = "none" | "pan" | "pinch" | "move";

type GestureSession = {
  mode: GestureMode;
  startTime: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startDistance: number;
  startZoom: number;
  startPanX: number;
  startPanY: number;
  pinchCenterX: number;
  pinchCenterY: number;
  hadGesture: boolean;
};

const CLOUD_SAVE_MS = 3000;

function touchDistance(t1: Touch, t2: Touch): number {
  return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
}

function touchCenter(t1: Touch, t2: Touch, container: HTMLElement): { x: number; y: number } {
  const rect = container.getBoundingClientRect();
  return {
    x: (t1.clientX + t2.clientX) / 2 - rect.left,
    y: (t1.clientY + t2.clientY) / 2 - rect.top,
  };
}

function emptyGesture(): GestureSession {
  return {
    mode: "none",
    startTime: 0,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    startDistance: 0,
    startZoom: 1,
    startPanX: 0,
    startPanY: 0,
    pinchCenterX: 0,
    pinchCenterY: 0,
    hadGesture: false,
  };
}

function assetIdOf(node: any): string {
  return String(node?.slbAssetId || node?.data?.slbAssetId || "").trim();
}

async function hydrateCanvasImages(canvas: Canvas, urls: string[]): Promise<void> {
  const visit = async (objects: any[]) => {
    for (const obj of objects) {
      if (!obj) continue;
      const nested = obj.getObjects?.() || obj._objects || [];
      if (Array.isArray(nested) && nested.length > 0) await visit(nested);
      if (String(obj.type || "").toLowerCase() !== "image") continue;
      const assetId = assetIdOf(obj);
      if (!assetId) continue;
      const blob = await getAsset(assetId).catch(() => null);
      if (!blob) continue;
      const url = URL.createObjectURL(blob);
      urls.push(url);
      if (typeof obj.setSrc === "function") {
        await obj.setSrc(url, { crossOrigin: "anonymous" }).catch(() => undefined);
      } else {
        obj.set?.({ src: url });
      }
      obj.set?.({ slbAssetId: assetId });
      obj.setCoords?.();
    }
  };
  await visit(canvas.getObjects?.() || []);
  canvas.requestRenderAll();
}

export function useMobileFabricEditor({ templateId, docId, blank = false }: UseMobileFabricEditorOptions) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const canvasRef = useRef<Canvas | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const pageSizeRef = useRef<{ w: number; h: number }>({ w: 794, h: 1123 });
  const pageSizeKeyRef = useRef<PageSize>("A4");
  const editingObjectRef = useRef<any>(null);
  const editingSkillBarRef = useRef<any>(null);
  const selectedObjectRef = useRef<any>(null);
  const docIdRef = useRef<string | null>(docId);
  const baseRevisionRef = useRef<number | null>(docId ? 0 : null);
  const baseUpdatedAtRef = useRef<string | null>(null);
  const shapeRef = useRef<"pages" | "canvas">("canvas");
  const serverPagesRef = useRef<any[]>([]);
  const activePageRef = useRef(0);
  const loadedKeyRef = useRef<string | null>(null);
  const saveGenRef = useRef(0);
  const savingRef = useRef(false);
  const saveQueuedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressDirtyRef = useRef(false);
  const objectUrlsRef = useRef<string[]>([]);
  const viewStateRef = useRef<MobileViewportState>({ zoom: 1, panX: 0, panY: 0 });
  const baseZoomRef = useRef(1);
  const userAdjustedViewRef = useRef(false);
  const gestureRef = useRef<GestureSession>(emptyGesture());
  const gestureHitRef = useRef<any>(null);
  const textOpenRef = useRef(false);
  const lastSizeRef = useRef({ w: 0, h: 0 });
  const resizeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [canvasReady, setCanvasReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [docTitle, setDocTitleState] = useState("Untitled Resume");
  const [saveStatus, setSaveStatus] = useState<MobileSaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [textEdit, setTextEdit] = useState<MobileTextEditState>(null);
  const [skillBarEdit, setSkillBarEdit] = useState<MobileSkillBarEditState>(null);
  const [downloadKind, setDownloadKind] = useState<"pdf" | "png" | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [selectionFrame, setSelectionFrame] = useState<MobileSelectionFrame | null>(null);
  const [selectionLabel, setSelectionLabel] = useState<string | null>(null);
  const [imageNotice, setImageNotice] = useState<string | null>(null);
  const [textStyle, setTextStyle] = useState<ReturnType<typeof readTextStyle> | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [saveKick, setSaveKick] = useState(0);
  const saveStatusRef = useRef<MobileSaveStatus>("idle");

  textOpenRef.current = !!textEdit || !!skillBarEdit;
  saveStatusRef.current = saveStatus;

  useEffect(() => {
    if (docId) docIdRef.current = docId;
  }, [docId]);

  const refreshSelectionFrame = useCallback(() => {
    const frame = selectionFrameForObject(selectedObjectRef.current);
    const canvas = canvasRef.current;
    const wrap = canvasWrapRef.current;
    const element = canvas?.getElement?.();
    if (!frame || !wrap || !element?.width || !element.height) {
      setSelectionFrame(null);
      return;
    }
    const canvasRect = element.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const scaleX = canvasRect.width / element.width;
    const scaleY = canvasRect.height / element.height;
    setSelectionFrame({
      left: canvasRect.left - wrapRect.left + frame.left * scaleX,
      top: canvasRect.top - wrapRect.top + frame.top * scaleY,
      width: frame.width * scaleX,
      height: frame.height * scaleY,
    });
  }, []);

  const applyViewState = useCallback(
    (state: MobileViewportState) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      viewStateRef.current = state;
      applyMobileViewportTransform(canvas, state);
      const base = baseZoomRef.current || state.zoom || 1;
      setZoomPercent(Math.max(100, Math.round((state.zoom / base) * 100)));
      refreshSelectionFrame();
    },
    [refreshSelectionFrame]
  );

  const fitToContainer = useCallback(
    (options?: { force?: boolean }) => {
      if (userAdjustedViewRef.current && !options?.force) return;
      const canvas = canvasRef.current;
      const viewport = viewportRef.current;
      if (!canvas || !viewport) return;
      const rect = viewport.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const pageBounds = getPageBounds(canvas, pageSizeKeyRef.current);
      const result = fitCanvasToViewport(canvas, rect.width, rect.height, pageBounds);
      viewStateRef.current = result.state;
      baseZoomRef.current = result.baseZoom;
      setZoomPercent(100);
      lastSizeRef.current = { w: rect.width, h: rect.height };
      refreshSelectionFrame();
    },
    [refreshSelectionFrame]
  );

  const resetView = useCallback(() => {
    userAdjustedViewRef.current = false;
    fitToContainer({ force: true });
  }, [fitToContainer]);

  const selectObject = useCallback(
    (obj: any, label: string | null) => {
      selectedObjectRef.current = obj;
      setSelectionLabel(label);
      refreshSelectionFrame();
    },
    [refreshSelectionFrame]
  );

  const rememberPageEdits = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const index = activePageRef.current;
    const current = serializeCanvasForSave(canvas);
    const serverPage = serverPagesRef.current[index];
    const merged = serverPage ? mergePreservedImages(current, serverPage) : current;
    const pages = serverPagesRef.current.slice();
    pages[index] = merged;
    serverPagesRef.current = pages;
  }, []);

  const loadPageAt = useCallback(
    async (index: number, snapshot: any) => {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas failed to initialize");
      const box = savedPagePixelSize(snapshot);
      pageSizeRef.current = box;
      if (Math.abs(box.w - 816) < 8 && Math.abs(box.h - 1056) < 8) pageSizeKeyRef.current = "Letter";
      else if (Math.abs(box.w - 794) < 8 && Math.abs(box.h - 1123) < 8) pageSizeKeyRef.current = "A4";
      else pageSizeKeyRef.current = "Custom";
      canvas.setDimensions({ width: box.w, height: box.h });
      await loadSnapshotOntoCanvas(canvas, snapshot, box.w, box.h, {
        isTemplateLoad: false,
        preserveUserImages: true,
        preservePageBox: true,
      });
      await hydrateCanvasImages(canvas, objectUrlsRef.current);
      activePageRef.current = index;
      setPageIndex(index);
      requestAnimationFrame(() => fitToContainer({ force: true }));
    },
    [fitToContainer]
  );

  const markUnsaved = useCallback(() => {
    if (suppressDirtyRef.current) return;
    saveGenRef.current += 1;
    setSaveError(null);
    setSaveStatus((status) => (status === "stale" ? status : "unsaved"));
  }, []);

  const setDocTitle = useCallback(
    (title: string) => {
      setDocTitleState(title);
      markUnsaved();
    },
    [markUnsaved]
  );

  const attachCanvasEl = useCallback((el: HTMLCanvasElement | null) => {
    if (!el) return;
    if (canvasRef.current) {
      try {
        canvasRef.current.dispose();
      } catch {
        /* ignore */
      }
      canvasRef.current = null;
    }
    const { w, h } = pageSizeRef.current;
    const canvas = initFabricCanvas(el, {
      width: w,
      height: h,
      backgroundColor: "#ebecf0",
      selection: false,
      preserveObjectStacking: true,
    });
    canvasRef.current = canvas;
    setCanvasReady(true);
  }, []);

  const showPage = useCallback(
    async (index: number) => {
      if (index < 0 || index >= serverPagesRef.current.length || index === activePageRef.current) return;
      rememberPageEdits();
      selectedObjectRef.current = null;
      setSelectionLabel(null);
      setSelectionFrame(null);
      setTextEdit(null);
      setSkillBarEdit(null);
      await loadPageAt(index, serverPagesRef.current[index]);
    },
    [loadPageAt, rememberPageEdits]
  );

  const save = useCallback(async () => {
    if (saveStatusRef.current === "stale") return false;
    if (savingRef.current) {
      saveQueuedRef.current = true;
      return false;
    }
    const canvas = canvasRef.current;
    if (!canvas || !user?.uid) {
      saveStatusRef.current = "error";
      setSaveStatus("error");
      setSaveError("Sign in again to save this resume.");
      return false;
    }
    rememberPageEdits();
    const activeJson = serializeCanvasForSave(canvas);
    const payload = mobileSavePayload({
      shape: shapeRef.current,
      serverPages: serverPagesRef.current,
      activeIndex: activePageRef.current,
      activeJson,
    });
    const saveBody = payload.pagesData || payload.canvasJson;
    if (fabricSavePayloadHasDataImageSrc(saveBody)) {
      saveStatusRef.current = "error";
      setSaveStatus("error");
      setSaveError("A photo in this resume can't be saved from the phone. Nothing was overwritten.");
      return false;
    }

    const generation = saveGenRef.current;
    savingRef.current = true;
    saveStatusRef.current = "saving";
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const creating = !docIdRef.current;
      const result = await commitMobileResumeDoc({
        uid: user.uid,
        docId: docIdRef.current,
        baseRevision: creating ? null : baseRevisionRef.current,
        baseUpdatedAt: creating ? null : baseUpdatedAtRef.current,
        title: docTitle || "Untitled Resume",
        sourceTemplateId: creating ? templateId || "blank" : undefined,
        canvasJson: payload.canvasJson,
        pagesData: payload.pagesData,
      });
      if (!result.ok) {
        if (result.reason === "stale") {
          saveStatusRef.current = "stale";
          setSaveStatus("stale");
          setSaveError("This resume was saved on another device. Reload the latest version. Your unsaved phone edits were not written over it.");
          return false;
        }
        saveStatusRef.current = "error";
        setSaveStatus("error");
        setSaveError("This resume could not be found. Reload and try again.");
        return false;
      }

      docIdRef.current = result.docId;
      baseRevisionRef.current = result.autosaveRevision;
      baseUpdatedAtRef.current = result.updatedAtToken;
      loadedKeyRef.current = `doc:${result.docId}`;
      if (payload.pagesData) {
        shapeRef.current = "pages";
        serverPagesRef.current = payload.pagesData;
      } else if (payload.canvasJson) {
        shapeRef.current = "canvas";
        serverPagesRef.current = [payload.canvasJson];
      }

      const params = new URLSearchParams(window.location.search);
      if (params.get("doc") !== result.docId) {
        params.set("doc", result.docId);
        router.replace(`${pathname}?${params.toString()}`);
      }

      const savedId = result.docId;
      const savedUid = user.uid;
      const thumbnailRevision = result.autosaveRevision;
      void (async () => {
        try {
          const thumb = await generateResumeThumbnail({
            pagesData: payload.pagesData,
            canvasJson: payload.pagesData ? undefined : payload.canvasJson,
            pageSize: pageSizeKeyRef.current === "Letter" ? "Letter" : "A4",
          });
          if (!thumb) return;
          await updateResumeThumbnail({
            uid: savedUid,
            docId: savedId,
            thumbnail: thumb,
            thumbnailRevision,
          });
        } catch (err) {
          console.error("[mobile-editor] Thumbnail failed", err);
        }
      })();

      if (generation !== saveGenRef.current) {
        saveStatusRef.current = "unsaved";
        setSaveStatus("unsaved");
        setSaveKick((value) => value + 1);
      } else {
        saveStatusRef.current = "saved";
        setSaveStatus("saved");
      }
      return true;
    } catch (err) {
      console.error("[mobile-editor] Save failed", err);
      saveStatusRef.current = "error";
      setSaveStatus("error");
      setSaveError("Save failed. Your latest cloud copy was not changed.");
      return false;
    } finally {
      savingRef.current = false;
      if (saveQueuedRef.current && saveStatusRef.current !== "stale") {
        saveQueuedRef.current = false;
        saveStatusRef.current = "unsaved";
        setSaveStatus("unsaved");
        setSaveKick((value) => value + 1);
      }
    }
  }, [docTitle, pathname, rememberPageEdits, router, templateId, user?.uid]);

  useEffect(() => {
    if (saveStatus !== "unsaved") return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void save();
    }, CLOUD_SAVE_MS);
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [save, saveKick, saveStatus]);

  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden" && saveStatus === "unsaved") void save();
    };
    document.addEventListener("visibilitychange", flush);
    return () => document.removeEventListener("visibilitychange", flush);
  }, [save, saveStatus]);

  const reloadLatest = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    loadedKeyRef.current = null;
    setSaveStatus("idle");
    setSaveError(null);
    setReloadNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!canvasReady) return;
    const key = docId ? `doc:${docId}` : blank ? "blank" : `tpl:${templateId || ""}`;
    if (loadedKeyRef.current === key) return;
    if (docId && !user?.uid) return;

    let cancelled = false;
    suppressDirtyRef.current = true;
    userAdjustedViewRef.current = false;
    setLoading(true);
    setLoadError(null);
    setImageNotice(null);
    selectedObjectRef.current = null;
    setSelectionFrame(null);
    setSelectionLabel(null);

    const run = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        if (docId && user?.uid) {
          const record = await getResumeDoc({ uid: user.uid, docId });
          if (cancelled) return;
          if (!record) {
            setLoadError("That saved resume could not be found in this account.");
            setLoading(false);
            return;
          }
          const parsed = pagesFromResumeRecord(record);
          serverPagesRef.current = parsed.pages;
          shapeRef.current = parsed.shape;
          docIdRef.current = docId;
          baseRevisionRef.current = typeof record.autosaveRevision === "number" ? record.autosaveRevision : 0;
          baseUpdatedAtRef.current = updatedAtToken(record.updatedAt);
          setDocTitleState(record.title || "Untitled Resume");
          setPageCount(parsed.pages.length);
          if (parsed.pages.some((page) => resumeHasLocalOnlyImage(page))) {
            setImageNotice(
              "Photos added on another device stay in this resume. This phone does not replace them."
            );
          }
          await loadPageAt(0, parsed.pages[0]);
        } else if (blank || !templateId) {
          const box = { w: 794, h: 1123 };
          pageSizeRef.current = box;
          pageSizeKeyRef.current = "A4";
          canvas.setDimensions({ width: box.w, height: box.h });
          canvas.clear();
          ensurePageBackground(canvas, box.w, box.h, "#ffffff");
          applyMobileInteractionLocks(canvas, box.w, box.h);
          const empty = serializeCanvasForSave(canvas);
          serverPagesRef.current = [empty];
          shapeRef.current = "canvas";
          docIdRef.current = null;
          baseRevisionRef.current = null;
          baseUpdatedAtRef.current = null;
          setDocTitleState("Untitled Resume");
          setPageCount(1);
          activePageRef.current = 0;
          setPageIndex(0);
          requestAnimationFrame(() => fitToContainer({ force: true }));
        } else {
          const template = getSystemTemplateById(templateId);
          if (!template) {
            setLoadError("Template not found.");
            setLoading(false);
            return;
          }
          setDocTitleState(template.name || "Untitled Resume");
          const snapshot = await template.load();
          if (cancelled) return;
          const box = savedPagePixelSize(snapshot);
          pageSizeRef.current = { w: 794, h: 1123 };
          pageSizeKeyRef.current = "A4";
          canvas.setDimensions({ width: 794, height: 1123 });
          await loadSnapshotOntoCanvas(canvas, snapshot, 794, 1123, { isTemplateLoad: true });
          const loaded = serializeCanvasForSave(canvas);
          serverPagesRef.current = [loaded];
          shapeRef.current = "canvas";
          docIdRef.current = null;
          baseRevisionRef.current = null;
          baseUpdatedAtRef.current = null;
          setPageCount(1);
          activePageRef.current = 0;
          setPageIndex(0);
          if (box.w > 1400) {
            /* Catalog pages are scaled into A4 by the existing template loader. */
          }
          requestAnimationFrame(() => fitToContainer({ force: true }));
        }
        if (cancelled) return;
        loadedKeyRef.current = key;
        setSaveStatus("idle");
        setLoading(false);
      } catch (err) {
        console.error("[mobile-editor] Failed to load", err);
        if (!cancelled) {
          setLoadError("We couldn't load this resume. Please try again.");
          setLoading(false);
        }
      } finally {
        suppressDirtyRef.current = false;
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [blank, canvasReady, docId, fitToContainer, loadPageAt, reloadNonce, templateId, user?.uid]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width = entry.contentRect.width;
      const height = entry.contentRect.height;
      const previous = lastSizeRef.current;
      if (previous.w > 0 && Math.abs(width - previous.w) < 1 && Math.abs(height - previous.h) < 1) return;
      const largeChange = Math.abs(width - previous.w) >= 80 || Math.abs(height - previous.h) >= 80;
      if (resizeDebounceRef.current) clearTimeout(resizeDebounceRef.current);
      resizeDebounceRef.current = setTimeout(() => {
        if (largeChange) userAdjustedViewRef.current = false;
        fitToContainer({ force: largeChange });
      }, 120);
    });
    observer.observe(viewport);
    return () => {
      observer.disconnect();
      if (resizeDebounceRef.current) clearTimeout(resizeDebounceRef.current);
    };
  }, [fitToContainer, loading]);

  const beginPinchGesture = useCallback(
    (t0: Touch, t1: Touch, container: HTMLElement) => {
      const center = touchCenter(t0, t1, container);
      const state = viewStateRef.current;
      gestureRef.current = {
        ...gestureRef.current,
        mode: "pinch",
        startDistance: touchDistance(t0, t1),
        startZoom: state.zoom,
        startPanX: state.panX,
        startPanY: state.panY,
        pinchCenterX: center.x,
        pinchCenterY: center.y,
        hadGesture: true,
      };
      userAdjustedViewRef.current = true;
    },
    []
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;
    if (!viewport || !canvas || !canvasReady || loading) return;

    const localPoint = (touch: Touch) => {
      const rect = viewport.getBoundingClientRect();
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    };

    const onTouchStart = (event: TouchEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("[data-slb-canvas-control]")) return;
      if (event.touches.length === 1) {
        const point = localPoint(event.touches[0]);
        gestureHitRef.current = findEditableTargetAtContainerPoint(
          canvas,
          viewport,
          event.touches[0].clientX,
          event.touches[0].clientY
        );
        gestureRef.current = {
          ...emptyGesture(),
          mode: "pan",
          startTime: Date.now(),
          startX: point.x,
          startY: point.y,
          lastX: point.x,
          lastY: point.y,
        };
      } else if (event.touches.length >= 2) {
        gestureHitRef.current = null;
        gestureRef.current = { ...emptyGesture(), mode: "pinch", startTime: Date.now() };
        beginPinchGesture(event.touches[0], event.touches[1], viewport);
        event.preventDefault();
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      const gesture = gestureRef.current;
      if (gesture.mode === "move" && event.touches.length === 1) {
        const point = localPoint(event.touches[0]);
        const obj = selectedObjectRef.current;
        if (!obj || obj.isEditing) return;
        const zoom = viewStateRef.current.zoom || 1;
        obj.set?.({
          left: (obj.left || 0) + (point.x - gesture.lastX) / zoom,
          top: (obj.top || 0) + (point.y - gesture.lastY) / zoom,
        });
        obj.setCoords?.();
        canvas.requestRenderAll();
        refreshSelectionFrame();
        gesture.lastX = point.x;
        gesture.lastY = point.y;
        markUnsaved();
        event.preventDefault();
        return;
      }
      if (gesture.mode === "pan" && event.touches.length === 1) {
        const point = localPoint(event.touches[0]);
        const total = Math.hypot(point.x - gesture.startX, point.y - gesture.startY);
        if (total <= MOBILE_TAP_MOVE_THRESHOLD_PX) return;
        if (!gesture.hadGesture) {
          gesture.hadGesture = true;
          gesture.lastX = point.x;
          gesture.lastY = point.y;
          const hit = gestureHitRef.current;
          const selected = selectedObjectRef.current;
          const moveTarget =
            selected && hit && (hit.object === selected || hit.host === selected) && !selected.isEditing
              ? selected
              : null;
          if (moveTarget) {
            gesture.mode = "move";
            return;
          }
          if (selected?.isEditing) return;
          userAdjustedViewRef.current = true;
          return;
        }
        const next = {
          ...viewStateRef.current,
          panX: viewStateRef.current.panX + (point.x - gesture.lastX),
          panY: viewStateRef.current.panY + (point.y - gesture.lastY),
        };
        applyViewState(next);
        gesture.lastX = point.x;
        gesture.lastY = point.y;
        event.preventDefault();
      } else if (event.touches.length >= 2) {
        const first = event.touches[0];
        const second = event.touches[1];
        if (gesture.mode !== "pinch" || gesture.startDistance <= 0) {
          beginPinchGesture(first, second, viewport);
        }
        const pinch = gestureRef.current;
        const next = zoomViewportAroundPoint(
          { zoom: pinch.startZoom, panX: pinch.startPanX, panY: pinch.startPanY },
          pinch.startZoom * (touchDistance(first, second) / pinch.startDistance),
          touchCenter(first, second, viewport).x,
          touchCenter(first, second, viewport).y,
          baseZoomRef.current
        );
        applyViewState(next);
        pinch.hadGesture = true;
        event.preventDefault();
      }
    };

    const onTouchEnd = (event: TouchEvent) => {
      const gesture = gestureRef.current;
      if (event.touches.length === 0) {
        const duration = Date.now() - gesture.startTime;
        const shouldTap =
          !gesture.hadGesture &&
          gesture.mode === "pan" &&
          duration < MOBILE_TAP_MAX_DURATION_MS &&
          event.changedTouches.length === 1;
        if (shouldTap) {
          const touch = event.changedTouches[0];
          const hit = findEditableTargetAtContainerPoint(canvas, viewport, touch.clientX, touch.clientY);
          if (hit?.type === "skill-bar") {
            const model = getSkillBarModel(hit.object);
            editingSkillBarRef.current = hit.object;
            selectObject(hit.object, model.label || "Skill bar");
            setTextStyle(null);
            setTextEdit(null);
            setSkillBarEdit({
              draftValue: model.value,
              max: model.max,
              label: model.label,
              originalValue: model.value,
            });
          } else if (hit?.type === "star-rating") {
            const nextValue = resolveStarRatingValueFromPointer(canvas, hit.object, touch.clientX, touch.clientY);
            selectObject(hit.object, "Star rating");
            if (nextValue != null) {
              const originalValue = getStarRatingModel(hit.object).value;
              setStarRatingValueOnGroup(hit.object, nextValue);
              canvas.requestRenderAll();
              if (nextValue !== originalValue) markUnsaved();
            }
          } else if (hit?.type === "text") {
            editingObjectRef.current = hit.object;
            const text = String(hit.object.text ?? "");
            selectObject(hit.host || hit.object, text.split("\n")[0].slice(0, 42) || "Text");
            setTextStyle(readTextStyle(hit.object));
            setTextEdit(focusCanvasText(canvas, hit.object) ? null : { draft: text });
            setSkillBarEdit(null);
          } else if (hit?.type === "object") {
            editingObjectRef.current = null;
            exitCanvasText(selectedObjectRef.current);
            selectObject(hit.object, hit.object?.data?.role === "table" ? "Table" : "Selection");
            setTextStyle(null);
            setTextEdit(null);
            setSkillBarEdit(null);
          } else {
            exitCanvasText(selectedObjectRef.current);
            editingObjectRef.current = null;
            selectObject(null, null);
            setTextStyle(null);
            setTextEdit(null);
            setSkillBarEdit(null);
          }
        }
        gestureRef.current = emptyGesture();
      } else if (event.touches.length === 1 && gesture.mode === "pinch") {
        const point = localPoint(event.touches[0]);
        gestureRef.current = {
          ...emptyGesture(),
          mode: "pan",
          startTime: Date.now(),
          startX: point.x,
          startY: point.y,
          lastX: point.x,
          lastY: point.y,
          hadGesture: true,
        };
      }
    };

    viewport.addEventListener("touchstart", onTouchStart, { passive: false });
    viewport.addEventListener("touchmove", onTouchMove, { passive: false });
    viewport.addEventListener("touchend", onTouchEnd, { passive: false });
    viewport.addEventListener("touchcancel", () => {
      gestureRef.current = emptyGesture();
    });
    return () => {
      viewport.removeEventListener("touchstart", onTouchStart);
      viewport.removeEventListener("touchmove", onTouchMove);
      viewport.removeEventListener("touchend", onTouchEnd);
    };
  }, [applyViewState, beginPinchGesture, canvasReady, loading, markUnsaved, refreshSelectionFrame, selectObject]);

  const closeTextEdit = useCallback(() => {
    editingObjectRef.current = null;
    setTextEdit(null);
  }, []);

  const closeSkillBarEdit = useCallback(() => {
    editingSkillBarRef.current = null;
    setSkillBarEdit(null);
    canvasRef.current?.discardActiveObject();
    canvasRef.current?.requestRenderAll();
  }, []);

  const previewSkillBarValue = useCallback((value: number) => {
    const canvas = canvasRef.current;
    const group = editingSkillBarRef.current;
    if (!canvas || !group) return;
    setSkillBarValueOnGroup(group, value);
    setSkillBarEdit((prev) => (prev ? { ...prev, draftValue: getSkillBarModel(group).value } : prev));
    canvas.requestRenderAll();
  }, []);

  const cancelSkillBarEdit = useCallback(() => {
    const canvas = canvasRef.current;
    const group = editingSkillBarRef.current;
    if (canvas && group && skillBarEdit) {
      setSkillBarValueOnGroup(group, skillBarEdit.originalValue);
      canvas.requestRenderAll();
    }
    closeSkillBarEdit();
  }, [closeSkillBarEdit, skillBarEdit]);

  const commitSkillBarEdit = useCallback(() => {
    const canvas = canvasRef.current;
    const group = editingSkillBarRef.current;
    if (!canvas || !group || !skillBarEdit) {
      closeSkillBarEdit();
      return;
    }
    setSkillBarValueOnGroup(group, skillBarEdit.draftValue);
    if (skillBarEdit.draftValue !== skillBarEdit.originalValue) markUnsaved();
    closeSkillBarEdit();
  }, [closeSkillBarEdit, markUnsaved, skillBarEdit]);

  const setSkillBarDraftValue = useCallback(
    (draftValue: number) => {
      setSkillBarEdit((prev) => (prev ? { ...prev, draftValue } : prev));
      previewSkillBarValue(draftValue);
    },
    [previewSkillBarValue]
  );

  const commitTextEdit = useCallback(() => {
    const canvas = canvasRef.current;
    const obj = editingObjectRef.current;
    if (!canvas || !obj || !textEdit) {
      closeTextEdit();
      return;
    }
    const previous = String(obj.text ?? "");
    obj.set?.({ text: textEdit.draft });
    if (typeof obj.initDimensions === "function") obj.initDimensions();
    obj.setCoords?.();
    canvas.requestRenderAll();
    refreshSelectionFrame();
    if (textEdit.draft !== previous) markUnsaved();
    closeTextEdit();
  }, [closeTextEdit, markUnsaved, refreshSelectionFrame, textEdit]);

  const downloadPages = useCallback(
    async (kind: "pdf" | "png") => {
      rememberPageEdits();
      const pages = serverPagesRef.current;
      if (!pages.length) return;
      setDownloadKind(kind);
      const exportCanvas = document.createElement("canvas");
      const canvas = initFabricCanvas(exportCanvas, {
        width: pageSizeRef.current.w,
        height: pageSizeRef.current.h,
        backgroundColor: "#ffffff",
        selection: false,
      });
      try {
        const rendered: { dataUrl: string; width: number; height: number }[] = [];
        for (const snapshot of pages) {
          const box = savedPagePixelSize(snapshot);
          canvas.setDimensions({ width: box.w, height: box.h });
          await loadSnapshotOntoCanvas(canvas, snapshot, box.w, box.h, {
            isTemplateLoad: false,
            preserveUserImages: true,
            preservePageBox: true,
          });
          await hydrateCanvasImages(canvas, objectUrlsRef.current);
          const result = exportToDataURL(canvas, {
            multiplier: 2,
            getPageBounds: (target) => getPageBounds(target, pageSizeKeyRef.current),
          });
          if (!result) throw new Error("Page export failed");
          rendered.push(result);
        }
        if (kind === "pdf") {
          const blob = buildPDFFromPages(rendered);
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "resume.pdf";
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);
        } else {
          rendered.forEach((page, index) => {
            const link = document.createElement("a");
            link.href = page.dataUrl;
            link.download = rendered.length === 1 ? "resume.png" : `resume-page-${index + 1}.png`;
            document.body.appendChild(link);
            link.click();
            link.remove();
          });
        }
      } catch (err) {
        console.error("[mobile-editor] Download failed", err);
        setSaveError(
          kind === "pdf"
            ? "PDF download failed. No file was saved."
            : "PNG download failed. No file was saved."
        );
      } finally {
        try {
          canvas.dispose();
        } catch {
          /* ignore */
        }
        setDownloadKind(null);
      }
    },
    [rememberPageEdits]
  );

  const clearSelection = useCallback(() => {
    exitCanvasText(editingObjectRef.current);
    exitCanvasText(selectedObjectRef.current);
    editingObjectRef.current = null;
    selectObject(null, null);
    setTextStyle(null);
    setTextEdit(null);
    setSkillBarEdit(null);
  }, [selectObject]);

  const rememberAdded = useCallback(
    (obj: any, label: string) => {
      if (!obj) return;
      editingObjectRef.current = null;
      selectObject(obj, label);
      setTextStyle(null);
      setTextEdit(null);
      markUnsaved();
    },
    [markUnsaved, selectObject]
  );

  const addTextBox = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obj = addMobileText(canvas, pageSizeRef.current);
    editingObjectRef.current = obj;
    selectObject(obj, "Text");
    setTextStyle(readTextStyle(obj));
    setTextEdit(focusCanvasText(canvas, obj) ? null : { draft: "Text" });
    markUnsaved();
  }, [markUnsaved, selectObject]);

  const addShape = useCallback(
    (shapeId: string) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      rememberAdded(addMobileShape(canvas, shapeId, pageSizeRef.current), "Shape");
    },
    [rememberAdded]
  );

  const addTable = useCallback(
    (rows: number, cols: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      rememberAdded(addMobileTable(canvas, rows, cols, pageSizeRef.current), "Table");
    },
    [rememberAdded]
  );

  const addFrame = useCallback(
    (type: "square" | "circle") => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      rememberAdded(addMobileFrame(canvas, type, pageSizeRef.current), "Frame");
    },
    [rememberAdded]
  );

  const uploadImages = useCallback(
    async (files: File[]) => {
      const canvas = canvasRef.current;
      if (!canvas || !user?.uid) {
        setActionNotice("Sign in again before uploading a photo.");
        return;
      }
      const page = pageSizeRef.current;
      const result = await processLocalImageFiles({
        files,
        uid: user.uid,
        docId: docIdRef.current || "draft",
        addImageFromUrl: async (url, meta) => {
          const obj = await addMobileImage(canvas, url, page, meta);
          if (!obj) return;
          editingObjectRef.current = null;
          selectObject(obj, "Photo");
          setTextStyle(null);
          markUnsaved();
        },
      });
      setActionNotice(result.uploadedCount ? null : "That photo could not be added. Try Upload again.");
    },
    [markUnsaved, selectObject, user?.uid]
  );

  const updateSelectedText = useCallback(
    (props: Partial<TextProps>) => {
      const obj = editingObjectRef.current;
      if (!obj) return;
      applyMobileTextStyle(obj, props);
      setTextStyle(readTextStyle(obj));
      refreshSelectionFrame();
      markUnsaved();
    },
    [markUnsaved, refreshSelectionFrame]
  );

  const resizeSelection = useCallback(
    (factor: number) => {
      const obj = selectedObjectRef.current;
      if (!obj) return;
      resizeMobileObject(obj, factor);
      if (editingObjectRef.current) setTextStyle(readTextStyle(editingObjectRef.current));
      refreshSelectionFrame();
      markUnsaved();
    },
    [markUnsaved, refreshSelectionFrame]
  );

  const duplicateSelection = useCallback(async () => {
    const canvas = canvasRef.current;
    const obj = selectedObjectRef.current;
    if (!canvas || !obj) return;
    rememberAdded(await duplicateMobileObject(canvas, obj, pageSizeRef.current), "Copy");
  }, [rememberAdded]);

  const deleteSelection = useCallback(() => {
    const canvas = canvasRef.current;
    const obj = selectedObjectRef.current;
    if (!canvas || !obj) return;
    deleteMobileObject(canvas, obj, pageSizeRef.current);
    clearSelection();
    markUnsaved();
  }, [clearSelection, markUnsaved]);

  const zoomBy = useCallback(
    (factor: number) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const rect = viewport.getBoundingClientRect();
      const current = viewStateRef.current;
      userAdjustedViewRef.current = true;
      applyViewState(
        zoomViewportAroundPoint(
          current,
          current.zoom * factor,
          rect.width / 2,
          rect.height / 2,
          baseZoomRef.current
        )
      );
    },
    [applyViewState]
  );

  const applyTemplateToPage = useCallback(
    async (nextTemplateId: string) => {
      const template = getSystemTemplateById(nextTemplateId);
      const canvas = canvasRef.current;
      if (!template || !canvas) return;
      const snapshot = await template.load();
      const box = pageSizeRef.current;
      await loadSnapshotOntoCanvas(canvas, snapshot, box.w, box.h, { isTemplateLoad: true });
      const loaded = serializeCanvasForSave(canvas);
      const pages = serverPagesRef.current.slice();
      pages[activePageRef.current] = loaded;
      serverPagesRef.current = pages;
      clearSelection();
      requestAnimationFrame(() => fitToContainer({ force: true }));
      markUnsaved();
    },
    [clearSelection, fitToContainer, markUnsaved]
  );

  const addPageAfter = useCallback(async () => {
    rememberPageEdits();
    const pages = serverPagesRef.current.slice();
    const index = activePageRef.current + 1;
    pages.splice(index, 0, { objects: [] });
    serverPagesRef.current = pages;
    if (pages.length > 1) shapeRef.current = "pages";
    setPageCount(pages.length);
    await loadPageAt(index, pages[index]);
    clearSelection();
    markUnsaved();
  }, [clearSelection, loadPageAt, markUnsaved, rememberPageEdits]);

  const duplicateCurrentPage = useCallback(async () => {
    rememberPageEdits();
    const pages = serverPagesRef.current.slice();
    const copy = JSON.parse(JSON.stringify(pages[activePageRef.current] || { objects: [] }));
    const index = activePageRef.current + 1;
    pages.splice(index, 0, copy);
    serverPagesRef.current = pages;
    if (pages.length > 1) shapeRef.current = "pages";
    setPageCount(pages.length);
    await loadPageAt(index, pages[index]);
    clearSelection();
    markUnsaved();
  }, [clearSelection, loadPageAt, markUnsaved, rememberPageEdits]);

  const deleteCurrentPage = useCallback(async () => {
    if (serverPagesRef.current.length < 2) return;
    rememberPageEdits();
    const pages = serverPagesRef.current.slice();
    const removeAt = activePageRef.current;
    pages.splice(removeAt, 1);
    serverPagesRef.current = pages;
    const next = Math.min(removeAt, pages.length - 1);
    setPageCount(pages.length);
    await loadPageAt(next, pages[next]);
    clearSelection();
    markUnsaved();
  }, [clearSelection, loadPageAt, markUnsaved, rememberPageEdits]);

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];
      if (canvasRef.current) {
        try {
          canvasRef.current.dispose();
        } catch {
          /* ignore */
        }
        canvasRef.current = null;
      }
    };
  }, []);

  return {
    loading,
    loadError,
    docTitle,
    setDocTitle,
    saveStatus,
    saveError,
    textEdit,
    setTextEdit,
    skillBarEdit,
    setSkillBarDraftValue,
    downloadKind,
    pageIndex,
    pageCount,
    selectionFrame,
    selectionLabel,
    imageNotice,
    textStyle,
    actionNotice,
    zoomPercent,
    attachCanvasEl,
    viewportRef,
    canvasWrapRef,
    closeTextEdit,
    commitTextEdit,
    cancelSkillBarEdit,
    commitSkillBarEdit,
    save,
    downloadPdf: () => downloadPages("pdf"),
    downloadPng: () => downloadPages("png"),
    resetView,
    showPage,
    reloadLatest,
    clearSelection,
    addTextBox,
    addShape,
    addTable,
    addFrame,
    uploadImages,
    updateSelectedText,
    resizeSelection,
    duplicateSelection,
    deleteSelection,
    zoomBy,
    applyTemplateToPage,
    addPageAfter,
    duplicateCurrentPage,
    deleteCurrentPage,
  };
}
