"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Canvas } from "fabric";
import { getSystemTemplateById } from "@/data/systemTemplates/registry";
import { initFabricCanvas } from "@/lib/editor/canvasInitializer";
import { exportToDataURL, buildPDFFromPages } from "@/lib/editor/exportCanvas";
import {
  applyMobileViewportTransform,
  fabricSavePayloadHasDataImageSrc,
  findTextTargetAtContainerPoint,
  fitCanvasToViewport,
  getPageBounds,
  loadSnapshotOntoCanvas,
  MOBILE_TAP_MAX_DURATION_MS,
  MOBILE_TAP_MOVE_THRESHOLD_PX,
  serializeCanvasForSave,
  type MobileViewportState,
  zoomViewportAroundPoint,
} from "@/lib/editor/mobileEditorUtils";
import { createResumeDoc, updateResumeDoc } from "@/lib/resumeDocs";
import { useAuth } from "@/lib/useAuth";
import { PAGE_SIZES, type PageSize } from "@/types/editor";

export type MobileSaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error";

export type MobileTextEditState = {
  draft: string;
} | null;

type UseMobileFabricEditorOptions = {
  templateId: string;
};

type GestureMode = "none" | "pan" | "pinch";

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

function touchDistance(t1: Touch, t2: Touch): number {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.hypot(dx, dy);
}

