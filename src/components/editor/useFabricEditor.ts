"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Canvas,
  Circle,
  Line,
  Rect,
  Textbox,
  Group,
  Shadow,
  Image as FabricImage,
} from "fabric";
import * as FabricNS from "fabric";
import { jsPDF } from "jspdf";
import { TEMPLATE_SNAPSHOTS } from "@/data/templates";
import { toHexColor } from "@/lib/color";
import { useAuthUser } from "@/lib/useAuthUser";
import { createResumeDoc, getResumeDoc, updateResumeDoc } from "@/lib/resumeDocs";
import type {
  EditorMode,
  PageSize,
  SelectionType,
  AlignAction,
  TextProps,
  ShapeProps,
  ImageProps,
  LayerItem,
} from "@/types/editor";
import {
  CANVAS_BG,
  PAGE_SIZES,
  FIT_RESIZE_DEBOUNCE_MS,
} from "@/types/editor";
import { initFabricCanvas, applyCanvasBackground as applyCanvasBackgroundModule } from "@/lib/editor/canvasInitializer";
import { normalizeToFabricJson } from "@/lib/editor/templateLoader";
import { clampEffectiveZoom as clampEffectiveZoomFn } from "@/lib/editor/zoomController";
import { addTextbox as addTextboxTool, applyTextBoxNoStretch } from "@/lib/editor/textTools";
import { addRect as addRectTool, addCircle as addCircleTool, addLine as addLineTool } from "@/lib/editor/shapeTools";
import { getLayers as getLayersFromModule } from "@/lib/editor/layerManager";
import { exportToDataURL as exportToDataURLModule } from "@/lib/editor/exportCanvas";
import { ensureObjectId } from "./editor/utils/fabricHelpers";
import {
  IMAGE_FRAME_SIZE,
  IMAGE_FRAME_TYPE,
  isImageFrame,
  getImageFrameFrameType,
  getImageForFrame,
  getFrameShape,
} from "./editor/frames/frameDetection";
import { createFrameCreate } from "./editor/frames/frameCreate";
import { createFrameAttach } from "./editor/frames/frameAttach";
import { createFrameCrop } from "./editor/frames/frameCrop";

// Ensure global Fabric defaults allow interaction unless explicitly overridden.
(FabricNS as any).Object.prototype.selectable = true;
(FabricNS as any).Object.prototype.evented = true;

function refreshCanvasOffset(canvas: any) {
  if (!canvas) return;
  requestAnimationFrame(() => {
    try {
      canvas.calcOffset();
    } catch {}

    setTimeout(() => {
      try {
        canvas.calcOffset();
        canvas.requestRenderAll();
      } catch {}
    }, 50);
  });
}

function getFrameId(frame: any): string | null {
  return frame?.id ?? frame?.data?.id ?? frame?.uid ?? null;
}

