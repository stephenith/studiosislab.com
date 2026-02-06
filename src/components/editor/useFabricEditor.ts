"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Canvas,
  Circle,
  Line,
  Rect,
  Textbox,
  Group,
  Image as FabricImage,
} from "fabric";
import { jsPDF } from "jspdf";
import { TEMPLATE_SNAPSHOTS } from "@/data/templates";

type EditorMode = "new" | "template";
type PageSize = "A4" | "Letter" | "Custom";

type SelectionType = "none" | "text" | "shape" | "image";

type TextProps = {
  fontFamily: string;
  fontSize: number;
  fill: string;
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  underline: boolean;
  textAlign: "left" | "center" | "right" | "justify";
  lineHeight: number;
};

type ShapeProps = {
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  cornerRadius: number;
};

type ImageProps = {
  opacity: number;
};

type LayerItem = {
  id: string;
  type: string;
  visible: boolean;
  locked: boolean;
  name: string;
  index: number;
};

const CANVAS_BG = "#f3f4f6";

const PAGE_SIZES: Record<PageSize, { w: number; h: number }> = {
  A4: { w: 2480, h: 3508 },
  Letter: { w: 2550, h: 3300 },
  Custom: { w: 2480, h: 3508 }, // default fallback (same as A4)
};

export function useFabricEditor({
  mode,
  initialTemplateId,
}: {
  mode: EditorMode;
  initialTemplateId?: string | null;
}) {
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const gridGroupRef = useRef<any>(null);
  const gridMetaRef = useRef<{ pageSize: PageSize } | null>(null);
  const lastAppliedTemplateRef = useRef<string | null>(null);

  const undoRef = useRef<any[]>([]);
  const redoRef = useRef<any[]>([]);
  const isApplyingRef = useRef(false);
  const didInitialFitRef = useRef(false);
  const fitRafRef = useRef<number | null>(null);
  const retryRef = useRef(0);
  const zoomModeRef = useRef<"fitWidth" | "manual">("fitWidth");
  const lastViewportRef = useRef<{ w: number; h: number } | null>(null);

  const clipboardRef = useRef<any>(null);

  const [zoom, setZoomState] = useState(1);
  const fitZoomRef = useRef(1);
  const userZoomRef = useRef(1);
  const [pageSize, setPageSize] = useState<PageSize>("A4");
  const [pageSizePx, setPageSizePxState] = useState<{ w: number; h: number }>(
    PAGE_SIZES.A4
  );
  const pageSizePxRef = useRef(pageSizePx);
  const [bgColor, setBgColor] = useState("#ffffff");
  const [gridEnabled, setGridEnabled] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);

  const [selectionType, setSelectionType] = useState<SelectionType>("none");
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

  const bgColorRef = useRef(bgColor);
  const getCanvas = useCallback(() => canvasRef.current, []);

  function getViewportEl(): HTMLElement | null {
    if (typeof document !== "undefined") {
      const el = document.querySelector('[data-editor-viewport="1"]') as HTMLElement | null;
      if (el) return el;
    }
    const canvasEl = canvasElRef.current;
    if (canvasEl) {
      const fallback =
        (canvasEl.closest?.('[data-editor-viewport="1"]') as HTMLElement | null) ||
        (canvasEl.parentElement as HTMLElement | null);
      if (fallback) return fallback;
    }
    return null;
  }

  function getViewportRect(): DOMRect | null {
    const el = getViewportEl();
    if (!el) return null;
    const w = Math.floor(el.clientWidth);
    const h = Math.floor(el.clientHeight);
    if (w < 200 || h < 200) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[fit] skipped small viewport", { w, h });
      }
      return null;
    }
    return new DOMRect(0, 0, w, h);
  }

  const getZoom = useCallback(() => {
    const c = canvasRef.current;
    const z = c?.getZoom?.();
    if (typeof z === "number" && Number.isFinite(z)) return z;
    return typeof zoom === "number" && Number.isFinite(zoom) ? zoom : 1;
  }, [zoom]);
  const getZoomPercent = useCallback(() => Math.round(getZoom() * 100), [getZoom]);
  const clampEffectiveZoom = useCallback((z: number) => {
    if (!Number.isFinite(z)) return 1;
    return Math.max(0.05, Math.min(4, z));
  }, []);

  const clamp = useCallback((v: number, lo: number, hi: number) => {
    return Math.min(hi, Math.max(lo, v));
  }, []);

  const findPageObject = useCallback(
    (c: Canvas, pageW?: number, pageH?: number) => {
      const objs = c.getObjects?.() || [];
      const direct = objs.find(
        (o: any) => o?.role === "page" || o?.name === "page-bg" || o?.data?.kind === "page-bg"
      );
      if (direct) return direct as any;
      const approxMatch = objs.find((o: any) => {
        if (o?.type !== "rect") return false;
        if (o?.left !== 0 || o?.top !== 0) return false;
        const w = o.getScaledWidth?.() ?? o.width ?? 0;
        const h = o.getScaledHeight?.() ?? o.height ?? 0;
        if (pageW && pageH) {
          return Math.abs(w - pageW) < 2 && Math.abs(h - pageH) < 2;
        }
        return w > 0 && h > 0;
      });
      return (approxMatch as any) || null;
    },
    []
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

  const applyEffectiveZoom = useCallback(
    (effectiveZoom: number, rect: DOMRect, pageW: number, pageH: number) => {
      const c = canvasRef.current;
      if (!c) return;
      const z = clampEffectiveZoom(effectiveZoom);
      applyViewportTransform({
        zoom: z,
        rectW: rect.width,
        rectH: rect.height,
        pageW,
        pageH,
      });
      setZoomState(c.getZoom?.() ?? z);
    },
    [clamp, clampEffectiveZoom]
  );

  const setZoom = useCallback(
    (next: number) => {
      const c = canvasRef.current;
      const z = clampEffectiveZoom(next);
      didInitialFitRef.current = true;
      zoomModeRef.current = "manual";
      const rect = getViewportRect();
      const size = getPageSizeForFit();
      if (!c || !rect) {
        setZoomState(z);
        return;
      }
      applyEffectiveZoom(z, rect, size.w, size.h);
    },
    [applyEffectiveZoom, clampEffectiveZoom, getPageSizeForFit]
  );

  const setZoomPercent = useCallback(
    (p: number) => {
      const z = clampEffectiveZoom(p / 100);
      setZoom(z);
    },
    [clampEffectiveZoom, setZoom]
  );
  const ensureObjectId = useCallback(
    (obj: any) => {
      if (!obj) return null;
      if (!obj.id) {
        const generated =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : String(Date.now() + Math.random());
        obj.id = generated;
      }
      if (!obj.data) obj.data = {};
      obj.data.id = obj.id;
      obj.uid = obj.id;
      return obj.id;
    },
    []
  );

  const serialize = useCallback(() => {
    const c = getCanvas();
    if (!c) return { objects: [] };
    const full = c.toDatalessJSON(["excludeFromExport", "selectable", "evented", "role"]);
    const objects = (full.objects || []).filter((o: any) => o.role !== "grid");
    return { objects };
  }, []);

  const normalizeToFabricJson = useCallback((snap: any) => {
    if (!snap) return { objects: [] };
    if (typeof snap === "string") {
      try {
        const parsed = JSON.parse(snap);
        return normalizeToFabricJson(parsed);
      } catch {
        return { objects: [] };
      }
    }
    if (snap?.canvas) return normalizeToFabricJson(snap.canvas);
    if (Array.isArray(snap?.objects)) {
      return snap;
    }
    return { objects: [] };
  }, []);

  const pushHistory = useCallback((reason: string) => {
    const c = getCanvas();
    if (!c || isApplyingRef.current) return;
    const snap = serialize();
    const last = undoRef.current[undoRef.current.length - 1];
    if (last && JSON.stringify(last) === JSON.stringify(snap)) return;
    undoRef.current.push(snap);
    redoRef.current = [];
  }, [serialize]);

  const applyPageBackground = useCallback((color: string) => {
    const c = getCanvas();
    if (!c) return;

    const page = findPageObject(c) as any;
    if (page && page.set) {
      page.set({ fill: color });
      if (page.moveTo) page.moveTo(0);
    } else {
      c.set({ backgroundColor: CANVAS_BG });
    }

    c.requestRenderAll();
  }, [findPageObject, getCanvas]);

  const ensurePageBackground = useCallback(
    (pageW: number, pageH: number) => {
      const c = getCanvas();
      if (!c) return;

      c.set({ backgroundColor: CANVAS_BG });

      const existing = findPageObject(c, pageW, pageH) as any;

      const baseProps = {
        width: pageW,
        height: pageH,
        left: 0,
        top: 0,
        fill: bgColorRef.current || "#ffffff",
        stroke: "#e5e7eb",
        shadow: {
          color: "rgba(0,0,0,0.10)",
          blur: 18,
          offsetX: 0,
          offsetY: 8,
        },
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false,
        lockMovementX: true,
        lockMovementY: true,
        lockScalingX: true,
        lockScalingY: true,
        lockRotation: true,
      } as const;

      let pageObj = existing;
      if (pageObj && pageObj.set) {
        pageObj.set(baseProps);
      } else {
        pageObj = new Rect(baseProps) as any;
        c.add(pageObj);
      }

      pageObj.role = "page";
      pageObj.name = "page-bg";
      if (!pageObj.data) pageObj.data = {};
      pageObj.data.system = true;
      pageObj.data.kind = "page-bg";
      pageObj.setCoords?.();
      pageObj.moveTo?.(0);
      c.requestRenderAll();
    },
    [findPageObject, getCanvas]
  );

  const setPageBackground = useCallback(
    (color: string) => {
      setBgColor(color);
      applyPageBackground(color);
    },
    [applyPageBackground]
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
    setZoomState(c.getZoom?.() ?? z);
  }

  const fitViewport = useCallback(
    (mode: "page" | "width", reason: string = "fit") => {
      const c = canvasRef.current;
      if (!c) return;
      if (zoomModeRef.current !== "fitWidth") return;
      const rect = getViewportRect();
      if (!rect) return;
      const size = getPageSizeForFit();
      const pageW = size.w;
      const pageH = size.h;
      const padding = 24;
      const widthScale = (rect.width - padding * 2) / pageW;
      const heightScale = (rect.height - padding * 2) / pageH;
      const fitScale = mode === "width" ? widthScale : Math.min(widthScale, heightScale);
      const fit = clampEffectiveZoom(fitScale);
      fitZoomRef.current = fit;
      const effective = fit;
      applyEffectiveZoom(effective, rect, pageW, pageH);
      if (process.env.NODE_ENV === "development") {
        console.debug("[fit]", {
          reason,
          rectW: rect.width,
          rectH: rect.height,
          fitZoom: fit,
          effectiveZoom: effective,
        });
      }
    },
    [applyEffectiveZoom, clampEffectiveZoom, getPageSizeForFit]
  );

  const scheduleFit = useCallback(
    (mode: "page" | "width", reason: string, resetUserZoom: boolean = false) => {
      if (fitRafRef.current) cancelAnimationFrame(fitRafRef.current);
      fitRafRef.current = requestAnimationFrame(() => {
        const rect = getViewportRect();
        if (rect) {
          const prev = lastViewportRef.current;
          const next = { w: Math.round(rect.width), h: Math.round(rect.height) };
          if (prev && prev.w === next.w && prev.h === next.h) {
            return;
          }
          lastViewportRef.current = next;
          if (process.env.NODE_ENV === "development") {
            const el = getViewportEl();
            const styleHeight =
              el && typeof window !== "undefined" ? window.getComputedStyle(el).height : "n/a";
            console.debug("[fit] viewport", {
              width: rect.width,
              height: rect.height,
              styleHeight,
            });
          }
        }
        if (!rect) {
          if (retryRef.current < 30) {
            retryRef.current += 1;
            scheduleFit(mode, `${reason}:retry`, resetUserZoom);
          }
          return;
        }
        retryRef.current = 0;
        if (resetUserZoom) {
          userZoomRef.current = 1;
          zoomModeRef.current = "fitWidth";
        }
        fitViewport(mode, reason);
      });
    },
    [fitViewport]
  );

  const scheduleFitAfterLayout = useCallback(
    (mode: "page" | "width", reason: string, resetUserZoom: boolean = false) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scheduleFit(mode, reason, resetUserZoom);
        });
      });
    },
    [scheduleFit]
  );

  const fitToViewport = useCallback(
    (mode: "page" | "width" = "width", reason: string = "fitToViewport") => {
      zoomModeRef.current = "fitWidth";
      scheduleFit(mode, reason, true);
    },
    [scheduleFit]
  );

  const applySnapshot = useCallback(async (snap: any) => {
    const c = getCanvas();
    if (!c) return;
    isApplyingRef.current = true;
    const json = normalizeToFabricJson(snap);
    if (!json || !Array.isArray((json as any).objects)) {
      console.error("[editor] Invalid template JSON, expected {objects: []}", snap);
      isApplyingRef.current = false;
      return;
    }
    didInitialFitRef.current = false;
    const enforceBackgroundSafety = () => {
      c.getObjects().forEach((o: any) => {
        if (o?.role === "background") {
          o.selectable = false;
          o.evented = false;
          o.lockMovementX = true;
          o.lockMovementY = true;
          o.lockScalingX = true;
          o.lockScalingY = true;
          o.lockRotation = true;
          if (o.moveTo) o.moveTo(0);
        }
      });
    };
    c.setViewportTransform([1, 0, 0, 1, 0, 0]);
    c.requestRenderAll();
    c.clear();
    const finalize = () => {
      c.getObjects().forEach((o: any) => {
        ensureObjectId(o);
      });
      ensurePageBackground(c.getWidth(), c.getHeight());
      applyPageBackground(bgColorRef.current);
      enforceBackgroundSafety();
      c.getObjects().forEach((o: any) => {
        if (o?.role === "grid") {
          o.excludeFromExport = true;
        }
      });
      const count = c.getObjects().length;
      if (count > 0 && !didInitialFitRef.current) {
        lastViewportRef.current = null;
        scheduleFitAfterLayout("width", "template-loaded", true);
        if (process.env.NODE_ENV !== "production") {
          console.debug("[viewport]", { zoom: c.getZoom?.(), vt: c.viewportTransform });
        }
      }
      c.requestRenderAll();
    };
    let finalized = false;
    try {
      const result = (c as any).loadFromJSON(json, () => {
        if (finalized) return;
        finalized = true;
        finalize();
      });
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
  }, [applyPageBackground, ensureObjectId, ensurePageBackground, getCanvas, initialTemplateId, mode, normalizeToFabricJson, pageSize, pageSizePx, scheduleFitAfterLayout]);

  const getLayerObjects = useCallback(() => {
    const c = getCanvas();
    if (!c) return { pageObj: null, gridObj: null, normalObjs: [] as any[] };
    const objs = c.getObjects();
    const pageObj = objs.find((o: any) => o?.role === "page") || null;
    const gridObj = objs.find((o: any) => o?.role === "grid") || null;
    const normalObjs = objs.filter((o: any) => o?.role !== "grid" && o?.role !== "page");
    return { pageObj, gridObj, normalObjs };
  }, [getCanvas]);

  const updateLayers = useCallback(() => {
    const { normalObjs } = getLayerObjects();
    const items = normalObjs
      .map((o: any, idx: number) => ({
        id: ensureObjectId(o) || `__idx_${idx}`,
        type: o.type || "object",
        visible: o.visible !== false,
        locked: !!o.lockMovementX || !!o.lockMovementY || o.selectable === false,
        name: o.text || o.type || `Layer ${idx + 1}`,
        index: idx,
      }))
      .reverse();
    setLayers(items);
  }, [ensureObjectId, getLayerObjects]);

  const updateSelection = useCallback(() => {
    const c = getCanvas();
    if (!c) return;
    const active: any = c.getActiveObject();
    if (!active || active.type === "activeSelection") {
      if (active?.type === "activeSelection") {
        const objs = active.getObjects?.() || active._objects || [];
        const target = objs[0];
        setSelectedLayerId(ensureObjectId(target));
      } else {
        setSelectedLayerId(null);
      }
      setSelectionType("none");
      setActiveObjectType(null);
      setActiveObjectSnapshot(null);
      return;
    }
    const type = String(active.type || "").toLowerCase();
    setActiveObjectType(type);
    setActiveObjectSnapshot(active.toObject ? active.toObject() : active);
    setSelectedLayerId(ensureObjectId(active));
    if (type === "textbox" || type === "i-text" || type === "text") {
      setSelectionType("text");
      setTextProps({
        fontFamily: active.fontFamily || "Poppins",
        fontSize: Math.round(active.fontSize || 32),
        fill: active.fill || "#111827",
        fontWeight: active.fontWeight === "bold" ? "bold" : "normal",
        fontStyle: active.fontStyle === "italic" ? "italic" : "normal",
        underline: !!active.underline,
        textAlign: active.textAlign || "left",
        lineHeight: active.lineHeight || 1.3,
      });
    } else if (type === "image") {
      setSelectionType("image");
      setImageProps({
        opacity: active.opacity ?? 1,
      });
    } else if (type === "rect" || type === "circle" || type === "triangle" || type === "line") {
      setSelectionType("shape");
      setShapeProps({
        fill: active.fill || "rgba(17,24,39,0.1)",
        stroke: active.stroke || "#111827",
        strokeWidth: active.strokeWidth || 2,
        opacity: active.opacity ?? 1,
        cornerRadius: active.rx || 0,
      });
    } else {
      setSelectionType("none");
    }
  }, [ensureObjectId, getCanvas]);

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
      const pageObj = c.getObjects().find((o: any) => o?.role === "page") as any;
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
    const pageObj = c.getObjects().find((o: any) => o?.role === "page") as any;
    if (pageObj && pageObj.moveTo) {
      pageObj.moveTo(0);
      if (group.moveTo) group.moveTo(1);
    } else if (group.moveTo) {
      group.moveTo(0);
    }
    c.requestRenderAll();
  }, [gridEnabled, pageSizePx]);

  const applyCanvasBackground = useCallback((color: string) => {
    const c = getCanvas();
    if (!c) return;
    c.set({ backgroundColor: color });
    c.requestRenderAll();
  }, [getCanvas]);

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

  useEffect(() => {
    if (!canvasElRef.current || canvasRef.current) return;
    const size = PAGE_SIZES[pageSize];
    const c = new Canvas(canvasElRef.current, {
      width: size.w,
      height: size.h,
      backgroundColor: CANVAS_BG,
      selection: true,
      preserveObjectStacking: true,
    } as any);
    canvasRef.current = c;
    if (process.env.NODE_ENV !== "production") {
      (window as any).__canvas = c;
    }
    setCanvasReady(true);
    ensurePageBackground(size.w, size.h);

    const hostEl = getViewportEl();
    const resizeScheduledRef = { current: false };
    const observer = hostEl
      ? new ResizeObserver(() => {
          if (resizeScheduledRef.current) return;
          resizeScheduledRef.current = true;
          requestAnimationFrame(() => {
            resizeScheduledRef.current = false;
            if (zoomModeRef.current === "fitWidth") {
              scheduleFit("width", "resize");
            }
          });
        })
      : null;
    if (hostEl && observer) observer.observe(hostEl);
    const onWinResize = () =>
      requestAnimationFrame(() => {
        if (zoomModeRef.current === "fitWidth") {
          scheduleFit("width", "window-resize");
        }
      });
    window.addEventListener("resize", onWinResize);
        lastViewportRef.current = null;
        scheduleFitAfterLayout("width", "resize-initial", true);

    c.on("selection:created", updateSelection);
    c.on("selection:updated", updateSelection);
    c.on("selection:cleared", () => {
      setSelectedLayerId(null);
      updateSelection();
    });
    c.on("object:modified", () => {
      updateSelection();
      updateLayers();
      pushHistory("modified");
    });
    c.on("object:added", (e: any) => {
      updateLayers();
      if (e?.target?.role === "grid") return;
      if (!isApplyingRef.current) pushHistory("added");
    });
    c.on("object:removed", (e: any) => {
      updateLayers();
      if (e?.target?.role === "grid") return;
      if (!isApplyingRef.current) pushHistory("removed");
    });
    c.on("text:changed", () => {
      updateSelection();
      if (!isApplyingRef.current) pushHistory("text");
    });

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", onWinResize);
      try {
        canvasRef.current?.dispose();
      } catch {}
      canvasRef.current = null;
    };
  }, []);

  useEffect(() => {
    bgColorRef.current = bgColor;
  }, [bgColor]);

  useEffect(() => {
    const c = getCanvas();
    if (!c || !canvasReady) return;
    const templateId = (initialTemplateId || "").toLowerCase().trim();
    const isBlank =
      mode === "new" || !templateId || templateId === "new" || templateId === "blank";
    const appliedId = isBlank ? "blank" : templateId;
    if (lastAppliedTemplateRef.current === appliedId) return;
    lastAppliedTemplateRef.current = appliedId;

    const snapshot = isBlank ? TEMPLATE_SNAPSHOTS.blank : TEMPLATE_SNAPSHOTS[templateId];
    const isMissingTemplate = mode === "template" && !isBlank && !snapshot;
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
    applySnapshot(snapshotForLoad).then(() => {
      undoRef.current = [snapshotForLoad];
      redoRef.current = [];
      updateLayers();
    });
  }, [applySnapshot, canvasReady, getCanvas, initialTemplateId, mode, updateLayers]);

  useEffect(() => {
    if (pageSize !== "Custom") {
      setPageSizePxState(PAGE_SIZES[pageSize]);
    }
  }, [pageSize]);

  useEffect(() => {
    pageSizePxRef.current = pageSizePx;
  }, [pageSizePx]);

  useEffect(() => {
    didInitialFitRef.current = false;
    const c = getCanvas();
    if (!c) return;
    const size = PAGE_SIZES[pageSize];
    c.setDimensions({ width: size.w, height: size.h }, { backstoreOnly: false });
    ensurePageBackground(size.w, size.h);
    lastViewportRef.current = null;
    scheduleFitAfterLayout("width", "pageSize-change", true);
  }, [ensurePageBackground, getCanvas, pageSize, pageSizePx]);

  useEffect(() => {
    const c = getCanvas();
    if (!c) return;
    ensurePageBackground(c.getWidth(), c.getHeight());
    applyPageBackground(bgColor);
    c.getObjects().forEach((o: any) => {
      if (o?.role === "background") {
        o.selectable = false;
        o.evented = false;
        o.lockMovementX = true;
        o.lockMovementY = true;
        o.lockScalingX = true;
        o.lockScalingY = true;
        o.lockRotation = true;
        if (o.moveTo) o.moveTo(0);
      }
    });
    c.requestRenderAll();
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
    const t = new Textbox("Text", {
      left: size.w / 2 - 200,
      top: size.h / 2 - 24,
      width: 400,
      fontSize: 32,
      fontFamily: "Poppins",
      fill: "#111827",
    }) as any;
    const id = ensureObjectId(t);
    t.uid = id;
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
    const r = new Rect({
      left: size.w / 2 - 180,
      top: size.h / 2 - 120,
      width: 360,
      height: 240,
      fill: "rgba(17,24,39,0.1)",
      stroke: "#111827",
      strokeWidth: 2,
      strokeUniform: true,
    }) as any;
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
    const r = new Circle({
      left: size.w / 2 - 120,
      top: size.h / 2 - 120,
      radius: 120,
      fill: "rgba(17,24,39,0.1)",
      stroke: "#111827",
      strokeWidth: 2,
      strokeUniform: true,
    }) as any;
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
    const l = new Line([0, 0, 300, 0], {
      left: size.w / 2 - 150,
      top: size.h / 2,
      stroke: "#111827",
      strokeWidth: 2,
      strokeUniform: true,
    }) as any;
    const id = ensureObjectId(l);
    l.uid = id;
    c.add(l);
    c.setActiveObject(l);
    c.requestRenderAll();
  }, [ensureObjectId, pageSizePx, pushHistory]);

  const addImage = useCallback((file: File) => {
    const c = getCanvas();
    if (!c) return;
    c.isDrawingMode = false;
    c.selection = true;
    const reader = new FileReader();
    reader.onload = async () => {
      const url = reader.result as string;
      const img = await FabricImage.fromURL(url);
      const size = pageSizePx;
      img.set({
        left: size.w / 2 - (img.width || 200) / 2,
        top: size.h / 2 - (img.height || 200) / 2,
        scaleX: 0.5,
        scaleY: 0.5,
      });
      const id = ensureObjectId(img);
      (img as any).uid = id;
      c.add(img);
      c.setActiveObject(img);
      c.requestRenderAll();
    };
    reader.readAsDataURL(file);
  }, [ensureObjectId, pageSizePx, pushHistory]);

  const setTextProp = useCallback((partial: Partial<TextProps>) => {
    const c = getCanvas();
    if (!c) return;
    const active: any = c.getActiveObject();
    if (!active) return;
    const type = String(active.type || "").toLowerCase();
    if (type !== "textbox" && type !== "i-text" && type !== "text") return;
    updateActiveObject(partial);
  }, [updateActiveObject]);

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
    if (active.type === "activeSelection") {
      (active as any).getObjects().forEach((o: any) => c.remove(o));
    } else {
      c.remove(active);
    }
    c.discardActiveObject();
    c.requestRenderAll();
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
    await applySnapshot(prev);
  }, [applySnapshot]);

  const redo = useCallback(async () => {
    const c = getCanvas();
    if (!c || redoRef.current.length === 0) return;
    const next = redoRef.current.pop();
    if (next) undoRef.current.push(next);
    await applySnapshot(next);
  }, [applySnapshot]);

  const exportPNG = useCallback(() => {
    const c = getCanvas();
    if (!c) return;
    const dataUrl = c.toDataURL({ format: "png", multiplier: 1 });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "resume.png";
    a.click();
  }, []);

  const exportPDF = useCallback(() => {
    const c = getCanvas();
    if (!c) return;
    const size = pageSizePx;
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "px",
      format: [size.w, size.h],
    });
    const dataUrl = c.toDataURL({ format: "png", multiplier: 1 });
    pdf.addImage(dataUrl, "PNG", 0, 0, size.w, size.h);
    pdf.save("resume.pdf");
  }, [pageSizePx]);

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
    canvasElRef,
    zoom,
    setZoom,
    setZoomPercent,
    getZoom,
    getZoomPercent,
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
    activeObjectType,
    activeObjectSnapshot,
    textProps,
    shapeProps,
    imageProps,
    layers,
    selectedLayerId,
    addText,
    addRect,
    addCircle,
    addLine,
    addImage,
    setTextProp,
    setShapeProp,
    updateActiveObject,
    deleteSelected,
    copy,
    paste,
    undo,
    redo,
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
  };
}
