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
  elementResizeMode,
  fitCanvasToViewport,
  MOBILE_PAGE_CONTROL_CLEARANCE,
  resizeBoundsForCorner,
  type ResizeCorner,
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
import {
  blankMobilePage,
  deleteMobilePage,
  insertMobilePage,
  isMobilePageSurface,
  mobilePageIndexAtSceneY,
  mobilePageIndexForObjectTop,
  splitStackedMobilePages,
  stackMobilePages,
  type MobilePageStack,
} from "@/lib/editor/mobilePageStack";
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
  holdPhoneTextCaret,
  readTextStyle,
  resizeMobileObject,
} from "@/components/editor/mobile/mobileCanvasActions";
import { applyTextBoxNoStretch } from "@/lib/editor/textTools";
import { getSkillBarModel, setSkillBarValueOnGroup } from "@/lib/editor/skillBar/skillBarFactory";
import {
  getStarRatingModel,
  resolveStarRatingValueFromPointer,
  setStarRatingValueOnGroup,
} from "@/lib/editor/starRating/starRatingFactory";
import { commitMobileResumeDoc, getResumeDoc, updateResumeThumbnail } from "@/lib/resumeDocs";
import {
  classifyPhoneResumeLoadError,
  loadOwnedResumeWithAuthRetry,
  phoneResumeLoadDecision,
  unwrapTemplateSnapshot,
} from "@/lib/editor/mobileResumeLoad";
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
  const { user, authReady } = useAuth();
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
  const stackMetaRef = useRef<MobilePageStack | null>(null);
  const pageOpRef = useRef(Promise.resolve());
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
  const keyboardViewRef = useRef<MobileViewportState | null>(null);
  const visualHeightRef = useRef(0);
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
  const [selectionResizable, setSelectionResizable] = useState(false);
  const resizeDragRef = useRef<{
    corner: ResizeCorner;
    startX: number;
    startY: number;
    start: { left: number; top: number; width: number; height: number };
    mode: ReturnType<typeof elementResizeMode>;
  } | null>(null);
  const [pageFrames, setPageFrames] = useState<{ index: number; left: number; top: number; width: number; height: number }[]>([]);
  const [selectionLabel, setSelectionLabel] = useState<string | null>(null);
  const [imageNotice, setImageNotice] = useState<string | null>(null);
  const [textStyle, setTextStyle] = useState<ReturnType<typeof readTextStyle> | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [canvasEpoch, setCanvasEpoch] = useState(0);
  const [saveKick, setSaveKick] = useState(0);
  const saveStatusRef = useRef<MobileSaveStatus>("idle");

  textOpenRef.current = !!textEdit || !!skillBarEdit;
  saveStatusRef.current = saveStatus;

  useEffect(() => {
    if (docId) docIdRef.current = docId;
  }, [docId]);

  const refreshSelectionFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = canvasWrapRef.current;
    const element = canvas?.getElement?.();
    const meta = stackMetaRef.current;
    if (!canvas || !wrap || !element?.width || !element.height) {
      setSelectionFrame(null);
      setPageFrames([]);
      return;
    }
    const canvasRect = element.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const logicalWidth = canvas.getWidth() || element.width;
    const logicalHeight = canvas.getHeight() || element.height;
    const scaleX = canvasRect.width / logicalWidth;
    const scaleY = canvasRect.height / logicalHeight;
    const state = viewStateRef.current;
    const zoom = state.zoom || 1;
    setPageFrames(
      meta?.pageTops.map((pageTop, index) => {
        const size = meta.pageSizes[index] || { w: 0, h: 0 };
        const x = state.panX * scaleX;
        const y = (pageTop * zoom + state.panY) * scaleY;
        return {
          index,
          left: canvasRect.left - wrapRect.left + x,
          top: canvasRect.top - wrapRect.top + y,
          width: size.w * zoom * scaleX,
          height: size.h * zoom * scaleY,
        };
      }) || []
    );
    const selected = selectedObjectRef.current;
    const frame = selected && !isMobilePageSurface(selected) ? selectionFrameForObject(selected) : null;
    if (!frame) {
      setSelectionFrame(null);
      return;
    }
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
      const meta = stackMetaRef.current;
      const index = meta ? Math.min(activePageRef.current, Math.max(0, meta.pageTops.length - 1)) : 0;
      const pageBounds = meta
        ? {
            left: 0,
            top: meta.pageTops[index] || 0,
            width: meta.pageSizes[index]?.w || rect.width,
            height: meta.pageSizes[index]?.h || rect.height,
          }
        : getPageBounds(canvas, pageSizeKeyRef.current);
      const result = fitCanvasToViewport(canvas, rect.width, rect.height, pageBounds);
      viewStateRef.current = result.state;
      baseZoomRef.current = result.baseZoom;
      setZoomPercent(100);
      lastSizeRef.current = { w: rect.width, h: rect.height };
      visualHeightRef.current = window.visualViewport?.height ?? window.innerHeight;
      refreshSelectionFrame();
    },
    [refreshSelectionFrame]
  );

  const syncStageSize = useCallback(
    (width: number, height: number) => {
      const canvas = canvasRef.current;
      if (!canvas || width < 2 || height < 2) return;
      const previous = lastSizeRef.current;
      const state = viewStateRef.current;
      const visualHeight = window.visualViewport?.height ?? window.innerHeight;
      const keyboardMoved = visualHeightRef.current > 0 && Math.abs(visualHeight - visualHeightRef.current) > 80;
      visualHeightRef.current = visualHeight;
      const grew = keyboardMoved && previous.h > 0 && height > previous.h + 40;
      const shrank = keyboardMoved && previous.h > 0 && height < previous.h - 40;
      canvas.setDimensions({ width: Math.round(width), height: Math.round(height) });
      lastSizeRef.current = { w: width, h: height };
      if (grew && keyboardViewRef.current) {
        const saved = keyboardViewRef.current;
        keyboardViewRef.current = null;
        applyViewState(saved);
        return;
      }
      let next = state;
      const obj = selectedObjectRef.current;
      if (shrank && obj) {
        applyMobileViewportTransform(canvas, state);
        const frame = selectionFrameForObject(obj);
        if (frame) {
          const cx = frame.left + frame.width / 2;
          const cy = frame.top + frame.height / 2;
          const margin = 24;
          let panX = state.panX;
          let panY = state.panY;
          if (cx < margin || cx > width - margin) panX += width / 2 - cx;
          if (cy < margin || cy > height - margin) panY += height * 0.42 - cy;
          if (panX !== state.panX || panY !== state.panY) {
            if (!keyboardViewRef.current) keyboardViewRef.current = state;
            next = { ...state, panX, panY };
          }
        }
      }
      applyViewState(next);
    },
    [applyViewState]
  );

  const revealSelectedText = useCallback(() => {
    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    const obj = selectedObjectRef.current;
    if (!canvas || !viewport || !obj) return;
    const rect = viewport.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    applyMobileViewportTransform(canvas, viewStateRef.current);
    const frame = selectionFrameForObject(obj);
    if (!frame) return;
    const state = viewStateRef.current;
    const cx = frame.left + frame.width / 2;
    const cy = frame.top + frame.height / 2;
    const margin = 16;
    let panX = state.panX;
    let panY = state.panY;
    if (cx < margin || cx > rect.width - margin) panX += rect.width / 2 - cx;
    if (cy < margin || cy > rect.height - margin) panY += rect.height * 0.35 - cy;
    if (panX !== state.panX || panY !== state.panY) {
      if (!keyboardViewRef.current) keyboardViewRef.current = state;
      applyViewState({ ...state, panX, panY });
    }
  }, [applyViewState]);

  const resetView = useCallback(() => {
    userAdjustedViewRef.current = false;
    keyboardViewRef.current = null;
    fitToContainer({ force: true });
  }, [fitToContainer]);

  const activatePageIndex = useCallback((index: number) => {
    const meta = stackMetaRef.current;
    if (!meta?.pageTops.length) return;
    const next = Math.min(Math.max(index, 0), meta.pageTops.length - 1);
    activePageRef.current = next;
    setPageIndex(next);
    const size = meta.pageSizes[next];
    if (size) pageSizeRef.current = size;
  }, []);

  const selectObject = useCallback(
    (obj: any, label: string | null) => {
      if (obj && isMobilePageSurface(obj)) {
        selectedObjectRef.current = null;
        setSelectionLabel(null);
        setSelectionFrame(null);
        setSelectionResizable(false);
        const meta = stackMetaRef.current;
        if (meta?.pageTops.length) activatePageIndex(mobilePageIndexForObjectTop(Number(obj.top) || 0, meta.pageTops));
        refreshSelectionFrame();
        return;
      }
      selectedObjectRef.current = obj;
      setSelectionLabel(label);
      setSelectionResizable(elementResizeMode(obj) !== "none");
      const meta = stackMetaRef.current;
      if (obj && meta?.pageTops.length) activatePageIndex(mobilePageIndexForObjectTop(Number(obj.top) || 0, meta.pageTops));
      refreshSelectionFrame();
    },
    [activatePageIndex, refreshSelectionFrame]
  );

  const rememberPageEdits = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const meta = stackMetaRef.current;
    if (!meta?.pageTops.length) {
      const index = activePageRef.current;
      const current = serializeCanvasForSave(canvas);
      const serverPage = serverPagesRef.current[index];
      const merged = serverPage ? mergePreservedImages(current, serverPage) : current;
      const pages = serverPagesRef.current.slice();
      pages[index] = merged;
      serverPagesRef.current = pages;
      return;
    }
    const current = serializeCanvasForSave(canvas);
    const split = splitStackedMobilePages(current.objects || [], meta.pageTops);
    serverPagesRef.current = split.map((page, index) => {
      const previous = serverPagesRef.current[index];
      return previous ? mergePreservedImages(page, previous) : page;
    });
  }, []);

  const scrollPageIntoView = useCallback(
    (index: number) => {
      const canvas = canvasRef.current;
      const viewport = viewportRef.current;
      const meta = stackMetaRef.current;
      const size = meta?.pageSizes[index];
      if (!canvas || !viewport || !meta || !size) return;
      const rect = viewport.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      canvas.setDimensions({ width: Math.round(rect.width), height: Math.round(rect.height) });
      const zoom = viewStateRef.current.zoom || baseZoomRef.current || 1;
      const padding = 16;
      const availH = Math.max(1, rect.height - padding * 2 - MOBILE_PAGE_CONTROL_CLEARANCE);
      const panX = (rect.width - size.w * zoom) / 2;
      const panY = padding + (availH - size.h * zoom) / 2 - (meta.pageTops[index] || 0) * zoom;
      applyViewState({ zoom, panX, panY });
    },
    [applyViewState]
  );

  const renderStackedPages = useCallback(
    async (pages: any[], options: { activeIndex: number; fit?: boolean; scroll?: boolean }) => {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas failed to initialize");
      const source = pages.length ? pages : [blankMobilePage()];
      const stacked = stackMobilePages(source);
      stackMetaRef.current = stacked;
      const index = Math.min(Math.max(options.activeIndex, 0), Math.max(0, stacked.pageTops.length - 1));
      const box = stacked.pageSizes[index] || stacked.pageSizes[0] || { w: 794, h: 1123 };
      pageSizeRef.current = box;
      if (Math.abs(box.w - 816) < 8 && Math.abs(box.h - 1056) < 8) pageSizeKeyRef.current = "Letter";
      else if (Math.abs(box.w - 794) < 8 && Math.abs(box.h - 1123) < 8) pageSizeKeyRef.current = "A4";
      else pageSizeKeyRef.current = "Custom";
      canvas.setDimensions({ width: box.w, height: box.h });
      await loadSnapshotOntoCanvas(canvas, { objects: stacked.objects }, box.w, box.h, {
        isTemplateLoad: false,
        preserveUserImages: true,
        preservePageBox: true,
      });
      await hydrateCanvasImages(canvas, objectUrlsRef.current);
      activePageRef.current = index;
      setPageIndex(index);
      const reveal = () => {
        if (options.fit) {
          userAdjustedViewRef.current = false;
          fitToContainer({ force: true });
        } else if (options.scroll) {
          scrollPageIntoView(index);
        }
      };
      reveal();
      requestAnimationFrame(reveal);
    },
    [fitToContainer, scrollPageIntoView]
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
    if (canvasRef.current?.getElement?.() === el) return;
    if (canvasRef.current) {
      try {
        canvasRef.current.dispose();
      } catch {
        /* ignore */
      }
      canvasRef.current = null;
    }
    if (!el) {
      setCanvasReady(false);
      return;
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
    loadedKeyRef.current = null;
    setCanvasEpoch((value) => value + 1);
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
      const size = stackMetaRef.current?.pageSizes[index];
      if (size) pageSizeRef.current = size;
      activePageRef.current = index;
      setPageIndex(index);
      scrollPageIntoView(index);
    },
    [rememberPageEdits, scrollPageIntoView]
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
      activeIndex: stackMetaRef.current ? -1 : activePageRef.current,
      activeJson: stackMetaRef.current ? { objects: [] } : activeJson,
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
    const decision = phoneResumeLoadDecision({
      docId,
      authReady,
      uid: user?.uid ?? null,
    });
    if (decision.type === "wait") return;

    const key =
      decision.type === "document"
        ? `doc:${decision.docId}`
        : blank
          ? "blank"
          : `tpl:${templateId || ""}`;
    if (loadedKeyRef.current === key) return;

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
      if (!canvas) {
        if (!cancelled) {
          setLoadError(classifyPhoneResumeLoadError(new Error("Canvas failed to initialize")).message);
          setLoading(false);
        }
        return;
      }
      try {
        if (decision.type === "denied") {
          setLoadError(decision.message);
          setLoading(false);
          return;
        }
        if (decision.type === "document") {
          const read = await loadOwnedResumeWithAuthRetry({
            load: () => getResumeDoc({ uid: decision.uid, docId: decision.docId }),
            refreshAuth: () => user?.getIdToken?.(true),
          });
          if (cancelled) return;
          if (!read.ok) {
            setLoadError(read.message);
            setLoading(false);
            return;
          }
          const record = read.record;
          const parsed = pagesFromResumeRecord(record);
          serverPagesRef.current = parsed.pages;
          shapeRef.current = parsed.shape;
          docIdRef.current = decision.docId;
          baseRevisionRef.current = typeof record.autosaveRevision === "number" ? record.autosaveRevision : 0;
          baseUpdatedAtRef.current = updatedAtToken(record.updatedAt);
          setDocTitleState(record.title || "Untitled Resume");
          setPageCount(parsed.pages.length);
          if (parsed.pages.some((page) => resumeHasLocalOnlyImage(page))) {
            setImageNotice(
              "Photos added on another device stay in this resume. This phone does not replace them."
            );
          }
          await renderStackedPages(parsed.pages, { activeIndex: 0, fit: true });
        } else if (blank || !templateId) {
          const box = { w: 794, h: 1123 };
          pageSizeRef.current = box;
          pageSizeKeyRef.current = "A4";
          canvas.setDimensions({ width: box.w, height: box.h });
          canvas.clear();
          ensurePageBackground(canvas, box.w, box.h, "#ffffff");
          applyMobileInteractionLocks(canvas, box.w, box.h);
          const empty = blankMobilePage();
          serverPagesRef.current = [empty];
          shapeRef.current = "canvas";
          docIdRef.current = null;
          baseRevisionRef.current = null;
          baseUpdatedAtRef.current = null;
          setDocTitleState("Untitled Resume");
          setPageCount(1);
          await renderStackedPages([empty], { activeIndex: 0, fit: true });
        } else {
          const template = getSystemTemplateById(templateId);
          if (!template) {
            setLoadError(classifyPhoneResumeLoadError(new Error("Template not found.")).message);
            setLoading(false);
            return;
          }
          setDocTitleState(template.name || "Untitled Resume");
          const snapshot = unwrapTemplateSnapshot(await template.load());
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
          if (box.w > 1400) {
            /* Catalog pages are scaled into A4 by the existing template loader. */
          }
          await renderStackedPages(serverPagesRef.current, { activeIndex: 0, fit: true });
        }
        if (cancelled) return;
        loadedKeyRef.current = key;
        setSaveStatus("idle");
        setLoading(false);
      } catch (err) {
        console.error("[mobile-editor] Failed to load", err);
        if (!cancelled) {
          setLoadError(classifyPhoneResumeLoadError(err).message);
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
  }, [authReady, blank, canvasEpoch, canvasReady, docId, reloadNonce, renderStackedPages, templateId, user]);

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
      if (resizeDebounceRef.current) clearTimeout(resizeDebounceRef.current);
      resizeDebounceRef.current = setTimeout(() => {
        const latest = lastSizeRef.current;
        const widthChanged = latest.w > 0 && Math.abs(width - latest.w) >= 48;
        const heightChanged = latest.h > 0 && Math.abs(height - latest.h) >= 40;
        if (latest.w === 0 || (widthChanged && !userAdjustedViewRef.current)) {
          keyboardViewRef.current = null;
          fitToContainer({ force: true });
          return;
        }
        if (widthChanged || heightChanged) syncStageSize(width, height);
      }, 80);
    });
    observer.observe(viewport);
    return () => {
      observer.disconnect();
      if (resizeDebounceRef.current) clearTimeout(resizeDebounceRef.current);
    };
  }, [fitToContainer, loading, syncStageSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvasReady || !canvas) return;
    const onTextChanged = () => {
      const obj = editingObjectRef.current;
      if (!obj) return;
      holdPhoneTextCaret(obj);
      const text = String(obj.text ?? "");
      setSelectedText(text);
      setSelectionLabel(text.split("\n")[0].slice(0, 42) || "Text");
      setTextStyle(readTextStyle(obj));
      refreshSelectionFrame();
      markUnsaved();
    };
    canvas.on("text:changed", onTextChanged);
    return () => {
      canvas.off("text:changed", onTextChanged);
    };
  }, [canvasReady, markUnsaved, refreshSelectionFrame]);

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
      keyboardViewRef.current = null;
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
      if (target?.closest?.("[data-slb-canvas-control]")) {
        gestureRef.current = emptyGesture();
        return;
      }
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
        if (!obj || obj.isEditing || isMobilePageSurface(obj)) return;
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
            selected &&
            hit &&
            !isMobilePageSurface(selected) &&
            !isMobilePageSurface(hit.object) &&
            (hit.object === selected || hit.host === selected) &&
            !selected.isEditing
              ? selected
              : null;
          if (moveTarget) {
            gesture.mode = "move";
            return;
          }
          userAdjustedViewRef.current = true;
          keyboardViewRef.current = null;
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
            setSelectedText("");
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
            setSelectedText("");
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
            setSelectedText(text);
            setTextEdit(null);
            setSkillBarEdit(null);
            focusCanvasText(canvas, hit.object, event);
            requestAnimationFrame(() => revealSelectedText());
          } else if (hit?.type === "object") {
            editingObjectRef.current = null;
            exitCanvasText(selectedObjectRef.current);
            selectObject(hit.object, hit.object?.data?.role === "table" ? "Table" : "Selection");
            setTextStyle(null);
            setSelectedText("");
            setTextEdit(null);
            setSkillBarEdit(null);
          } else {
            exitCanvasText(selectedObjectRef.current);
            editingObjectRef.current = null;
            selectObject(null, null);
            setTextStyle(null);
            setSelectedText("");
            setTextEdit(null);
            setSkillBarEdit(null);
            const meta = stackMetaRef.current;
            const canvasRect = canvas.getElement()?.getBoundingClientRect();
            const logicalHeight = canvas.getHeight?.() || canvasRect?.height || 1;
            if (meta?.pageTops.length && canvasRect && logicalHeight) {
              const scaleY = canvasRect.height / logicalHeight;
              const logicalY = (touch.clientY - canvasRect.top) / (scaleY || 1);
              const sceneY = (logicalY - viewStateRef.current.panY) / (viewStateRef.current.zoom || 1);
              activatePageIndex(mobilePageIndexAtSceneY(sceneY, meta.pageTops, meta.pageSizes));
            }
          }
        }
        if (gesture.hadGesture && gesture.mode === "pan") {
          const meta = stackMetaRef.current;
          const rect = viewport.getBoundingClientRect();
          const state = viewStateRef.current;
          if (meta?.pageTops.length && state.zoom) {
            const sceneY = (rect.height / 2 - state.panY) / state.zoom;
            const index = mobilePageIndexAtSceneY(sceneY, meta.pageTops, meta.pageSizes);
            if (index !== activePageRef.current) {
              activePageRef.current = index;
              setPageIndex(index);
              const size = meta.pageSizes[index];
              if (size) pageSizeRef.current = size;
            }
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
  }, [activatePageIndex, applyViewState, beginPinchGesture, canvasReady, loading, markUnsaved, refreshSelectionFrame, revealSelectedText, selectObject]);

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
    setSelectedText("");
    setTextEdit(null);
    setSkillBarEdit(null);
  }, [selectObject]);

  const offsetNewObjectToActivePage = useCallback((obj: any) => {
    const meta = stackMetaRef.current;
    if (!obj || !meta) return;
    const pageTop = meta.pageTops[activePageRef.current] || 0;
    if (pageTop <= 0) return;
    const current = Number(obj.top) || 0;
    if (current < pageTop) {
      obj.set?.({ top: current + pageTop });
      obj.setCoords?.();
      canvasRef.current?.requestRenderAll?.();
    }
  }, []);

  const rememberAdded = useCallback(
    (obj: any, label: string) => {
      if (!obj) return;
      offsetNewObjectToActivePage(obj);
      editingObjectRef.current = null;
      selectObject(obj, label);
      setTextStyle(null);
      setSelectedText("");
      setTextEdit(null);
      markUnsaved();
    },
    [markUnsaved, offsetNewObjectToActivePage, selectObject]
  );

  const addTextBox = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obj = addMobileText(canvas, pageSizeRef.current);
    offsetNewObjectToActivePage(obj);
    editingObjectRef.current = obj;
    selectObject(obj, "Text");
    setTextStyle(readTextStyle(obj));
    setSelectedText(String(obj.text ?? "Text"));
    setTextEdit(null);
    setSkillBarEdit(null);
    focusCanvasText(canvas, obj);
    markUnsaved();
    requestAnimationFrame(() => revealSelectedText());
  }, [markUnsaved, offsetNewObjectToActivePage, revealSelectedText, selectObject]);

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
          offsetNewObjectToActivePage(obj);
          editingObjectRef.current = null;
          selectObject(obj, "Photo");
          setTextStyle(null);
          setSelectedText("");
          markUnsaved();
        },
      });
      setActionNotice(result.uploadedCount ? null : "That photo could not be added. Try Upload again.");
    },
    [markUnsaved, offsetNewObjectToActivePage, selectObject, user?.uid]
  );

  const updateSelectedText = useCallback(
    (props: Partial<TextProps>) => {
      const obj = editingObjectRef.current;
      if (!obj) return;
      applyMobileTextStyle(obj, props);
      setTextStyle(readTextStyle(obj));
      refreshSelectionFrame();
      markUnsaved();
      const active = typeof document !== "undefined" ? document.activeElement : null;
      const keepField =
        active instanceof HTMLElement &&
        active !== obj.hiddenTextarea &&
        (active.tagName === "SELECT" || active.tagName === "INPUT");
      if (obj.isEditing && !keepField) obj.hiddenTextarea?.focus?.({ preventScroll: true });
    },
    [markUnsaved, refreshSelectionFrame]
  );

  const setSelectedTextContent = useCallback(
    (value: string) => {
      const obj = editingObjectRef.current;
      if (!obj) return;
      exitCanvasText(obj);
      const previous = String(obj.text ?? "");
      obj.set?.({ text: value });
      applyTextBoxNoStretch(obj);
      obj.initDimensions?.();
      obj.setCoords?.();
      canvasRef.current?.requestRenderAll();
      setSelectedText(value);
      setSelectionLabel(value.split("\n")[0].slice(0, 42) || "Text");
      refreshSelectionFrame();
      if (value !== previous) markUnsaved();
    },
    [markUnsaved, refreshSelectionFrame]
  );

  const resizeSelectionByCorner = useCallback(
    (corner: ResizeCorner, phase: "start" | "move" | "end", clientX: number, clientY: number) => {
      const obj = selectedObjectRef.current;
      const mode = elementResizeMode(obj);
      if (!obj || mode === "none") return;
      if (phase === "end") {
        resizeDragRef.current = null;
        return;
      }
      const displayedWidth = Math.abs(Number(obj.width) || 0) * Math.abs(Number(obj.scaleX) || 1);
      const displayedHeight = Math.abs(Number(obj.height) || 0) * Math.abs(Number(obj.scaleY) || 1);
      if (phase === "start") {
        resizeDragRef.current = {
          corner,
          startX: clientX,
          startY: clientY,
          start: { left: Number(obj.left) || 0, top: Number(obj.top) || 0, width: displayedWidth, height: displayedHeight },
          mode,
        };
        return;
      }
      const drag = resizeDragRef.current;
      if (!drag || drag.corner !== corner) return;
      const canvas = canvasRef.current;
      const element = canvas?.getElement?.();
      const logicalWidth = canvas?.getWidth?.() || element?.width || 1;
      const canvasRect = element?.getBoundingClientRect();
      const cssScale = canvasRect && logicalWidth ? canvasRect.width / logicalWidth : 1;
      const scenePerPixel = 1 / ((viewStateRef.current.zoom || 1) * (cssScale || 1));
      const next = resizeBoundsForCorner(
        drag.start,
        corner,
        (clientX - drag.startX) * scenePerPixel,
        (clientY - drag.startY) * scenePerPixel,
        drag.mode
      );
      if (drag.mode === "text") {
        const scaleX = Number(obj.scaleX) || 1;
        obj.set?.({ left: next.left, width: Math.max(24, next.width / Math.abs(scaleX || 1)) });
        applyTextBoxNoStretch(obj);
        obj.initDimensions?.();
      } else {
        const baseW = Math.abs(Number(obj.width) || 0) || 1;
        const baseH = Math.abs(Number(obj.height) || 0) || 1;
        obj.set?.({
          left: next.left,
          top: next.top,
          scaleX: next.width / baseW,
          scaleY: next.height / baseH,
        });
      }
      obj.setCoords?.();
      canvas?.requestRenderAll();
      refreshSelectionFrame();
      markUnsaved();
    },
    [markUnsaved, refreshSelectionFrame]
  );

  const resizeSelection = useCallback(
    (factor: number) => {
      const obj = selectedObjectRef.current;
      if (!obj || isMobilePageSurface(obj)) return;
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
    if (!canvas || !obj || isMobilePageSurface(obj)) return;
    rememberAdded(await duplicateMobileObject(canvas, obj, pageSizeRef.current), "Copy");
  }, [rememberAdded]);

  const deleteSelection = useCallback(() => {
    const canvas = canvasRef.current;
    const obj = selectedObjectRef.current;
    if (!canvas || !obj || isMobilePageSurface(obj)) return;
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
      keyboardViewRef.current = null;
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

  const commitPageList = useCallback(
    async (pages: any[], index: number) => {
      serverPagesRef.current = pages;
      if (pages.length > 1) shapeRef.current = "pages";
      await renderStackedPages(pages, { activeIndex: index, scroll: true });
      setPageCount(pages.length);
      clearSelection();
      markUnsaved();
    },
    [clearSelection, markUnsaved, renderStackedPages]
  );

  const applyTemplateToPage = useCallback(
    async (nextTemplateId: string) => {
      const template = getSystemTemplateById(nextTemplateId);
      if (!template || !canvasRef.current) return;
      const previous = serverPagesRef.current.map((page) => JSON.parse(JSON.stringify(page)));
      const previousIndex = activePageRef.current;
      try {
        rememberPageEdits();
        const snapshot = await template.load();
        const box = pageSizeRef.current;
        const holder = document.createElement("canvas");
        const temp = initFabricCanvas(holder, {
          width: box.w,
          height: box.h,
          backgroundColor: "#ffffff",
          selection: false,
        });
        try {
          await loadSnapshotOntoCanvas(temp, snapshot, box.w, box.h, { isTemplateLoad: true });
          const loaded = serializeCanvasForSave(temp);
          const pages = serverPagesRef.current.slice();
          pages[previousIndex] = loaded;
          await commitPageList(pages, previousIndex);
        } finally {
          try {
            temp.dispose();
          } catch {
            /* ignore */
          }
        }
      } catch (err) {
        console.error("[mobile-editor] Template replace failed", err);
        serverPagesRef.current = previous;
        setPageCount(previous.length);
        setActionNotice("Couldn't replace this page. The resume was not changed.");
        try {
          await renderStackedPages(previous, { activeIndex: previousIndex, scroll: true });
        } catch {
          /* The previous pages remain stored. */
        }
      }
    },
    [commitPageList, rememberPageEdits, renderStackedPages]
  );

  const addPageAfter = useCallback(async (pageIndex?: number) => {
    const run = pageOpRef.current.then(async () => {
      if (typeof pageIndex === "number") activePageRef.current = pageIndex;
      const previous = serverPagesRef.current.map((page) => JSON.parse(JSON.stringify(page)));
      const previousIndex = activePageRef.current;
      try {
        rememberPageEdits();
        const inserted = insertMobilePage(serverPagesRef.current, activePageRef.current, blankMobilePage());
        await commitPageList(inserted.pages, inserted.index);
        setActionNotice(null);
      } catch (err) {
        console.error("[mobile-editor] Add page failed", err);
        serverPagesRef.current = previous;
        activePageRef.current = previousIndex;
        setPageIndex(previousIndex);
        setPageCount(previous.length);
        setActionNotice("Couldn't add a page. The resume was not changed.");
        try {
          await renderStackedPages(previous, { activeIndex: previousIndex, scroll: true });
        } catch {
          /* The previous pages remain stored. */
        }
      }
    });
    pageOpRef.current = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }, [commitPageList, rememberPageEdits, renderStackedPages]);

  const duplicateCurrentPage = useCallback(async (pageIndex?: number) => {
    const run = pageOpRef.current.then(async () => {
      if (typeof pageIndex === "number") activePageRef.current = pageIndex;
      const previous = serverPagesRef.current.map((page) => JSON.parse(JSON.stringify(page)));
      const previousIndex = activePageRef.current;
      try {
        rememberPageEdits();
        const source = serverPagesRef.current[activePageRef.current] || blankMobilePage();
        const inserted = insertMobilePage(serverPagesRef.current, activePageRef.current, source);
        await commitPageList(inserted.pages, inserted.index);
        setActionNotice(null);
      } catch (err) {
        console.error("[mobile-editor] Duplicate page failed", err);
        serverPagesRef.current = previous;
        activePageRef.current = previousIndex;
        setPageIndex(previousIndex);
        setPageCount(previous.length);
        setActionNotice("Couldn't duplicate this page. The resume was not changed.");
        try {
          await renderStackedPages(previous, { activeIndex: previousIndex, scroll: true });
        } catch {
          /* The previous pages remain stored. */
        }
      }
    });
    pageOpRef.current = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }, [commitPageList, rememberPageEdits, renderStackedPages]);

  const deleteCurrentPage = useCallback(async (pageIndex?: number) => {
    const run = pageOpRef.current.then(async () => {
      if (typeof pageIndex === "number") activePageRef.current = pageIndex;
      if (serverPagesRef.current.length < 2) return;
      const previous = serverPagesRef.current.map((page) => JSON.parse(JSON.stringify(page)));
      const previousIndex = activePageRef.current;
      try {
        rememberPageEdits();
        const removed = deleteMobilePage(serverPagesRef.current, activePageRef.current);
        if (!removed) return;
        await commitPageList(removed.pages, removed.index);
        setActionNotice(null);
      } catch (err) {
        console.error("[mobile-editor] Delete page failed", err);
        serverPagesRef.current = previous;
        activePageRef.current = previousIndex;
        setPageIndex(previousIndex);
        setPageCount(previous.length);
        setActionNotice("Couldn't delete this page. The resume was not changed.");
        try {
          await renderStackedPages(previous, { activeIndex: previousIndex, scroll: true });
        } catch {
          /* The previous pages remain stored. */
        }
      }
    });
    pageOpRef.current = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }, [commitPageList, rememberPageEdits, renderStackedPages]);

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
    selectedText,
    setSelectedTextContent,
    skillBarEdit,
    setSkillBarDraftValue,
    downloadKind,
    pageIndex,
    pageCount,
    selectionFrame,
    selectionResizable,
    pageFrames,
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
    resizeSelectionByCorner,
    duplicateSelection,
    deleteSelection,
    zoomBy,
    applyTemplateToPage,
    addPageAfter,
    duplicateCurrentPage,
    deleteCurrentPage,
  };
}