export function useFabricEditor({
  mode,
  initialTemplateId,
  docId: docIdParam,
}: {
  mode: EditorMode;
  initialTemplateId?: string | null;
  docId?: string | null;
}) {
  const canvasRef = useRef<Canvas | null>(null);
  const pageCanvasesRef = useRef<Map<string, Canvas>>(new Map());
  const pendingPageLoadRef = useRef<Map<string, any>>(new Map());
  const pageIdCounterRef = useRef(1);
  const gridGroupRef = useRef<any>(null);
  const gridMetaRef = useRef<{ pageSize: PageSize } | null>(null);
  const lastAppliedTemplateRef = useRef<string | null>(null);

  const undoRef = useRef<any[]>([]);
  const redoRef = useRef<any[]>([]);
  const isApplyingRef = useRef(false);
  const lastLoadedSnapshotRef = useRef<any>(null);
  const didInitialFitRef = useRef(false);
  const fitRafRef = useRef<number | null>(null);
  const fitResizeTimeoutRef = useRef<number | null>(null);
  const didLogFitRef = useRef<string | null>(null);
  const manualZoomRef = useRef(false);
  const userZoomedRef = useRef(false);
  const normalizedContentRef = useRef<WeakSet<Canvas>>(new WeakSet());
  const lastHostSizeRef = useRef<{ w: number; h: number } | null>(null);
  const zoomModeRef = useRef<"fitWidth" | "manual">("fitWidth");
  const isLoadingDocRef = useRef(false);
  const hadStoredZoomRef = useRef(false);
  const docRevisionRef = useRef(0);
  const imageFrameCropModeRef = useRef<{
    frame: any;
    image: any;
    canvas: Canvas;
  } | null>(null);
  const exitCropModeRef = useRef<(() => void) | null>(null);
  const [isInImageFrameCropMode, setIsInImageFrameCropMode] = useState(false);
  const setCropModeStateRef = useRef<(v: boolean) => void>(() => {});
  setCropModeStateRef.current = setIsInImageFrameCropMode;

  const clipboardRef = useRef<any>(null);
  const isInitializingCanvasRef = useRef(false);
  const isCanvasBootingRef = useRef(false);

  const [zoom, setZoomState] = useState(1);
  const fitZoomRef = useRef(1);
  const baseFitZoomRef = useRef<number | null>(null);
  const userZoomRef = useRef(1);
  const [pageSize, setPageSize] = useState<PageSize>("A4");
  const [pageSizePx, setPageSizePxState] = useState<{ w: number; h: number }>(
    PAGE_SIZES.A4
  );
  const pageSizePxRef = useRef(pageSizePx);
  const [bgColor, setBgColor] = useState("#ffffff");
  const [gridEnabled, setGridEnabled] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [pages, setPages] = useState<Array<{ id: string }>>([{ id: "page-1" }]);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const pagesRef = useRef(pages);
  pagesRef.current = pages;

  const [selectionType, setSelectionType] = useState<SelectionType>("none");
  const [selectedFrameHasImage, setSelectedFrameHasImage] = useState(false);
  const [activeObjectType, setActiveObjectType] = useState<string | null>(null);
  const [activeObjectSnapshot, setActiveObjectSnapshot] = useState<any>(null);
  const [textProps, setTextProps] = useState<TextProps>({
    fontFamily: "Poppins",
    fontSize: 32,
    fill: "#111827",
    fontWeight: "normal",
    fontStyle: "normal",
    underline: false,
    textAlign: "left",
    lineHeight: 1.3,
  });
  const [shapeProps, setShapeProps] = useState<ShapeProps>({
    fill: "rgba(17,24,39,0.1)",
    stroke: "#111827",
    strokeWidth: 2,
    opacity: 1,
    cornerRadius: 0,
  });
  const [imageProps, setImageProps] = useState<ImageProps>({
    opacity: 1,
  });
  const [layers, setLayers] = useState<LayerItem[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [cloudDocId, setCloudDocId] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState<string | null>(null);
  const [docCreatedAt, setDocCreatedAt] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDocDataReady, setIsDocDataReady] = useState(false);

  const bgColorRef = useRef(bgColor);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const isHydratingFromSelectionRef = useRef(false);
  const prevActivePageIdRef = useRef<string | null>(null);
  const { user, loading: authLoading } = useAuthUser();
  const getCanvas = useCallback(() => canvasRef.current, []);
  const logTextSync = useCallback((mode: "hydrate" | "apply") => {
    if (process.env.NODE_ENV !== "development") return;
    console.log("[text-sync]", mode);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleScroll = () => {
      const canvas = getCanvas();
      if (!canvas) return;

      try {
        canvas.calcOffset();
      } catch {}
    };

    viewport.addEventListener("scroll", handleScroll);

    return () => {
      viewport.removeEventListener("scroll", handleScroll);
    };
  }, [getCanvas]);

  function reorderPages<T>(list: T[], from: number, to: number): T[] {
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  }

  const getActivePageId = useCallback(() => {
    const p = pagesRef.current;
    const i = activePageIndex;
    return p[Math.max(0, Math.min(i, p.length - 1))]?.id;
  }, [activePageIndex]);

  const createPageId = useCallback(() => {
    pageIdCounterRef.current += 1;
    return `page-${pageIdCounterRef.current}`;
  }, []);

  const addPageAfter = useCallback(
    (afterIndex: number) => {
      const { w: pageW, h: pageH } = pageSizePxRef.current;
      const newPage = {
        id: createPageId(),
        objects: [] as any[],
        width: pageW,
        height: pageH,
        background: "#ffffff",
      };
      pendingPageLoadRef.current.delete(newPage.id);
      pendingPageLoadRef.current.set(newPage.id, { type: "blank" });
      const updated = [
        ...pages.slice(0, afterIndex + 1),
        newPage,
        ...pages.slice(afterIndex + 1),
      ];
      setPages(updated);
      setActivePageIndex(afterIndex + 1);
      return newPage.id;
    },
    [createPageId, pages]
  );

  const duplicatePage = useCallback(
    (index: number) => {
      const srcId = pages[index]?.id;
      const srcCanvas = srcId ? pageCanvasesRef.current.get(srcId) : null;
      const id = createPageId();
      if (srcCanvas) {
        const json = (srcCanvas as any).toJSON([
          "excludeFromExport",
          "selectable",
          "evented",
          "role",
          "name",
          "slbId",
          "isPageBg",
          "locked",
          "hidden",
        ]);
        const vpt = srcCanvas.viewportTransform;
        const objects = Array.isArray((json as any)?.objects) ? (json as any).objects : [];
        pendingPageLoadRef.current.set(id, {
          type: "duplicate",
          objects,
          viewportTransform: vpt && vpt.length >= 6 ? [...vpt] : null,
        });
      }
      setPages((prev) => {
        const next = [...prev];
        next.splice(index + 1, 0, { id });
        return next;
      });
      setActivePageIndex(index + 1);
      return id;
    },
    [createPageId, pages]
  );

  const deletePage = useCallback(
    (index: number) => {
      if (pages.length <= 1) return;
      const id = pages[index]?.id;
      if (id) {
        const c = pageCanvasesRef.current.get(id);
        if (c) {
          try {
            c.dispose();
          } catch {}
          pageCanvasesRef.current.delete(id);
        }
        pendingPageLoadRef.current.delete(id);
      }
      setPages((prev) => prev.filter((_, i) => i !== index));
      setActivePageIndex((prev) => {
        const nextLength = pages.length - 1;
        if (prev === index) {
          return Math.max(0, Math.min(index, nextLength - 1));
        }
        if (prev > index) return prev - 1;
        return prev;
      });
    },
    [pages]
  );

  function getViewportEl(): HTMLElement | null {
    return viewportRef.current;
  }

  const getViewportSize = useCallback((c: Canvas | null) => {
    const host = viewportRef.current;
    if (!host) return null;
    const rect = host.getBoundingClientRect();
    const w = Math.round(host.clientWidth || rect.width);
    const h = Math.round(host.clientHeight || rect.height);
    if (w <= 0 || h <= 0) return null;
    return { w, h };
  }, []);

  function getViewportRect(): DOMRect | null {
    const rect = getViewportSize(canvasRef.current);
    if (!rect) return null;
    if (rect.w < 200 || rect.h < 200) return null;
    return new DOMRect(0, 0, rect.w, rect.h);
  }

  const getZoom = useCallback(() => {
    return typeof zoom === "number" && Number.isFinite(zoom) ? zoom : 1;
  }, [zoom]);
  const getZoomPercent = useCallback(() => Math.round(getZoom() * 100), [getZoom]);
  const clampEffectiveZoom = useCallback((z: number) => clampEffectiveZoomFn(z), []);

  const clamp = useCallback((v: number, lo: number, hi: number) => {
    return Math.min(hi, Math.max(lo, v));
  }, []);

  const getObjectBounds = useCallback((obj: any) => {
    if (!obj) return { left: 0, top: 0, width: 0, height: 0 };
    if (typeof obj.getBoundingRect === "function") {
      const r = obj.getBoundingRect(true, true);
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    }
    const left = Number(obj?.left ?? 0);
    const top = Number(obj?.top ?? 0);
    const w = obj.getScaledWidth?.() ?? obj.width ?? 0;
    const h = obj.getScaledHeight?.() ?? obj.height ?? 0;
    return { left, top, width: w, height: h };
  }, []);

  const getContentBounds = useCallback(
    (objects: any[]) => {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const o of objects) {
        const b = getObjectBounds(o);
        minX = Math.min(minX, b.left);
        minY = Math.min(minY, b.top);
        maxX = Math.max(maxX, b.left + b.width);
        maxY = Math.max(maxY, b.top + b.height);
      }
      if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
      return { minX, minY, maxX, maxY };
    },
    [getObjectBounds]
  );

  const isPageBackgroundObject = useCallback(
    (obj: any, pageW?: number, pageH?: number) => {
      if (!obj) return false;
      if (obj?.data?.role === "pageBackground") return true;
      if (obj?.role === "pageBackground") return true;
      if (obj?.role === "page-bg") return true;
      if (obj?.role === "page") return true;
      if (obj?.data?.kind === "page-bg") return true;
      if (obj?.isPageBg === true) return true;
      const name = typeof obj?.name === "string" ? obj.name.toLowerCase().trim() : "";
      if (name === "page background") return true;
      if (name === "page-bg") return true;
      const id = obj?.id || obj?.data?.id;
      if (id === "page_bg") return true;
      if (obj?.type === "rect" && obj.left === 0 && obj.top === 0 && pageW && pageH) {
        const w = obj.getScaledWidth?.() ?? obj.width ?? 0;
        const h = obj.getScaledHeight?.() ?? obj.height ?? 0;
        return Math.abs(w - pageW) < 2 && Math.abs(h - pageH) < 2;
      }
      return false;
    },
    []
  );

  const findPageObject = useCallback(
    (c: Canvas, pageW?: number, pageH?: number) => {
      const objs = c.getObjects?.() || [];
      const direct = objs.find((o: any) => isPageBackgroundObject(o, pageW, pageH));
      if (direct) return direct as any;
      if (!pageW || !pageH) return null;
      const tol = 5;
      let best: any = null;
      let bestScore = -Infinity;
      for (const o of objs) {
        if (!o) continue;
        if ((o as any)?.role === "grid") continue;
        const w = o.getScaledWidth?.() ?? o.width ?? 0;
        const h = o.getScaledHeight?.() ?? o.height ?? 0;
        if (!w || !h) continue;
        if (Math.abs(w - pageW) > tol || Math.abs(h - pageH) > tol) continue;
        let score = 0;
        if (o.type === "rect") score += 2;
        if (o.fill) score += 1;
        const left = Number(o.left ?? 0);
        const top = Number(o.top ?? 0);
        if (Math.abs(left) <= tol) score += 1;
        if (Math.abs(top) <= tol) score += 1;
        score += (w * h) / (pageW * pageH);
        if (score > bestScore) {
          bestScore = score;
          best = o;
        }
      }
      return best;
    },
    [isPageBackgroundObject]
  );

  const getPageSizeForFit = useCallback(() => {
    const c = canvasRef.current;
    const fallback =
      pageSize === "Custom" ? pageSizePxRef.current : PAGE_SIZES[pageSize];
    if (!c) return fallback;
    const pageObj = findPageObject(c, fallback?.w, fallback?.h);
    if (pageObj) {
      const w = pageObj.getScaledWidth?.() ?? pageObj.width ?? fallback.w;
      const h = pageObj.getScaledHeight?.() ?? pageObj.height ?? fallback.h;
      return { w, h };
    }
    return fallback;
  }, [findPageObject, pageSize]);

  const getPageSizeForCanvas = useCallback(
    (c: Canvas | null) => {
      const fallback =
        pageSize === "Custom" ? pageSizePxRef.current : PAGE_SIZES[pageSize];
      if (!c) return fallback;
      const pageObj = findPageObject(c, fallback?.w, fallback?.h);
      if (pageObj) {
        const w = pageObj.getScaledWidth?.() ?? pageObj.width ?? fallback.w;
        const h = pageObj.getScaledHeight?.() ?? pageObj.height ?? fallback.h;
        return { w, h };
      }
      return fallback;
    },
    [findPageObject, pageSize]
  );

  const getPageBounds = useCallback(
    (c: Canvas | null) => {
      const fallback =
        pageSize === "Custom" ? pageSizePxRef.current : PAGE_SIZES[pageSize];
      if (!c) return { left: 0, top: 0, width: fallback.w, height: fallback.h };
      const pageObj = findPageObject(c, fallback?.w, fallback?.h);
      if (pageObj) {
        const b = getObjectBounds(pageObj);
        return { left: b.left, top: b.top, width: b.width, height: b.height };
      }
      const objs = c.getObjects?.() || [];
      const nonGrid = objs.filter((o: any) => o?.role !== "grid");
      const bounds = getContentBounds(nonGrid);
      if (bounds) {
        return {
          left: bounds.minX,
          top: bounds.minY,
          width: bounds.maxX - bounds.minX,
          height: bounds.maxY - bounds.minY,
        };
      }
      return { left: 0, top: 0, width: fallback.w, height: fallback.h };
    },
    [findPageObject, getContentBounds, getObjectBounds, pageSize]
  );

  const syncCanvasesToContainer = useCallback((z: number) => {
    const { w: pageW, h: pageH } = pageSizePxRef.current;
    const w = Math.max(1, Math.round(pageW * z));
    const h = Math.max(1, Math.round(pageH * z));
    const prevSize = lastHostSizeRef.current;
    const changed = !prevSize || prevSize.w !== w || prevSize.h !== h;
    lastHostSizeRef.current = { w, h };
    if (process.env.NODE_ENV !== "production") {
      console.log("[syncCanvasesToContainer]", {
        z,
        w,
        h,
        changed,
        canvasCount: pageCanvasesRef.current.size,
      });
    }
    if (!changed) {
      // Dimensions already match; avoid redundant setDimensions() to prevent resize feedback loops.
      return false;
    }
    pageCanvasesRef.current.forEach((c) => {
      c.setDimensions({ width: w, height: h }, { backstoreOnly: false });
      (c as any).calcOffset?.();
    });
    return true;
  }, []);

  const applyZoomToCanvas = useCallback((canvas: Canvas, z: number) => {
    if (process.env.NODE_ENV !== "production") {
      console.log("[applyZoomToCanvas]", { z });
    }
    const vpt: [number, number, number, number, number, number] = [
      z,
      0,
      0,
      z,
      0,
      0,
    ];
    canvas.setViewportTransform(vpt);
    (canvas as any).calcOffset?.();
    canvas.requestRenderAll();
  }, []);

  const applyZoomToCanvases = useCallback(
    (z: number) => {
      syncCanvasesToContainer(z);
      pageCanvasesRef.current.forEach((canvas) => {
        applyZoomToCanvas(canvas, z);
      });
      setZoomState(z);
    },
    [applyZoomToCanvas, syncCanvasesToContainer]
  );

  const applyEffectiveZoom = useCallback(
    (effectiveZoom: number) => {
      const z = clampEffectiveZoom(effectiveZoom);
      applyZoomToCanvases(z);
    },
    [applyZoomToCanvases, clampEffectiveZoom]
  );

  const setZoom = useCallback(
    (next: number) => {
      const z = clampEffectiveZoom(next);
      didInitialFitRef.current = true;
      manualZoomRef.current = true;
      zoomModeRef.current = "manual";
      userZoomedRef.current = true;
      applyEffectiveZoom(z);
    },
    [applyEffectiveZoom, clampEffectiveZoom]
  );

  const setZoomPercent = useCallback(
    (p: number) => {
      const z = clampEffectiveZoom(p / 100);
      setZoom(z);
    },
    [clampEffectiveZoom, setZoom]
  );

  const getDefaultLabel = useCallback((obj: any) => {
    const size = pageSizePxRef.current;
    const isPageBg =
      obj?.get?.("isPageBg") === true ||
      isPageBackgroundObject(obj, size.w, size.h);
    if (isPageBg) return "Page Background";
    const type = String(obj?.type || "").toLowerCase();
    if (type === "textbox" || type === "i-text" || type === "text") {
      const text = String(obj?.text || "").trim();
      if (!text) return "Text";
      return text.length > 20 ? `${text.slice(0, 20)}…` : text;
    }
    if (type === "image") return "Image";
    if (type === "rect") return "Rectangle";
    if (type === "circle") return "Circle";
    if (type === "line") return "Line";
    if (type === "group" && isImageFrame(obj)) {
      const ft = getImageFrameFrameType(obj);
      return ft === "circle" ? "Circle Image Frame" : "Square Image Frame";
    }
    return "Layer";
  }, [isPageBackgroundObject]);

  const serialize = useCallback(() => {
    const c = getCanvas();
    if (!c) return { objects: [] };
    const full = c.toDatalessJSON([
      "excludeFromExport",
      "selectable",
      "evented",
      "role",
      "name",
      "slbId",
      "isPageBg",
      "locked",
      "hidden",
    ]);
    const objects = (full.objects || []).filter((o: any) => o.role !== "grid");
    return { objects };
  }, []);

  const getDraftKey = useCallback(() => {
    const id = mode === "new" ? "new" : String(initialTemplateId || "new");
    return `slb:draft:${id}`;
  }, [initialTemplateId, mode]);

  const serializeForDraft = useCallback(() => {
    const c = getCanvas();
    if (!c) return null;
    return (c as any).toJSON([
      "excludeFromExport",
      "selectable",
      "evented",
      "role",
      "name",
      "slbId",
      "isPageBg",
      "locked",
      "hidden",
    ]);
  }, [getCanvas]);

  const getCanvasJsonForSave = useCallback(() => {
    return serializeForDraft();
  }, [serializeForDraft]);

  const getCanvasJson = useCallback(() => {
    return getCanvasJsonForSave();
  }, [getCanvasJsonForSave]);

  const getPagesJsonForSave = useCallback(() => {
    const toJson = (c: Canvas) =>
      (c as any).toJSON([
        "excludeFromExport",
        "selectable",
        "evented",
        "role",
        "name",
        "slbId",
        "isPageBg",
        "locked",
        "hidden",
      ]);
    const pagesData: any[] = [];
    const order = pages.map((p) => p.id);
    for (const pageId of order) {
      const c = pageCanvasesRef.current.get(pageId);
      if (c) pagesData.push(toJson(c));
    }
    return pagesData.length > 0 ? pagesData : null;
  }, [pages]);

  const saveDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    const draft = serializeForDraft();
    if (!draft) return;
    try {
      window.localStorage.setItem(getDraftKey(), JSON.stringify(draft));
    } catch {}
  }, [getDraftKey, serializeForDraft]);

  const saveToCloud = useCallback(
    async (title?: string) => {
      if (!user) {
        console.warn("[save] No user logged in");
        return null;
      }
      const pagesData = getPagesJsonForSave();
      const hasMultiplePages = Array.isArray(pagesData) && pagesData.length > 1;
      const canvasJson = hasMultiplePages ? undefined : getCanvasJsonForSave();
      const dataToSave = hasMultiplePages ? pagesData : canvasJson;
      if (!dataToSave) return null;
      const nextTitle = title || docTitle || "Untitled Resume";
      const common = {
        uid: user.uid,
        title: nextTitle,
        pageSize,
        zoom,
      };
      if (cloudDocId) {
        await updateResumeDoc({
          ...common,
          docId: cloudDocId,
          ...(hasMultiplePages ? { pagesData } : { canvasJson }),
        });
        setDocTitle(nextTitle);
        return { docId: cloudDocId, isNew: false };
      }
      const templateId = (initialTemplateId || "").toLowerCase().trim();
      const isTemplate = !!TEMPLATE_SNAPSHOTS[templateId];
      const sourceTemplateId = isTemplate ? templateId : null;
      const newDocId = await createResumeDoc({
        ...common,
        sourceTemplateId,
        ...(hasMultiplePages ? { pagesData } : { canvasJson }),
      });
      setCloudDocId(newDocId);
      setDocTitle(nextTitle);
      return { docId: newDocId, isNew: true };
    },
    [
      cloudDocId,
      docTitle,
      getCanvasJsonForSave,
      getPagesJsonForSave,
      initialTemplateId,
      pageSize,
      user,
      zoom,
    ]
  );

  const pushHistory = useCallback((reason: string) => {
    const c = getCanvas();
    if (!c || isApplyingRef.current) return;
    const snap = serialize();
    const last = undoRef.current[undoRef.current.length - 1];
    if (last && JSON.stringify(last) === JSON.stringify(snap)) return;
    undoRef.current.push(snap);
    redoRef.current = [];
    docRevisionRef.current += 1;
  }, [getCanvas, serialize]);

  const applyPageBackgroundProps = useCallback(
    (pageObj: any, pageW: number, pageH: number, fill: string) => {
      const baseProps = {
        width: pageW,
        height: pageH,
        left: 0,
        top: 0,
        originX: "left",
        originY: "top",
        scaleX: 1,
        scaleY: 1,
        fill,
        stroke: "#e5e7eb",
        shadow: new Shadow({
          color: "rgba(0,0,0,0.10)",
          blur: 18,
          offsetX: 0,
          offsetY: 8,
        }),
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false,
        lockMovementX: true,
        lockMovementY: true,
        lockScalingX: true,
        lockScalingY: true,
        lockRotation: true,
        hoverCursor: "default",
        borderColor: "transparent",
        cornerColor: "transparent",
        transparentCorners: true,
        excludeFromExport: false,
      } as const;

      pageObj.set?.(baseProps);
      pageObj.role = "pageBackground";
      pageObj.name = "Page Background";
      pageObj.set?.("isPageBg", true);
      if (!pageObj.data) pageObj.data = {};
      pageObj.data.role = "pageBackground";
      pageObj.data.kind = "page-bg";
      pageObj.data.system = true;
      pageObj.setCoords?.();
    },
    []
  );

  const makePageBackgroundRect = useCallback(
    (pageW: number, pageH: number, fill: string) => {
      const rect = new Rect({
        width: pageW,
        height: pageH,
        left: 0,
        top: 0,
        fill,
        stroke: "#e5e7eb",
        shadow: new Shadow({
          color: "rgba(0,0,0,0.10)",
          blur: 18,
          offsetX: 0,
          offsetY: 8,
        }),
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false,
        lockMovementX: true,
        lockMovementY: true,
        lockScalingX: true,
        lockScalingY: true,
        lockRotation: true,
        hoverCursor: "default",
        borderColor: "transparent",
        cornerColor: "transparent",
        transparentCorners: true,
        excludeFromExport: false,
      }) as any;
      applyPageBackgroundProps(rect, pageW, pageH, fill);
      return rect;
    },
    [applyPageBackgroundProps]
  );

  const normalizePageBackground = useCallback(
    (
      c: Canvas,
      pageW: number,
      pageH: number,
      fill: string,
      opts?: { discardSelection?: boolean }
    ) => {
      if (!c) return null;
      c.set({ backgroundColor: CANVAS_BG });
      let pageObj = findPageObject(c, pageW, pageH) as any;
      const shouldReplace =
        !pageObj || !(pageObj instanceof Rect) || typeof pageObj?.set !== "function";
      if (pageObj && shouldReplace) {
        try {
          c.remove(pageObj);
        } catch {}
        pageObj = null;
      }
      if (!pageObj) {
        pageObj = makePageBackgroundRect(pageW, pageH, fill);
      } else {
        applyPageBackgroundProps(pageObj, pageW, pageH, fill);
      }
      if (!c.getObjects().includes(pageObj)) {
        c.add(pageObj);
      }
      if ((c as any).sendToBack) {
        (c as any).sendToBack(pageObj);
      } else if (pageObj.moveTo) {
        pageObj.moveTo(0);
      }
      const active = c.getActiveObject?.();
      if (active === pageObj) {
        c.discardActiveObject();
      }
      // IMPORTANT: do NOT blindly discard the current selection here.
      // This function is called frequently (page size changes, doc load, etc.),
      // and clearing selection on every call makes it impossible for the user
      // to keep objects selected or drag them reliably.
      c.requestRenderAll();
      return pageObj;
    },
    [applyPageBackgroundProps, findPageObject, makePageBackgroundRect]
  );

  const applyPageBackground = useCallback(
    (color: string) => {
      const c = getCanvas();
      if (!c) return;
      const size = pageSizePxRef.current;
      normalizePageBackground(c, size.w, size.h, color);
    },
    [getCanvas, normalizePageBackground]
  );

  const ensurePageBackground = useCallback(
    (pageW: number, pageH: number, opts?: { discardSelection?: boolean }) => {
      const c = getCanvas();
      if (!c) return;
      normalizePageBackground(c, pageW, pageH, bgColorRef.current || "#ffffff", opts);
    },
    [getCanvas, normalizePageBackground]
  );

  function applyViewportTransform(opts: {
    zoom: number;
    rectW: number;
    rectH: number;
    pageW: number;
    pageH: number;
  }) {
    const c = getCanvas();
    if (!c) return;
    const z = Math.max(0.05, Math.min(4, opts.zoom));
    const padding = 24;
    const scaledW = opts.pageW * z;
    const scaledH = opts.pageH * z;
    let tx = (opts.rectW - scaledW) / 2;
    let ty = padding;
    if (scaledW <= opts.rectW) {
      tx = clamp(tx, 0, opts.rectW - scaledW);
    } else {
      tx = clamp(tx, opts.rectW - scaledW, 0);
    }
    const minTy = scaledH <= opts.rectH ? 0 : opts.rectH - scaledH;
    const maxTy = scaledH <= opts.rectH ? opts.rectH - scaledH : padding;
    ty = clamp(ty, minTy, maxTy);
    const vt: [number, number, number, number, number, number] = [
      z,
      0,
      0,
      z,
      Math.round(tx),
      Math.round(ty),
    ];
    c.setViewportTransform(vt);
    c.requestRenderAll();
    setZoomState(z);
  }

  const PAGE_HEADER_HEIGHT_PX = 48;
  const PAGE_GAP_PX = 48;

  const fitViewport = useCallback(
    (reason: string = "fit") => {
      const c = canvasRef.current;
      if (!c) return;
      if (
        reason === "templateLoaded" ||
        reason === "template-loaded" ||
        reason === "pageSize" ||
        reason === "doc-load" ||
        reason === "doc-load-no-zoom"
      ) {
        manualZoomRef.current = false;
        userZoomedRef.current = false;
        zoomModeRef.current = "fitWidth";
      }
      if (manualZoomRef.current && reason === "resize") return;
      if (zoomModeRef.current === "manual") return;
      if (userZoomedRef.current && reason === "resize") {
        applyZoomToCanvases(getZoom());
        return;
      }
      const hostRect = getViewportSize(c);
      if (!hostRect) return;
      const viewportH = hostRect.h;
      if (viewportH <= 0) return;
      const { h: pageH } = pageSizePxRef.current;

      const availableHeight =
        viewportH - PAGE_HEADER_HEIGHT_PX - PAGE_GAP_PX;
      if (availableHeight <= 0) return;

      let fit = availableHeight / pageH;
      if (!Number.isFinite(fit) || fit <= 0) return;
      fit = Math.min(fit, 1);

      if (baseFitZoomRef.current === null) {
        baseFitZoomRef.current = fit;
      }
      fitZoomRef.current = fit;
      if (process.env.NODE_ENV !== "production") {
        console.log("[fitViewport] baseFitZoomRef:", baseFitZoomRef.current, "reason:", reason);
      }
      applyEffectiveZoom(fit);

      if (
        reason === "templateLoaded" ||
        reason === "template-loaded" ||
        reason === "pageSize" ||
        reason === "doc-load" ||
        reason === "doc-load-no-zoom"
      ) {
        const vp = viewportRef.current;
        if (vp) {
          vp.scrollTop = 0;
          vp.scrollLeft = 0;
        }
      }

    },
    [
      applyEffectiveZoom,
      applyZoomToCanvases,
      getZoom,
      getViewportSize,
    ]
  );

  const fitToViewport = useCallback(
    (reason: string = "fitToViewport") => {
      if (manualZoomRef.current && reason === "resize") return;
      zoomModeRef.current = "fitWidth";
      fitViewport(reason);
    },
    [fitViewport]
  );

  const setManualZooming = useCallback((flag: boolean) => {
    manualZoomRef.current = flag;
    zoomModeRef.current = flag ? "manual" : "fitWidth";
    if (!flag) userZoomedRef.current = false;
  }, []);

  const scheduleFit = useCallback(
    (reason: string) => {
      if (isLoadingDocRef.current) {
        if (process.env.NODE_ENV !== "production") {
          console.log("[scheduleFit] skipped during doc load", reason);
        }
        return;
      }
      if (fitRafRef.current) cancelAnimationFrame(fitRafRef.current);
      const runFit = () => {
        fitResizeTimeoutRef.current = null;
        fitRafRef.current = requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            fitToViewport(reason);
          });
        });
      };
      if (reason === "resize") {
        if (fitResizeTimeoutRef.current) {
          window.clearTimeout(fitResizeTimeoutRef.current);
        }
        fitResizeTimeoutRef.current = window.setTimeout(runFit, FIT_RESIZE_DEBOUNCE_MS);
        return;
      }
      if (fitResizeTimeoutRef.current) {
        window.clearTimeout(fitResizeTimeoutRef.current);
        fitResizeTimeoutRef.current = null;
      }
      runFit();
    },
    [fitToViewport]
  );

  const scheduleFitRef = useRef(scheduleFit);
  scheduleFitRef.current = scheduleFit;

  useEffect(() => {
    return () => {
      if (fitRafRef.current) cancelAnimationFrame(fitRafRef.current);
      if (fitResizeTimeoutRef.current) window.clearTimeout(fitResizeTimeoutRef.current);
    };
  }, []);

  const setViewportEl = useCallback(
    (el: HTMLElement | null) => {
      viewportRef.current = el as HTMLDivElement | null;
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (!el || typeof ResizeObserver === "undefined") return;
      const ro = new ResizeObserver(() => {
        scheduleFitRef.current("resize");
      });
      ro.observe(el);
      resizeObserverRef.current = ro;
      requestAnimationFrame(() => {
        scheduleFitRef.current("resize");
      });
      // Recalc Fabric pointer offset once viewport is in DOM (fixes hit-test when viewport mounts after canvas)
      requestAnimationFrame(() => {
        setTimeout(() => {
          const c = getCanvas();
          if (c) refreshCanvasOffset(c);
        }, 0);
      });
    },
    [getCanvas]
  );

  useEffect(() => {
    const onResize = () => scheduleFitRef.current("resize");
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const setPageBackground = useCallback(
    (color: string) => {
      const normalized = toHexColor(color, "#ffffff");
      setBgColor(normalized);
      applyPageBackground(normalized);
      scheduleFitRef.current("templateLoaded");
    },
    [applyPageBackground]
  );

  const applySnapshotToCanvas = useCallback(
    async (c: Canvas, snap: any, reason: string) => {
      if (reason === "doc-load" && lastLoadedSnapshotRef.current === snap) {
        return;
      }
      baseFitZoomRef.current = null;
      isApplyingRef.current = true;
      const json = normalizeToFabricJson(snap);
      if (!json || !Array.isArray((json as any).objects)) {
        console.error("[editor] Invalid template JSON, expected {objects: []}", snap);
        isApplyingRef.current = false;
        return;
      }
      didInitialFitRef.current = false;
      const isDuplicate = reason === "page-duplicate";
      const isDocLoad = reason === "doc-load";
      const skipPostLoadMutations = isDuplicate || isDocLoad;
      const enforceBackgroundSafety = () => {
        const target = pageSizePxRef.current;
        c.getObjects().forEach((o: any) => {
          if (isPageBackgroundObject(o, target.w, target.h)) {
            applyPageBackgroundProps(
              o,
              target.w,
              target.h,
              bgColorRef.current || "#ffffff"
            );
          }
        });
      };
      if (!skipPostLoadMutations) {
        c.setViewportTransform([1, 0, 0, 1, 0, 0]);
      }
      c.requestRenderAll();
      if (process.env.NODE_ENV !== "production") {
        console.log("[applySnapshot] baseFitZoomRef reset, canvas.clear() before loadFromJSON", {
          reason,
          baseFitZoomRef: baseFitZoomRef.current,
        });
      }
      c.clear();
      const reviver = (_: any, obj: any) => {
        const target = pageSizePxRef.current;
        if (isPageBackgroundObject(obj, target.w, target.h)) {
          applyPageBackgroundProps(
            obj,
            target.w,
            target.h,
            bgColorRef.current || "#ffffff"
          );
        }
      };
      const finalize = () => {
        c.getObjects().forEach((o: any) => {
          ensureObjectId(o);
          applyTextBoxNoStretch(o);
        });
        // --- SLB: normalize 300DPI templates into editor page size (fix right-shift) ---
        // Skip for page-duplicate and doc-load: content is already in correct coordinates
        if (!skipPostLoadMutations) {
try {
  const targetW = pageSizePxRef.current.w;
  const targetH = pageSizePxRef.current.h;

  const allObjs = c.getObjects?.() || [];

  // find biggest rect by area (this is typically the "paper/page" in 300DPI templates)
  const biggest = allObjs
    .map((o: any) => {
      const w = o?.getScaledWidth?.() ?? o?.width ?? 0;
      const h = o?.getScaledHeight?.() ?? o?.height ?? 0;
      return { o, w: Number(w) || 0, h: Number(h) || 0, a: (Number(w) || 0) * (Number(h) || 0) };
    })
    .filter((x) => x.o && x.w > 0 && x.h > 0)
    .sort((a, b) => b.a - a.a)[0];

  if (biggest && biggest.w > targetW * 1.5 && biggest.h > targetH * 1.5) {
    const sx = targetW / biggest.w;
    const sy = targetH / biggest.h;
    // use same scale for X/Y to preserve aspect ratio
    const s = Math.min(sx, sy);

    // scale + shift everything into the editor page space
    for (const o of allObjs) {
      if (!o) continue;

      const left = Number(o.left ?? 0);
      const top = Number(o.top ?? 0);
      const scaleX = Number(o.scaleX ?? 1);
      const scaleY = Number(o.scaleY ?? 1);

      o.set?.({
        left: left * s,
        top: top * s,
        scaleX: scaleX * s,
        scaleY: scaleY * s,
      });
      o.setCoords?.();
    }

    // After scaling, shift so the biggest rect starts at (0,0)
    const bg = biggest.o;
    const bgLeft = Number(bg.left ?? 0);
    const bgTop = Number(bg.top ?? 0);

    if (bgLeft || bgTop) {
      for (const o of allObjs) {
        if (!o) continue;
        const left = Number(o.left ?? 0);
        const top = Number(o.top ?? 0);
        o.set?.({ left: left - bgLeft, top: top - bgTop });
        o.setCoords?.();
      }
    }
  }
} catch {}
        }
// --- end normalize ---
        const pageSizeTarget = pageSizePxRef.current;
        ensurePageBackground(pageSizeTarget.w, pageSizeTarget.h, { discardSelection: true });
        applyPageBackground(bgColorRef.current);
        enforceBackgroundSafety();
        const pageW = pageSizeTarget.w;
        const pageH = pageSizeTarget.h;
        const pageObj = findPageObject(c, pageW, pageH) as any;
        if (pageObj) {
          applyPageBackgroundProps(pageObj, pageW, pageH, bgColorRef.current || "#ffffff");
          if ((c as any).sendToBack) {
            (c as any).sendToBack(pageObj);
          } else if (pageObj.moveTo) {
            pageObj.moveTo(0);
          }
        }
        //if (reason === "template-loaded" && !normalizedContentRef.current.has(c)) {
        // TEMP FIX: disable second normalization
        if (false && reason === "template-loaded" && !normalizedContentRef.current.has(c)) {
      const all = c.getObjects();
      const nonBg = pageObj
        ? all.filter((o: any) => o !== pageObj && o?.role !== "grid")
        : all.filter((o: any) => o?.role !== "grid");
      const bounds = getContentBounds(nonBg);
      if (!bounds) return;

      const contentW = bounds!.maxX - bounds!.minX;
      const contentH = bounds!.maxY - bounds!.minY;

      const scale = pageW / contentW;

      const dx = -bounds!.minX;
      const dy = -bounds!.minY;

      for (const o of nonBg) {
        const left = Number(o?.left ?? 0);
        const top = Number(o?.top ?? 0);

        o.set?.({
          left: (left + dx) * scale,
          top: (top + dy) * scale,
        });

        const sx = Number(o?.scaleX ?? 1);
        const sy = Number(o?.scaleY ?? 1);

        o.set?.({
          scaleX: sx * scale,
          scaleY: sy * scale,
        });

        o.setCoords?.();
      }

      normalizedContentRef.current.add(c);
    }
        c.discardActiveObject();
        setSelectedLayerId(null);
        setSelectionType("none");
        setActiveObjectType(null);
        setActiveObjectSnapshot(null);

        const objs = c.getObjects();
        objs.forEach((obj: any) => {
          // page background must NEVER intercept clicks
          if (obj?.role === "pageBackground") {
            obj.set({
              selectable: false,
              evented: false,
            });
            return;
          }

          // grid also non-interactive
          if (obj?.role === "grid") {
            obj.set({
              selectable: false,
              evented: false,
            });
            return;
          }

          // all other objects interactive
          obj.set({
            selectable: true,
            evented: true,
          });

          // normalize groups
          if (obj.type === "group") {
            obj.set({
              selectable: true,
              evented: true,
              subTargetCheck: false,
            });
          }
        });

        // Restore canvas interaction flags after JSON load
        c.selection = true;
        c.skipTargetFind = false;
        (c as any).interactive = true;
        refreshCanvasOffset(c);
        if (reason === "template-loaded" && !skipPostLoadMutations) {
          userZoomedRef.current = false;
          didLogFitRef.current = null;
          scheduleFit("templateLoaded");
        }
        if (process.env.NODE_ENV !== "production") {
          console.log("[applySnapshot] loadFromJSON finalize done, requestRenderAll", { reason });
        }
        lastLoadedSnapshotRef.current = snap;
        c.requestRenderAll();
        if (skipPostLoadMutations) {
          requestAnimationFrame(() => {
            if (hadStoredZoomRef.current) {
              applyZoomToCanvases(getZoom());
            } else {
              scheduleFit("doc-load");
            }
          });
        }
      };
      let finalized = false;
      try {
       if (process.env.NODE_ENV !== "production") {
         console.log("[loadFromJSON] start", { reason, objectsCount: (json?.objects?.length ?? 0) });
       }
       const result = (c as any).loadFromJSON(
  json,
  reviver,
  () => {
    if (finalized) return;
    finalized = true;
    finalize();
  }
);
        if (result && typeof result.then === "function") {
          await result;
          if (!finalized) {
            finalized = true;
            finalize();
          }
        }
      } catch (err) {
        console.error("[editor] Failed to load template JSON", err);
      }
      isApplyingRef.current = false;
    },
    [
      applyPageBackground,
      applyPageBackgroundProps,
      applyZoomToCanvases,
      ensureObjectId,
      ensurePageBackground,
      getZoom,
      isPageBackgroundObject,
      normalizeToFabricJson,
      scheduleFit,
    ]
  );

  const applySnapshotToCanvasRef = useRef(applySnapshotToCanvas);
  applySnapshotToCanvasRef.current = applySnapshotToCanvas;

  const applySnapshot = useCallback(
    async (snap: any, reason: string = "template-loaded") => {
      const c = getCanvas();
      if (!c) return;
      await applySnapshotToCanvas(c, snap, reason);
    },
    [applySnapshotToCanvas, getCanvas]
  );

  const applySnapshotRef = useRef(applySnapshot);
  applySnapshotRef.current = applySnapshot;

  const getLayerObjects = useCallback(() => {
    const c = getCanvas();
    if (!c) return { pageObj: null, gridObj: null, normalObjs: [] as any[] };
    const objs = c.getObjects();
    const size = pageSizePxRef.current;
    const pageObj = findPageObject(c, size.w, size.h);
    const gridObj = objs.find((o: any) => o?.role === "grid") || null;
    const normalObjs = objs.filter(
      (o: any) => o?.role !== "grid" && !isPageBackgroundObject(o, size.w, size.h)
    );
    return { pageObj, gridObj, normalObjs };
  }, [findPageObject, getCanvas, isPageBackgroundObject]);

  const lastLayersRef = useRef<string>("");
  const updateLayers = useCallback(() => {
    if (isCanvasBootingRef.current) return;
    const c = getCanvas();
    if (!c) return;
    const size = pageSizePxRef.current;
    const items = getLayersFromModule(c, {
      isPageBackground: (o: any) => isPageBackgroundObject(o, size.w, size.h),
      getDisplayName: getDefaultLabel,
      ensureId: (o: any) => ensureObjectId(o),
    });
    const signature = items.map((i) => i.id).join("|");
    if (signature !== lastLayersRef.current) {
      lastLayersRef.current = signature;
      setLayers(items);
    }
  }, [ensureObjectId, getDefaultLabel, getCanvas, isPageBackgroundObject]);

  const updateLayersRef = useRef(updateLayers);
  updateLayersRef.current = updateLayers;

  const renameLayer = useCallback(
    (id: string, newName: string) => {
      const c = getCanvas();
      if (!c) return;
      let obj = c
        .getObjects()
        .find((o: any) => o?.data?.id === id || o?.id === id || o?.uid === id);
      if (!obj && id.startsWith("__idx_")) {
        const idx = Number(id.replace("__idx_", ""));
        obj = c.getObjects()[idx];
      }
      if (!obj) return;
      const name = String(newName || "").trim();
      obj.set?.("name", name || getDefaultLabel(obj));
      c.requestRenderAll();
      updateLayers();
      saveDraft();
    },
    [getCanvas, getDefaultLabel, saveDraft, updateLayers]
  );

  const lastSelectionRef = useRef<string | null>(null);

  const updateSelection = useCallback(() => {
    const c = getCanvas();
    if (!c) return;
    const active: any = c.getActiveObject();

    // Guard: skip React work if logical selection id hasn't changed
    let currentId: string | null = null;
    if (active) {
      if (active.type === "activeSelection") {
        const objs = active.getObjects?.() || active._objects || [];
        const target = objs[0];
        currentId = target ? ensureObjectId(target) : null;
      } else {
        currentId = ensureObjectId(active);
      }
    }
    if (lastSelectionRef.current === currentId) {
      return;
    }
    lastSelectionRef.current = currentId;

    if (!active || active.type === "activeSelection") {
      if (active?.type === "activeSelection") {
        const objs = active.getObjects?.() || active._objects || [];
        const target = objs[0];
        const targetId = target ? ensureObjectId(target) : null;
        setSelectedLayerId((prev) => (prev === targetId ? prev : targetId));
      } else {
        setSelectedLayerId((prev) => (prev === null ? prev : null));
      }
      setSelectionType((prev) => (prev === "none" ? prev : "none"));
      setSelectedFrameHasImage((prev: boolean) => (prev === false ? prev : false));
      setActiveObjectType((prev: string | null) => (prev === null ? prev : null));
      setActiveObjectSnapshot((prev: any) => (prev === null ? prev : null));
      return;
    }
    const type = String(active.type || "").toLowerCase();
    isHydratingFromSelectionRef.current = true;
    setActiveObjectType((prev: string | null) => (prev === type ? prev : type));
    const nextSnapshot = active.toObject ? active.toObject() : active;
    setActiveObjectSnapshot((prev: any) => (prev === nextSnapshot ? prev : nextSnapshot));
    const activeId = ensureObjectId(active);
    setSelectedLayerId((prev: string | null) => (prev === activeId ? prev : activeId));
    if (type === "textbox" || type === "i-text" || type === "text") {
      setSelectionType((prev) => (prev === "text" ? prev : "text"));
      setSelectedFrameHasImage((prev) => (prev === false ? prev : false));
      logTextSync("hydrate");
      const activeFontSize = Number(active.fontSize);
      const activeLineHeight = Number(active.lineHeight);
      setTextProps({
        fontFamily: active.fontFamily || "Poppins",
        fontSize: Number.isFinite(activeFontSize) ? Math.round(activeFontSize) : 32,
        fill: toHexColor(active.fill, "#111827"),
        fontWeight: active.fontWeight === "bold" ? "bold" : "normal",
        fontStyle: active.fontStyle === "italic" ? "italic" : "normal",
        underline: !!active.underline,
        textAlign: active.textAlign || "left",
        lineHeight: Number.isFinite(activeLineHeight) ? activeLineHeight : 1.3,
      });
    } else if (type === "image") {
      setSelectionType((prev) => (prev === "image" ? prev : "image"));
      setSelectedFrameHasImage((prev) => (prev === false ? prev : false));
      const nextImage = { opacity: active.opacity ?? 1 };
      setImageProps((prev: typeof nextImage | null) =>
        prev && prev.opacity === nextImage.opacity ? prev : nextImage
      );
    } else if (type === "rect" || type === "circle" || type === "triangle" || type === "line") {
      setSelectionType((prev) => (prev === "shape" ? prev : "shape"));
      setSelectedFrameHasImage((prev) => (prev === false ? prev : false));
      const nextShape = {
        fill: toHexColor(active.fill, "#111827"),
        stroke: toHexColor(active.stroke, "#111827"),
        strokeWidth: active.strokeWidth || 2,
        opacity: active.opacity ?? 1,
        cornerRadius: active.rx || 0,
      };
      setShapeProps((prev: typeof nextShape | null) =>
        prev &&
        prev.fill === nextShape.fill &&
        prev.stroke === nextShape.stroke &&
        prev.strokeWidth === nextShape.strokeWidth &&
        prev.opacity === nextShape.opacity &&
        prev.cornerRadius === nextShape.cornerRadius
          ? prev
          : nextShape
      );
    } else if ((type === "group" || type === "activeSelection") && isImageFrame(active)) {
      setSelectionType((prev) => (prev === "frame" ? prev : "frame"));
      const hasImg = !!getImageForFrame(c, active);
      setSelectedFrameHasImage((prev) => (prev === hasImg ? prev : hasImg));
    } else {
      setSelectedFrameHasImage((prev) => (prev === false ? prev : false));
      setSelectionType((prev) => (prev === "none" ? prev : "none"));
    }
    requestAnimationFrame(() => {
      isHydratingFromSelectionRef.current = false;
    });
  }, [ensureObjectId, getCanvas, logTextSync]);

  const updateSelectionRef = useRef(updateSelection);
  updateSelectionRef.current = updateSelection;

  const attachImageToFrameRef = useRef<(frameGroup: any, img: any) => void>(() => undefined);

  const activeCanvasListenersRef = useRef<{
    canvas: Canvas;
    handlers: {
      selectionCreated: (e?: any) => void;
      selectionUpdated: (e?: any) => void;
      selectionCleared: () => void;
      objectModified: (e?: any) => void;
      objectAdded: (e: any) => void;
      objectRemoved: (e: any) => void;
      textChanged: () => void;
      mouseDblclick: (e: any) => void;
      mouseUp: (e: any) => void;
      debugMouseDown?: (e: any) => void;
    };
  } | null>(null);

  const unbindActiveCanvasListeners = useCallback(() => {
    const current = activeCanvasListenersRef.current;
    if (!current) return;
    const { canvas, handlers } = current;
    canvas.off("selection:created", handlers.selectionCreated);
    canvas.off("selection:updated", handlers.selectionUpdated);
    canvas.off("selection:cleared", handlers.selectionCleared);
    canvas.off("object:modified", handlers.objectModified);
    canvas.off("object:added", handlers.objectAdded as any);
    canvas.off("object:removed", handlers.objectRemoved as any);
    canvas.off("text:changed", handlers.textChanged);
    canvas.off("mouse:dblclick", handlers.mouseDblclick);
    canvas.off("mouse:up", handlers.mouseUp);
    if (handlers.debugMouseDown) canvas.off("mouse:down", handlers.debugMouseDown);
    activeCanvasListenersRef.current = null;
  }, []);

  const { enterImageFrameCropMode, exitImageFrameCropMode } = createFrameCrop({
    getCanvas,
    isImageFrame,
    getImageForFrame,
    imageFrameCropModeRef,
    exitCropModeRef,
    setCropModeStateRef,
  });

  const bindActiveCanvasListeners = useCallback(
    (canvas: Canvas) => {
      if (activeCanvasListenersRef.current?.canvas === canvas) {
        return;
      }
      unbindActiveCanvasListeners();

      const exitCropMode = () => {
        const state = imageFrameCropModeRef.current;
        if (!state) return;
        const { frame, image } = state;

        // Apply a simple final crop based on the image's position relative to the frame.
        if (frame && image) {
          const shape = getFrameShape(frame);
          const frameW = Number((shape as any)?.width ?? 0);
          const frameH = Number((shape as any)?.height ?? 0);
          const scale = Number((image as any).scaleX || 1);
          if (frameW > 0 && frameH > 0 && Number.isFinite(scale) && scale > 0) {
            const imgLeft = Number((image as any).left || 0);
            const imgTop = Number((image as any).top || 0);
            const cropX = Math.max(0, -imgLeft / scale);
            const cropY = Math.max(0, -imgTop / scale);
            const cropW = frameW / scale;
            const cropH = frameH / scale;
            (image as any).set({
              cropX,
              cropY,
              width: cropW,
              height: cropH,
              left: 0,
              top: 0,
              scaleX: scale,
              scaleY: scale,
            });
          }
        }

        if (image) {
          image.set({
            selectable: false,
            evented: true,
            lockMovementX: true,
            lockMovementY: true,
            lockScalingX: true,
            lockScalingY: true,
          });
        }
        if (frame) {
          frame.set({
            selectable: true,
            evented: true,
          });
          (frame as any).lockMovementX = false;
          (frame as any).lockMovementY = false;
          // Restore default hit testing outside crop mode
          (frame as any).subTargetCheck = false;
          (frame as any)._activeObjects = [];
          (frame as any)._set?.("dirty", true);

          // Remove frame highlight styling applied during crop mode.
          const shape = getFrameShape(frame);
          if (shape) {
            (shape as any).set({
              stroke: "#d1d5db",
              strokeWidth: 1,
            });
          }
        }
        imageFrameCropModeRef.current = null;
        setCropModeStateRef.current(false);
        canvas.setActiveObject(frame);
        canvas.requestRenderAll();
      };
      exitCropModeRef.current = exitCropMode;

      const handleSelection = () => {
        const active = canvas.getActiveObject?.();
        const state = imageFrameCropModeRef.current;
        if (state && active !== state.frame) exitCropMode();
        setHasSelection(!!active);
        updateSelection();
      };

      const runFrameDropDetection = (obj: any): boolean => {
        if (!obj) return false;
        if (imageFrameCropModeRef.current) return false;

        if (obj.type === "activeSelection") {
          const objs = obj.getObjects?.() || obj._objects || [];
          if (objs.length !== 2) return false;
          const image = objs.find((o: any) => o.type === "image");
          const frame = objs.find((o: any) => isImageFrame(o));
          if (image && frame) {
            const didAttach = tryAttachImageToFrame(image, frame);
            if (didAttach) {
              updateSelection();
              updateLayers();
            }
            return didAttach;
          }
        }

        if (obj.type !== "image") return false;
        const canvas = getCanvas();
        const frames = (canvas?.getObjects?.() || []).filter((o: any) => isImageFrame(o));

        for (let i = frames.length - 1; i >= 0; i--) {
          const frame = frames[i];
          const imgRect = (obj as any).getBoundingRect?.(true, true);
          const frameRect = (frame as any).getBoundingRect?.(true, true);
          if (!imgRect || !frameRect) continue;

          const isOverlapping =
            imgRect.left < frameRect.left + frameRect.width &&
            imgRect.left + imgRect.width > frameRect.left &&
            imgRect.top < frameRect.top + frameRect.height &&
            imgRect.top + imgRect.height > frameRect.top;

          if (isOverlapping) {
            if (tryAttachImageToFrame(obj, frame)) return true;
          }
        }
        return false;
      };

      const handlers = {
        selectionCreated: () => {
          handleSelection();
        },
        selectionUpdated: () => {
          handleSelection();
        },
        selectionCleared: () => {
          exitCropMode();
          setSelectedLayerId(null);
          setHasSelection(false);
          updateSelection();
        },
        objectModified: (e: any) => {
          const obj = e?.target;
          const didAttach = obj ? runFrameDropDetection(obj) : false;
          updateSelection();
          updateLayers();
          if (!didAttach) pushHistory("modified");
        },
        objectAdded: (e: any) => {
          updateLayers();
          if (e?.target?.role === "grid") return;
          if (!isApplyingRef.current) pushHistory("added");
        },
        objectRemoved: (e: any) => {
          updateLayers();
          if (e?.target?.role === "grid") return;
          if (!isApplyingRef.current) pushHistory("removed");
        },
        textChanged: () => {
          updateSelection();
          if (!isApplyingRef.current) pushHistory("text");
        },
        objectMoving: (e: any) => {
          const target = e?.target as any;
          if (!target || imageFrameCropModeRef.current) return;
          if (!isImageFrame(target)) return;
          const c = canvas;
          const img = getImageForFrame(c, target);
          if (!img) return;
          const shape = getFrameShape(target);
          if (!shape?.getCenterPoint) return;
          const center = shape.getCenterPoint();
          img.set({
            left: center.x,
            top: center.y,
          });
          img.setCoords();
        },
        mouseUp: (e: any) => {
          const obj = e?.target;
          if (!obj) return;
          runFrameDropDetection(obj);
        },
        mouseDblclick: (e: any) => {
          const target = e?.target as any;
          // #region agent log
          fetch("http://127.0.0.1:7497/ingest/56601a8a-ebed-4e8a-847f-61b683cab256", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Debug-Session-Id": "b60eca",
            },
            body: JSON.stringify({
              sessionId: "b60eca",
              runId: "frame-crop",
              hypothesisId: "H-crop-dblclick",
              location: "useFabricEditor.ts:mouseDblclick",
              message: "mouse:dblclick",
              data: {
                hasTarget: !!target,
                targetType: target?.type ?? null,
                targetId: (target as any)?.id ?? (target as any)?.uid ?? null,
                inCropMode: !!imageFrameCropModeRef.current,
              },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion
          if (!target) return;

          // If already in crop mode, ignore further double-clicks
          if (imageFrameCropModeRef.current) return;

          // Double-click directly on an image that is linked to a frame via data.frameId
          if (target.type === "image" && target?.data?.frameId) {
            const frameId = target.data.frameId;
            const frame = (canvas.getObjects?.() || []).find((o: any) => {
              const oid = (o as any).id ?? (o as any).uid;
              return isImageFrame(o) && oid === frameId;
            });
            if (frame) {
              canvas.setActiveObject(frame);
              enterImageFrameCropMode();
              return;
            }
          }

          // Double-click directly on a frame
          if (isImageFrame(target)) {
            enterImageFrameCropMode();
            return;
          }

          // Double-click on image or child inside a frame
          const parent = (target as any).group || (target as any).parent || (target as any)._parent;
          if (parent && isImageFrame(parent)) {
            canvas.setActiveObject(parent);
            enterImageFrameCropMode();
          }
        },
      };
      canvas.on("selection:created", handlers.selectionCreated as any);
      canvas.on("selection:updated", handlers.selectionUpdated as any);
      canvas.on("selection:cleared", handlers.selectionCleared);
      canvas.on("object:modified", handlers.objectModified);
      canvas.on("object:added", handlers.objectAdded as any);
      canvas.on("object:removed", handlers.objectRemoved as any);
      canvas.on("text:changed", handlers.textChanged);
      canvas.on("mouse:dblclick", handlers.mouseDblclick);
      canvas.on("mouse:up", handlers.mouseUp);
      canvas.on("object:moving", handlers.objectMoving as any);
      activeCanvasListenersRef.current = { canvas, handlers };
    },
    [pushHistory, unbindActiveCanvasListeners, updateLayers, updateSelection, enterImageFrameCropMode]
  );

  const bindActiveCanvasListenersRef = useRef(bindActiveCanvasListeners);
  bindActiveCanvasListenersRef.current = bindActiveCanvasListeners;
  const unbindActiveCanvasListenersRef = useRef(unbindActiveCanvasListeners);
  unbindActiveCanvasListenersRef.current = unbindActiveCanvasListeners;

  useEffect(() => {
    const p = pagesRef.current;
    const idx = activePageIndex;
    const id = p[Math.max(0, Math.min(idx, p.length - 1))]?.id;
    if (!id) return;
    const c = pageCanvasesRef.current.get(id) || null;
    const didPageActuallyChange = prevActivePageIdRef.current !== id;
    canvasRef.current = c;
    pageCanvasesRef.current.forEach((canvas, pageId) => {
      const isActivePage = pageId === id;
      if (isActivePage) {
        canvas.selection = true;
        (canvas as any).interactive = true;
        (canvas as any).skipTargetFind = false;
      } else {
        canvas.selection = false;
        (canvas as any).interactive = false;
      }
    });
    if (process.env.NODE_ENV !== "production") {
      if (!(globalThis as any).__canvas) (globalThis as any).__canvas = c;
    }
    unbindActiveCanvasListenersRef.current();
    if (c) bindActiveCanvasListenersRef.current(c);
    if (c) {
      if (didPageActuallyChange) {
        c.discardActiveObject();
      }
      refreshCanvasOffset(c);
      c.requestRenderAll();
    }
    if (didPageActuallyChange) {
      setSelectedLayerId(null);
      setSelectionType("none");
      setActiveObjectType(null);
      setActiveObjectSnapshot(null);
    }
    prevActivePageIdRef.current = id;
    updateSelectionRef.current();
    updateLayersRef.current();
  }, [activePageIndex]);

  useEffect(() => {
    const handler = () => {
      try {
        const canvas = getCanvas();
        if (canvas) refreshCanvasOffset(canvas);
      } catch {}
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [getCanvas]);

  const applyGrid = useCallback((enabled?: boolean) => {
    const c = getCanvas();
    if (!c) return;
    const isEnabled = enabled ?? gridEnabled;
    if (!isEnabled) {
      if (gridGroupRef.current) {
        c.remove(gridGroupRef.current);
        gridGroupRef.current = null;
      }
      gridMetaRef.current = null;
      c.requestRenderAll();
      return;
    }
    const existing = gridGroupRef.current;
    const size = pageSizePx;
    const prevMeta = gridMetaRef.current;
    if (existing && prevMeta?.pageSize === pageSize) {
      const pageObj = findPageObject(c, size.w, size.h) as any;
      if (pageObj?.moveTo) {
        pageObj.moveTo(0);
        existing.moveTo?.(1);
      } else {
        existing.moveTo?.(0);
      }
      c.requestRenderAll();
      return;
    }
    if (existing) {
      c.remove(existing);
      gridGroupRef.current = null;
    }
    const step = 120;
    const lines: any[] = [];
    for (let x = 0; x <= size.w; x += step) {
      const l = new Line([x, 0, x, size.h], {
        stroke: "#e5e7eb",
        selectable: false,
        evented: false,
        excludeFromExport: true,
      }) as any;
      l.role = "grid";
      lines.push(l);
    }
    for (let y = 0; y <= size.h; y += step) {
      const l = new Line([0, y, size.w, y], {
        stroke: "#e5e7eb",
        selectable: false,
        evented: false,
        excludeFromExport: true,
      }) as any;
      l.role = "grid";
      lines.push(l);
    }
    const group = new Group(lines, { selectable: false, evented: false }) as any;
    group.role = "grid";
    group.excludeFromExport = true;
    gridGroupRef.current = group;
    gridMetaRef.current = { pageSize };
    c.add(group);
    const pageObj = findPageObject(c, size.w, size.h) as any;
    if (pageObj && pageObj.moveTo) {
      pageObj.moveTo(0);
      if (group.moveTo) group.moveTo(1);
    } else if (group.moveTo) {
      group.moveTo(0);
    }
    c.requestRenderAll();
  }, [findPageObject, gridEnabled, pageSize, pageSizePx]);

  const applyCanvasBackground = useCallback((color: string) => {
    const c = getCanvas();
    if (!c) return;
    applyCanvasBackgroundModule(c, color);
  }, [getCanvas]);

  const exportPageDataUrl = useCallback(
    (multiplier: number = 2, canvas?: Canvas | null) => {
      const c = canvas ?? getCanvas();
      if (!c) return null;
      return exportToDataURLModule(c, {
        multiplier,
        getPageBounds: (canv) => {
          const size = pageSizePxRef.current;
          const pageObj = findPageObject(canv, size.w, size.h) as any;
          if (!pageObj) return null;
          const b = getObjectBounds(pageObj);
          return { ...b, fabricObj: pageObj };
        },
      });
    },
    [findPageObject, getCanvas, getObjectBounds]
  );

  const updateActiveObject = useCallback((patch: Record<string, any>) => {
    const c = getCanvas();
    if (!c) return;
    const active: any = c.getActiveObject();
    if (!active) return;
    active.set(patch);
    active.setCoords?.();
    c.requestRenderAll();
    pushHistory("object:update");
    updateSelection();
  }, [pushHistory, updateSelection]);

  const initCanvasForPage = useCallback(
    async (pageId: string, c: Canvas) => {
      if (process.env.NODE_ENV !== "production") {
        console.log("[initCanvas real pageId]", pageId);
      }
      isInitializingCanvasRef.current = true;
      isCanvasBootingRef.current = true;
      try {
      const size = pageSizePxRef.current;
      const zoom = baseFitZoomRef.current || 1;
      (c as any).setZoom?.(zoom);
      c.requestRenderAll();
      // Configure interaction based on whether this page is currently active.
      const isActivePage = getActivePageId() === pageId;
      if (isActivePage) {
        c.selection = true;
        (c as any).interactive = true;
        (c as any).skipTargetFind = false;
      } else {
        c.selection = false;
        (c as any).interactive = false;
      }
      if (process.env.NODE_ENV === "development") {
        (window as any).__slbCanvas = c;
      }
      if (c.lowerCanvasEl) c.lowerCanvasEl.tabIndex = -1;
      if (c.upperCanvasEl) c.upperCanvasEl.tabIndex = -1;
      const isActive = getActivePageId() === pageId;
      if (isActive) {
        canvasRef.current = c;
        if (process.env.NODE_ENV === "development") {
          if (!(globalThis as any).__canvas) (globalThis as any).__canvas = c;
          if (!(window as any).__slbExportTemplate) {
            (window as any).__slbExportTemplate = (templateId = "template") => {
              try {
                const active = canvasRef.current;
                if (!active) {
                  console.warn("[slbExport] No active canvas");
                  return;
                }
                const extraProps = [
                  "id",
                  "name",
                  "role",
                  "isPageBg",
                  "data",
                  "selectable",
                  "evented",
                  "lockMovementX",
                  "lockMovementY",
                  "hasControls",
                  "hasBorders",
                  "opacity",
                  "fill",
                  "stroke",
                  "strokeWidth",
                  "fontFamily",
                  "fontSize",
                  "fontWeight",
                  "fontStyle",
                  "underline",
                  "textAlign",
                  "lineHeight",
                  "width",
                  "height",
                  "left",
                  "top",
                  "scaleX",
                  "scaleY",
                  "angle",
                  "originX",
                  "originY",
                ];
                const snap = (active as any).toJSON(extraProps);
                const objects = Array.isArray((snap as any).objects)
                  ? (snap as any).objects
                  : [];
                let pageIdx = objects.findIndex(
                  (o: any) =>
                    o?.role === "pageBackground" ||
                    o?.role === "page-bg" ||
                    o?.isPageBg === true ||
                    o?.name === "page-bg" ||
                    o?.name === "page background" ||
                    o?.data?.role === "pageBackground" ||
                    o?.data?.kind === "page-bg"
                );
                if (pageIdx >= 0) {
                  const pageObj = objects[pageIdx];
                  pageObj.role = "pageBackground";
                  pageObj.name = "pageBackground";
                  pageObj.isPageBg = true;
                  pageObj.selectable = false;
                  pageObj.evented = false;
                  pageObj.hasControls = false;
                  pageObj.hasBorders = false;
                  pageObj.lockMovementX = true;
                  pageObj.lockMovementY = true;
                  pageObj.originX = "left";
                  pageObj.originY = "top";
                  pageObj.scaleX = 1;
                  pageObj.scaleY = 1;
                  if (pageIdx !== 0) {
                    objects.splice(pageIdx, 1);
                    objects.unshift(pageObj);
                  }
                } else {
                  const size = pageSizePxRef.current;
                  objects.unshift({
                    type: "rect",
                    left: 0,
                    top: 0,
                    width: size.w,
                    height: size.h,
                    fill: "#ffffff",
                    stroke: "#e5e7eb",
                    selectable: false,
                    evented: false,
                    hasControls: false,
                    hasBorders: false,
                    lockMovementX: true,
                    lockMovementY: true,
                    originX: "left",
                    originY: "top",
                    scaleX: 1,
                    scaleY: 1,
                    role: "pageBackground",
                    name: "pageBackground",
                    isPageBg: true,
                    data: { role: "pageBackground", kind: "page-bg", system: true },
                  });
                }
                (snap as any).objects = objects;
                const json = JSON.stringify(snap, null, 2);
                const fileName = `${templateId}.json`;
                const download = () => {
                  const blob = new Blob([json], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = fileName;
                  a.click();
                  URL.revokeObjectURL(url);
                };
                const canClipboard =
                  !!window.isSecureContext && !!navigator.clipboard?.writeText;
                if (canClipboard) {
                  navigator.clipboard
                    .writeText(json)
                    .then(() =>
                      console.log(`[slbExport] Copied ${fileName} to clipboard`)
                    )
                    .catch(() => {
                      download();
                      console.info(
                        `[slbExport] Clipboard unavailable, downloaded ${fileName}`
                      );
                    });
                } else {
                  download();
                  console.info(`[slbExport] Downloaded ${fileName}`);
                }
              } catch (err) {
                console.error("[slbExport] Failed to export template", err);
              }
            };
          }
          if (!(window as any).__slbImportTemplate) {
            (window as any).__slbImportTemplate = async (
              jsonOrObject: any,
              reason = "template-loaded"
            ) => {
              try {
                const active = canvasRef.current;
                if (!active) {
                  console.warn("[slbImport] No active canvas");
                  return;
                }
                const data =
                  typeof jsonOrObject === "string"
                    ? JSON.parse(jsonOrObject)
                    : jsonOrObject;
                await applySnapshotRef.current(data, reason);
                active.requestRenderAll();
                console.log("[slbImport] Loaded template");
              } catch (err) {
                console.error("[slbImport] Failed to load template", err);
              }
            };
          }
        }
        unbindActiveCanvasListenersRef.current();
        bindActiveCanvasListenersRef.current(c);
        updateSelectionRef.current();
        updateLayersRef.current();
      }
      setCanvasReady(true);
      const prevActiveCanvas = canvasRef.current;
      canvasRef.current = c;
      ensurePageBackground(size.w, size.h, { discardSelection: true });

      const pending = pendingPageLoadRef.current.get(pageId);

      if (pending?.type === "duplicate") {
        baseFitZoomRef.current = null;
        if (process.env.NODE_ENV !== "production") {
          console.log("[initCanvas] baseFitZoomRef reset before load (duplicate)", { pageId });
        }
        const { objects, viewportTransform } = pending;
        const z = getZoom();
        const { w: pageW, h: pageH } = pageSizePxRef.current;
        const displayW = Math.max(1, Math.round(pageW * z));
        const displayH = Math.max(1, Math.round(pageH * z));
        c.setDimensions({ width: displayW, height: displayH }, { backstoreOnly: false });
        c.setViewportTransform(
          viewportTransform && viewportTransform.length >= 6
            ? (viewportTransform as [number, number, number, number, number, number])
            : [z, 0, 0, z, 0, 0]
        );
        if (process.env.NODE_ENV !== "production") {
          console.log("[initCanvas] loadFromJSON (duplicate)", { pageId, objectsCount: (objects?.length ?? 0) });
        }
        c.clear();
        const objectsOnly = { objects: objects ?? [] };
        const reviver = (_: any, obj: any) => {
          const target = pageSizePxRef.current;
          if (isPageBackgroundObject(obj, target.w, target.h)) {
            applyPageBackgroundProps(
              obj,
              target.w,
              target.h,
              bgColorRef.current || "#ffffff"
            );
          }
        };
        try {
          const result = (c as any).loadFromJSON(objectsOnly, reviver, () => {
            c.getObjects().forEach((o: any) => {
              ensureObjectId(o);
              applyTextBoxNoStretch(o);
              // Normalize restored image frames so they remain interactive
              if (o?.data?.type === IMAGE_FRAME_TYPE) {
                o.set({
                  selectable: true,
                  evented: true,
                  lockMovementX: false,
                  lockMovementY: false,
                });
              }
            });
            ensurePageBackground(pageSizePxRef.current.w, pageSizePxRef.current.h, {
              discardSelection: true,
            });
            c.discardActiveObject();
            c.requestRenderAll();
            requestAnimationFrame(() => {
              if (hadStoredZoomRef.current) {
                applyZoomToCanvases(getZoom());
              } else {
                scheduleFitRef.current("doc-load");
              }
            });
          });
          if (result && typeof result.then === "function") {
            await result;
          }
        } catch (err) {
          console.error("[editor] Failed to load duplicate page JSON", err);
        }
      } else if (pending?.type === "doc-load") {
        baseFitZoomRef.current = null;
        if (process.env.NODE_ENV !== "production") {
          console.log("[initCanvas] doc-load", { pageId });
        }
        await applySnapshotToCanvasRef.current(c, pending.snapshot, "doc-load");
      } else {
        // blank (Add Page) or no pending — do not load any JSON
        c.clear();
        ensurePageBackground(pageSizePxRef.current.w, pageSizePxRef.current.h, {
          discardSelection: true,
        });
        (c as any).discardActiveObject?.();
        c.requestRenderAll();
        // Apply current zoom immediately so new page matches DOM on first mount (fixes add-page layout bug)
        const z = getZoom();
        const { w: pageW, h: pageH } = pageSizePxRef.current;
        const w = Math.max(1, Math.round(pageW * z));
        const h = Math.max(1, Math.round(pageH * z));
        c.setDimensions({ width: w, height: h }, { backstoreOnly: false });
        (c as any).calcOffset?.();
        applyZoomToCanvas(c, z);
        c.requestRenderAll();
        scheduleFitRef.current("page-add");
      }

      pendingPageLoadRef.current.delete(pageId);
      const activeId = getActivePageId();
      canvasRef.current = (activeId ? pageCanvasesRef.current.get(activeId) ?? null : null) ?? prevActiveCanvas;
      } finally {
        isInitializingCanvasRef.current = false;
        requestAnimationFrame(() => {
          isCanvasBootingRef.current = false;
        });
      }
    },
    [
      applyPageBackgroundProps,
      ensureObjectId,
      ensurePageBackground,
      getActivePageId,
      getZoom,
      applyZoomToCanvas,
      isPageBackgroundObject,
      mode,
      pageSize,
      applyTextBoxNoStretch,
      applyZoomToCanvases,
    ]
  );

  const attachCanvasEl = useCallback(
    (pageId: string, el: HTMLCanvasElement | null) => {
      if (!el) return;
      if (pageCanvasesRef.current.has(pageId)) return;
      const size = pageSizePxRef.current;
      const c = initFabricCanvas(el, {
        width: size.w,
        height: size.h,
        backgroundColor: CANVAS_BG,
        selection: true,
        preserveObjectStacking: true,
      });
      refreshCanvasOffset(c);
      // Ensure Fabric interaction is enabled
      (c as any).interactive = true;
      c.selection = true;
      (c as any).skipTargetFind = false;

      pageCanvasesRef.current.set(pageId, c);
      initCanvasForPage(pageId, c);
    },
    [initCanvasForPage]
  );

  const prevPageIdsRef = useRef<string[]>([]);
  useEffect(() => {
    const prevIds = prevPageIdsRef.current;
    const nextIds = pages.map((p: any) => p?.id).filter(Boolean) as string[];

    for (const oldId of prevIds) {
      if (!nextIds.includes(oldId)) {
        const c = pageCanvasesRef.current.get(oldId);
        if (c) {
          try {
            c.dispose();
          } catch {}
          pageCanvasesRef.current.delete(oldId);
        }
      }
    }

    prevPageIdsRef.current = nextIds;
  }, [pages]);

  useEffect(() => {
    bgColorRef.current = bgColor;
  }, [bgColor]);

  const templateId = (initialTemplateId || "").toLowerCase().trim();
  const trimmedDocId = (docIdParam || "").trim();
  const isBlank =
    mode === "new" || !templateId || templateId === "new" || templateId === "blank";
  const isTemplateId = !!TEMPLATE_SNAPSHOTS[templateId];
  const isDocId =
    !!trimmedDocId || (mode === "template" && !isBlank && !isTemplateId);
  const treatBlank = !trimmedDocId && isBlank;

  useEffect(() => {
    if (!isDocId) {
      setIsDocDataReady(true);
      return;
    }
    if (authLoading) return;
    if (!user) {
      setLoadError("Please login to load your resume");
      setIsDocDataReady(true);
      return;
    }

    let alive = true;
    isLoadingDocRef.current = true;
    hadStoredZoomRef.current = false;
    setIsDocDataReady(false);
    getResumeDoc({ uid: user.uid, docId: trimmedDocId || templateId })
      .then((docSnap) => {
        if (!alive) return;
        if (!docSnap) {
          setLoadError("Resume not found");
          isLoadingDocRef.current = false;
          setIsDocDataReady(true);
          return;
        }
        setLoadError(null);
        setCloudDocId(trimmedDocId || templateId);
        setDocTitle(docSnap.title || "Untitled Resume");
        setDocCreatedAt(docSnap.createdAt ?? null);
        if (docSnap.pageSize && PAGE_SIZES[docSnap.pageSize as PageSize]) {
          setPageSize(docSnap.pageSize as PageSize);
        }
        const hadStoredZoom = typeof docSnap.zoom === "number";
        hadStoredZoomRef.current = hadStoredZoom;
        if (hadStoredZoom) {
          applyEffectiveZoom(docSnap.zoom);
        }
        const DEFAULT_PAGE_WIDTH = 794;
        const DEFAULT_PAGE_HEIGHT = 1123;
        const pagesData = docSnap.pagesData;
        if (Array.isArray(pagesData) && pagesData.length > 0) {
          const reconstructedPages = pagesData.map((pageData: any, i: number) => ({
            id: `page-${i + 1}`,
            objects: [] as any[],
            width: pageData?.width || DEFAULT_PAGE_WIDTH,
            height: pageData?.height || DEFAULT_PAGE_HEIGHT,
            background: "#ffffff",
          }));
          if (process.env.NODE_ENV !== "production") {
            console.log("[doc-load] reconstructedPages ids", reconstructedPages.map((p) => p.id));
          }
          setPages(reconstructedPages);
          pageIdCounterRef.current = reconstructedPages.length;
          setActivePageIndex(0);
          pendingPageLoadRef.current.clear();
          pagesData.forEach((pageData: any, i: number) => {
            const pageId = `page-${i + 1}`;
            pendingPageLoadRef.current.set(pageId, {
              type: "doc-load",
              snapshot: pageData,
            });
          });
          if (process.env.NODE_ENV !== "production") {
            console.log("[doc-load] pending ids", Array.from(pendingPageLoadRef.current.keys()));
          }
          undoRef.current = [pagesData[0]];
        } else {
          const snap = docSnap.canvasJson || { objects: [] };
          const singlePage = {
            id: "page-1",
            objects: Array.isArray(snap?.objects) ? snap.objects : [],
            width: typeof snap?.width === "number" ? snap.width : DEFAULT_PAGE_WIDTH,
            height: typeof snap?.height === "number" ? snap.height : DEFAULT_PAGE_HEIGHT,
            background: "#ffffff",
          };
          setPages([singlePage]);
          setActivePageIndex(0);
          pendingPageLoadRef.current.set("page-1", {
            type: "doc-load",
            snapshot: snap,
          });
          undoRef.current = [snap];
        }
        redoRef.current = [];
        requestAnimationFrame(() => {
          isLoadingDocRef.current = false;
        });
        setIsDocDataReady(true);
        if (process.env.NODE_ENV !== "production") {
          console.log("[load] doc data ready, isDocDataReady=true");
        }
      })
      .catch((err) => {
        if (!alive) return;
        const name = err?.name || "";
        const msg = typeof err?.message === "string" ? err.message : "";
        if (name === "AbortError" || msg.toLowerCase().includes("aborted")) return;
        console.error("[editor] Failed to fetch doc", err);
        isLoadingDocRef.current = false;
        setIsDocDataReady(true);
      });
    return () => {
      alive = false;
      isLoadingDocRef.current = false;
    };
  }, [
    isDocId,
    authLoading,
    user,
    trimmedDocId,
    templateId,
    applyEffectiveZoom,
    setPageSize,
  ]);

  useEffect(() => {
    const c = getCanvas();
    if (!c || !canvasReady) return;
    if (isDocId && !isDocDataReady) return;
    const appliedId = treatBlank ? "blank" : (trimmedDocId || templateId);
    if (lastAppliedTemplateRef.current === appliedId) return;
    lastAppliedTemplateRef.current = appliedId;

    if (isDocId) {
      return;
    }

    setLoadError(null);
    let draftSnapshot: any = null;
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(getDraftKey());
        if (raw) {
          const parsed = JSON.parse(raw);
          draftSnapshot = parsed;
        }
      } catch {}
    }

    const snapshot =
      draftSnapshot || (treatBlank ? TEMPLATE_SNAPSHOTS.blank : TEMPLATE_SNAPSHOTS[templateId]);
    const isMissingTemplate = mode === "template" && !treatBlank && !snapshot;
    if (isMissingTemplate) {
      console.error(
        "[editor] Missing template snapshot for id:",
        templateId,
        "Available:",
        Object.keys(TEMPLATE_SNAPSHOTS)
      );
      if (process.env.NODE_ENV !== "production") {
        throw new Error(
          `[editor] Missing template snapshot for id: ${templateId} (available: ${Object.keys(
            TEMPLATE_SNAPSHOTS
          ).join(", ")})`
        );
      }
    }

    const snapshotForLoad = snapshot || { objects: [] };
    applySnapshotRef.current(snapshotForLoad).then(() => {
      undoRef.current = [snapshotForLoad];
      redoRef.current = [];
      updateLayersRef.current();
    });
  }, [
    canvasReady,
    getCanvas,
    getDraftKey,
    initialTemplateId,
    docIdParam,
    isDocDataReady,
    isDocId,
    mode,
    setPageSize,
    templateId,
    trimmedDocId,
    treatBlank,
  ]);

  useEffect(() => {
    if (pageSize !== "Custom") {
      setPageSizePxState(PAGE_SIZES[pageSize]);
    }
  }, [pageSize]);

  useEffect(() => {
    pageSizePxRef.current = pageSizePx;
  }, [pageSizePx]);

  useEffect(() => {
    if (isLoadingDocRef.current) return;
    didInitialFitRef.current = false;
    userZoomedRef.current = false;
    didLogFitRef.current = null;
    const c = getCanvas();
    if (!c) return;
    const size = PAGE_SIZES[pageSize];
    ensurePageBackground(size.w, size.h, { discardSelection: true });
    scheduleFitRef.current("pageSize");
  }, [ensurePageBackground, getCanvas, pageSize, pageSizePx]);

  useEffect(() => {
    const c = getCanvas();
    if (!c) return;
    const size = pageSizePxRef.current;
    ensurePageBackground(size.w, size.h);
    applyPageBackground(bgColor);
  }, [applyPageBackground, bgColor, ensurePageBackground]);

  useEffect(() => {
    applyGrid();
  }, [applyGrid]);

  const addText = useCallback(() => {
    const c = getCanvas();
    if (!c) return;
    c.isDrawingMode = false;
    c.selection = true;
    const size = pageSizePx;
    const t = addTextboxTool(c, {
      text: "Text",
      left: size.w / 2 - 200,
      top: size.h / 2 - 24,
      width: 400,
      fontSize: 32,
      fontFamily: "Poppins",
      fill: "#111827",
    });
    const id = ensureObjectId(t);
    t.uid = id;
    applyTextBoxNoStretch(t);
    c.add(t);
    c.setActiveObject(t);
    c.requestRenderAll();
  }, [ensureObjectId, pageSizePx, pushHistory]);

  const addRect = useCallback(() => {
    const c = getCanvas();
    if (!c) return;
    c.isDrawingMode = false;
    c.selection = true;
    const size = pageSizePx;
    const r = addRectTool(c, {
      left: size.w / 2 - 180,
      top: size.h / 2 - 120,
      width: 360,
      height: 240,
      fill: "rgba(17,24,39,0.1)",
      stroke: "#111827",
      strokeWidth: 2,
    });
    const id = ensureObjectId(r);
    r.uid = id;
    c.add(r);
    c.setActiveObject(r);
    c.requestRenderAll();
  }, [ensureObjectId, pageSizePx, pushHistory]);

  const addCircle = useCallback(() => {
    const c = getCanvas();
    if (!c) return;
    c.isDrawingMode = false;
    c.selection = true;
    const size = pageSizePx;
    const r = addCircleTool(c, {
      left: size.w / 2 - 120,
      top: size.h / 2 - 120,
      radius: 120,
      fill: "rgba(17,24,39,0.1)",
      stroke: "#111827",
      strokeWidth: 2,
    });
    const id = ensureObjectId(r);
    r.uid = id;
    c.add(r);
    c.setActiveObject(r);
    c.requestRenderAll();
  }, [ensureObjectId, pageSizePx, pushHistory]);

  const addLine = useCallback(() => {
    const c = getCanvas();
    if (!c) return;
    c.isDrawingMode = false;
    c.selection = true;
    const size = pageSizePx;
    const l = addLineTool(c, {
      x1: 0,
      y1: 0,
      x2: 300,
      y2: 0,
      left: size.w / 2 - 150,
      top: size.h / 2,
      stroke: "#111827",
      strokeWidth: 2,
    });
    const id = ensureObjectId(l);
    l.uid = id;
    c.add(l);
    c.setActiveObject(l);
    c.requestRenderAll();
  }, [ensureObjectId, pageSizePx, pushHistory]);

  const { attachImageToFrame, tryAttachImageToFrame } = createFrameAttach({
    getCanvas,
    getImageFrameFrameType,
    getFrameShape,
    getImageForFrame,
    pushHistory,
    updateLayers,
    isImageFrame,
    attachImageToFrameRef,
  });

  useEffect(() => {
    attachImageToFrameRef.current = attachImageToFrame;
  }, [attachImageToFrame]);

  const addImageToFrame = useCallback(
    async (frame: any, file: File) => {
      const c = getCanvas();
      if (!c || !frame || !isImageFrame(frame)) return;

      try {
        const url = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const img = await FabricImage.fromURL(url);
        attachImageToFrame(frame, img);
      } catch (err) {
        console.error("[addImageToFrame]", err);
      }
    },
    [attachImageToFrame]
  );

  const addImage = useCallback(
    (file: File) => {
      const c = getCanvas();
      if (!c) return;
      c.isDrawingMode = false;
      c.selection = true;

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const url = reader.result as string;
          const img = await FabricImage.fromURL(url);
          const size = pageSizePx;
          const w = (img.width || 200) * 0.5;
          const h = (img.height || 200) * 0.5;
          img.set({
            left: size.w / 2 - w / 2,
            top: size.h / 2 - h / 2,
            scaleX: 0.5,
            scaleY: 0.5,
          });
          const id = ensureObjectId(img);
          (img as any).uid = id;
          c.add(img);
          c.setActiveObject(img);
          c.requestRenderAll();
          pushHistory("added");
        } catch (err) {
          console.error("[addImage]", err);
        }
      };
      reader.readAsDataURL(file);
    },
    [ensureObjectId, pageSizePx, pushHistory]
  );

  const { addImageFrame } = createFrameCreate({
    getCanvas,
    getPageSizePx: () => pageSizePx,
    ensureObjectId,
    pushHistory,
    updateLayers,
  });

  const removeImageFromFrame = useCallback(
    (frame?: any) => {
      const c = getCanvas();
      if (!c) return;
      const target = frame || (c.getActiveObject?.() as any);
      if (!target || !isImageFrame(target)) return;

      const img = getImageForFrame(c, target);
      if (img) {
        target.remove(img);
        const orig = (img as any).getOriginalSize?.() || {};
        const resetCrop: any = {
          clipPath: undefined,
          cropX: 0,
          cropY: 0,
        };
        if (orig.width != null) resetCrop.width = orig.width;
        if (orig.height != null) resetCrop.height = orig.height;
        img.set(resetCrop);
        if (img.data) delete img.data.insideFrame;
        img.set({ selectable: true, evented: true, lockScalingX: false, lockScalingY: false });
        c.add(img);
        c.setActiveObject(img);
      }
      target.data = target.data || {};
      target.data.hasImage = false;
      if (typeof target._calcBounds === "function") target._calcBounds();
      target.setCoords?.();
      c.requestRenderAll();
      pushHistory("object:update");
      updateLayers();
    },
    [pushHistory, updateLayers]
  );

  const deleteFrameEntirely = useCallback(() => {
    const c = getCanvas();
    if (!c) return;
    const active = c.getActiveObject() as any;
    if (!active || !isImageFrame(active)) return;
    const img = getImageForFrame(c, active);
    if (img) {
      active.remove(img);
      const orig = (img as any).getOriginalSize?.() || {};
      const resetCrop: any = {
        clipPath: undefined,
        cropX: 0,
        cropY: 0,
      };
      if (orig.width != null) resetCrop.width = orig.width;
      if (orig.height != null) resetCrop.height = orig.height;
      img.set(resetCrop);
      if (img.data) delete img.data.insideFrame;
      img.set({ selectable: true });
      c.add(img);
    }
    c.remove(active);
    c.discardActiveObject();
    c.requestRenderAll();
    pushHistory("removed");
    updateLayers();
  }, [pushHistory, updateLayers]);

  const isImageFrameSelected = useCallback(() => {
    const c = getCanvas();
    if (!c) return false;
    const active = c.getActiveObject() as any;
    return !!(active && isImageFrame(active));
  }, []);

  const setTextProp = useCallback((partial: Partial<TextProps>) => {
    if (isHydratingFromSelectionRef.current) return;
    if (selectionType !== "text") return;
    const patch: Partial<TextProps> = { ...partial };
    if (patch.fontSize != null) {
      const nextFontSize = Number(patch.fontSize);
      if (!Number.isFinite(nextFontSize)) return;
      patch.fontSize = nextFontSize;
    }
    if (patch.lineHeight != null) {
      const nextLineHeight = Number(patch.lineHeight);
      if (!Number.isFinite(nextLineHeight)) return;
      patch.lineHeight = nextLineHeight;
    }
    const c = getCanvas();
    if (!c) return;
    const active: any = c.getActiveObject();
    if (!active) return;
    const type = String(active.type || "").toLowerCase();
    if (type !== "textbox" && type !== "i-text" && type !== "text") return;
    logTextSync("apply");
    updateActiveObject(patch);
  }, [getCanvas, logTextSync, selectionType, updateActiveObject]);

  const setShapeProp = useCallback((partial: Partial<ShapeProps>) => {
    const c = getCanvas();
    if (!c) return;
    const active: any = c.getActiveObject();
    if (!active) return;
    const type = String(active.type || "").toLowerCase();
    if (type !== "rect" && type !== "circle" && type !== "triangle" && type !== "line") return;
    const patch: any = { ...partial, strokeUniform: true };
    if (partial.cornerRadius != null && type === "rect") {
      patch.rx = partial.cornerRadius;
      patch.ry = partial.cornerRadius;
    }
    updateActiveObject(patch);
  }, [updateActiveObject]);

  const deleteSelected = useCallback(() => {
    const c = getCanvas();
    if (!c) return;
    const active = c.getActiveObject();
    if (!active) return;

    const removeObj = (obj: any) => {
      if (obj?.group) {
        obj.group.remove(obj);
        if (obj.data) delete obj.data.insideFrame;
        (obj.group as any).data = (obj.group as any).data || {};
        (obj.group as any).data.hasImage = false;
      } else {
        c.remove(obj);
      }
    };

    if (active.type === "activeSelection") {
      (active as any).getObjects().forEach((o: any) => removeObj(o));
    } else {
      removeObj(active);
    }
    c.discardActiveObject();
    c.requestRenderAll();
    pushHistory("removed");
  }, [pushHistory]);

  const copy = useCallback(async () => {
    const c = getCanvas();
    if (!c) return;
    const active: any = c.getActiveObject();
    if (!active) return;
    if (active.clone) {
      try {
        clipboardRef.current = await active.clone();
      } catch {
        active.clone((cloned: any) => {
          clipboardRef.current = cloned;
        });
      }
    }
  }, []);

  const paste = useCallback(async () => {
    const c = getCanvas();
    if (!c || !clipboardRef.current) return;
    const src = clipboardRef.current;
    let cloned: any = null;
    if (src.clone) {
      try {
        cloned = await src.clone();
      } catch {
        await new Promise<void>((resolve) => {
          src.clone((c2: any) => {
            cloned = c2;
            resolve();
          });
        });
      }
    }
    if (!cloned) return;
    cloned.set({ left: (cloned.left || 0) + 40, top: (cloned.top || 0) + 40 });
    cloned.uid = `obj_${Date.now()}`;
    c.add(cloned);
    c.setActiveObject(cloned);
    c.requestRenderAll();
    pushHistory("paste");
  }, [pushHistory]);

  const undo = useCallback(async () => {
    const c = getCanvas();
    if (!c || undoRef.current.length <= 1) return;
    const current = undoRef.current.pop();
    if (current) redoRef.current.push(current);
    const prev = undoRef.current[undoRef.current.length - 1];
    await applySnapshotRef.current(prev, "history");
  }, [getCanvas]);

  const redo = useCallback(async () => {
    const c = getCanvas();
    if (!c || redoRef.current.length === 0) return;
    const next = redoRef.current.pop();
    if (next) undoRef.current.push(next);
    await applySnapshotRef.current(next, "history");
  }, [getCanvas]);

  const alignSelected = useCallback(
    (action: AlignAction) => {
      const c = canvasRef.current;
      if (!c) return;
      const obj: any = c.getActiveObject();
      if (!obj) return;
      const page = getPageBounds(c);
      if (!page) return;

      const br = obj.getBoundingRect(true, true);
      let dx = 0;
      let dy = 0;

      switch (action) {
        case "left":
          dx = page.left - br.left;
          break;
        case "centerX":
          dx = page.left + page.width / 2 - (br.left + br.width / 2);
          break;
        case "right":
          dx = page.left + page.width - (br.left + br.width);
          break;
        case "top":
          dy = page.top - br.top;
          break;
        case "middle":
          dy = page.top + page.height / 2 - (br.top + br.height / 2);
          break;
        case "bottom":
          dy = page.top + page.height - (br.top + br.height);
          break;
      }

      if (!dx && !dy) return;

      if (dx !== 0) obj.set({ left: (obj.left ?? 0) + dx });
      if (dy !== 0) obj.set({ top: (obj.top ?? 0) + dy });
      obj.setCoords?.();
      if ((obj as any).type === "activeSelection") {
        (obj as any)._objects?.forEach((o: any) => o.setCoords?.());
      }
      c.requestRenderAll();
    },
    [getPageBounds]
  );

  const exportPNG = useCallback(
    (pageIndexes?: number[]) => {
      const c = getCanvas();
      if (!c) return;
      const hasSelection = Array.isArray(pageIndexes) && pageIndexes.length > 0;
      if (!hasSelection) {
        const result = exportPageDataUrl(2);
        if (!result) return;
        const { dataUrl } = result;
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = "resume.png";
        a.click();
        return;
      }
      const ordered = Array.from(new Set(pageIndexes))
        .filter((i) => i >= 0 && i < pages.length)
        .sort((a, b) => a - b);
      if (!ordered.length) return;
      for (const i of ordered) {
        const pageId = pages[i]?.id;
        const canvas = pageId ? pageCanvasesRef.current.get(pageId) : null;
        if (!canvas) continue;
        const result = exportPageDataUrl(2, canvas);
        if (!result) continue;
        const { dataUrl } = result;
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `resume-page-${i + 1}.png`;
        a.click();
      }
    },
    [exportPageDataUrl, getCanvas, pages]
  );

  const exportPDF = useCallback(
    (pageIndexes?: number[]) => {
      const c = getCanvas();
      if (!c) return;
      const hasSelection = Array.isArray(pageIndexes) && pageIndexes.length > 0;
      if (!hasSelection) {
        const result = exportPageDataUrl(2);
        if (!result) return;
        const { dataUrl, width, height } = result;
        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "px",
          format: [width, height],
        });
        pdf.addImage(dataUrl, "PNG", 0, 0, width, height);
        pdf.save("resume.pdf");
        return;
      }
      const ordered = Array.from(new Set(pageIndexes))
        .filter((i) => i >= 0 && i < pages.length)
        .sort((a, b) => a - b);
      if (!ordered.length) return;
      let pdf: jsPDF | null = null;
      for (const i of ordered) {
        const pageId = pages[i]?.id;
        const canvas = pageId ? pageCanvasesRef.current.get(pageId) : null;
        if (!canvas) continue;
        const result = exportPageDataUrl(2, canvas);
        if (!result) continue;
        const { dataUrl, width, height } = result;
        if (!pdf) {
          pdf = new jsPDF({
            orientation: "portrait",
            unit: "px",
            format: [width, height],
          });
          pdf.addImage(dataUrl, "PNG", 0, 0, width, height);
        } else {
          pdf.addPage([width, height], "portrait");
          pdf.addImage(dataUrl, "PNG", 0, 0, width, height);
        }
      }
      if (pdf) pdf.save("resume.pdf");
    },
    [exportPageDataUrl, getCanvas, pages]
  );

  const setLayerVisible = useCallback((id: string, visible: boolean) => {
    const c = getCanvas();
    if (!c) return;
    let obj = c.getObjects().find((o: any) => o?.data?.id === id || o?.id === id || o?.uid === id);
    if (!obj && id.startsWith("__idx_")) {
      const idx = Number(id.replace("__idx_", ""));
      obj = c.getObjects()[idx];
    }
    if (!obj) return;
    obj.visible = visible;
    c.requestRenderAll();
    updateLayers();
  }, [updateLayers]);

  const setLayerLocked = useCallback((id: string, locked: boolean) => {
    const c = getCanvas();
    if (!c) return;
    let obj = c.getObjects().find((o: any) => o?.data?.id === id || o?.id === id || o?.uid === id);
    if (!obj && id.startsWith("__idx_")) {
      const idx = Number(id.replace("__idx_", ""));
      obj = c.getObjects()[idx];
    }
    if (!obj) return;
    obj.selectable = !locked;
    obj.evented = !locked;
    obj.lockMovementX = locked;
    obj.lockMovementY = locked;
    obj.lockScalingX = locked;
    obj.lockScalingY = locked;
    obj.lockRotation = locked;
    c.requestRenderAll();
    updateLayers();
  }, [updateLayers]);

  const setPageSizePx = useCallback((widthPx: number, heightPx: number) => {
    if (!Number.isFinite(widthPx) || !Number.isFinite(heightPx)) return;
    const w = Math.max(1, Math.round(widthPx));
    const h = Math.max(1, Math.round(heightPx));
    setPageSize("Custom");
    setPageSizePxState({ w, h });
  }, []);

  const getPageSizePx = useCallback(() => pageSizePx, [pageSizePx]);

  const selectLayerById = useCallback(
    (id: string | null) => {
      const c = getCanvas();
      if (!c || !id) {
        setSelectedLayerId(null);
        return;
      }
      let obj = c.getObjects().find((o: any) => o?.data?.id === id || o?.id === id || o?.uid === id);
      if (!obj && id.startsWith("__idx_")) {
        const idx = Number(id.replace("__idx_", ""));
        obj = c.getObjects()[idx];
      }
      if (!obj) {
        setSelectedLayerId(null);
        return;
      }
      ensureObjectId(obj);
      c.setActiveObject(obj);
      c.requestRenderAll();
      setSelectedLayerId(id);
      updateSelection();
    },
    [ensureObjectId, getCanvas, updateSelection]
  );

  const enforceGridBack = useCallback(() => {
    const c = getCanvas();
    if (!c || !gridGroupRef.current) return;
    gridGroupRef.current.moveTo?.(0);
  }, [getCanvas]);

  const applyLayerOrder = useCallback(
    (uiOrder: any[]) => {
      const c = getCanvas();
      if (!c) return;
      const { pageObj, gridObj } = getLayerObjects();
      const fabricOrder = uiOrder.slice().reverse();
      const finalStack: any[] = [];
      if (pageObj) finalStack.push(pageObj);
      if (gridObj) finalStack.push(gridObj);
      finalStack.push(...fabricOrder);
      finalStack.forEach((obj, idx) => {
        if (c.moveObjectTo) c.moveObjectTo(obj, idx);
        else obj.moveTo?.(idx);
      });
      enforceGridBack();
    },
    [enforceGridBack, getCanvas, getLayerObjects]
  );

  const reorderLayer = useCallback(
    (fromUiIndex: number, toUiIndex: number) => {
      const c = getCanvas();
      if (!c) return;
      const { normalObjs } = getLayerObjects();
      const count = normalObjs.length;
      if (!count) return;
      const uiOrder = normalObjs.slice().reverse();
      const from = Math.max(0, Math.min(count - 1, fromUiIndex));
      const to = Math.max(0, Math.min(count - 1, toUiIndex));
      const obj = uiOrder[from];
      if (!obj) return;
      uiOrder.splice(from, 1);
      uiOrder.splice(to, 0, obj);
      applyLayerOrder(uiOrder);
      if (process.env.NODE_ENV !== "production") {
        console.debug("[layers] move", {
          fromUiIndex,
          toUiIndex,
          fromFabricIndex: count - 1 - from,
          toFabricIndex: count - 1 - to,
          objId: (obj as any).id,
        });
      }
      c.setActiveObject(obj);
      obj.setCoords?.();
      c.requestRenderAll();
      updateLayers();
    },
    [applyLayerOrder, getCanvas, getLayerObjects, updateLayers]
  );

  const layerBringToFront = useCallback(
    (id: string) => {
      const c = getCanvas();
      if (!c) return;
      const { normalObjs } = getLayerObjects();
      const uiOrder = normalObjs.slice().reverse();
      const idx = uiOrder.findIndex(
        (o: any) => o?.data?.id === id || o?.id === id || o?.uid === id
      );
      if (idx === -1) return;
      const obj = uiOrder[idx];
      if (!obj) return;
      uiOrder.splice(idx, 1);
      uiOrder.unshift(obj);
      applyLayerOrder(uiOrder);
      c.setActiveObject(obj);
      obj.setCoords?.();
      c.requestRenderAll();
      updateLayers();
    },
    [applyLayerOrder, getCanvas, getLayerObjects, updateLayers]
  );

  const layerSendToBack = useCallback(
    (id: string) => {
      const c = getCanvas();
      if (!c) return;
      const { normalObjs } = getLayerObjects();
      const uiOrder = normalObjs.slice().reverse();
      const idx = uiOrder.findIndex(
        (o: any) => o?.data?.id === id || o?.id === id || o?.uid === id
      );
      if (idx === -1) return;
      const obj = uiOrder[idx];
      uiOrder.splice(idx, 1);
      uiOrder.push(obj);
      applyLayerOrder(uiOrder);
      c.setActiveObject(obj);
      obj.setCoords?.();
      c.requestRenderAll();
      updateLayers();
    },
    [applyLayerOrder, getCanvas, getLayerObjects, updateLayers]
  );

  const layerBringForward = useCallback(
    (id: string) => {
      const c = getCanvas();
      if (!c) return;
      const { normalObjs } = getLayerObjects();
      const uiOrder = normalObjs.slice().reverse();
      const idx = uiOrder.findIndex(
        (o: any) => o?.data?.id === id || o?.id === id || o?.uid === id
      );
      if (idx === -1) return;
      const obj = uiOrder[idx];
      const target = Math.max(0, idx - 1);
      if (idx === target) return;
      uiOrder.splice(idx, 1);
      uiOrder.splice(target, 0, obj);
      applyLayerOrder(uiOrder);
      c.setActiveObject(obj);
      obj.setCoords?.();
      c.requestRenderAll();
      updateLayers();
    },
    [applyLayerOrder, getCanvas, getLayerObjects, updateLayers]
  );

  const layerSendBackward = useCallback(
    (id: string) => {
      const c = getCanvas();
      if (!c) return;
      const { normalObjs } = getLayerObjects();
      const uiOrder = normalObjs.slice().reverse();
      const idx = uiOrder.findIndex(
        (o: any) => o?.data?.id === id || o?.id === id || o?.uid === id
      );
      if (idx === -1) return;
      const obj = uiOrder[idx];
      const target = Math.min(uiOrder.length - 1, idx + 1);
      if (idx === target) return;
      uiOrder.splice(idx, 1);
      uiOrder.splice(target, 0, obj);
      applyLayerOrder(uiOrder);
      c.setActiveObject(obj);
      obj.setCoords?.();
      c.requestRenderAll();
      updateLayers();
    },
    [applyLayerOrder, getCanvas, getLayerObjects, updateLayers]
  );

  return {
    pages,
    activePageIndex,
    setActivePageIndex,
    movePage(fromIndex: number, toIndex: number) {
      setPages((prev) => {
        if (fromIndex === toIndex) return prev;
        if (fromIndex < 0 || toIndex < 0) return prev;
        if (fromIndex >= prev.length || toIndex >= prev.length) return prev;
        return reorderPages(prev, fromIndex, toIndex);
      });
      setActivePageIndex((prev) => {
        if (prev === fromIndex) return toIndex;
        return prev;
      });
    },
    movePageUp(idx: number) {
      if (idx > 0) {
        (this as any).movePage(idx, idx - 1);
      }
    },
    movePageDown(idx: number) {
      if (idx < pages.length - 1) {
        (this as any).movePage(idx, idx + 1);
      }
    },
    attachCanvasEl,
    getCanvas,
    addPageAfter,
    duplicatePage,
    deletePage,
    zoom,
    setZoom,
    setZoomPercent,
    setManualZooming,
    getZoom,
    getZoomPercent,
    viewportRef,
    setViewportEl,
    fitToViewport,
    pageSize,
    setPageSize,
    setPageSizePx,
    getPageSizePx,
    bgColor,
    setBgColor,
    applyCanvasBackground,
    setPageBackground,
    gridEnabled,
    setGridEnabled,
    applyGrid,
    selectionType,
    selectedFrameHasImage,
    activeObjectType,
    activeObjectSnapshot,
    textProps,
    shapeProps,
    imageProps,
    layers,
    selectedLayerId,
    hasSelection,
    docId: cloudDocId,
    docTitle,
    docCreatedAt,
    loadError,
    isDocDataReady,
    getCanvasJson,
    getPagesJsonForSave,
    saveToCloud,
    addText,
    addRect,
    addCircle,
    addLine,
    addImage,
    addImageFrame,
    setTextProp,
    setShapeProp,
    updateActiveObject,
    deleteSelected,
    deleteFrameEntirely,
    removeImageFromFrame,
    isImageFrameSelected,
    isInImageFrameCropMode,
    enterImageFrameCropMode,
    exitImageFrameCropMode,
    copy,
    paste,
    undo,
    redo,
    alignSelected,
    exportPNG,
    exportPDF,
    setLayerVisible,
    setLayerLocked,
    selectLayerById,
    reorderLayer,
    layerBringToFront,
    layerSendToBack,
    layerBringForward,
    layerSendBackward,
    renameLayer,
    docRevision: docRevisionRef.current,
  };
}