function touchCenter(t1: Touch, t2: Touch, container: HTMLElement): { x: number; y: number } {
  const rect = container.getBoundingClientRect();
  const cx = (t1.clientX + t2.clientX) / 2;
  const cy = (t1.clientY + t2.clientY) / 2;
  return { x: cx - rect.left, y: cy - rect.top };
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

export function useMobileFabricEditor({ templateId }: UseMobileFabricEditorOptions) {
  const { user } = useAuth();
  const canvasRef = useRef<Canvas | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const pageSizeRef = useRef(PAGE_SIZES.A4);
  const editingObjectRef = useRef<any>(null);
  const docIdRef = useRef<string | null>(null);
  const isDirtyRef = useRef(false);
  const viewStateRef = useRef<MobileViewportState>({ zoom: 1, panX: 0, panY: 0 });
  const baseZoomRef = useRef(1);
  const userAdjustedViewRef = useRef(false);
  const gestureRef = useRef<GestureSession>(emptyGesture());
  const isCanvasInteractingRef = useRef(false);

  const [canvasReady, setCanvasReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState("Untitled Resume");
  const [saveStatus, setSaveStatus] = useState<MobileSaveStatus>("idle");
  const [textEdit, setTextEdit] = useState<MobileTextEditState>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const applyViewState = useCallback((state: MobileViewportState) => {
    const c = canvasRef.current;
    if (!c) return;
    viewStateRef.current = state;
    applyMobileViewportTransform(c, state);
  }, []);

  const lastContainerWidthRef = useRef(0);
  const resizeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fitToContainer = useCallback((options?: { force?: boolean }) => {
    if (userAdjustedViewRef.current && !options?.force) return;
    const c = canvasRef.current;
    const vp = viewportRef.current;
    if (!c || !vp) return;
    const rect = vp.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const pageBounds = getPageBounds(c, "A4");
    const result = fitCanvasToViewport(c, rect.width, rect.height, pageBounds);
    viewStateRef.current = result.state;
    baseZoomRef.current = result.baseZoom;
    lastContainerWidthRef.current = rect.width;
  }, []);

  const resetView = useCallback(() => {
    userAdjustedViewRef.current = false;
    fitToContainer({ force: true });
  }, [fitToContainer]);

  const beginPinchGesture = useCallback(
    (t0: Touch, t1: Touch, container: HTMLElement, markAdjusted: boolean) => {
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
      if (markAdjusted) {
        userAdjustedViewRef.current = true;
      }
    },
    []
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
    const c = initFabricCanvas(el, {
      width: w,
      height: h,
      backgroundColor: "#ebecf0",
      selection: false,
      preserveObjectStacking: true,
    });
    canvasRef.current = c;
    setCanvasReady(true);
  }, []);

  useEffect(() => {
    if (!canvasReady) return;

    let cancelled = false;
    userAdjustedViewRef.current = false;

    const run = async () => {
      setLoading(true);
      setLoadError(null);

      const template = getSystemTemplateById(templateId);
      if (!template) {
        setLoadError("Template not found.");
        setLoading(false);
        return;
      }

      setDocTitle(template.name || "Untitled Resume");
      docIdRef.current = null;

      try {
        const snapshot = await template.load();

        if (cancelled) return;

        const c = canvasRef.current;
        if (!c) {
          throw new Error("Canvas failed to initialize");
        }

        const { w, h } = pageSizeRef.current;
        await loadSnapshotOntoCanvas(c, snapshot, w, h, {
          isTemplateLoad: true,
        });

        if (cancelled) return;
        requestAnimationFrame(() => fitToContainer());
        setSaveStatus("idle");
        setLoading(false);
      } catch (err) {
        console.error("[mobile-editor] Failed to load template", err);
        if (!cancelled) {
          setLoadError("We couldn't load this template. Please try again.");
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [canvasReady, fitToContainer, templateId]);

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width = entry.contentRect.width;
      if (
        lastContainerWidthRef.current > 0 &&
        Math.abs(width - lastContainerWidthRef.current) < 1
      ) {
        return;
      }

      if (resizeDebounceRef.current) {
        clearTimeout(resizeDebounceRef.current);
      }
      resizeDebounceRef.current = setTimeout(() => {
        fitToContainer();
      }, 120);
    });
    ro.observe(vp);
    return () => {
      ro.disconnect();
      if (resizeDebounceRef.current) {
        clearTimeout(resizeDebounceRef.current);
      }
    };
  }, [fitToContainer, loading]);

  useEffect(() => {
    const vp = viewportRef.current;
    const c = canvasRef.current;
    if (!vp || !c || !canvasReady || loading) return;

    const localPoint = (touch: Touch) => {
      const rect = vp.getBoundingClientRect();
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    };

    const markUserAdjusted = () => {
      userAdjustedViewRef.current = true;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const p = localPoint(e.touches[0]);
        gestureRef.current = {
          ...emptyGesture(),
          mode: "pan",
          startTime: Date.now(),
          startX: p.x,
          startY: p.y,
          lastX: p.x,
          lastY: p.y,
        };
        isCanvasInteractingRef.current = true;
      } else if (e.touches.length >= 2) {
        gestureRef.current = {
          ...emptyGesture(),
          mode: "pinch",
          startTime: Date.now(),
        };
        beginPinchGesture(e.touches[0], e.touches[1], vp, false);
        isCanvasInteractingRef.current = true;
        e.preventDefault();
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      const g = gestureRef.current;
      if (g.mode === "pan" && e.touches.length === 1) {
        const p = localPoint(e.touches[0]);
        const dx = p.x - g.lastX;
        const dy = p.y - g.lastY;
        const totalDx = p.x - g.startX;
        const totalDy = p.y - g.startY;
        if (Math.hypot(totalDx, totalDy) > MOBILE_TAP_MOVE_THRESHOLD_PX) {
          g.hadGesture = true;
          markUserAdjusted();
        }
        if (dx !== 0 || dy !== 0) {
          const next = {
            ...viewStateRef.current,
            panX: viewStateRef.current.panX + dx,
            panY: viewStateRef.current.panY + dy,
          };
          applyViewState(next);
          g.lastX = p.x;
          g.lastY = p.y;
          e.preventDefault();
        }
      } else if (e.touches.length >= 2) {
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const dist = touchDistance(t0, t1);
        const center = touchCenter(t0, t1, vp);
        if (g.mode !== "pinch" || g.startDistance <= 0) {
          beginPinchGesture(t0, t1, vp, true);
        }
        const pinch = gestureRef.current;
        const scaleFactor = dist / pinch.startDistance;
        const newZoom = pinch.startZoom * scaleFactor;
        const next = zoomViewportAroundPoint(
          { zoom: pinch.startZoom, panX: pinch.startPanX, panY: pinch.startPanY },
          newZoom,
          center.x,
          center.y,
          baseZoomRef.current
        );
        applyViewState(next);
        pinch.hadGesture = true;
        markUserAdjusted();
        e.preventDefault();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      const g = gestureRef.current;
      const duration = Date.now() - g.startTime;

      if (e.touches.length === 0) {
        isCanvasInteractingRef.current = false;

        const shouldTap =
          !g.hadGesture &&
          g.mode === "pan" &&
          duration < MOBILE_TAP_MAX_DURATION_MS &&
          e.changedTouches.length === 1;

        if (shouldTap) {
          const touch = e.changedTouches[0];
          const totalMove = Math.hypot(
            touch.clientX - (vp.getBoundingClientRect().left + g.startX),
            touch.clientY - (vp.getBoundingClientRect().top + g.startY)
          );
          if (totalMove <= MOBILE_TAP_MOVE_THRESHOLD_PX) {
            const target = findTextTargetAtContainerPoint(c, vp, touch.clientX, touch.clientY);
            if (target) {
              editingObjectRef.current = target;
              setTextEdit({ draft: String(target.text ?? "") });
            }
          }
        }

        gestureRef.current = emptyGesture();
      } else if (e.touches.length === 1 && g.mode === "pinch") {
        const p = localPoint(e.touches[0]);
        gestureRef.current = {
          ...emptyGesture(),
          mode: "pan",
          startTime: Date.now(),
          startX: p.x,
          startY: p.y,
          lastX: p.x,
          lastY: p.y,
          hadGesture: true,
        };
      }
    };

    const onTouchCancel = () => {
      gestureRef.current = emptyGesture();
      isCanvasInteractingRef.current = false;
    };

    vp.addEventListener("touchstart", onTouchStart, { passive: false });
    vp.addEventListener("touchmove", onTouchMove, { passive: false });
    vp.addEventListener("touchend", onTouchEnd, { passive: false });
    vp.addEventListener("touchcancel", onTouchCancel, { passive: false });

    return () => {
      vp.removeEventListener("touchstart", onTouchStart);
      vp.removeEventListener("touchmove", onTouchMove);
      vp.removeEventListener("touchend", onTouchEnd);
      vp.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [applyViewState, beginPinchGesture, canvasReady, loading]);

  const closeTextEdit = useCallback(() => {
    editingObjectRef.current = null;
    setTextEdit(null);
  }, []);

  const commitTextEdit = useCallback(() => {
    const c = canvasRef.current;
    const obj = editingObjectRef.current;
    if (!c || !obj || !textEdit) {
      closeTextEdit();
      return;
    }
    obj.set?.({ text: textEdit.draft });
    obj.setCoords?.();
    c.requestRenderAll();
    isDirtyRef.current = true;
    setSaveStatus("unsaved");
    closeTextEdit();
  }, [closeTextEdit, textEdit]);

  const save = useCallback(async () => {
    const c = canvasRef.current;
    if (!c || !user?.uid) {
      setSaveStatus("error");
      return false;
    }

    const canvasJson = serializeCanvasForSave(c);
    if (fabricSavePayloadHasDataImageSrc(canvasJson)) {
      console.error("[mobile-editor] Save blocked: canvas contains data:image URLs");
      setSaveStatus("error");
      return false;
    }

    setSaveStatus("saving");
    try {
      const pageSize: PageSize = "A4";
      const common = {
        uid: user.uid,
        title: docTitle || "Untitled Resume",
        canvasJson,
        pageSize,
        zoom: 1,
      };

      if (docIdRef.current) {
        await updateResumeDoc({
          ...common,
          docId: docIdRef.current,
        });
      } else {
        const newId = await createResumeDoc({
          ...common,
          sourceTemplateId: templateId,
        });
        docIdRef.current = newId;
      }

      isDirtyRef.current = false;
      setSaveStatus("saved");
      return true;
    } catch (err) {
      console.error("[mobile-editor] Save failed", err);
      setSaveStatus("error");
      return false;
    }
  }, [docTitle, templateId, user?.uid]);

  const downloadPdf = useCallback(async () => {
    const c = canvasRef.current;
    if (!c) return;

    setIsDownloading(true);
    try {
      const result = exportToDataURL(c, {
        multiplier: 2,
        getPageBounds: (canvas) => getPageBounds(canvas, "A4"),
      });
      if (!result) {
        console.error("[mobile-editor] PDF export failed: no page bounds");
        return;
      }
      const blob = buildPDFFromPages([result]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "resume.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[mobile-editor] PDF download failed", err);
    } finally {
      setIsDownloading(false);
    }
  }, []);

  useEffect(() => {
    return () => {
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
    textEdit,
    setTextEdit,
    isDownloading,
    attachCanvasEl,
    viewportRef,
    canvasWrapRef,
    closeTextEdit,
    commitTextEdit,
    save,
    downloadPdf,
    resetView,
  };
}
