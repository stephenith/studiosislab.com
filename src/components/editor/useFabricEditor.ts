"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Canvas,
  Line,
  Rect,
  Group,
  ActiveSelection,
  Shadow,
  Image as FabricImage,
} from "fabric";
import * as FabricNS from "fabric";
import { jsPDF } from "jspdf";
import { TEMPLATE_SNAPSHOTS } from "@/data/templates";
import { getSystemTemplateById } from "@/data/systemTemplates/registry";
import { toHexColor } from "@/lib/color";
import { useAuthUser } from "@/lib/useAuthUser";
import { createResumeDoc, getResumeDoc, updateResumeDoc } from "@/lib/resumeDocs";
import { generateResumeThumbnail } from "@/lib/resumePreviewExport";
import type {
  EditorMode,
  PageSize,
  SelectionType,
  AlignAction,
  TextProps,
  ShapeProps,
  ImageProps,
  ImageAdjustments,
  TableProps,
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
import { getShapeDefinitionById } from "@/data/shapes/catalog";
import { createShapeFromDefinition } from "@/lib/editor/shapeFactory";
import { createTableModel, type TableModel } from "@/lib/editor/tableModel";
import { renderTableFromModel } from "@/lib/editor/tableFactory";
import { generateQrDataUrl } from "@/lib/editor/qrGenerator";
import { getLayers as getLayersFromModule } from "@/lib/editor/layerManager";
import { exportToDataURL as exportToDataURLModule } from "@/lib/editor/exportCanvas";
import {
  deleteAutosaveDraft,
  readAutosaveDraft,
  saveAutosaveDraft,
} from "@/lib/editor/autosaveStore";
import { ensureObjectId } from "./editor/utils/fabricHelpers";
import {
  isImageFrame,
  getImageFrameFrameType,
  getFrameShape,
  getFrameImage,
  isImageNestedInImageFrame,
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

function isShapeType(type: string, shapeKind?: string) {
  const normalizedType = String(type || "").toLowerCase();
  const normalizedKind = String(shapeKind || "").toLowerCase();
  return ["rect", "circle", "triangle", "line", "polygon", "star"].includes(normalizedType) ||
    ["rect", "circle", "triangle", "line", "polygon", "star"].includes(normalizedKind);
}

const DEFAULT_IMAGE_ADJUSTMENTS: ImageAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  blur: 0,
  sharpen: 0,
};

const LOCAL_AUTOSAVE_THROTTLE_MS = 500;
const CLOUD_AUTOSAVE_DEBOUNCE_MS = 3000;
const CLOUD_AUTOSAVE_INTERVAL_MS = 45000;

type AutosaveStatus = "saving" | "syncing" | "synced" | "offlinePending" | null;

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
  const isInternalMutationRef = useRef(false);
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
  const autosaveRevisionRef = useRef(0);
  const dirtyRef = useRef(false);
  const lastSavedHashRef = useRef<string | null>(null);
  const lastSyncedHashRef = useRef<string | null>(null);
  const pendingSnapshotRef = useRef<any>(null);
  const saveTimerRef = useRef<number | null>(null);
  const syncTimerRef = useRef<number | null>(null);
  const syncIntervalRef = useRef<number | null>(null);
  const isCloudSyncRunningRef = useRef(false);
  /** Throttle offscreen thumbnail uploads after cloud sync (ms). */
  const THUMBNAIL_CLOUD_MIN_INTERVAL_MS = 90_000;
  const lastThumbnailGenAtRef = useRef(0);
  const lastThumbnailGenHashRef = useRef<string | null>(null);
  const restoreCheckKeyRef = useRef<string | null>(null);
  const markDirtyRef = useRef<(snapshot: any) => void>(() => {});
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
  const [selectionKind, setSelectionKind] = useState<"none" | "single" | "multi" | "group">(
    "none"
  );
  const [selectedFrameHasImage, setSelectedFrameHasImage] = useState(false);
  const [activeObjectType, setActiveObjectType] = useState<string | null>(null);
  const [activeObjectSnapshot, setActiveObjectSnapshot] = useState<any>(null);
  const [textProps, setTextProps] = useState<TextProps>({
    fontFamily: "Poppins",
    fontSize: 32,
    fill: "#111827",
    fontWeight: 400,
    fontStyle: "normal",
    fontVariantId: "400-normal",
    underline: false,
    textAlign: "left",
    lineHeight: 1.3,
    charSpacing: 0,
    opacity: 1,
    uppercaseEnabled: false,
    listMode: "none",
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
    scaleX: 1,
    scaleY: 1,
    angle: 0,
    flipX: false,
    flipY: false,
    width: 0,
    height: 0,
    isCropping: false,
    adjustments: { ...DEFAULT_IMAGE_ADJUSTMENTS },
  });
  const [tableProps, setTableProps] = useState<TableProps>({
    borderColor: "#111827",
    borderWidth: 1,
  });
  const [activeDrawTool, setActiveDrawToolState] = useState<"none" | "pencil" | "highlighter" | "eraser">("none");
  const [pencilColor, setPencilColor] = useState("#111827");
  const [pencilThickness, setPencilThickness] = useState(3);
  const [highlighterColor, setHighlighterColor] = useState("rgba(204,255,0,0.3)");
  const [highlighterThickness, setHighlighterThickness] = useState(16);
  const [eraserSize, setEraserSize] = useState(20);
  const [layers, setLayers] = useState<LayerItem[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [cloudDocId, setCloudDocId] = useState<string | null>(null);
  const [resolvedDocId, setResolvedDocId] = useState<string>(() => {
    const fromParam = String(docIdParam || "").trim();
    if (fromParam) return fromParam;
    if (typeof window === "undefined") return "";
    if (mode !== "template") return "";
    const templateId = String(initialTemplateId || "").toLowerCase().trim();
    if (!templateId) return "";
    try {
      return String(window.localStorage.getItem(`lastDocIdForTemplate:${templateId}`) || "").trim();
    } catch {
      return "";
    }
  });
  const [docTitle, setDocTitle] = useState<string | null>(null);
  const [docCreatedAt, setDocCreatedAt] = useState<any>(null);
  const [docUpdatedAt, setDocUpdatedAt] = useState<any>(null);
  const [docAutosaveRevision, setDocAutosaveRevision] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDocDataReady, setIsDocDataReady] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>(null);

  const bgColorRef = useRef(bgColor);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const isHydratingFromSelectionRef = useRef(false);
  const imageCropStateRef = useRef<{
    image: any;
    baseCropX: number;
    baseCropY: number;
    dimTop: any;
    dimBottom: any;
    dimLeft: any;
    dimRight: any;
    cropRect: any;
    handlers: {
      moving: () => void;
      scaling: () => void;
      modified: () => void;
    };
  } | null>(null);
  const suppressImageHistoryPushRef = useRef(false);
  const prevActivePageIdRef = useRef<string | null>(null);
  const { user, loading: authLoading } = useAuthUser();
  const getCanvas = useCallback(() => canvasRef.current, []);
  const persistTemplateDocPointer = useCallback(
    (nextDocId: string | null) => {
      if (typeof window === "undefined") return;
      if (mode !== "template") return;
      const templateId = String(initialTemplateId || "").toLowerCase().trim();
      if (!templateId) return;
      const key = `lastDocIdForTemplate:${templateId}`;
      try {
        if (nextDocId) window.localStorage.setItem(key, nextDocId);
        else window.localStorage.removeItem(key);
      } catch {}
    },
    [initialTemplateId, mode]
  );
  useEffect(() => {
    const fromParam = String(docIdParam || "").trim();
    if (fromParam) {
      setResolvedDocId(fromParam);
      return;
    }
    if (mode !== "template") {
      setResolvedDocId("");
      return;
    }
    const templateId = String(initialTemplateId || "").toLowerCase().trim();
    if (!templateId) {
      setResolvedDocId("");
      return;
    }
    try {
      const pointer = String(window.localStorage.getItem(`lastDocIdForTemplate:${templateId}`) || "").trim();
      setResolvedDocId(pointer);
    } catch {
      setResolvedDocId("");
    }
  }, [docIdParam, initialTemplateId, mode]);
  const logTextSync = useCallback((mode: "hydrate" | "apply") => {
    if (process.env.NODE_ENV !== "development") return;
    console.log("[text-sync]", mode);
  }, []);

  const setDrawTool = useCallback((tool: "none" | "pencil" | "highlighter" | "eraser") => {
    setActiveDrawToolState((prev) => (prev === tool ? "none" : tool));
  }, []);

  const setPencilThicknessValue = useCallback((value: number) => {
    const next = Number.isFinite(value) ? value : 1;
    setPencilThickness(Math.max(1, Math.min(64, Math.round(next))));
  }, []);

  const setHighlighterThicknessValue = useCallback((value: number) => {
    const next = Number.isFinite(value) ? value : 8;
    setHighlighterThickness(Math.max(4, Math.min(64, Math.round(next))));
  }, []);

  const setEraserSizeValue = useCallback((value: number) => {
    const next = Number.isFinite(value) ? value : 8;
    setEraserSize(Math.max(4, Math.min(96, Math.round(next))));
  }, []);

  const setPencilColorValue = useCallback((value: string) => {
    if (!value) return;
    setPencilColor(value);
  }, []);

  const setHighlighterColorValue = useCallback((value: string) => {
    if (!value) return;
    setHighlighterColor(value);
  }, []);

  const createEraserBrush = useCallback((canvas: Canvas) => {
    const brush: any = new (FabricNS as any).PencilBrush(canvas);
    brush.width = Math.max(1, eraserSize);
    brush.color = "rgba(0,0,0,1)";

    const baseFinalize = brush._finalizeAndAddPath?.bind(brush);
    if (baseFinalize) {
      brush._finalizeAndAddPath = function (...args: any[]) {
        const topCtx = this.canvas?.contextTop;
        if (topCtx) topCtx.globalCompositeOperation = "destination-out";
        try {
          return baseFinalize(...args);
        } finally {
          if (topCtx) topCtx.globalCompositeOperation = "source-over";
        }
      };
    }

    const baseCreatePath = brush.createPath?.bind(brush);
    if (baseCreatePath) {
      brush.createPath = function (...args: any[]) {
        const path = baseCreatePath(...args);
        if (path) (path as any).globalCompositeOperation = "destination-out";
        return path;
      };
    }

    return brush;
  }, [eraserSize]);

  const updateBrushConfig = useCallback(() => {
    const activeCanvas = getCanvas();

    pageCanvasesRef.current.forEach((canvas) => {
      canvas.isDrawingMode = false;
      canvas.selection = canvas === activeCanvas;
      (canvas as any).skipTargetFind = false;
    });

    if (!activeCanvas || activeDrawTool === "none") return;

    let brush: any = null;
    if (activeDrawTool === "pencil") {
      brush = new (FabricNS as any).PencilBrush(activeCanvas);
      brush.color = pencilColor;
      brush.width = Math.max(1, pencilThickness);
      brush.opacity = 1;
    } else if (activeDrawTool === "highlighter") {
      brush = new (FabricNS as any).PencilBrush(activeCanvas);
      brush.color = highlighterColor;
      brush.width = Math.max(4, highlighterThickness);
      brush.opacity = 1;
    } else if (activeDrawTool === "eraser") {
      brush = createEraserBrush(activeCanvas);
    }

    if (!brush) return;
    activeCanvas.freeDrawingBrush = brush;
    activeCanvas.selection = false;
    (activeCanvas as any).skipTargetFind = true;
    activeCanvas.isDrawingMode = true;
  }, [
    activeDrawTool,
    createEraserBrush,
    getCanvas,
    highlighterColor,
    highlighterThickness,
    pencilColor,
    pencilThickness,
  ]);

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

  useEffect(() => {
    updateBrushConfig();
    if (typeof window === "undefined") return;
    const frame = window.requestAnimationFrame(() => {
      updateBrushConfig();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [updateBrushConfig, activePageIndex]);

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
    async (
      title?: string,
      opts?: { autosaveRevision?: number; autosaveHash?: string | null }
    ) => {
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
        autosaveRevision:
          typeof opts?.autosaveRevision === "number"
            ? opts.autosaveRevision
            : autosaveRevisionRef.current,
        autosaveHash:
          typeof opts?.autosaveHash === "string" ? opts.autosaveHash : lastSavedHashRef.current,
      };
      if (cloudDocId) {
        await updateResumeDoc({
          ...common,
          docId: cloudDocId,
          ...(hasMultiplePages ? { pagesData } : { canvasJson }),
        });
        setDocTitle(nextTitle);
        setResolvedDocId(cloudDocId);
        persistTemplateDocPointer(cloudDocId);
        return { docId: cloudDocId, isNew: false };
      }
      const templateId = (initialTemplateId || "").toLowerCase().trim();
      const isTemplate = !!getSystemTemplateById(templateId);
      const sourceTemplateId = isTemplate ? templateId : null;
      const newDocId = await createResumeDoc({
        ...common,
        sourceTemplateId,
        ...(hasMultiplePages ? { pagesData } : { canvasJson }),
      });
      setCloudDocId(newDocId);
      setDocTitle(nextTitle);
      setResolvedDocId(newDocId);
      persistTemplateDocPointer(newDocId);
      return { docId: newDocId, isNew: true };
    },
    [
      cloudDocId,
      docTitle,
      getCanvasJsonForSave,
      getPagesJsonForSave,
      initialTemplateId,
      pageSize,
      persistTemplateDocPointer,
      user,
      zoom,
    ]
  );

  const getAutosaveDocKey = useCallback(() => {
    const uid = user?.uid || "anonymous";
    const sourceId =
      cloudDocId ||
      resolvedDocId ||
      `${mode}:${String(initialTemplateId || "blank").toLowerCase().trim()}`;
    return `${uid}:${sourceId}`;
  }, [cloudDocId, initialTemplateId, mode, resolvedDocId, user?.uid]);

  const getAutosaveMetaStorageKey = useCallback(() => {
    return `slb:autosave:meta:${getAutosaveDocKey()}`;
  }, [getAutosaveDocKey]);

  const computeSnapshotHash = useCallback((snapshot: any): string => {
    const raw = JSON.stringify(snapshot || { objects: [] });
    let checksum = 0;
    for (let i = 0; i < raw.length; i++) {
      checksum = (checksum + raw.charCodeAt(i) * (i + 1)) % 1000000007;
    }
    return `${raw.length}:${checksum}`;
  }, []);

  const runWhenIdle = useCallback((fn: () => void) => {
    if (typeof window === "undefined") return;
    const ric = (window as any).requestIdleCallback;
    if (typeof ric === "function") {
      ric(() => fn(), { timeout: 700 });
      return;
    }
    window.setTimeout(fn, 0);
  }, []);

  const toEpochMs = useCallback((value: any): number => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (value && typeof value.toMillis === "function") return Number(value.toMillis()) || 0;
    const parsed = Date.parse(String(value ?? ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }, []);

  const writeAutosaveMeta = useCallback(
    (meta: {
      docId: string | null;
      revision: number;
      updatedAt: number;
      hash: string;
      hasPendingSync: boolean;
    }) => {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(getAutosaveMetaStorageKey(), JSON.stringify(meta));
      } catch {}
    },
    [getAutosaveMetaStorageKey]
  );

  const readAutosaveMeta = useCallback(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(getAutosaveMetaStorageKey());
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed as {
        docId: string | null;
        revision: number;
        updatedAt: number;
        hash: string;
        hasPendingSync: boolean;
      };
    } catch {
      return null;
    }
  }, [getAutosaveMetaStorageKey]);

  const saveLocalDraftNow = useCallback(
    async (snapshot: any, hash: string) => {
      const now = Date.now();
      const undoStack = (undoRef.current || []).slice(-10);
      const redoStack = (redoRef.current || []).slice(-10);
      await saveAutosaveDraft({
        key: getAutosaveDocKey(),
        snapshot,
        hash,
        revision: autosaveRevisionRef.current,
        updatedAt: now,
        history: {
          undo: undoStack,
          redo: redoStack,
        },
      });
      lastSavedHashRef.current = hash;
      writeAutosaveMeta({
        docId: cloudDocId || resolvedDocId || null,
        revision: autosaveRevisionRef.current,
        updatedAt: now,
        hash,
        hasPendingSync: true,
      });
    },
    [cloudDocId, getAutosaveDocKey, resolvedDocId, writeAutosaveMeta]
  );

  const scheduleLocalDraftSave = useCallback(
    (snapshot: any, hash: string) => {
      if (typeof window === "undefined") return;
      if (saveTimerRef.current != null) return;
      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null;
        const latestSnapshot = pendingSnapshotRef.current || snapshot;
        const latestHash = computeSnapshotHash(latestSnapshot);
        runWhenIdle(() => {
          void saveLocalDraftNow(latestSnapshot, latestHash).catch(() => {});
        });
      }, LOCAL_AUTOSAVE_THROTTLE_MS);
      setAutosaveStatus("saving");
    },
    [computeSnapshotHash, runWhenIdle, saveLocalDraftNow]
  );

  const syncNow = useCallback(async () => {
    if (isCloudSyncRunningRef.current) return;
    const snapshot = pendingSnapshotRef.current;
    if (!snapshot) return;
    const hash = computeSnapshotHash(snapshot);
    if (hash === lastSyncedHashRef.current) {
      pendingSnapshotRef.current = null;
      dirtyRef.current = false;
      writeAutosaveMeta({
        docId: cloudDocId || resolvedDocId || null,
        revision: autosaveRevisionRef.current,
        updatedAt: Date.now(),
        hash,
        hasPendingSync: false,
      });
      setAutosaveStatus("synced");
      void deleteAutosaveDraft(getAutosaveDocKey()).catch(() => {});
      return;
    }
    if (!user) {
      setAutosaveStatus("offlinePending");
      return;
    }
    isCloudSyncRunningRef.current = true;
    setAutosaveStatus("syncing");
    try {
      const saveResult = await saveToCloud(docTitle || undefined, {
        autosaveRevision: autosaveRevisionRef.current,
        autosaveHash: hash,
      });
      lastSyncedHashRef.current = hash;

      if (saveResult && user) {
        const activeDocId = saveResult.docId;
        const now = Date.now();
        const elapsed =
          lastThumbnailGenAtRef.current === 0
            ? THUMBNAIL_CLOUD_MIN_INTERVAL_MS
            : now - lastThumbnailGenAtRef.current;
        const hashChanged = hash !== lastThumbnailGenHashRef.current;
        if (hashChanged && elapsed >= THUMBNAIL_CLOUD_MIN_INTERVAL_MS) {
          const pd = getPagesJsonForSave();
          const multi = Array.isArray(pd) && pd.length > 1;
          const cj = multi ? undefined : getCanvasJsonForSave();
          void (async () => {
            try {
              const thumb = await generateResumeThumbnail({
                pagesData: multi ? pd : undefined,
                canvasJson: multi ? undefined : cj,
                pageSize,
              });
              if (thumb && thumb.length < 950_000) {
                await updateResumeDoc({
                  uid: user.uid,
                  docId: activeDocId,
                  title: docTitle || "Untitled Resume",
                  thumbnail: thumb,
                });
                lastThumbnailGenHashRef.current = hash;
                lastThumbnailGenAtRef.current = Date.now();
              }
            } catch (e) {
              console.warn("[thumb] cloud thumbnail failed", e);
            }
          })();
        }
      }

      const latestHash = computeSnapshotHash(pendingSnapshotRef.current);
      if (latestHash === hash) {
        pendingSnapshotRef.current = null;
        dirtyRef.current = false;
        writeAutosaveMeta({
          docId: cloudDocId || resolvedDocId || null,
          revision: autosaveRevisionRef.current,
          updatedAt: Date.now(),
          hash,
          hasPendingSync: false,
        });
        setAutosaveStatus("synced");
        void deleteAutosaveDraft(getAutosaveDocKey()).catch(() => {});
      } else {
        setAutosaveStatus("saving");
      }
    } catch {
      dirtyRef.current = true;
      setAutosaveStatus("offlinePending");
      writeAutosaveMeta({
        docId: cloudDocId || resolvedDocId || null,
        revision: autosaveRevisionRef.current,
        updatedAt: Date.now(),
        hash,
        hasPendingSync: true,
      });
    } finally {
      isCloudSyncRunningRef.current = false;
    }
  }, [
    cloudDocId,
    computeSnapshotHash,
    deleteAutosaveDraft,
    docTitle,
    getAutosaveDocKey,
    getCanvasJsonForSave,
    getPagesJsonForSave,
    pageSize,
    resolvedDocId,
    saveToCloud,
    user,
    writeAutosaveMeta,
  ]);

  const scheduleCloudSync = useCallback(() => {
    if (typeof window === "undefined") return;
    if (syncTimerRef.current != null) {
      window.clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    syncTimerRef.current = window.setTimeout(() => {
      syncTimerRef.current = null;
      void syncNow();
    }, CLOUD_AUTOSAVE_DEBOUNCE_MS);
  }, [syncNow]);

  const markDirty = useCallback(
    (snapshot: any) => {
      if (!snapshot) return;
      const hash = computeSnapshotHash(snapshot);
      pendingSnapshotRef.current = snapshot;
      dirtyRef.current = true;
      if (hash === lastSavedHashRef.current && hash === lastSyncedHashRef.current) {
        return;
      }
      scheduleLocalDraftSave(snapshot, hash);
      scheduleCloudSync();
    },
    [computeSnapshotHash, scheduleCloudSync, scheduleLocalDraftSave]
  );
  markDirtyRef.current = markDirty;

  const pushHistory = useCallback((reason: string) => {
    const c = getCanvas();
    if (!c || isApplyingRef.current || isInternalMutationRef.current) return;
    const snap: any = serialize();
    const normalized = (value: any) => {
      if (!value || typeof value !== "object") return value;
      const next = { ...value };
      delete next.autosaveRevision;
      delete next.updatedAt;
      return next;
    };
    const last = undoRef.current[undoRef.current.length - 1];
    if (last && JSON.stringify(normalized(last)) === JSON.stringify(normalized(snap))) return;
    autosaveRevisionRef.current += 1;
    snap.autosaveRevision = autosaveRevisionRef.current;
    snap.updatedAt = Date.now();
    undoRef.current.push(snap);
    redoRef.current = [];
    docRevisionRef.current += 1;
    markDirtyRef.current(snap);
  }, [getCanvas, serialize]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current != null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (syncTimerRef.current != null) {
        window.clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      if (syncIntervalRef.current != null) {
        window.clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (syncIntervalRef.current != null) {
      window.clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
    syncIntervalRef.current = window.setInterval(() => {
      if (!dirtyRef.current) return;
      void syncNow();
    }, CLOUD_AUTOSAVE_INTERVAL_MS);
    return () => {
      if (syncIntervalRef.current != null) {
        window.clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [syncNow]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOnline = () => {
      if (!pendingSnapshotRef.current) return;
      void syncNow();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [syncNow]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isDocDataReady) return;
    const autosaveKey = getAutosaveDocKey();
    if (restoreCheckKeyRef.current === autosaveKey) return;
    restoreCheckKeyRef.current = autosaveKey;
    let cancelled = false;
    const run = async () => {
      const meta = readAutosaveMeta();
      if (!meta) return;
      const remoteRevision = Number(docAutosaveRevision || 0);
      const localRevision = Number(meta.revision || 0);
      const draft = await readAutosaveDraft(autosaveKey).catch(() => null);
      if (cancelled) return;

      const shouldUseLocal =
        !!draft?.snapshot &&
        (localRevision > remoteRevision ||
          (localRevision === remoteRevision &&
            (Array.isArray(draft?.history?.undo) &&
              draft.history.undo.length > 1 ||
              !!meta.hasPendingSync ||
              toEpochMs(meta.updatedAt) >= toEpochMs(docUpdatedAt))));

      if (shouldUseLocal && draft?.snapshot) {
        await applySnapshotRef.current(draft.snapshot, "history");
        autosaveRevisionRef.current = Math.max(localRevision, autosaveRevisionRef.current);
        undoRef.current =
          Array.isArray(draft.history?.undo) && draft.history!.undo.length
            ? draft.history!.undo.slice(-10)
            : [draft.snapshot];
        redoRef.current = Array.isArray(draft.history?.redo) ? draft.history!.redo.slice(-10) : [];
        pendingSnapshotRef.current = draft.snapshot;
        dirtyRef.current = !!meta.hasPendingSync;
        setAutosaveStatus(meta.hasPendingSync ? "offlinePending" : "synced");
        if (meta.hasPendingSync) scheduleCloudSync();
        return;
      }

      if (draft?.snapshot && meta.hasPendingSync) {
        pendingSnapshotRef.current = null;
        dirtyRef.current = false;
        writeAutosaveMeta({
          docId: cloudDocId || resolvedDocId || null,
          revision: Math.max(remoteRevision, localRevision),
          updatedAt: Date.now(),
          hash: meta.hash || "",
          hasPendingSync: false,
        });
        setAutosaveStatus("synced");
        void deleteAutosaveDraft(autosaveKey).catch(() => {});
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [
    cloudDocId,
    docAutosaveRevision,
    docUpdatedAt,
    getAutosaveDocKey,
    isDocDataReady,
    readAutosaveMeta,
    resolvedDocId,
    scheduleCloudSync,
    toEpochMs,
    writeAutosaveMeta,
  ]);

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
      const isHistory = reason === "history";
      const isTemplateLoad = reason === "template-loaded";
      const skipPostLoadMutations = isDuplicate || isDocLoad || isHistory;
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
        const allBefore = c.getObjects();
        allBefore.forEach((o: any) => {
          ensureObjectId(o);
          applyTextBoxNoStretch(o);
        });
        // --- SLB: normalize 300DPI templates into editor page size (fix right-shift) ---
        // Skip for page-duplicate and doc-load: content is already in correct coordinates
        if (isTemplateLoad) {
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

          // Image frame groups + nested cover image
          if (obj.type === "group" && isImageFrame(obj)) {
            obj.set({
              selectable: true,
              evented: true,
              hasControls: true,
              hasBorders: true,
              lockMovementX: false,
              lockMovementY: false,
              subTargetCheck: false,
              interactive: false,
            });
            const nestedImg = getFrameImage(obj);
            if (nestedImg) {
              nestedImg.set({
                selectable: false,
                evented: false,
                lockMovementX: true,
                lockMovementY: true,
                lockScalingX: true,
                lockScalingY: true,
                hasBorders: false,
                hasControls: false,
              });
              nestedImg.setCoords?.();
            }
            return;
          }

          // all other objects interactive
          obj.set({
            selectable: true,
            evented: true,
          });

          // normalize other groups
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

  const isActiveSelectionLike = (obj: any) => {
    return (
      obj?.isType?.("ActiveSelection") ||
      String(obj?.type || "").toLowerCase() === "activeselection"
    );
  };

  const isGroupLike = (obj: any) => {
    return (
      obj?.isType?.("Group") ||
      String(obj?.type || "").toLowerCase() === "group"
    );
  };

  const detectListMode = useCallback((text: string): "none" | "bullet" | "number" => {
    if (!text) return "none";
    const lines = text.split("\n");
    if (lines.length === 0) return "none";
    if (lines.every((line) => line.trim().startsWith("• "))) return "bullet";
    if (lines.every((line) => /^\d+\.\s/.test(line.trim()))) return "number";
    return "none";
  }, []);

  const stripListPrefixes = useCallback((text: string) => {
    return text
      .split("\n")
      .map((line) => line.replace(/^(\d+\.\s|•\s)/, ""))
      .join("\n");
  }, []);

  const applyBulletList = useCallback((text: string) => {
    return text
      .split("\n")
      .map((line) => `• ${line}`)
      .join("\n");
  }, []);

  const applyNumberList = useCallback((text: string) => {
    return text
      .split("\n")
      .map((line, index) => `${index + 1}. ${line}`)
      .join("\n");
  }, []);

  const hydrateTextUiFromActiveObject = useCallback((activeOverride?: any) => {
    const c = getCanvas();
    if (!c) return;
    const active: any = activeOverride || c.getActiveObject();
    if (!active) return;
    const type = String(active.type || "").toLowerCase();
    if (type !== "textbox" && type !== "i-text" && type !== "text") return;

    const activeFontSize = Number(active.fontSize);
    const activeLineHeight = Number(active.lineHeight);
    const activeCharSpacing = Number(active.charSpacing);
    const activeOpacity = Number(active.opacity);
    const activeText = String(active.text || "");
    const nextListMode = detectListMode(activeText);
    const uppercaseEnabled = !!active?.data?.uppercaseEnabled;
    const rawWeight = active.fontWeight;
    const activeWeight =
      rawWeight === "bold"
        ? 700
        : rawWeight === "normal"
          ? 400
          : Number(rawWeight);
    const normalizedWeight = Number.isFinite(activeWeight) ? activeWeight : 400;
    const normalizedStyle: "normal" | "italic" =
      active.fontStyle === "italic" ? "italic" : "normal";
    const fontVariantId = `${normalizedWeight}-${normalizedStyle}`;
    setTextProps({
      fontFamily: active.fontFamily || "Poppins",
      fontSize: Number.isFinite(activeFontSize) ? Math.round(activeFontSize) : 32,
      fill: toHexColor(active.fill, "#111827"),
      fontWeight: normalizedWeight,
      fontStyle: normalizedStyle,
      fontVariantId,
      underline: !!active.underline,
      textAlign: active.textAlign || "left",
      lineHeight: Number.isFinite(activeLineHeight) ? activeLineHeight : 1.3,
      charSpacing: Number.isFinite(activeCharSpacing) ? activeCharSpacing : 0,
      opacity: Number.isFinite(activeOpacity) ? activeOpacity : 1,
      uppercaseEnabled,
      listMode: nextListMode,
    });
  }, [detectListMode, getCanvas]);

  const hydrateShapeUiFromActiveObject = useCallback((activeOverride?: any) => {
    const c = getCanvas();
    if (!c) return;
    const active: any = activeOverride || c.getActiveObject();
    if (!active) return;
    const type = String(active.type || "").toLowerCase();
    if (!isShapeType(type, active?.data?.shapeKind)) return;

    const nextShape = {
      fill: toHexColor(active.fill, "#111827"),
      stroke: toHexColor(active.stroke, "#111827"),
      strokeWidth: Number(active.strokeWidth ?? 0),
      opacity: Number(active.opacity ?? 1),
      cornerRadius: Number(active.rx ?? 0),
    };

    setShapeProps((prev) =>
      prev &&
      prev.fill === nextShape.fill &&
      prev.stroke === nextShape.stroke &&
      prev.strokeWidth === nextShape.strokeWidth &&
      prev.opacity === nextShape.opacity &&
      prev.cornerRadius === nextShape.cornerRadius
        ? prev
        : nextShape
    );
  }, [getCanvas]);

  const getImageAdjustmentsFromObject = useCallback((image: any): ImageAdjustments => {
    const raw = image?.data?.imageAdjustments || {};
    const toNumber = (value: unknown, fallback: number) => {
      const next = Number(value);
      return Number.isFinite(next) ? next : fallback;
    };
    return {
      brightness: Math.max(-1, Math.min(1, toNumber(raw.brightness, 0))),
      contrast: Math.max(-1, Math.min(1, toNumber(raw.contrast, 0))),
      saturation: Math.max(-1, Math.min(1, toNumber(raw.saturation, 0))),
      blur: Math.max(0, Math.min(1, toNumber(raw.blur, 0))),
      sharpen: Math.max(0, Math.min(1, toNumber(raw.sharpen, 0))),
    };
  }, []);

  const applyImageFilters = useCallback((image: any, adjustments: ImageAdjustments) => {
    const filtersNS = (FabricNS as any)?.filters || (FabricNS as any)?.Image?.filters;
    if (!filtersNS || !image) return;

    const nextFilters: any[] = [];
    if (Math.abs(adjustments.brightness) > 0.0001) {
      nextFilters.push(new filtersNS.Brightness({ brightness: adjustments.brightness }));
    }
    if (Math.abs(adjustments.contrast) > 0.0001) {
      nextFilters.push(new filtersNS.Contrast({ contrast: adjustments.contrast }));
    }
    if (Math.abs(adjustments.saturation) > 0.0001) {
      nextFilters.push(new filtersNS.Saturation({ saturation: adjustments.saturation }));
    }
    if (adjustments.blur > 0.0001) {
      nextFilters.push(new filtersNS.Blur({ blur: adjustments.blur }));
    }
    if (adjustments.sharpen > 0.0001) {
      const s = adjustments.sharpen;
      const center = 1 + 4 * s;
      const edge = -s;
      nextFilters.push(
        new filtersNS.Convolute({
          matrix: [0, edge, 0, edge, center, edge, 0, edge, 0],
        })
      );
    }
    image.filters = nextFilters;
    image.applyFilters?.();
  }, []);

  const hydrateImageUiFromActiveObject = useCallback((activeOverride?: any) => {
    const c = getCanvas();
    if (!c) return;
    const active: any = activeOverride || c.getActiveObject();
    if (!active) return;
    const type = String(active.type || "").toLowerCase();
    if (type !== "image") return;
    const nextImage: ImageProps = {
      opacity: Number.isFinite(Number(active.opacity)) ? Number(active.opacity) : 1,
      scaleX: Number.isFinite(Number(active.scaleX)) ? Number(active.scaleX) : 1,
      scaleY: Number.isFinite(Number(active.scaleY)) ? Number(active.scaleY) : 1,
      angle: Number.isFinite(Number(active.angle)) ? Number(active.angle) : 0,
      flipX: !!active.flipX,
      flipY: !!active.flipY,
      width: Number.isFinite(Number(active.width)) ? Number(active.width) : 0,
      height: Number.isFinite(Number(active.height)) ? Number(active.height) : 0,
      isCropping: !!imageCropStateRef.current,
      adjustments: getImageAdjustmentsFromObject(active),
    };
    setImageProps((prev) => {
      if (
        prev.opacity === nextImage.opacity &&
        prev.scaleX === nextImage.scaleX &&
        prev.scaleY === nextImage.scaleY &&
        prev.angle === nextImage.angle &&
        prev.flipX === nextImage.flipX &&
        prev.flipY === nextImage.flipY &&
        prev.width === nextImage.width &&
        prev.height === nextImage.height &&
        prev.isCropping === nextImage.isCropping &&
        prev.adjustments.brightness === nextImage.adjustments.brightness &&
        prev.adjustments.contrast === nextImage.adjustments.contrast &&
        prev.adjustments.saturation === nextImage.adjustments.saturation &&
        prev.adjustments.blur === nextImage.adjustments.blur &&
        prev.adjustments.sharpen === nextImage.adjustments.sharpen
      ) {
        return prev;
      }
      return nextImage;
    });
  }, [getCanvas, getImageAdjustmentsFromObject]);

  const isTableLike = useCallback((obj: any) => {
    return String(obj?.data?.role || "").toLowerCase() === "table";
  }, []);

  const updateSelection = useCallback(() => {
    const c = getCanvas();
    if (!c) return;
    const active: any = c.getActiveObject();

    // Guard: skip React work if logical selection id hasn't changed
    let currentId: string | null = null;
    if (active) {
      if (isActiveSelectionLike(active)) {
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

    if (!active || isActiveSelectionLike(active)) {
      if (isActiveSelectionLike(active)) {
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
      hydrateTextUiFromActiveObject();
    } else if (type === "image") {
      setSelectionType((prev) => (prev === "image" ? prev : "image"));
      setSelectedFrameHasImage((prev) => (prev === false ? prev : false));
      hydrateImageUiFromActiveObject(active);
    } else if (isTableLike(active)) {
      setSelectionType((prev) => (prev === "table" ? prev : "table"));
      setSelectedFrameHasImage((prev) => (prev === false ? prev : false));
      const border = (active?.data as TableModel | undefined)?.border;
      const nextTable = {
        borderColor: toHexColor(border?.color, "#111827"),
        borderWidth: Number(border?.width ?? 1),
      };
      setTableProps((prev) =>
        prev &&
        prev.borderColor === nextTable.borderColor &&
        prev.borderWidth === nextTable.borderWidth
          ? prev
          : nextTable
      );
    } else if (isShapeType(type, active?.data?.shapeKind)) {
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
      const hasImg = !!getFrameImage(active);
      setSelectedFrameHasImage((prev) => (prev === hasImg ? prev : hasImg));
    } else {
      setSelectedFrameHasImage((prev) => (prev === false ? prev : false));
      setSelectionType((prev) => (prev === "none" ? prev : "none"));
    }
    requestAnimationFrame(() => {
      isHydratingFromSelectionRef.current = false;
    });
  }, [
    ensureObjectId,
    getCanvas,
    hydrateImageUiFromActiveObject,
    hydrateTextUiFromActiveObject,
    isTableLike,
    logTextSync,
  ]);

  const updateSelectionRef = useRef(updateSelection);
  updateSelectionRef.current = updateSelection;

  const computeSelectionKind = useCallback(
    (active: any): "none" | "single" | "multi" | "group" => {
      if (!active) return "none";
      if (isActiveSelectionLike(active)) return "multi";
      if (isGroupLike(active) && !isImageFrame(active)) return "group";

      return "single";
    },
    []
  );

  const syncSelectionKind = useCallback(() => {
    const c = getCanvas();
    const active = c?.getActiveObject?.();
    setSelectionKind(computeSelectionKind(active));
  }, [computeSelectionKind, getCanvas]);

  // Interaction state for frame vs image edit mode (kept in refs to avoid rerender churn).
  const activeFrameRef = useRef<any>(null);
  const editingImageRef = useRef<any>(null);
  const isEditModeRef = useRef<boolean>(false);

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
      mouseDown: (e: any) => void;
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
    canvas.off("mouse:down", handlers.mouseDown);
    canvas.off("mouse:up", handlers.mouseUp);
    if (handlers.debugMouseDown) canvas.off("mouse:down", handlers.debugMouseDown);
    activeCanvasListenersRef.current = null;
  }, []);

  const { enterImageFrameCropMode, exitImageFrameCropMode } = createFrameCrop({
    getCanvas,
    isImageFrame,
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

        if (image) {
          image.set({
            selectable: false,
            evented: false,
            lockMovementX: true,
            lockMovementY: true,
            lockScalingX: true,
            lockScalingY: true,
            hasBorders: false,
            hasControls: false,
          });
        }
        if (frame) {
          frame.set({
            selectable: true,
            evented: true,
          });
          (frame as any).lockMovementX = false;
          (frame as any).lockMovementY = false;
          (frame as any).subTargetCheck = false;
          (frame as any).interactive = false;
          (frame as any)._activeObjects = [];
          (frame as any)._set?.("dirty", true);

          const shape = getFrameShape(frame);
          if (shape) {
            (shape as any).set({
              stroke: "#9ca3af",
              strokeWidth: 2,
            });
          }
        }
        imageFrameCropModeRef.current = null;
        setCropModeStateRef.current(false);
        activeFrameRef.current = frame ?? null;
        editingImageRef.current = null;
        isEditModeRef.current = false;
        canvas.setActiveObject(frame);
        canvas.requestRenderAll();
      };
      exitCropModeRef.current = exitCropMode;

      const handleSelection = () => {
        const active = canvas.getActiveObject?.();
        const state = imageFrameCropModeRef.current;
        // V1 crop keeps the image active; stay in crop while selection is frame or image.
        if (
          state &&
          active &&
          active !== state.frame &&
          active !== state.image
        ) {
          exitCropMode();
        }
        setHasSelection(!!active);
        syncSelectionKind();
        updateSelection();
      };

      function isStep1Frame(o: any) {
        return isImageFrame(o) || o?.data?.isFrame === true || o?.isFrame === true;
      }

      function isFabricImage(o: any) {
        return Boolean(
          o?.type === "image" ||
            o?._element ||
            o?.data?.src ||
            o?.data?.url
        );
      }

      const resolveFrameFromTarget = (target: any): any => {
        if (!target) return null;
        if (isImageFrame(target)) return target;
        const parent = target.group || target.parent || target._parent;
        if (isImageFrame(parent)) return parent;
        return null;
      };

      const runFrameDropDetection = (obj: any): boolean => {
        if (!obj) return false;
        if (imageFrameCropModeRef.current) return false;

        const canvas = getCanvas();
        if (!canvas) return false;

        let images: any[] = [];
        if (isFabricImage(obj)) {
          images = [obj];
        } else if (isActiveSelectionLike(obj)) {
          images = (obj.getObjects?.() || obj._objects || []).filter((o: any) =>
            isFabricImage(o)
          );
        } else {
          // obj might be a wrapper/group; fallback to canvas active object.
          const active = canvas?.getActiveObject?.();
          if (isFabricImage(active)) {
            images = [active];
          } else if (isActiveSelectionLike(active)) {
            images =
              (active as any).getObjects?.().filter((o: any) => isFabricImage(o)) ||
              [];
          } else {
            return false;
          }
        }

        if (images.length === 0) return false;

        const frames = canvas.getObjects?.().filter((o: any) => isStep1Frame(o)) || [];
        if (frames.length === 0) return false;

        const prefersCenterInside = (imgRect: any, frameRect: any) => {
          const imgCenterX = imgRect.left + imgRect.width / 2;
          const imgCenterY = imgRect.top + imgRect.height / 2;
          return (
            imgCenterX >= frameRect.left &&
            imgCenterX <= frameRect.left + frameRect.width &&
            imgCenterY >= frameRect.top &&
            imgCenterY <= frameRect.top + frameRect.height
          );
        };

        for (let i = images.length - 1; i >= 0; i--) {
          const image = images[i];
          if (!image || isImageNestedInImageFrame(image)) continue;

          const imgRect = (image as any).getBoundingRect?.(true, true);
          if (!imgRect) continue;

          // Two-pass preference:
          // pass 0: overlap where the image center is inside the frame
          // pass 1: any overlap fallback
          for (let pass = 0; pass < 2; pass++) {
            for (let fi = frames.length - 1; fi >= 0; fi--) {
              const frame = frames[fi];
              const frameRect = (frame as any).getBoundingRect?.(true, true);
              if (!frameRect) continue;

              const isOverlapping =
                imgRect.left < frameRect.left + frameRect.width &&
                imgRect.left + imgRect.width > frameRect.left &&
                imgRect.top < frameRect.top + frameRect.height &&
                imgRect.top + imgRect.height > frameRect.top;
              if (!isOverlapping) continue;

              const centerInside = prefersCenterInside(imgRect, frameRect);
              if (pass === 0 && !centerInside) continue;

              attachImageToFrame(frame, image);
              return true;
            }
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
          syncSelectionKind();
          updateSelection();
        },
        objectModified: () => {
          updateSelection();
          updateLayers();
          pushHistory("modified");
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
        mouseDown: (e: any) => {
          const target = e?.target as any;

          let editState = imageFrameCropModeRef.current;

          const clickedFrame = resolveFrameFromTarget(target);

          // If we are in IMAGE EDIT MODE, only exit when the click is outside
          // the currently edited frame.
          if (editState) {
            const currentFrame = editState.frame;
            const clickedIsCurrentFrame =
              clickedFrame &&
              String(ensureObjectId(clickedFrame)) === String(ensureObjectId(currentFrame));

            if (!target || !clickedIsCurrentFrame) {
              exitCropMode();
              // If clicked outside every frame, exit and let `exitCropMode()` keep frame active.
              if (!clickedFrame) return;
            } else {
              // Click inside the current frame while editing: keep edit mode.
              return;
            }
          }

          // Not in edit mode: track frame for app UI only — do NOT mutate Fabric objects
          // on pointerdown (that breaks _setupCurrentTransform / drag on this gesture).
          if (!clickedFrame) return;
          activeFrameRef.current = clickedFrame;
          editingImageRef.current = null;
          isEditModeRef.current = false;
        },
        mouseUp: (e: any) => {
          const canvas = getCanvas();
          const obj = e?.target ?? canvas?.getActiveObject();
          if (!obj) return;
          runFrameDropDetection(obj);
        },
        mouseDblclick: (e: any) => {
          const target = e?.target as any;
          if (!target) return;

          // If already in crop mode, ignore further double-clicks
          if (imageFrameCropModeRef.current) return;

          // Double-click directly on a frame
          if (isImageFrame(target)) {
            enterImageFrameCropMode();
            const st = imageFrameCropModeRef.current as { image: any } | null;
            activeFrameRef.current = null;
            editingImageRef.current = st?.image ?? null;
            isEditModeRef.current = !!st;
            return;
          }

          // Double-click on image or child inside a frame
          const parent = (target as any).group || (target as any).parent || (target as any)._parent;
          if (parent && isImageFrame(parent)) {
            canvas.setActiveObject(parent);
            enterImageFrameCropMode();
            const st = imageFrameCropModeRef.current as { image: any } | null;
            activeFrameRef.current = null;
            editingImageRef.current = st?.image ?? null;
            isEditModeRef.current = !!st;
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
      canvas.on("mouse:down", handlers.mouseDown);
      canvas.on("mouse:up", handlers.mouseUp);
      activeCanvasListenersRef.current = { canvas, handlers };
    },
    [
      enterImageFrameCropMode,
      pushHistory,
      hydrateImageUiFromActiveObject,
      syncSelectionKind,
      unbindActiveCanvasListeners,
      updateLayers,
      updateSelection,
    ]
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
    syncSelectionKind();
    updateSelectionRef.current();
    updateLayersRef.current();
  }, [activePageIndex, syncSelectionKind]);

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

  const updateActiveObject = useCallback((patch: Record<string, any>, opts?: { commitHistory?: boolean }) => {
    const c = getCanvas();
    if (!c) return;
    const active: any = c.getActiveObject();
    if (!active) return;
    active.set(patch);
    active.setCoords?.();
    c.requestRenderAll();
    hydrateTextUiFromActiveObject(active);
    hydrateShapeUiFromActiveObject(active);
    hydrateImageUiFromActiveObject(active);
    const nextSnapshot = active.toObject ? active.toObject() : active;
    setActiveObjectSnapshot(nextSnapshot);
    const shouldCommit = opts?.commitHistory ?? !suppressImageHistoryPushRef.current;
    if (shouldCommit) pushHistory("object:update");
  }, [
    getCanvas,
    hydrateImageUiFromActiveObject,
    hydrateShapeUiFromActiveObject,
    hydrateTextUiFromActiveObject,
    pushHistory,
  ]);

  const toggleUppercase = useCallback(() => {
    const c = getCanvas();
    if (!c) return;
    const obj: any = c.getActiveObject();
    if (!obj) return;
    const type = String(obj.type || "").toLowerCase();
    if (type !== "textbox" && type !== "i-text" && type !== "text") return;
    const currentText = String(obj.text || "");
    if (!currentText) return;

    const data = obj.data || {};
    if (!data.uppercaseEnabled) {
      obj.data = {
        ...data,
        caseOriginalText: currentText,
        uppercaseEnabled: true,
      };
      obj.set("text", currentText.toUpperCase());
    } else {
      const original = String(data.caseOriginalText || currentText);
      obj.set("text", original);
      obj.data = {
        ...data,
        uppercaseEnabled: false,
      };
    }

    obj.setCoords?.();
    c.requestRenderAll();
    pushHistory("object:update");
    hydrateTextUiFromActiveObject(obj);
  }, [getCanvas, hydrateTextUiFromActiveObject, pushHistory]);

  const toggleBulletList = useCallback(() => {
    const c = getCanvas();
    if (!c) return;
    const obj: any = c.getActiveObject();
    if (!obj) return;
    const type = String(obj.type || "").toLowerCase();
    if (type !== "textbox" && type !== "i-text" && type !== "text") return;

    const rawText = String(obj.text || "");
    if (!rawText) return;
    const mode = detectListMode(rawText);

    let newText: string;
    if (mode === "bullet") {
      newText = stripListPrefixes(rawText);
    } else {
      newText = applyBulletList(stripListPrefixes(rawText));
    }

    obj.set("text", newText);
    obj.setCoords?.();
    c.requestRenderAll();
    pushHistory("object:update");
    hydrateTextUiFromActiveObject(obj);
  }, [
    applyBulletList,
    detectListMode,
    getCanvas,
    hydrateTextUiFromActiveObject,
    pushHistory,
    stripListPrefixes,
  ]);

  const toggleNumberedList = useCallback(() => {
    const c = getCanvas();
    if (!c) return;
    const obj: any = c.getActiveObject();
    if (!obj) return;
    const type = String(obj.type || "").toLowerCase();
    if (type !== "textbox" && type !== "i-text" && type !== "text") return;

    const rawText = String(obj.text || "");
    if (!rawText) return;
    const mode = detectListMode(rawText);

    let newText: string;
    if (mode === "number") {
      newText = stripListPrefixes(rawText);
    } else {
      newText = applyNumberList(stripListPrefixes(rawText));
    }

    obj.set("text", newText);
    obj.setCoords?.();
    c.requestRenderAll();
    pushHistory("object:update");
    hydrateTextUiFromActiveObject(obj);
  }, [
    applyNumberList,
    detectListMode,
    getCanvas,
    hydrateTextUiFromActiveObject,
    pushHistory,
    stripListPrefixes,
  ]);

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
            const allBeforeDup = c.getObjects();
            allBeforeDup.forEach((o: any) => {
              ensureObjectId(o);
              applyTextBoxNoStretch(o);
            });
            c.getObjects().forEach((o: any) => {
              if (o?.type === "group" && isImageFrame(o)) {
                o.set({
                  selectable: true,
                  evented: true,
                  hasControls: true,
                  hasBorders: true,
                  lockMovementX: false,
                  lockMovementY: false,
                  subTargetCheck: false,
                  interactive: false,
                });
                const nestedImg = getFrameImage(o);
                if (nestedImg) {
                  nestedImg.set({
                    selectable: false,
                    evented: false,
                    lockMovementX: true,
                    lockMovementY: true,
                    lockScalingX: true,
                    lockScalingY: true,
                    hasBorders: false,
                    hasControls: false,
                  });
                  nestedImg.setCoords?.();
                }
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
  const trimmedDocId = (resolvedDocId || "").trim();
  const isBlank =
    mode === "new" || !templateId || templateId === "new" || templateId === "blank";
  const isTemplateId = !!getSystemTemplateById(templateId);
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
        setResolvedDocId(trimmedDocId || templateId);
        persistTemplateDocPointer(trimmedDocId || templateId);
        setDocTitle(docSnap.title || "Untitled Resume");
        setDocCreatedAt(docSnap.createdAt ?? null);
        setDocUpdatedAt(docSnap.updatedAt ?? null);
        setDocAutosaveRevision(
          typeof docSnap.autosaveRevision === "number" ? docSnap.autosaveRevision : 0
        );
        autosaveRevisionRef.current =
          typeof docSnap.autosaveRevision === "number" ? docSnap.autosaveRevision : 0;
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

    if (isDocId) {
      return;
    }

    setLoadError(null);
    let cancelled = false;

    const run = async () => {
      try {
        let snapshot: any = { objects: [] };

        if (treatBlank) {
          snapshot = { objects: [] };
        } else {
          const template = getSystemTemplateById(templateId);
          if (!template) {
            console.error("Template not found:", templateId);
            return;
          }
          snapshot = await template.load();
          if (cancelled) return;
        }

        const snapshotForLoad = snapshot || { objects: [] };
        if (cancelled) return;

        await applySnapshotRef.current(snapshotForLoad);
        if (cancelled) return;

        autosaveRevisionRef.current = Number(snapshotForLoad?.autosaveRevision || 0);
        setDocAutosaveRevision(autosaveRevisionRef.current);
        undoRef.current = [snapshotForLoad];
        redoRef.current = [];
        updateLayersRef.current();
        lastAppliedTemplateRef.current = appliedId;
      } catch (err: any) {
        if (cancelled) return;
        const name = err?.name || "";
        const msg = String(err?.message || "").toLowerCase();
        if (name === "AbortError" || msg.includes("aborted")) return;
        console.error("[editor] Failed initial load", err);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    canvasReady,
    getCanvas,
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

  const addShape = useCallback((shapeId: string) => {
    const c = getCanvas();
    if (!c) return;
    c.isDrawingMode = false;
    c.selection = true;
    const def = getShapeDefinitionById(shapeId);
    if (!def) return;
    const obj = createShapeFromDefinition(def, pageSizePx);
    const id = ensureObjectId(obj);
    obj.uid = id;
    c.add(obj);
    c.setActiveObject(obj);
    c.requestRenderAll();
  }, [ensureObjectId, getCanvas, pageSizePx]);

  const addTable = useCallback((rows: number, cols: number) => {
    const c = getCanvas();
    if (!c) return;
    c.isDrawingMode = false;
    c.selection = true;

    const model = createTableModel(rows, cols);
    const group = renderTableFromModel(model) as any;
    const tableWidth = model.colWidths.reduce((sum, value) => sum + value, 0);
    const tableHeight = model.rowHeights.reduce((sum, value) => sum + value, 0);
    const size = pageSizePx;

    group.set({
      left: size.w / 2 - tableWidth / 2,
      top: size.h / 2 - tableHeight / 2,
      subTargetCheck: true,
      hasControls: true,
      lockScalingFlip: true,
    });
    group.data = { ...model, role: "table", tableId: model.tableId };

    const children = group.getObjects?.() || group._objects || [];
    children.forEach((child: any) => {
      if (String(child?.data?.role || "") !== "table-cell-text") return;
      const syncCellContent = () => {
        const tableData = group.data as TableModel | undefined;
        if (!tableData?.cells) return;
        const row = Number(child?.data?.row);
        const col = Number(child?.data?.col);
        const cell = tableData.cells.find((entry) => entry.row === row && entry.col === col);
        if (!cell) return;
        cell.text = String(child?.text || "");
      };
      child.on?.("changed", syncCellContent);
      child.on?.("editing:exited", syncCellContent);
    });

    const id = ensureObjectId(group);
    group.uid = id;

    isApplyingRef.current = true;
    try {
      c.add(group);
      c.setActiveObject(group);
      c.requestRenderAll();
    } finally {
      isApplyingRef.current = false;
    }

    const nextTableProps = {
      borderColor: toHexColor(model.border.color, "#111827"),
      borderWidth: Number(model.border.width ?? 1),
    };
    setTableProps(nextTableProps);
    pushHistory("table:created");
  }, [ensureObjectId, getCanvas, pageSizePx, pushHistory]);

  const addRect = useCallback(() => {
    addShape("rectangle");
  }, [addShape]);

  const addCircle = useCallback(() => {
    addShape("circle");
  }, [addShape]);

  const addLine = useCallback(() => {
    addShape("line");
  }, [addShape]);

  const { attachImageToFrame } = createFrameAttach({
    getCanvas,
    pushHistory,
    updateLayers,
    isInternalMutationRef,
  });

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

  const addImageFromUrl = useCallback(
    async (url: string) => {
      const c = getCanvas();
      if (!c || !url) return;

      c.isDrawingMode = false;
      c.selection = true;

      try {
        const img = await FabricImage.fromURL(url, { crossOrigin: "anonymous" } as any);
        const size = pageSizePx;
        const maxW = size.w * 0.55;
        const maxH = size.h * 0.55;
        const baseW = img.width || 200;
        const baseH = img.height || 200;
        const scale = Math.min(maxW / baseW, maxH / baseH, 1);
        const targetW = baseW * scale;
        const targetH = baseH * scale;

        img.set({
          left: size.w / 2 - targetW / 2,
          top: size.h / 2 - targetH / 2,
          scaleX: scale,
          scaleY: scale,
        });

        const id = ensureObjectId(img);
        (img as any).uid = id;

        isApplyingRef.current = true;
        try {
          c.add(img);
          c.setActiveObject(img);
          c.requestRenderAll();
        } finally {
          isApplyingRef.current = false;
        }

        pushHistory("added");
      } catch (err) {
        console.error("[addImageFromUrl]", err);
      }
    },
    [ensureObjectId, getCanvas, pageSizePx, pushHistory]
  );

  const addImage = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const url = reader.result as string;
          await addImageFromUrl(url);
        } catch (err) {
          console.error("[addImage]", err);
        }
      };
      reader.readAsDataURL(file);
    },
    [addImageFromUrl]
  );

  const addGraphicFromUrl = useCallback(
    async (url: string) => {
      const c = getCanvas();
      if (!c || !url) return;

      c.isDrawingMode = false;
      c.selection = true;

      try {
        const img = await FabricImage.fromURL(url, { crossOrigin: "anonymous" } as any);
        const size = pageSizePx;
        const maxW = size.w * 0.25;
        const maxH = size.h * 0.25;
        const baseW = img.width || 200;
        const baseH = img.height || 200;
        const scale = Math.min(maxW / baseW, maxH / baseH, 1);
        const targetW = baseW * scale;
        const targetH = baseH * scale;

        img.set({
          left: size.w / 2 - targetW / 2,
          top: size.h / 2 - targetH / 2,
          scaleX: scale,
          scaleY: scale,
        });

        const id = ensureObjectId(img);
        (img as any).uid = id;

        isApplyingRef.current = true;
        try {
          c.add(img);
          c.setActiveObject(img);
          c.requestRenderAll();
        } finally {
          isApplyingRef.current = false;
        }

        pushHistory("added");
      } catch (err) {
        console.error("[addGraphicFromUrl]", err);
      }
    },
    [ensureObjectId, getCanvas, pageSizePx, pushHistory]
  );

  const addQrCode = useCallback(async (content: string) => {
    const c = getCanvas();
    if (!c || !content?.trim()) return;

    try {
      const dataUrl = await generateQrDataUrl(content);
      const img = await FabricImage.fromURL(dataUrl);

      const size = 180;
      const sourceW = img.width || size;
      const sourceH = img.height || size;

      img.set({
        left: pageSizePx.w / 2 - size / 2,
        top: pageSizePx.h / 2 - size / 2,
        scaleX: size / sourceW,
        scaleY: size / sourceH,
        selectable: true,
      });

      const id = ensureObjectId(img);
      (img as any).uid = id;

      isApplyingRef.current = true;
      try {
        c.add(img);
        c.setActiveObject(img);
        c.requestRenderAll();
      } finally {
        isApplyingRef.current = false;
      }

      pushHistory("qr:added");
    } catch (err) {
      console.error("[QR] generation failed", err);
    }
  }, [ensureObjectId, getCanvas, pageSizePx, pushHistory]);

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

      const img = getFrameImage(target);
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
    const img = getFrameImage(active);
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
    if (patch.fontWeight != null) {
      const rawWeight = patch.fontWeight as any;
      const nextWeight =
        rawWeight === "bold"
          ? 700
          : rawWeight === "normal"
            ? 400
            : Number(rawWeight);
      if (!Number.isFinite(nextWeight)) return;
      patch.fontWeight = Math.max(100, Math.min(900, Math.round(nextWeight)));
    }
    const c = getCanvas();
    if (!c) return;
    const active: any = c.getActiveObject();
    if (!active) return;
    const type = String(active.type || "").toLowerCase();
    if (type !== "textbox" && type !== "i-text" && type !== "text") return;
    logTextSync("apply");
    const fabricPatch: Record<string, any> = { ...patch };
    delete fabricPatch.fontVariantId;
    delete fabricPatch.uppercaseEnabled;
    delete fabricPatch.listMode;
    updateActiveObject(fabricPatch);
  }, [getCanvas, logTextSync, selectionType, updateActiveObject]);

  const setShapeProp = useCallback((partial: Partial<ShapeProps>) => {
    const c = getCanvas();
    if (!c) return;
    const active: any = c.getActiveObject();
    if (!active) return;
    const type = String(active.type || "").toLowerCase();
    if (!isShapeType(type, active?.data?.shapeKind)) return;
    const patch: any = { ...partial, strokeUniform: true };
    if (partial.cornerRadius != null && type === "rect") {
      patch.rx = partial.cornerRadius;
      patch.ry = partial.cornerRadius;
    }
    updateActiveObject(patch);
  }, [updateActiveObject]);

  const updateActiveObjectLive = useCallback((patch: Record<string, any>) => {
    suppressImageHistoryPushRef.current = true;
    try {
      updateActiveObject(patch, { commitHistory: false });
    } finally {
      suppressImageHistoryPushRef.current = false;
    }
  }, [updateActiveObject]);

  const commitActiveObjectUpdate = useCallback(() => {
    const c = getCanvas();
    if (!c) return;
    const active = c.getActiveObject();
    if (!active) return;
    const nextSnapshot = (active as any).toObject ? (active as any).toObject() : active;
    setActiveObjectSnapshot(nextSnapshot);
    pushHistory("object:update");
  }, [getCanvas, pushHistory]);

  const setTableProp = useCallback((partial: Partial<TableProps>) => {
    const c = getCanvas();
    if (!c) return;
    const active: any = c.getActiveObject();
    if (!active || !isTableLike(active)) return;

    const tableData = (active.data || {}) as TableModel;
    tableData.border = tableData.border || { color: "#111827", width: 1 };

    if (partial.borderColor != null) {
      tableData.border.color = toHexColor(partial.borderColor, "#111827");
    }
    if (partial.borderWidth != null) {
      tableData.border.width = Math.max(0, Math.min(12, Number(partial.borderWidth) || 0));
    }

    active.data = {
      ...tableData,
      role: "table",
    };

    const children = active.getObjects?.() || active._objects || [];
    children.forEach((child: any) => {
      if (String(child?.data?.role || "") !== "table-cell-rect") return;
      child.set({
        stroke: tableData.border.color,
        strokeWidth: tableData.border.width,
      });
      child.setCoords?.();
    });

    setTableProps({
      borderColor: toHexColor(tableData.border.color, "#111827"),
      borderWidth: Number(tableData.border.width ?? 1),
    });
    const nextSnapshot = active.toObject ? active.toObject() : active;
    setActiveObjectSnapshot(nextSnapshot);
    c.requestRenderAll();
    pushHistory("table:update");
  }, [getCanvas, isTableLike, pushHistory]);

  const getActiveImageObject = useCallback(() => {
    const c = getCanvas();
    if (!c) return null;
    const active: any = c.getActiveObject();
    if (!active) return null;
    return String(active.type || "").toLowerCase() === "image" ? active : null;
  }, [getCanvas]);

  const replaceImageSource = useCallback(
    async (image: any, src: string) => {
      const c = getCanvas();
      if (!c || !image || !src) return false;
      const renderedW = (Number(image.width) || 1) * (Number(image.scaleX) || 1);
      const renderedH = (Number(image.height) || 1) * (Number(image.scaleY) || 1);
      const loaded = await FabricImage.fromURL(src, { crossOrigin: "anonymous" } as any);
      const element = loaded?.getElement?.() || (loaded as any)?._element;
      if (!element) return false;
      image.setElement?.(element);
      image.set({
        width: loaded.width || image.width || 1,
        height: loaded.height || image.height || 1,
        cropX: 0,
        cropY: 0,
      });
      const nextW = Number(image.width) || 1;
      const nextH = Number(image.height) || 1;
      image.set({
        scaleX: renderedW / nextW,
        scaleY: renderedH / nextH,
      });
      image.setCoords?.();
      c.requestRenderAll();
      return true;
    },
    [getCanvas]
  );

  const updateImageAdjustments = useCallback(
    (partial: Partial<ImageAdjustments>, opts?: { commit?: boolean }) => {
      const c = getCanvas();
      if (!c) return;
      const image = getActiveImageObject();
      if (!image) return;
      const prev = getImageAdjustmentsFromObject(image);
      const next: ImageAdjustments = {
        brightness: Math.max(-1, Math.min(1, Number(partial.brightness ?? prev.brightness))),
        contrast: Math.max(-1, Math.min(1, Number(partial.contrast ?? prev.contrast))),
        saturation: Math.max(-1, Math.min(1, Number(partial.saturation ?? prev.saturation))),
        blur: Math.max(0, Math.min(1, Number(partial.blur ?? prev.blur))),
        sharpen: Math.max(0, Math.min(1, Number(partial.sharpen ?? prev.sharpen))),
      };
      image.data = {
        ...(image.data || {}),
        imageAdjustments: next,
      };
      applyImageFilters(image, next);
      image.setCoords?.();
      c.requestRenderAll();
      hydrateImageUiFromActiveObject(image);
      const nextSnapshot = image.toObject ? image.toObject() : image;
      setActiveObjectSnapshot(nextSnapshot);
      if (opts?.commit) {
        pushHistory("object:update");
      }
    },
    [
      applyImageFilters,
      getActiveImageObject,
      getCanvas,
      getImageAdjustmentsFromObject,
      hydrateImageUiFromActiveObject,
      pushHistory,
    ]
  );

  const resetImageAdjustments = useCallback(() => {
    updateImageAdjustments({ ...DEFAULT_IMAGE_ADJUSTMENTS }, { commit: true });
  }, [updateImageAdjustments]);

  const normalizeCropRectScale = useCallback((cropRect: any) => {
    const scaleX = Number(cropRect.scaleX || 1);
    const scaleY = Number(cropRect.scaleY || 1);
    if (Math.abs(scaleX - 1) < 0.0001 && Math.abs(scaleY - 1) < 0.0001) return;
    cropRect.set({
      width: Math.max(1, Number(cropRect.width || 1) * scaleX),
      height: Math.max(1, Number(cropRect.height || 1) * scaleY),
      scaleX: 1,
      scaleY: 1,
    });
  }, []);

  const updateCropDimRects = useCallback(
    (
      cropRect: any,
      dimTop: any,
      dimBottom: any,
      dimLeft: any,
      dimRight: any
    ) => {
      const { w: pageW, h: pageH } = pageSizePxRef.current;
      const left = Math.max(0, Number(cropRect.left || 0));
      const top = Math.max(0, Number(cropRect.top || 0));
      const width = Math.max(1, Number(cropRect.width || 1));
      const height = Math.max(1, Number(cropRect.height || 1));
      const right = Math.min(pageW, left + width);
      const bottom = Math.min(pageH, top + height);

      dimTop.set({
        left: 0,
        top: 0,
        width: pageW,
        height: Math.max(0, top),
      });
      dimBottom.set({
        left: 0,
        top: Math.max(0, bottom),
        width: pageW,
        height: Math.max(0, pageH - bottom),
      });
      dimLeft.set({
        left: 0,
        top: Math.max(0, top),
        width: Math.max(0, left),
        height: Math.max(0, bottom - top),
      });
      dimRight.set({
        left: Math.max(0, right),
        top: Math.max(0, top),
        width: Math.max(0, pageW - right),
        height: Math.max(0, bottom - top),
      });
    },
    []
  );

  const clampCropRectToImageBounds = useCallback(
    (cropRect: any, image: any) => {
      const imageRect = image.getBoundingRect?.(true, true);
      if (!imageRect) return;
      normalizeCropRectScale(cropRect);
      const minSize = 8;
      const maxW = Math.max(minSize, Number(imageRect.width || minSize));
      const maxH = Math.max(minSize, Number(imageRect.height || minSize));

      let width = Math.max(minSize, Number(cropRect.width || minSize));
      let height = Math.max(minSize, Number(cropRect.height || minSize));
      width = Math.min(width, maxW);
      height = Math.min(height, maxH);

      let left = Number(cropRect.left || imageRect.left);
      let top = Number(cropRect.top || imageRect.top);
      left = Math.max(imageRect.left, Math.min(left, imageRect.left + imageRect.width - width));
      top = Math.max(imageRect.top, Math.min(top, imageRect.top + imageRect.height - height));

      cropRect.set({
        left,
        top,
        width,
        height,
        scaleX: 1,
        scaleY: 1,
      });
      cropRect.setCoords?.();
    },
    [normalizeCropRectScale]
  );

  const beginImageCrop = useCallback(() => {
    const c = getCanvas();
    if (!c || imageCropStateRef.current) return;
    const image = getActiveImageObject();
    if (!image) return;
    const imageRect = image.getBoundingRect?.(true, true);
    if (!imageRect) return;
    const makeDim = () =>
      new Rect({
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        fill: "rgba(15,23,42,0.18)",
        selectable: false,
        evented: false,
        excludeFromExport: true,
      }) as any;
    const dimTop = makeDim();
    const dimBottom = makeDim();
    const dimLeft = makeDim();
    const dimRight = makeDim();
    dimTop.role = "image-crop-dim";
    dimBottom.role = "image-crop-dim";
    dimLeft.role = "image-crop-dim";
    dimRight.role = "image-crop-dim";

    const cropRect = new Rect({
      left: imageRect.left,
      top: imageRect.top,
      width: imageRect.width,
      height: imageRect.height,
      fill: "rgba(59,130,246,0.06)",
      stroke: "#2563eb",
      strokeDashArray: [8, 6],
      strokeWidth: 2,
      hasRotatingPoint: false,
      lockRotation: true,
      transparentCorners: false,
      cornerColor: "#2563eb",
      cornerStrokeColor: "#ffffff",
      borderColor: "#2563eb",
      cornerSize: 10,
      originX: "left",
      originY: "top",
    }) as any;
    cropRect.role = "image-crop-rect";

    const syncCropUi = () => {
      clampCropRectToImageBounds(cropRect, image);
      updateCropDimRects(cropRect, dimTop, dimBottom, dimLeft, dimRight);
      c.requestRenderAll();
    };

    const handlers = {
      moving: syncCropUi,
      scaling: syncCropUi,
      modified: syncCropUi,
    };
    cropRect.on("moving", handlers.moving);
    cropRect.on("scaling", handlers.scaling);
    cropRect.on("modified", handlers.modified);

    isApplyingRef.current = true;
    try {
      c.add(dimTop);
      c.add(dimBottom);
      c.add(dimLeft);
      c.add(dimRight);
      c.add(cropRect);
      c.setActiveObject(cropRect);
      syncCropUi();
      cropRect.moveTo?.(Math.max(0, c.getObjects().length - 1));
    } finally {
      isApplyingRef.current = false;
    }

    imageCropStateRef.current = {
      image,
      baseCropX: Math.max(0, Number(image.cropX || 0)),
      baseCropY: Math.max(0, Number(image.cropY || 0)),
      dimTop,
      dimBottom,
      dimLeft,
      dimRight,
      cropRect,
      handlers,
    };
    setImageProps((prev) => ({ ...prev, isCropping: true }));
    c.requestRenderAll();
  }, [clampCropRectToImageBounds, getActiveImageObject, getCanvas, updateCropDimRects]);

  const cancelImageCrop = useCallback(() => {
    const c = getCanvas();
    const state = imageCropStateRef.current;
    if (!c || !state) return;
    const { cropRect, dimTop, dimBottom, dimLeft, dimRight, image, handlers } = state;
    cropRect.off("moving", handlers.moving);
    cropRect.off("scaling", handlers.scaling);
    cropRect.off("modified", handlers.modified);
    isApplyingRef.current = true;
    try {
      c.remove(dimTop);
      c.remove(dimBottom);
      c.remove(dimLeft);
      c.remove(dimRight);
      c.remove(cropRect);
      c.setActiveObject(image);
    } finally {
      isApplyingRef.current = false;
    }
    imageCropStateRef.current = null;
    setImageProps((prev) => ({ ...prev, isCropping: false }));
    c.requestRenderAll();
    hydrateImageUiFromActiveObject(image);
  }, [getCanvas, hydrateImageUiFromActiveObject]);

  const applyImageCrop = useCallback(() => {
    const c = getCanvas();
    const state = imageCropStateRef.current;
    if (!c || !state) return;
    const { image, cropRect, dimTop, dimBottom, dimLeft, dimRight, handlers, baseCropX, baseCropY } =
      state;

    cropRect.off("moving", handlers.moving);
    cropRect.off("scaling", handlers.scaling);
    cropRect.off("modified", handlers.modified);
    clampCropRectToImageBounds(cropRect, image);

    const left = Number(cropRect.left || 0);
    const top = Number(cropRect.top || 0);
    const width = Math.max(1, Number(cropRect.width || 1));
    const height = Math.max(1, Number(cropRect.height || 1));
    const pointA = new (FabricNS as any).Point(left, top);
    const pointB = new (FabricNS as any).Point(left + width, top + height);
    const localA = image.toLocalPoint?.(pointA, "center", "center");
    const localB = image.toLocalPoint?.(pointB, "center", "center");
    if (!localA || !localB) {
      cancelImageCrop();
      return;
    }

    const sourceW = Math.max(1, Number(image.width || 1));
    const sourceH = Math.max(1, Number(image.height || 1));
    const localLeft = Math.max(0, Math.min(sourceW, Math.min(localA.x, localB.x) + sourceW / 2));
    const localRight = Math.max(0, Math.min(sourceW, Math.max(localA.x, localB.x) + sourceW / 2));
    const localTop = Math.max(0, Math.min(sourceH, Math.min(localA.y, localB.y) + sourceH / 2));
    const localBottom = Math.max(0, Math.min(sourceH, Math.max(localA.y, localB.y) + sourceH / 2));
    const nextWidth = Math.max(1, localRight - localLeft);
    const nextHeight = Math.max(1, localBottom - localTop);
    const renderedWidth = sourceW * Math.max(0.0001, Number(image.scaleX || 1));
    const renderedHeight = sourceH * Math.max(0.0001, Number(image.scaleY || 1));

    image.set({
      cropX: Math.max(0, baseCropX + localLeft),
      cropY: Math.max(0, baseCropY + localTop),
      width: nextWidth,
      height: nextHeight,
      scaleX: renderedWidth / nextWidth,
      scaleY: renderedHeight / nextHeight,
      left: left + width / 2,
      top: top + height / 2,
      originX: "center",
      originY: "center",
    });
    image.setCoords?.();

    isApplyingRef.current = true;
    try {
      c.remove(dimTop);
      c.remove(dimBottom);
      c.remove(dimLeft);
      c.remove(dimRight);
      c.remove(cropRect);
      c.setActiveObject(image);
    } finally {
      isApplyingRef.current = false;
    }
    imageCropStateRef.current = null;
    setImageProps((prev) => ({ ...prev, isCropping: false }));
    c.requestRenderAll();
    hydrateImageUiFromActiveObject(image);
    pushHistory("object:update");
  }, [cancelImageCrop, clampCropRectToImageBounds, getCanvas, hydrateImageUiFromActiveObject, pushHistory]);

  const deleteSelected = useCallback(() => {
    const c = getCanvas();
    if (!c) return;
    const active = c.getActiveObject() as any;
    if (!active) return;

    // MULTI-SELECTION
    if (isActiveSelectionLike(active)) {
      const objects = [...(active.getObjects?.() || active._objects || [])];
      if (!objects.length) return;

      isInternalMutationRef.current = true;
      try {
        c.discardActiveObject();
        c.remove(...objects);
        c.requestRenderAll();
      } finally {
        isInternalMutationRef.current = false;
      }

      syncSelectionKind();
      updateSelectionRef.current?.();
      updateLayers();
      pushHistory("object:removed");
      return;
    }

    // GROUP
    if (isGroupLike(active)) {
      isInternalMutationRef.current = true;
      try {
        c.discardActiveObject();
        c.remove(active);
        c.requestRenderAll();
      } finally {
        isInternalMutationRef.current = false;
      }

      syncSelectionKind();
      updateSelectionRef.current?.();
      updateLayers();
      pushHistory("object:removed");
      return;
    }

    // SINGLE OBJECT
    isInternalMutationRef.current = true;
    try {
      c.discardActiveObject();
      c.remove(active);
      c.requestRenderAll();
    } finally {
      isInternalMutationRef.current = false;
    }

    syncSelectionKind();
    updateSelectionRef.current?.();
    updateLayers();
    pushHistory("object:removed");
  }, [getCanvas, pushHistory, syncSelectionKind, updateLayers]);

  const groupSelected = useCallback(() => {
    const c = getCanvas();
    if (!c) return;

    const active = c.getActiveObject() as any;
    if (!isActiveSelectionLike(active)) return;
    const objects = [...(active.getObjects?.() || active._objects || [])];
    if (!objects.length) return;

    isInternalMutationRef.current = true;
    try {
      c.discardActiveObject();
      c.remove(...objects);

      const group = new Group(objects);
      c.add(group);
      c.setActiveObject(group);
      c.requestRenderAll();
    } finally {
      isInternalMutationRef.current = false;
    }

    syncSelectionKind();
    updateSelectionRef.current?.();
    updateLayers();
    pushHistory("object:grouped");
  }, [getCanvas, pushHistory, syncSelectionKind, updateLayers]);

  const ungroupSelected = useCallback(() => {
    const c = getCanvas();
    if (!c) return;

    const active = c.getActiveObject() as any;
    if (!active || !isGroupLike(active)) return;
    if (isImageFrame(active)) return;

    isInternalMutationRef.current = true;
    try {
      c.discardActiveObject();
      c.remove(active);

      const children = active.removeAll?.() || active.getObjects?.() || active._objects || [];
      if (children.length) {
        c.add(...children);
        const selection = new ActiveSelection(children, { canvas: c } as any);
        c.setActiveObject(selection);
      }

      c.requestRenderAll();
    } finally {
      isInternalMutationRef.current = false;
    }

    syncSelectionKind();
    updateSelectionRef.current?.();
    updateLayers();
    pushHistory("object:ungrouped");
  }, [getCanvas, pushHistory, syncSelectionKind, updateLayers]);

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
    const pasteOffset = 40;
    const cloneFabricObject = async (obj: any) => {
      if (!obj?.clone) return null;
      try {
        return await obj.clone();
      } catch {
        return await new Promise<any>((resolve) => {
          obj.clone((clonedObj: any) => resolve(clonedObj));
        });
      }
    };
    const setCoordsDeep = (obj: any) => {
      obj?.setCoords?.();
      if (isGroupLike(obj) || isActiveSelectionLike(obj)) {
        const children = obj.getObjects?.() || obj._objects || [];
        children.forEach((child: any) => setCoordsDeep(child));
      }
    };
    const getObjectCenter = (obj: any) => {
      const bounds = obj?.getBoundingRect?.(true, true);
      if (!bounds) {
        return {
          x: Number(obj?.left || 0),
          y: Number(obj?.top || 0),
        };
      }
      return {
        x: Number(bounds.left || 0) + Number(bounds.width || 0) / 2,
        y: Number(bounds.top || 0) + Number(bounds.height || 0) / 2,
      };
    };
    if (isActiveSelectionLike(src)) {
      const sourceObjects = src.getObjects?.() || src._objects || [];
      if (!Array.isArray(sourceObjects) || sourceObjects.length === 0) return;
      const clonedChildrenRaw = await Promise.all(
        sourceObjects.map((obj: any) => cloneFabricObject(obj))
      );
      const clonedChildren = clonedChildrenRaw.filter(Boolean);
      if (!clonedChildren.length) return;
      const tempSelection = new ActiveSelection(clonedChildren, { canvas: c } as any);
      setCoordsDeep(tempSelection);
      const sourceCenter = getObjectCenter(src);
      const cloneCenter = getObjectCenter(tempSelection);
      const deltaX = sourceCenter.x + pasteOffset - cloneCenter.x;
      const deltaY = sourceCenter.y + pasteOffset - cloneCenter.y;
      const now = Date.now();
      isInternalMutationRef.current = true;
      try {
        clonedChildren.forEach((child: any, index: number) => {
          child.set({
            left: Number(child.left || 0) + deltaX,
            top: Number(child.top || 0) + deltaY,
          });
          child.uid = `obj_${now}_${index}`;
          setCoordsDeep(child);
        });
        c.add(...clonedChildren);
        const selection = new ActiveSelection(clonedChildren, { canvas: c } as any);
        setCoordsDeep(selection);
        c.setActiveObject(selection);
      } finally {
        isInternalMutationRef.current = false;
      }
      c.requestRenderAll();
      syncSelectionKind();
      updateSelectionRef.current?.();
      updateLayers();
      pushHistory("paste");
      return;
    }

    const cloned = await cloneFabricObject(src);
    if (!cloned) return;
    setCoordsDeep(cloned);
    const sourceCenter = getObjectCenter(src);
    const cloneCenter = getObjectCenter(cloned);
    const deltaX = sourceCenter.x + pasteOffset - cloneCenter.x;
    const deltaY = sourceCenter.y + pasteOffset - cloneCenter.y;
    const now = Date.now();
    cloned.set({
      left: Number(cloned.left || 0) + deltaX,
      top: Number(cloned.top || 0) + deltaY,
    });
    cloned.uid = `obj_${now}`;
    setCoordsDeep(cloned);
    isInternalMutationRef.current = true;
    try {
      c.add(cloned);
      c.setActiveObject(cloned);
    } finally {
      isInternalMutationRef.current = false;
    }
    c.requestRenderAll();
    syncSelectionKind();
    updateSelectionRef.current?.();
    updateLayers();
    pushHistory("paste");
  }, [getCanvas, pushHistory, syncSelectionKind, updateLayers]);

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
      if (isActiveSelectionLike(obj)) {
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

  const applyTemplateToCurrentPage = useCallback(
    async (templateId: string) => {
      try {
        const template = getSystemTemplateById(templateId);
        if (!template) {
          console.error("Template not found:", templateId);
          return;
        }

        const snapshot = await template.load();
        if (!snapshot) return;

        await applySnapshotRef.current(snapshot, "template-loaded");

        undoRef.current = [snapshot];
        redoRef.current = [];
        updateLayersRef.current();
      } catch (err: any) {
        const msg = String(err?.message || "").toLowerCase();
        if (err?.name === "AbortError" || msg.includes("aborted")) return;
        console.error("[editor] template apply failed", err);
      }
    },
    []
  );
  
  const addImageFrameRef = useRef(addImageFrame);
  addImageFrameRef.current = addImageFrame;

  useEffect(() => {
    if (typeof window === "undefined") return;

    (window as any).editor = {
      addImageFrame: (type: "square" | "circle") =>
        addImageFrameRef.current(type),
    };
  }, []);

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
    selectionKind,
    canGroup: selectionKind === "multi",
    canUngroup: selectionKind === "group",
    canDelete: selectionKind !== "none",
    selectedFrameHasImage,
    activeObjectType,
    activeObjectSnapshot,
    textProps,
    shapeProps,
    imageProps,
    tableProps,
    activeDrawTool,
    pencilColor,
    pencilThickness,
    highlighterColor,
    highlighterThickness,
    eraserSize,
    layers,
    selectedLayerId,
    hasSelection,
    docId: cloudDocId,
    docTitle,
    docCreatedAt,
    autosaveStatus,
    loadError,
    isDocDataReady,
    getCanvasJson,
    getPagesJsonForSave,
    saveToCloud,
    addText,
    addTable,
    addShape,
    addRect,
    addCircle,
    addLine,
    addImage,
    addImageFromUrl,
    addGraphicFromUrl,
    addQrCode,
    addImageFrame,
    applyTemplateToCurrentPage,
    setDrawTool,
    updateBrushConfig,
    setPencilColor: setPencilColorValue,
    setPencilThickness: setPencilThicknessValue,
    setHighlighterColor: setHighlighterColorValue,
    setHighlighterThickness: setHighlighterThicknessValue,
    setEraserSize: setEraserSizeValue,
    setTextProp,
    setShapeProp,
    setTableProp,
    updateActiveObject,
    updateActiveObjectLive,
    commitActiveObjectUpdate,
    updateImageAdjustments,
    resetImageAdjustments,
    beginImageCrop,
    cancelImageCrop,
    applyImageCrop,
    toggleUppercase,
    toggleBulletList,
    toggleNumberedList,
    deleteSelected,
    groupSelected,
    ungroupSelected,
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
