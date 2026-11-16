"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ArrowRight, Lock, LockOpen, Mail, Plus, Share2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthUser } from "@/lib/useAuthUser";
import type { EsignDocument } from "@/lib/esign";
import { removeBackgroundFromDataUrl } from "@/lib/esignRemoveBackground";
import {
  isPngOrJpegSignatureFile,
  SIGNATURE_UPLOAD_ACCEPT,
  SIGNATURE_UPLOAD_REJECTED_MESSAGE,
} from "@/lib/esignSignatureUpload";
import {
  esignTitleStatus,
  lockButtonView,
  phoneDockGuidance,
  phoneEsignHeaderFileName,
  recipientActionEnabled,
  recipientActionLabel,
  recipientHelperText,
  recipientPhase,
} from "@/lib/esignViewerState";
import { loadEsignOriginalPreview } from "@/lib/esignOriginalPreview";
import {
  ESIGN_TARGET_ERRORS,
  readLockedCountersignTarget,
} from "@/lib/esignPlacements";
import { trackEvent } from "@/lib/analytics";
import {
  esignCountersignShareDataLayerEvent,
  esignPdfDownloadDataLayerEvent,
  trackEsignDataLayerEvent,
} from "@/lib/esignGtmEvents";
import SignatureToolsPanel from "@/components/esign/SignatureToolsPanel";
import {
  EsignPhoneDock,
  EsignPhoneSheet,
  useEsignPhoneLayout,
} from "@/components/esign/EsignPhoneChrome";
import {
  ESIGN_PHONE_CONTROL_CLASS,
  ESIGN_PHONE_DOCUMENT_SHEET_CLASS,
  ESIGN_PHONE_PAGE_TOUCH_ACTION,
  ESIGN_PHONE_STAGE_TOUCH_CLASS,
} from "@/lib/esignPhoneLayout";
import { HOME_LOGOS_DARK } from "@/components/home/homeLogoAssets";
import {
  dragSignatureBox,
  phonePinchStageSize,
  phoneZoomPercent,
  pinchMidpointInScroller,
  pinchScaleFromDistance,
  pointerDeltaInPageSpace,
  resizeSignatureBox,
  resolveCountersignLock,
  scrollToKeepPinchMidpoint,
  touchDistance,
  visibleEsignPageFromRects,
  visualClientPointToLayout,
  visualRectToLayoutBox,
  type EsignResizeCorner,
} from "@/lib/esignPdfTouch";
import {
  nearbyEsignPdfPages,
  phonePdfCanvasMetrics,
  phonePdfPaintNeeded,
  phonePdfPreviewOutputScale,
  phonePdfSharpOutputScale,
} from "@/lib/esignPdfRender";

type EsignViewerClientProps = {
  documentId: string;
};

function debounce(fn: () => void, ms: number): () => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      fn();
      timeout = null;
    }, ms);
  };
}

/** Normalized coords (0..1) relative to page; used for export and positioning. */
export type SignatureModel = {
  id: string;
  page: number;
  xNorm: number;
  yNorm: number;
  wNorm: number;
  hNorm: number;
  imageDataUrl: string;
  locked: boolean;
};

/** Countersign placeholder box (sender-side only). */
export type CountersignPlaceholderModel = {
  id: string;
  page: number;
  xNorm: number;
  yNorm: number;
  wNorm: number;
  hNorm: number;
  locked: boolean;
};

/** Smooth a path of points with quadratic curves for less jagged lines. */
function smoothStroke(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  color: string
) {
  if (points.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length - 1; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const cpX = (p0.x + p1.x) / 2;
    const cpY = (p0.y + p1.y) / 2;
    ctx.quadraticCurveTo(p1.x, p1.y, cpX, cpY);
  }
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  ctx.quadraticCurveTo(prev.x, prev.y, last.x, last.y);
  ctx.stroke();
}

function SignaturePad({
  onSignatureReady,
  onUseAndPlace,
  showInsertButton = true,
}: {
  onSignatureReady: (dataUrl: string) => void;
  onUseAndPlace?: (dataUrl: string) => void;
  showInsertButton?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [color, setColor] = useState<"black" | "blue">("black");
  const [strokes, setStrokes] = useState<
    { points: { x: number; y: number }[]; color: string }[]
  >([]);
  const isDrawingRef = useRef(false);

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokes) {
      smoothStroke(ctx, stroke.points, stroke.color);
    }
  };

  useEffect(() => {
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes]);



  const getPoint = (e: any) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: any) => {
    e.preventDefault();
    const pt = getPoint(e);
    isDrawingRef.current = true;
    setStrokes((prev) => [
      ...prev,
      {
        points: [pt],
        color: color === "black" ? "#000000" : "#2563eb",
      },
    ]);
  };

  const handlePointerMove = (e: any) => {
    if (!isDrawingRef.current) return;
    const pt = getPoint(e);
    setStrokes((prev) => {
      if (!prev.length) return prev;
      const next = [...prev];
      const last = next[next.length - 1];
      last.points = [...last.points, pt];
      return next;
    });
  };

  const handlePointerUp = () => {
    isDrawingRef.current = false;
  };

  const handleUndo = () => {
    setStrokes((prev) => prev.slice(0, -1));
  };

  const handleUseSignature = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL("image/png");
    if (!dataUrl) return;
    onSignatureReady(dataUrl);
    onUseAndPlace?.(dataUrl);
  };

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase text-zinc-500">
        Draw Signature
      </div>
      <div className="rounded-xl border border-zinc-300 bg-white p-2">
        <canvas
          ref={canvasRef}
          width={320}
          height={120}
          className="w-full rounded-lg bg-white"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={handleUndo}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs hover:border-blue-400"
        >
          Undo
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setColor("black")}
            className={`h-6 w-6 rounded-full border ${
              color === "black"
                ? "border-blue-500 ring-2 ring-blue-200"
                : "border-zinc-300"
            } bg-black`}
          />
          <button
            type="button"
            onClick={() => setColor("blue")}
            className={`h-6 w-6 rounded-full border ${
              color === "blue"
                ? "border-blue-500 ring-2 ring-blue-200"
                : "border-zinc-300"
            } bg-blue-600`}
          />
        </div>
        {showInsertButton && (
          <button
            type="button"
            onClick={handleUseSignature}
            className="rounded-lg bg-black px-3 py-1.5 text-xs font-medium text-white"
          >
            Insert
          </button>
        )}
      </div>
    </div>
  );
}

type ZoomMode = "fit" | "custom";

type EsignPdfViewerRef = {
  placeSignatureAtCenter: (dataUrl: string, pageNumber: number) => boolean;
  placeSignatureAtNormalized: (
    dataUrl: string,
    pageNumber: number,
    xNorm: number,
    yNorm: number,
    wNorm: number,
    hNorm: number,
    locked: boolean
  ) => void;
  placeFittedInTarget: (
    dataUrl: string,
    target: { page: number; xNorm: number; yNorm: number; wNorm: number; hNorm: number }
  ) => Promise<boolean>;
};

function EsignPdfViewerInner(
  {
    documentId,
    activeSignature,
    placing,
    onSignaturePlaced,
    zoomMode,
    zoomScale,
    onSignatureCreated,
    onSignatureSelected,
    onSignatureUpdated,
    lockedSignatureIds,
    signatures,
    scrollContainerRef,
    onVisiblePageChange,
    countersignPlaceholder,
    onCountersignPlaceholderChange,
    recipientView = false,
    recipientSignatureId = null,
    showStaticTarget = false,
    useFinalPdf = false,
    onSignaturesPainted,
    touchChrome = false,
    viewScale = 1,
    selectedPage = null,
    onPageSelect,
    pinchActiveRef: pinchActiveFromParent,
  }: {
    documentId: string;
    activeSignature: string | null;
    placing: boolean;
    onSignaturePlaced: () => void;
    zoomMode: ZoomMode;
    zoomScale: number;
    onSignatureCreated: (sig: SignatureModel) => void;
    onSignatureSelected: (id: string) => void;
    onSignatureUpdated?: (id: string, norms: { xNorm: number; yNorm: number; wNorm?: number; hNorm?: number }) => void;
    lockedSignatureIds?: string[];
    signatures: SignatureModel[];
    scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
    onVisiblePageChange?: (page: number) => void;
    countersignPlaceholder?: CountersignPlaceholderModel | null;
    onCountersignPlaceholderChange?: (norms: { page: number; xNorm: number; yNorm: number; wNorm: number; hNorm: number }) => void;
    recipientView?: boolean;
    recipientSignatureId?: string | null;
    showStaticTarget?: boolean;
    useFinalPdf?: boolean;
    onSignaturesPainted?: () => void;
    touchChrome?: boolean;
    viewScale?: number;
    selectedPage?: number | null;
    onPageSelect?: (page: number) => void;
    pinchActiveRef?: React.MutableRefObject<boolean>;
  },
  ref: React.Ref<EsignPdfViewerRef>
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [renderedPageCount, setRenderedPageCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const pageWrapperRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const recipientTargetScrolledRef = useRef(false);
  const senderBoxRevealRef = useRef<string | null>(null);
  const onSignaturesPaintedRef = useRef(onSignaturesPainted);
  onSignaturesPaintedRef.current = onSignaturesPainted;

  const activeSignatureRef = useRef<string | null>(activeSignature);
  const placingRef = useRef<boolean>(placing);
  const onSignaturePlacedRef = useRef<() => void>(() => {});
  const onSignatureCreatedRef = useRef<(sig: SignatureModel) => void>(() => {});
  const onSignatureSelectedRef = useRef<(id: string) => void>(() => {});
  const onSignatureUpdatedRef = useRef<((id: string, n: { xNorm: number; yNorm: number; wNorm?: number; hNorm?: number }) => void) | undefined>(undefined);
  const onCountersignPlaceholderChangeRef = useRef<((n: { page: number; xNorm: number; yNorm: number; wNorm: number; hNorm: number }) => void) | undefined>(undefined);
  const signaturesLockedRef = useRef<Set<string>>(new Set());
  const countersignGestureRef = useRef(false);
  const [countersignLayoutEpoch, setCountersignLayoutEpoch] = useState(0);
  const viewScaleRef = useRef(1);
  const fallbackPinchActiveRef = useRef(false);
  const pinchActiveRef = pinchActiveFromParent ?? fallbackPinchActiveRef;
  const pdfDocRef = useRef<any>(null);
  const pageRenderTaskRef = useRef<Map<number, { cancel: () => void }>>(new Map());
  const pagePaintScaleRef = useRef<Map<number, number>>(new Map());
  const pagePaintGenRef = useRef<Map<number, number>>(new Map());
  const [paintFocusPage, setPaintFocusPage] = useState(1);
  const onPageSelectRef = useRef(onPageSelect);
  const onVisiblePageChangeRef = useRef(onVisiblePageChange);
  const touchChromeRef = useRef(touchChrome);
  const visiblePagePickRef = useRef(1);
  onPageSelectRef.current = onPageSelect;
  onVisiblePageChangeRef.current = onVisiblePageChange;
  touchChromeRef.current = touchChrome;
  viewScaleRef.current = viewScale;

  activeSignatureRef.current = activeSignature;
  placingRef.current = placing;
  onSignatureUpdatedRef.current = onSignatureUpdated;
  onCountersignPlaceholderChangeRef.current = onCountersignPlaceholderChange;

  useEffect(() => {
    onSignaturePlacedRef.current = onSignaturePlaced;
  }, [onSignaturePlaced]);

  useEffect(() => {
    onSignatureCreatedRef.current = onSignatureCreated;
  }, [onSignatureCreated]);

  useEffect(() => {
    onSignatureSelectedRef.current = onSignatureSelected;
  }, [onSignatureSelected]);

  useEffect(() => {
    signaturesLockedRef.current = new Set(lockedSignatureIds ?? []);
  }, [lockedSignatureIds]);

  const paintPhonePage = useCallback(async (pageNumber: number, outputScale: number) => {
    const pdf = pdfDocRef.current;
    const container = containerRef.current;
    if (!pdf || !container) return;
    const wrapper = container.querySelector<HTMLElement>(
      `[data-esign-page="${pageNumber}"]`
    );
    const live = wrapper?.querySelector("canvas");
    if (!wrapper || !live) return;
    const cssWidth = Number(wrapper.dataset.esignCssWidth);
    const cssHeight = Number(wrapper.dataset.esignCssHeight);
    const layoutScale = Number(wrapper.dataset.esignLayoutScale);
    if (!(cssWidth > 0 && cssHeight > 0 && layoutScale > 0)) return;
    const metrics = phonePdfCanvasMetrics({ cssWidth, cssHeight, outputScale });
    if (
      !phonePdfPaintNeeded(
        pagePaintScaleRef.current.get(pageNumber) ?? 0,
        metrics.outputScale
      )
    ) {
      return;
    }
    const gen = (pagePaintGenRef.current.get(pageNumber) ?? 0) + 1;
    pagePaintGenRef.current.set(pageNumber, gen);
    try {
      pageRenderTaskRef.current.get(pageNumber)?.cancel();
    } catch {
      // pdf.js cancel throws when the task is already done.
    }
    const page = await pdf.getPage(pageNumber);
    if (pagePaintGenRef.current.get(pageNumber) !== gen) return;
    const viewport = page.getViewport({ scale: layoutScale });
    const offscreen = document.createElement("canvas");
    offscreen.width = metrics.canvasWidth;
    offscreen.height = metrics.canvasHeight;
    const context = offscreen.getContext("2d");
    if (!context) return;
    const task = page.render({
      canvasContext: context,
      viewport,
      transform: [metrics.outputScale, 0, 0, metrics.outputScale, 0, 0],
    } as any);
    pageRenderTaskRef.current.set(pageNumber, task);
    try {
      await task.promise;
    } catch {
      return;
    } finally {
      if (pageRenderTaskRef.current.get(pageNumber) === task) {
        pageRenderTaskRef.current.delete(pageNumber);
      }
    }
    if (pagePaintGenRef.current.get(pageNumber) !== gen) return;
    if (!live.isConnected) return;
    offscreen.style.display = "block";
    offscreen.style.margin = "0 auto";
    offscreen.style.width = `${metrics.cssWidth}px`;
    offscreen.style.height = `${metrics.cssHeight}px`;
    offscreen.style.touchAction = ESIGN_PHONE_PAGE_TOUCH_ACTION;
    live.replaceWith(offscreen);
    pagePaintScaleRef.current.set(pageNumber, metrics.outputScale);
  }, []);

  const placeAtCenter = useCallback((dataUrl: string, pageNumber: number) => {
    if (!dataUrl) return false;
    const overlay = containerRef.current?.querySelector<HTMLDivElement>(
      `[data-esign-overlay][data-page-number="${pageNumber}"]`
    );
    if (!overlay) return false;
    const w = overlay.clientWidth;
    const h = overlay.clientHeight;
    const defaultW = 160;
    const defaultH = 60;
    const xNorm = (0.5 - (defaultW / w) / 2);
    const yNorm = (0.5 - (defaultH / h) / 2);
    const wNorm = defaultW / w;
    const hNorm = defaultH / h;
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const sig: SignatureModel = {
      id,
      page: pageNumber,
      xNorm: Math.max(0, xNorm),
      yNorm: Math.max(0, yNorm),
      wNorm,
      hNorm,
      imageDataUrl: dataUrl,
      locked: false,
    };
    
    onSignaturePlacedRef.current?.();
    onSignatureCreatedRef.current?.(sig);
    return true;
  }, []);

  const placeAtNormalized = useCallback(
    (
      dataUrl: string,
      pageNumber: number,
      xNorm: number,
      yNorm: number,
      wNorm: number,
      hNorm: number,
      locked: boolean
    ) => {
      if (!dataUrl) return;
      const overlay = containerRef.current?.querySelector<HTMLDivElement>(
        `[data-esign-overlay][data-page-number="${pageNumber}"]`
      );
      if (!overlay) return;
      const w = overlay.clientWidth;
      const h = overlay.clientHeight;
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const sig: SignatureModel = {
        id,
        page: pageNumber,
        xNorm,
        yNorm,
        wNorm,
        hNorm,
        imageDataUrl: dataUrl,
        locked,
      };
      const img = document.createElement("img");
      img.src = dataUrl;
      img.alt = "Signature";
      img.dataset.esignSigId = id;
      img.style.position = "absolute";
      img.style.width = `${wNorm * w}px`;
      img.style.height = "auto";
      img.style.left = `${xNorm * w}px`;
      img.style.top = `${yNorm * h}px`;
      img.style.cursor = locked ? "default" : "move";
      img.style.pointerEvents = locked ? "none" : "auto";
      img.style.border = locked ? "2px solid #16a34a" : "none";
      img.addEventListener("click", (e) => {
        e.stopPropagation();
        onSignatureSelectedRef.current?.(id);
      });
      if (!locked) {
        img.onpointerdown = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const startX = e.clientX;
          const startY = e.clientY;
          const origLeft = img.offsetLeft;
          const origTop = img.offsetTop;
          const move = (ev: PointerEvent) => {
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            let nextLeft = origLeft + dx;
            let nextTop = origTop + dy;
            nextLeft = Math.max(0, Math.min(nextLeft, overlay.clientWidth - img.offsetWidth));
            nextTop = Math.max(0, Math.min(nextTop, overlay.clientHeight - img.offsetHeight));
            img.style.left = `${nextLeft}px`;
            img.style.top = `${nextTop}px`;
          };
          const up = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            const newXNorm = img.offsetLeft / overlay.clientWidth;
            const newYNorm = img.offsetTop / overlay.clientHeight;
            onSignatureUpdatedRef.current?.(id, { xNorm: newXNorm, yNorm: newYNorm });
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
        };
      }
      overlay.appendChild(img);
      onSignaturePlacedRef.current?.();
      onSignatureCreatedRef.current?.(sig);
    },
    []
  );

  const placeFittedInTarget = useCallback(
    (
      dataUrl: string,
      target: { page: number; xNorm: number; yNorm: number; wNorm: number; hNorm: number }
    ) => {
      return new Promise<boolean>((resolve) => {
        if (!dataUrl) {
          resolve(false);
          return;
        }
        const image = document.createElement("img");
        image.onload = () => {
          const overlay = containerRef.current?.querySelector<HTMLDivElement>(
            `[data-esign-overlay][data-page-number="${target.page}"]`
          );
          const overlayWidth = overlay?.clientWidth ?? 0;
          const overlayHeight = overlay?.clientHeight ?? 0;
          const boxWidth = target.wNorm * overlayWidth;
          const boxHeight = target.hNorm * overlayHeight;
          if (
            !overlay ||
            !(overlayWidth > 0) ||
            !(overlayHeight > 0) ||
            !(image.naturalWidth > 0) ||
            !(image.naturalHeight > 0) ||
            !(boxWidth > 1) ||
            !(boxHeight > 1)
          ) {
            resolve(false);
            return;
          }
          const imageAspect = image.naturalWidth / image.naturalHeight;
          const boxAspect = boxWidth / boxHeight;
          let drawWidth = boxWidth;
          let drawHeight = boxHeight;
          if (imageAspect > boxAspect) {
            drawWidth = boxWidth;
            drawHeight = boxWidth / imageAspect;
          } else {
            drawHeight = boxHeight;
            drawWidth = boxHeight * imageAspect;
          }
          const left = target.xNorm * overlayWidth + (boxWidth - drawWidth) / 2;
          const top = target.yNorm * overlayHeight + (boxHeight - drawHeight) / 2;
          const id =
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
          onSignatureCreatedRef.current?.({
            id,
            page: target.page,
            xNorm: left / overlayWidth,
            yNorm: top / overlayHeight,
            wNorm: drawWidth / overlayWidth,
            hNorm: drawHeight / overlayHeight,
            imageDataUrl: dataUrl,
            locked: false,
          });
          overlay.scrollIntoView({ block: "center", inline: "nearest" });
          resolve(true);
        };
        image.onerror = () => resolve(false);
        image.src = dataUrl;
      });
    },
    []
  );

  useImperativeHandle(
    ref,
    () => ({
      placeSignatureAtCenter: placeAtCenter,
      placeSignatureAtNormalized: placeAtNormalized,
      placeFittedInTarget,
    }),
    [placeAtCenter, placeAtNormalized, placeFittedInTarget]
  );

  // Track container width for "fit" zoom mode.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const entry = entries[0];
      const w = entry.contentRect.width;
      setContainerWidth((prev) => (prev === w ? prev : w));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setRenderedPageCount(0);
        setError(null);
        // @ts-expect-error pdfjs-dist ships no types for this legacy entry
        const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf");

        (pdfjsLib as any).GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

        const url = `/api/esign/download?documentId=${encodeURIComponent(
          documentId
        )}${useFinalPdf ? "&final=1" : ""}`;
        const sharedBytes = useFinalPdf
          ? await (async () => {
              const response = await fetch(url);
              if (!response.ok) {
                throw new Error("Failed to render document");
              }
              return new Uint8Array(await response.arrayBuffer());
            })()
          : await loadEsignOriginalPreview(documentId, async () => {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error("Failed to render document");
          }
          return new Uint8Array(await response.arrayBuffer());
        });
        const loadingTask = (pdfjsLib as any).getDocument({
          data: sharedBytes.slice(),
        });
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        const container = containerRef.current;
        if (!container) return;
        pageRenderTaskRef.current.forEach((task) => {
          try {
            task.cancel();
          } catch {
            // Ignore completed tasks.
          }
        });
        pageRenderTaskRef.current.clear();
        pagePaintScaleRef.current.clear();
        pagePaintGenRef.current.clear();
        pdfDocRef.current = pdf;
        container.innerHTML = "";

        const effectiveWidth =
          (containerWidth ?? container.clientWidth) || 800;
        const previewOutputScale = touchChrome
          ? phonePdfPreviewOutputScale(window.devicePixelRatio || 1)
          : 1;

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
          const page = await pdf.getPage(pageNumber);
          if (cancelled) return;

          const baseViewport = page.getViewport({ scale: 1 });
          const scale =
            zoomMode === "fit"
              ? effectiveWidth / baseViewport.width
              : zoomScale;
          const viewport = page.getViewport({ scale });
          const metrics = touchChrome
            ? phonePdfCanvasMetrics({
                cssWidth: viewport.width,
                cssHeight: viewport.height,
                outputScale: previewOutputScale,
              })
            : {
                outputScale: 1,
                canvasWidth: viewport.width,
                canvasHeight: viewport.height,
                cssWidth: viewport.width,
                cssHeight: viewport.height,
              };

          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          canvas.width = metrics.canvasWidth;
          canvas.height = metrics.canvasHeight;
          canvas.style.display = "block";
          canvas.style.margin = "0 auto";
          if (touchChrome) {
            canvas.style.width = `${metrics.cssWidth}px`;
            canvas.style.height = `${metrics.cssHeight}px`;
            canvas.style.touchAction = ESIGN_PHONE_PAGE_TOUCH_ACTION;
          }

          const pageWrapper = document.createElement("div");
          pageWrapper.style.position = "relative";
          pageWrapper.style.marginBottom = "24px";
          if (touchChrome) {
            pageWrapper.style.touchAction = ESIGN_PHONE_PAGE_TOUCH_ACTION;
          }
          pageWrapper.dataset.pageNumber = String(pageNumber);
          pageWrapper.dataset.esignCssWidth = String(metrics.cssWidth);
          pageWrapper.dataset.esignCssHeight = String(metrics.cssHeight);
          pageWrapper.dataset.esignLayoutScale = String(scale);
          pageWrapper.setAttribute("data-esign-page", String(pageNumber));
          if (touchChrome) {
            pageWrapper.addEventListener("pointerdown", () => {
              if (pinchActiveRef.current) return;
              const page = parseInt(
                pageWrapper.getAttribute("data-esign-page") ?? "1",
                10
              );
              visiblePagePickRef.current = page;
              onPageSelectRef.current?.(page);
              onVisiblePageChangeRef.current?.(page);
              setPaintFocusPage((current) => (current === page ? current : page));
            });
          }
          pageWrapper.appendChild(canvas);

          const overlay = document.createElement("div");
          overlay.style.position = "absolute";
          overlay.style.inset = "0";
          overlay.style.cursor = "crosshair";
          overlay.style.pointerEvents = "none";
          overlay.style.zIndex = "1";
          overlay.dataset.pageNumber = String(pageNumber);
          overlay.setAttribute("data-esign-overlay", "true");
          overlay.addEventListener("pointerdown", (event) => {
            if (event.target !== overlay) return;
            const page = parseInt(overlay.getAttribute("data-page-number") ?? "1", 10);
            onPageSelectRef.current?.(page);
          });

          overlay.addEventListener("click", (event) => {
            if (!placingRef.current) return;
            const dataUrl = activeSignatureRef.current;
            if (!dataUrl) return;
            const rect = overlay.getBoundingClientRect();
            const layoutPoint = visualClientPointToLayout(
              event.clientX,
              event.clientY,
              rect,
              viewScaleRef.current
            );
            const px = layoutPoint?.x ?? event.clientX - rect.left;
            const py = layoutPoint?.y ?? event.clientY - rect.top;
            const w = overlay.clientWidth;
            const h = overlay.clientHeight;
            const defaultW = 160;
            const defaultH = 60;
            const left = Math.max(0, Math.min(px - defaultW / 2, w - defaultW));
            const top = Math.max(0, Math.min(py, h - defaultH));
            const xNorm = left / w;
            const yNorm = top / h;
            const wNorm = defaultW / w;
            const hNorm = defaultH / h;
            const id = typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
            const model: SignatureModel = {
              id,
              page: pageNumber,
              xNorm,
              yNorm,
              wNorm,
              hNorm,
              imageDataUrl: dataUrl,
              locked: false,
            };
            placingRef.current = false;
            onSignaturePlacedRef.current?.();
            onSignatureCreatedRef.current?.(model);
          });

          pageWrapper.appendChild(overlay);
          container.appendChild(pageWrapper);

          const renderParams: {
            canvasContext: CanvasRenderingContext2D;
            viewport: typeof viewport;
            transform?: number[];
          } = {
            canvasContext: context!,
            viewport,
          };
          if (touchChrome && metrics.outputScale !== 1) {
            renderParams.transform = [
              metrics.outputScale,
              0,
              0,
              metrics.outputScale,
              0,
              0,
            ];
          }
          await page.render(renderParams as any).promise;
          if (cancelled) return;
          if (touchChrome) {
            pagePaintScaleRef.current.set(pageNumber, metrics.outputScale);
          }
          setRenderedPageCount(pageNumber);
          if (pageNumber === 1) setLoading(false);
        }
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "Failed to render document");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
      pageRenderTaskRef.current.forEach((task) => {
        try {
          task.cancel();
        } catch {
          // Ignore completed tasks.
        }
      });
      pageRenderTaskRef.current.clear();
    };
    // PDF pages only rerender when document/zoom/source change. Signatures are rendered in a separate effect.
  }, [documentId, zoomMode, zoomScale, containerWidth, useFinalPdf, touchChrome]);

  useEffect(() => {
    if (!touchChrome || loading) return;
    const pdf = pdfDocRef.current;
    if (!pdf) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled || pinchActiveRef.current) return;
      const pageCount = Number(pdf.numPages) || 0;
      const nearby = nearbyEsignPdfPages(paintFocusPage, pageCount);
      const nearbySet = new Set(nearby);
      const dpr = window.devicePixelRatio || 1;
      const sharp = phonePdfSharpOutputScale(dpr, viewScaleRef.current);
      const preview = phonePdfPreviewOutputScale(dpr);
      const pages = new Set(nearby);
      pagePaintScaleRef.current.forEach((scale, pageNumber) => {
        if (phonePdfPaintNeeded(scale, preview)) pages.add(pageNumber);
      });
      pages.forEach((pageNumber) => {
        void paintPhonePage(pageNumber, nearbySet.has(pageNumber) ? sharp : preview);
      });
    }, 160);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [touchChrome, loading, renderedPageCount, viewScale, paintFocusPage, paintPhonePage]);

  // Sync signatures from state into overlay layers. Does NOT rebuild PDF canvases.
  useEffect(() => {
    if (loading) return;
    const container = containerRef.current;
    if (!container) return;
    const overlays = container.querySelectorAll<HTMLDivElement>("[data-esign-overlay]");
    overlays.forEach((overlay) => {
      const pageNum = parseInt(overlay.getAttribute("data-page-number") ?? "1", 10);
      overlay.querySelectorAll("[data-esign-sig-id]").forEach((el) => el.remove());
      const pageSignatures = signatures.filter((s) => s.page === pageNum);
      const w = overlay.clientWidth;
      const h = overlay.clientHeight;
      pageSignatures.forEach((model) => {
        if (!model.imageDataUrl) return;
        const img = document.createElement("img");
        img.src = model.imageDataUrl;
        img.alt = "Signature";
        img.dataset.esignSigId = model.id;
        img.style.position = "absolute";
        img.style.width = `${model.wNorm * w}px`;
        img.style.height = `${model.hNorm * h}px`;
        img.style.left = `${model.xNorm * w}px`;
        img.style.top = `${model.yNorm * h}px`;
        const ownRecipient = recipientView && model.id === recipientSignatureId;
        const foreignRecipient = recipientView && !ownRecipient;
        if (foreignRecipient) {
          img.dataset.esignSenderMark = "1";
          img.style.cursor = "default";
          img.style.pointerEvents = "none";
          img.style.border = "none";
        } else if (ownRecipient) {
          img.dataset.esignRecipientMark = "1";
          img.style.cursor = "default";
          img.style.pointerEvents = model.locked ? "none" : "auto";
          img.style.border = "none";
          if (!model.locked) {
            img.addEventListener("click", (e) => {
              e.stopPropagation();
              onSignatureSelectedRef.current?.(model.id);
            });
            if (!touchChromeRef.current) {
              // Desktop recipient keeps click-to-select; phone can drag inside the target.
            } else {
            img.style.touchAction = "none";
            img.onpointerdown = (e) => {
              if (pinchActiveRef.current) return;
              e.preventDefault();
              e.stopPropagation();
              onSignatureSelectedRef.current?.(model.id);
              img.setPointerCapture?.(e.pointerId);
              const startX = e.clientX;
              const startY = e.clientY;
              const start = {
                left: img.offsetLeft,
                top: img.offsetTop,
                width: img.offsetWidth,
                height: img.offsetHeight,
              };
              const target = countersignPlaceholder;
              const clampRect = target
                ? {
                    left: target.xNorm * overlay.clientWidth,
                    top: target.yNorm * overlay.clientHeight,
                    width: target.wNorm * overlay.clientWidth,
                    height: target.hNorm * overlay.clientHeight,
                  }
                : null;
              const move = (ev: PointerEvent) => {
                if (pinchActiveRef.current) return;
                const next = dragSignatureBox({
                  start,
                  dx: ev.clientX - startX,
                  dy: ev.clientY - startY,
                  overlayWidth: overlay.clientWidth,
                  overlayHeight: overlay.clientHeight,
                  scale: viewScaleRef.current,
                  clampRect,
                });
                img.style.left = `${next.left}px`;
                img.style.top = `${next.top}px`;
              };
              const up = () => {
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", up);
                window.removeEventListener("pointercancel", up);
                onSignatureUpdatedRef.current?.(model.id, {
                  xNorm: img.offsetLeft / overlay.clientWidth,
                  yNorm: img.offsetTop / overlay.clientHeight,
                });
              };
              window.addEventListener("pointermove", move);
              window.addEventListener("pointerup", up);
              window.addEventListener("pointercancel", up);
            };
            }
          }
        } else {
        img.style.cursor = model.locked ? "default" : "move";
        img.style.pointerEvents = "auto";
        img.style.border = model.locked ? "2px dashed red" : "none";
        img.addEventListener("click", (e) => {
          e.stopPropagation();
          onSignatureSelectedRef.current?.(model.id);
        });
        if (!model.locked) {
          img.style.touchAction = "none";
          img.onpointerdown = (e) => {
            if (pinchActiveRef.current) return;
            e.preventDefault();
            e.stopPropagation();
            onSignatureSelectedRef.current?.(model.id);
            img.setPointerCapture?.(e.pointerId);
            const startX = e.clientX;
            const startY = e.clientY;
            const start = {
              left: img.offsetLeft,
              top: img.offsetTop,
              width: img.offsetWidth,
              height: img.offsetHeight,
            };
            const move = (ev: PointerEvent) => {
              if (pinchActiveRef.current) return;
              const next = dragSignatureBox({
                start,
                dx: ev.clientX - startX,
                dy: ev.clientY - startY,
                overlayWidth: overlay.clientWidth,
                overlayHeight: overlay.clientHeight,
                scale: viewScaleRef.current,
              });
              img.style.left = `${next.left}px`;
              img.style.top = `${next.top}px`;
            };
            const up = () => {
              window.removeEventListener("pointermove", move);
              window.removeEventListener("pointerup", up);
              window.removeEventListener("pointercancel", up);
              const newXNorm = img.offsetLeft / overlay.clientWidth;
              const newYNorm = img.offsetTop / overlay.clientHeight;
              onSignatureUpdatedRef.current?.(model.id, { xNorm: newXNorm, yNorm: newYNorm });
            };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", up);
            window.addEventListener("pointercancel", up);
          };
        }
        }
        overlay.appendChild(img);
      });
    });
    onSignaturesPaintedRef.current?.();
  }, [signatures, loading, renderedPageCount, recipientView, recipientSignatureId, countersignPlaceholder, touchChrome]);

  // Track visible page for "Use this" / "Place Signature" instant placement.
  useEffect(() => {
    const root = scrollContainerRef?.current;
    if (!root || !onVisiblePageChange) return;
    const container = containerRef.current;
    if (!container || loading) return;
    if (touchChrome) {
      const pickVisiblePage = () => {
        if (pinchActiveRef.current) return;
        const wrappers = container.querySelectorAll<HTMLElement>("[data-esign-page]");
        if (wrappers.length === 0) return;
        const viewport = root.getBoundingClientRect();
        const pages = Array.from(wrappers).map((el) => {
          const rect = el.getBoundingClientRect();
          return {
            page: parseInt(el.getAttribute("data-esign-page") ?? "1", 10),
            top: rect.top,
            bottom: rect.bottom,
          };
        });
        const next = visibleEsignPageFromRects(
          pages,
          viewport.top,
          viewport.bottom,
          visiblePagePickRef.current
        );
        if (next === visiblePagePickRef.current) return;
        visiblePagePickRef.current = next;
        onVisiblePageChangeRef.current?.(next);
        onPageSelectRef.current?.(next);
        setPaintFocusPage((current) => (current === next ? current : next));
      };
      root.addEventListener("scroll", pickVisiblePage, { passive: true });
      const observer = new ResizeObserver(pickVisiblePage);
      observer.observe(root);
      observer.observe(container);
      pickVisiblePage();
      return () => {
        root.removeEventListener("scroll", pickVisiblePage);
        observer.disconnect();
      };
    }
    const wrappers = container.querySelectorAll<HTMLElement>("[data-esign-page]");
    if (wrappers.length === 0) return;
    const ratiosRef = { current: new Map<number, number>() };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const page = parseInt(entry.target.getAttribute("data-esign-page") ?? "1", 10);
          ratiosRef.current.set(page, entry.intersectionRatio);
        }
        let bestPage = 1;
        let bestRatio = 0;
        ratiosRef.current.forEach((ratio, page) => {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestPage = page;
          }
        });
        onVisiblePageChange(bestPage);
        setPaintFocusPage((current) => (current === bestPage ? current : bestPage));
      },
      { root, rootMargin: "0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    wrappers.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [signatures.length, loading, renderedPageCount, scrollContainerRef, touchChrome, viewScale]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.querySelectorAll<HTMLDivElement>("[data-esign-overlay]").forEach((overlay) => {
      overlay.style.pointerEvents = placing ? "auto" : "none";
    });
  }, [placing, loading, renderedPageCount]);

  useEffect(() => {
    if (countersignPlaceholder?.locked) countersignGestureRef.current = false;
  }, [countersignPlaceholder?.locked]);

  // Sync countersign placeholder box (sender-only) into the overlay.
  // A drag keeps this node mounted. Rebuilding it while the pointer is down
  // detaches the node, and pointerup would then store a zero-size target.
  useEffect(() => {
    if (countersignGestureRef.current) return;
    if (loading || !countersignPlaceholder) return;
    const interactive = Boolean(onCountersignPlaceholderChange);
    if (!interactive && !showStaticTarget) return;
    const container = containerRef.current;
    if (!container) return;
    const overlays = container.querySelectorAll<HTMLDivElement>("[data-esign-overlay]");
    const overlay = Array.from(overlays).find((el) => el.getAttribute("data-page-number") === String(countersignPlaceholder.page));
    if (!overlay) return;

    container.querySelectorAll("[data-esign-countersign-box]").forEach((node) => node.remove());

    const w = overlay.clientWidth;
    const h = overlay.clientHeight;
    const { xNorm, yNorm, wNorm, hNorm } = countersignPlaceholder;
    const normsFinite = [xNorm, yNorm, wNorm, hNorm].every((value) => Number.isFinite(value));
    if (!(w > 0) || !(h > 0) || !normsFinite || !(wNorm > 0) || !(hNorm > 0)) return;

    const box = document.createElement("div");
    box.setAttribute("data-esign-countersign-box", countersignPlaceholder.id);
    box.style.position = "absolute";
    box.style.left = `${xNorm * w}px`;
    box.style.top = `${yNorm * h}px`;
    box.style.width = `${wNorm * w}px`;
    box.style.height = `${hNorm * h}px`;
    box.style.border = "3px dashed #dc2626";
    box.style.backgroundColor = "rgba(220,38,38,0.22)";
    box.style.outline = "1px solid rgba(255,255,255,0.95)";
    box.style.outlineOffset = "0px";
    box.style.boxSizing = "border-box";
    box.style.pointerEvents = countersignPlaceholder.locked ? "none" : "auto";
    box.style.cursor = countersignPlaceholder.locked ? "default" : "move";
    box.style.touchAction = "none";
    box.style.zIndex = "3";
    const caption = document.createElement("div");
    caption.textContent = "Recipient signature";
    caption.style.position = "absolute";
    caption.style.left = "4px";
    caption.style.top = "4px";
    caption.style.padding = "1px 4px";
    caption.style.borderRadius = "4px";
    caption.style.background = "rgba(220,38,38,0.92)";
    caption.style.color = "#fff";
    caption.style.fontSize = "10px";
    caption.style.fontWeight = "600";
    caption.style.lineHeight = "14px";
    caption.style.pointerEvents = "none";
    caption.style.whiteSpace = "nowrap";
    box.appendChild(caption);
    if (!interactive) {
      box.style.pointerEvents = "none";
      box.style.cursor = "default";
      overlay.appendChild(box);
      if (!recipientTargetScrolledRef.current) {
        recipientTargetScrolledRef.current = true;
        box.scrollIntoView({ block: "center", inline: "nearest" });
      }
      return () => {
        box.remove();
      };
    }

    const readNorms = () => {
      if (!box.isConnected) return null;
      const overlayRect = overlay.getBoundingClientRect();
      const layout = visualRectToLayoutBox(
        box.getBoundingClientRect(),
        overlayRect,
        viewScaleRef.current
      );
      const pageW = overlay.clientWidth;
      const pageH = overlay.clientHeight;
      if (!layout || !(pageW > 0) || !(pageH > 0)) return null;
      const nextW = Math.min(layout.width / pageW, 1);
      const nextH = Math.min(layout.height / pageH, 1);
      const nextX = Math.max(0, Math.min(layout.left / pageW, 1 - nextW));
      const nextY = Math.max(0, Math.min(layout.top / pageH, 1 - nextH));
      if (![nextX, nextY, nextW, nextH].every((value) => Number.isFinite(value) && value >= 0)) return null;
      if (!(nextW > 0) || !(nextH > 0)) return null;
      return {
        page: countersignPlaceholder.page,
        xNorm: nextX,
        yNorm: nextY,
        wNorm: nextW,
        hNorm: nextH,
      };
    };

    const finishGesture = () => {
      countersignGestureRef.current = false;
      const norms = readNorms();
      if (norms) {
        onCountersignPlaceholderChangeRef.current?.(norms);
      } else {
        setCountersignLayoutEpoch((value) => value + 1);
      }
    };

    if (!countersignPlaceholder.locked) {
      box.onpointerdown = (e) => {
        if ((e.target as HTMLElement).dataset.resize === "true") return;
        e.preventDefault();
        e.stopPropagation();
        countersignGestureRef.current = true;
        box.setPointerCapture?.(e.pointerId);
        const startX = e.clientX;
        const startY = e.clientY;
        const overlayRect = overlay.getBoundingClientRect();
        const origin = visualRectToLayoutBox(
          box.getBoundingClientRect(),
          overlayRect,
          viewScaleRef.current
        );
        if (!origin) {
          countersignGestureRef.current = false;
          return;
        }
        const move = (ev: PointerEvent) => {
          const delta = pointerDeltaInPageSpace(
            ev.clientX - startX,
            ev.clientY - startY,
            viewScaleRef.current
          );
          const maxLeft = Math.max(0, overlay.clientWidth - origin.width);
          const maxTop = Math.max(0, overlay.clientHeight - origin.height);
          box.style.left = `${Math.max(0, Math.min(origin.left + delta.dx, maxLeft))}px`;
          box.style.top = `${Math.max(0, Math.min(origin.top + delta.dy, maxTop))}px`;
        };
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          window.removeEventListener("pointercancel", up);
          finishGesture();
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
        window.addEventListener("pointercancel", up);
      };
      const handle = document.createElement("div");
      handle.setAttribute("data-resize", "true");
      handle.setAttribute("data-esign-resize-handle", "true");
      handle.style.position = "absolute";
      handle.style.right = "0";
      handle.style.bottom = "0";
      handle.style.width = "28px";
      handle.style.height = "28px";
      handle.style.background =
        "linear-gradient(135deg, transparent 0 46%, #111827 46% 54%, transparent 54%), #dc2626";
      handle.style.border = "2px solid #fff";
      handle.style.borderRadius = "4px 0 0 0";
      handle.style.cursor = "nwse-resize";
      handle.style.touchAction = "none";
      handle.style.zIndex = "4";
      handle.onpointerdown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        countersignGestureRef.current = true;
        handle.setPointerCapture?.(e.pointerId);
        const startX = e.clientX;
        const startY = e.clientY;
        const origin = visualRectToLayoutBox(
          box.getBoundingClientRect(),
          overlay.getBoundingClientRect(),
          viewScaleRef.current
        );
        if (!origin) {
          countersignGestureRef.current = false;
          return;
        }
        const move = (ev: PointerEvent) => {
          const delta = pointerDeltaInPageSpace(
            ev.clientX - startX,
            ev.clientY - startY,
            viewScaleRef.current
          );
          const layout = visualRectToLayoutBox(
            box.getBoundingClientRect(),
            overlay.getBoundingClientRect(),
            viewScaleRef.current
          );
          const left = layout?.left ?? origin.left;
          const top = layout?.top ?? origin.top;
          const maxW = Math.max(40, overlay.clientWidth - left);
          const maxH = Math.max(24, overlay.clientHeight - top);
          box.style.width = `${Math.max(40, Math.min(origin.width + delta.dx, maxW))}px`;
          box.style.height = `${Math.max(24, Math.min(origin.height + delta.dy, maxH))}px`;
        };
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          window.removeEventListener("pointercancel", up);
          finishGesture();
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
        window.addEventListener("pointercancel", up);
      };
      box.appendChild(handle);
    }

    overlay.appendChild(box);
    if (senderBoxRevealRef.current !== countersignPlaceholder.id) {
      senderBoxRevealRef.current = countersignPlaceholder.id;
      box.scrollIntoView({ block: "center", inline: "nearest" });
    }
    return () => {
      if (countersignGestureRef.current) return;
      box.remove();
    };
  }, [loading, countersignPlaceholder, renderedPageCount, countersignLayoutEpoch, showStaticTarget, Boolean(onCountersignPlaceholderChange)]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.querySelectorAll<HTMLElement>("[data-esign-page]").forEach((page) => {
      const pageNumber = parseInt(page.getAttribute("data-esign-page") ?? "1", 10);
      const selected = touchChrome && selectedPage === pageNumber;
      page.style.outline = selected ? "2px solid #1f1f28" : "";
      page.style.outlineOffset = selected ? "3px" : "";
    });
  }, [touchChrome, selectedPage, loading, renderedPageCount]);

  return (
    <div className="mx-auto w-full max-w-4xl">
      {loading && (
        <div className="p-4 text-sm text-zinc-600">Loading document…</div>
      )}
      {error && (
        <div className="p-4 text-sm text-red-600">{error}</div>
      )}
      <div
        ref={containerRef}
        className="mx-auto flex flex-col items-center gap-6 py-4"
      />
    </div>
  );
}

const EsignPdfViewer = React.forwardRef(EsignPdfViewerInner);

export default function EsignViewerClient({
  documentId,
}: EsignViewerClientProps) {
  const router = useRouter();
  const { user, loading } = useAuthUser();
  const { phone: phoneLayout, keyboardOpen, setShellEl } = useEsignPhoneLayout();
  const [phoneSheet, setPhoneSheet] = useState<null | "sign" | "document">(null);
  const [phoneZoom, setPhoneZoom] = useState(1);
  const [senderLockedHintDismissed, setSenderLockedHintDismissed] = useState(false);
  const [selectedPageNumber, setSelectedPageNumber] = useState(1);
  const activePageRef = useRef(1);
  const phoneZoomRef = useRef(1);
  const phonePinchActiveRef = useRef(false);
  const phonePagesRef = useRef<HTMLDivElement | null>(null);
  const phoneSpacerRef = useRef<HTMLDivElement | null>(null);
  const phoneZoomHudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phoneZoomHudElRef = useRef<HTMLDivElement | null>(null);
  if (!phonePinchActiveRef.current) phoneZoomRef.current = phoneZoom;

  const [docData, setDocData] = useState<EsignDocument | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeSignature, setActiveSignature] = useState<string | null>(null);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [signatureFileName, setSignatureFileName] = useState<string | null>(
    null
  );
  const [placing, setPlacing] = useState(false);
  const [signatures, setSignatures] = useState<SignatureModel[]>([]);
  const [selectedSignatureId, setSelectedSignatureId] = useState<string | null>(
    null
  );
  const signatureInputRef = useRef<HTMLInputElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<{
    placeSignatureAtCenter: (dataUrl: string, page: number) => boolean;
    placeSignatureAtNormalized: (
      dataUrl: string,
      page: number,
      xNorm: number,
      yNorm: number,
      wNorm: number,
      hNorm: number,
      locked: boolean
    ) => void;
    placeFittedInTarget: (
      dataUrl: string,
      target: { page: number; xNorm: number; yNorm: number; wNorm: number; hNorm: number }
    ) => Promise<boolean>;
  } | null>(null);
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const isRecipientMode = Boolean(token);
  const [inviteValid, setInviteValid] = useState<boolean>(false);
  const [inviteValidating, setInviteValidating] = useState<boolean>(Boolean(token));
  const [recipientComplete, setRecipientComplete] = useState(false);
  const [recipientCompleting, setRecipientCompleting] = useState(false);
  const [clientSignatureInserted, setClientSignatureInserted] = useState(false);
  const [clientSignatureId, setClientSignatureId] = useState<string | null>(null);
  const [signaturePaintEpoch, setSignaturePaintEpoch] = useState(0);
  const [showCompletionPopup, setShowCompletionPopup] = useState(false);
  const [visiblePageNumber, setVisiblePageNumber] = useState(1);
  const commitPhoneActivePage = useCallback((page: number) => {
    const next = Math.max(1, Math.floor(page) || 1);
    activePageRef.current = next;
    setVisiblePageNumber((current) => (current === next ? current : next));
    setSelectedPageNumber((current) => (current === next ? current : next));
  }, []);
  const [zoomMode, setZoomMode] = useState<ZoomMode>("fit");
  const [zoomScale, setZoomScale] = useState(1);
  useEffect(() => {
    if (!phoneLayout) {
      setPhoneZoom(1);
      phonePinchActiveRef.current = false;
      return;
    }
    if (loadingDoc) return;
    const scroller = scrollContainerRef.current;
    const inner = phonePagesRef.current;
    const spacer = phoneSpacerRef.current;
    if (!scroller || !inner || !spacer) return;

    const layoutUnscaledWidth = () => {
      const viewportWidth = scroller.clientWidth;
      if (viewportWidth > 0) inner.style.width = `${viewportWidth}px`;
    };

    const syncSpacer = (scale: number) => {
      layoutUnscaledWidth();
      const size = phonePinchStageSize(
        inner.offsetWidth,
        inner.offsetHeight,
        scale,
        scroller.clientWidth
      );
      spacer.style.width = `${size.width}px`;
      spacer.style.height = `${size.height}px`;
    };
    inner.style.transformOrigin = "top left";
    inner.style.willChange = "transform";
    syncSpacer(phoneZoomRef.current);

    let startDistance = 0;
    let originScale = 1;
    let raf = 0;
    let pending: { next: number; midpoint: { x: number; y: number } } | null = null;

    const showHud = (scale: number) => {
      const el = phoneZoomHudElRef.current;
      if (el) {
        el.textContent = `${phoneZoomPercent(scale)}%`;
        el.style.opacity = "1";
        el.setAttribute("aria-hidden", "false");
      }
      if (phoneZoomHudTimerRef.current) clearTimeout(phoneZoomHudTimerRef.current);
      phoneZoomHudTimerRef.current = setTimeout(() => {
        if (el) {
          el.style.opacity = "0";
          el.setAttribute("aria-hidden", "true");
        }
      }, 900);
    };

    const commitScale = (next: number, midpoint: { x: number; y: number }) => {
      const previous = phoneZoomRef.current;
      if (Math.abs(next - previous) < 0.001) return;
      const keep = scrollToKeepPinchMidpoint({
        previousScale: previous,
        nextScale: next,
        scrollLeft: scroller.scrollLeft,
        scrollTop: scroller.scrollTop,
        midpointX: midpoint.x,
        midpointY: midpoint.y,
      });
      phoneZoomRef.current = next;
      inner.style.transform = `scale(${next})`;
      syncSpacer(next);
      scroller.scrollLeft = keep.scrollLeft;
      scroller.scrollTop = keep.scrollTop;
      showHud(next);
    };

    const applyScale = (next: number, midpoint: { x: number; y: number }) => {
      pending = { next, midpoint };
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        const frame = pending;
        pending = null;
        if (frame) commitScale(frame.next, frame.midpoint);
      });
    };

    const onStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        phonePinchActiveRef.current = true;
        startDistance = touchDistance(event.touches[0], event.touches[1]);
        originScale = phoneZoomRef.current;
        if (event.cancelable) event.preventDefault();
      }
    };
    const onMove = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      phonePinchActiveRef.current = true;
      if (event.cancelable) event.preventDefault();
      if (!(startDistance > 0)) {
        startDistance = touchDistance(event.touches[0], event.touches[1]);
        originScale = phoneZoomRef.current;
      }
      const next = pinchScaleFromDistance(
        startDistance,
        touchDistance(event.touches[0], event.touches[1]),
        originScale
      );
      const rect = scroller.getBoundingClientRect();
      applyScale(
        next,
        pinchMidpointInScroller(event.touches[0], event.touches[1], rect)
      );
    };
    const onEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) {
        phonePinchActiveRef.current = false;
        startDistance = 0;
        const leftover = pending;
        pending = null;
        if (raf) {
          window.cancelAnimationFrame(raf);
          raf = 0;
        }
        if (leftover) commitScale(leftover.next, leftover.midpoint);
        inner.style.transform = `scale(${phoneZoomRef.current})`;
        syncSpacer(phoneZoomRef.current);
        setPhoneZoom(phoneZoomRef.current);
      }
    };
    const preventGesture = (event: Event) => {
      if (event.cancelable) event.preventDefault();
    };

    scroller.addEventListener("touchstart", onStart, { passive: false });
    scroller.addEventListener("touchmove", onMove, { passive: false });
    scroller.addEventListener("touchend", onEnd);
    scroller.addEventListener("touchcancel", onEnd);
    scroller.addEventListener("gesturestart", preventGesture, { passive: false });
    scroller.addEventListener("gesturechange", preventGesture, { passive: false });
    scroller.addEventListener("gestureend", preventGesture, { passive: false });
    const observer = new ResizeObserver(() => {
      if (phonePinchActiveRef.current) return;
      syncSpacer(phoneZoomRef.current);
    });
    observer.observe(scroller);
    observer.observe(inner);
    return () => {
      observer.disconnect();
      if (raf) window.cancelAnimationFrame(raf);
      if (phoneZoomHudTimerRef.current) clearTimeout(phoneZoomHudTimerRef.current);
      inner.style.willChange = "";
      scroller.removeEventListener("touchstart", onStart);
      scroller.removeEventListener("touchmove", onMove);
      scroller.removeEventListener("touchend", onEnd);
      scroller.removeEventListener("touchcancel", onEnd);
      scroller.removeEventListener("gesturestart", preventGesture);
      scroller.removeEventListener("gesturechange", preventGesture);
      scroller.removeEventListener("gestureend", preventGesture);
    };
  }, [phoneLayout, loadingDoc]);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [countersignSetupOpen, setCountersignSetupOpen] = useState(false);
  const [countersignLockHint, setCountersignLockHint] = useState(false);
  const [countersignSending, setCountersignSending] = useState(false);
  const [countersignShareError, setCountersignShareError] = useState<string | null>(null);
  const countersignSendingRef = useRef(false);
  const countersignShareTapRef = useRef(0);
  const [senderEmail, setSenderEmail] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [counterMessage, setCounterMessage] = useState("");
  const [backgroundRemoved, setBackgroundRemoved] = useState(false);
  const [removingBg, setRemovingBg] = useState(false);
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(
    null
  );
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [mobileSigningUrl, setMobileSigningUrl] = useState<string | null>(null);
  const [mobileSigningQrDataUrl, setMobileSigningQrDataUrl] = useState<string | null>(
    null
  );
  const [mobileSigningSessionId, setMobileSigningSessionId] = useState<string | null>(
    null
  );
  const [mobileSigningExpiresAt, setMobileSigningExpiresAt] = useState<string | null>(
    null
  );
  const [mobileSigningLoading, setMobileSigningLoading] = useState(false);
  const [mobileSigningError, setMobileSigningError] = useState<string | null>(null);
  const [mobileSignatureFetching, setMobileSignatureFetching] = useState(false);
  const [mobileSignatureFetchError, setMobileSignatureFetchError] = useState<string | null>(
    null
  );
  const [mobileSignatureReady, setMobileSignatureReady] = useState(false);
  const [mobileSigningStatusMessage, setMobileSigningStatusMessage] = useState<
    string | null
  >(null);
  const [countersignPlaceholder, setCountersignPlaceholder] = useState<CountersignPlaceholderModel | null>(null);
  const [countersignLockError, setCountersignLockError] = useState<string | null>(null);
  const [countersignLockPending, setCountersignLockPending] = useState(false);
  const countersignLockTapRef = useRef(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  const signaturesRef = useRef<SignatureModel[]>(signatures);
  const countersignPlaceholderRef = useRef<CountersignPlaceholderModel | null>(countersignPlaceholder);
  const docDataRef = useRef<EsignDocument | null>(docData);
  const initialLoadDoneRef = useRef(false);
  const insertingRef = useRef(false);
  const senderInsertBlockedRef = useRef(false);
  const recipientInsertBlockedRef = useRef(false);
  const recipientInsertInFlightRef = useRef(false);
  const clientSignatureInsertedRef = useRef(false);
  const completionTrackedRef = useRef(false);
  const pendingRecipientInsertRef = useRef(false);
  const lastMobileSignatureRef = useRef<string | null>(null);
  signaturesRef.current = signatures;
  countersignPlaceholderRef.current = countersignPlaceholder;
  docDataRef.current = docData;

  useEffect(() => {
    senderInsertBlockedRef.current = signatures.length > 0;
  }, [signatures.length]);

  const saveDocumentProgress = useCallback(() => {
    const docRef = doc(db, "esign_documents", documentId);
    const sigs = signaturesRef.current;
    const ph = countersignPlaceholderRef.current;
    const data = docDataRef.current;
    let status: "draft" | "waiting_countersign" | "completed" = "draft";
    if (data?.status === "completed") status = "completed";
    else if (data?.countersignStatus === "sent") status = "waiting_countersign";
    else if (sigs.length > 0) status = "draft";
    setSaveState("saving");
    updateDoc(docRef, {
      placements: sigs,
      countersignPlaceholder: ph ?? null,
      updatedAt: serverTimestamp(),
      status,
    })
      .then(() => {
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 2000);
      })
      .catch((err) => {
        console.warn("E-sign autosave failed:", err);
        setSaveState("idle");
      });
  }, [documentId]);

  const saveRef = useRef(saveDocumentProgress);
  saveRef.current = saveDocumentProgress;
  const debouncedSaveRef = useRef(debounce(() => saveRef.current(), 800));

  useEffect(() => {
    if (!loadingDoc && docData) initialLoadDoneRef.current = true;
  }, [loadingDoc, docData]);

  useEffect(() => {
    if (!initialLoadDoneRef.current || isRecipientMode || !documentId || !user) return;
    debouncedSaveRef.current();
  }, [signatures, countersignPlaceholder, isRecipientMode, documentId, user]);

  // Global event: insert current sender signature into the viewer.
  

  // Sync selection, locked state, size, and resize handle to signature DOM elements.
  useEffect(() => {
    signatures.forEach((sig) => {
      const el = document.querySelector<HTMLImageElement>(
        `[data-esign-sig-id="${sig.id}"]`
      );
      if (!el) return;
      const overlay = el.parentElement as HTMLDivElement | null;
      if (overlay?.clientWidth) {
        el.style.width = `${sig.wNorm * overlay.clientWidth}px`;
        el.style.height = `${sig.hNorm * overlay.clientHeight}px`;
      }
      const locked = sig.locked ?? false;
      const ownRecipient = !isRecipientMode || sig.id === clientSignatureId;
      if (isRecipientMode && !ownRecipient) {
        el.style.pointerEvents = "none";
        el.style.cursor = "default";
        el.style.border = "none";
        return;
      }
      if (isRecipientMode) {
        el.style.pointerEvents = locked ? "none" : "auto";
        el.style.cursor = "default";
        el.style.border =
          !locked && sig.id === selectedSignatureId ? "2px solid #3b82f6" : "none";
        return;
      }
      el.style.pointerEvents = "auto";
      el.style.cursor = locked ? "default" : "move";
      if (locked) {
        el.style.border = "2px dashed red";
      } else {
        el.style.border =
          sig.id === selectedSignatureId ? "2px solid #3b82f6" : "none";
      }
    });
    // Remove any existing resize handles from previous selection.
    document.querySelectorAll("[data-esign-resize-handle]").forEach((h) => h.remove());
    const selected = signatures.find((s) => s.id === selectedSignatureId);
    const recipientOwnsSelection = !isRecipientMode || selected?.id === clientSignatureId;
    if (selected && !(selected.locked ?? false) && recipientOwnsSelection) {
      const el = document.querySelector<HTMLImageElement>(
        `[data-esign-sig-id="${selectedSignatureId}"]`
      );
      const overlay = el?.parentElement as HTMLDivElement | null;
      if (el && overlay) {
        const phoneHandles = phoneLayout;
        const corners: EsignResizeCorner[] = phoneHandles
          ? ["tl", "tr", "bl", "br"]
          : ["br"];
        const size = phoneHandles ? 18 : 10;
        const placeHandle = (handle: HTMLDivElement, corner: EsignResizeCorner) => {
          const left =
            corner === "tl" || corner === "bl"
              ? el.offsetLeft - size / 2
              : el.offsetLeft + el.offsetWidth - size / 2;
          const top =
            corner === "tl" || corner === "tr"
              ? el.offsetTop - size / 2
              : el.offsetTop + el.offsetHeight - size / 2;
          handle.style.left = `${left}px`;
          handle.style.top = `${top}px`;
        };
        corners.forEach((corner) => {
        const handle = document.createElement("div");
        handle.setAttribute("data-esign-resize-handle", selected.id);
        handle.dataset.corner = corner;
        handle.style.position = "absolute";
        handle.style.width = `${size}px`;
        handle.style.height = `${size}px`;
        handle.style.backgroundColor = "#3b82f6";
        handle.style.border = phoneHandles ? "2px solid #ffffff" : "none";
        handle.style.zIndex = "6";
        handle.style.pointerEvents = "auto";
        handle.style.touchAction = "none";
        handle.style.cursor =
          corner === "tl" || corner === "br" ? "nwse-resize" : "nesw-resize";
        handle.style.borderRadius = phoneHandles ? "999px" : "2px";
        placeHandle(handle, corner);
        handle.onpointerdown = (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (phonePinchActiveRef.current) return;
          handle.setPointerCapture?.(e.pointerId);
          const startX = e.clientX;
          const startY = e.clientY;
          const origW = el.offsetWidth;
          const origH = el.offsetHeight;
          const start = {
            left: el.offsetLeft,
            top: el.offsetTop,
            width: origW,
            height: origH,
          };
          const move = (ev: PointerEvent) => {
            if (phoneHandles) {
              const overlayWidth = overlay.clientWidth;
              const overlayHeight = overlay.clientHeight;
              const clampRect =
                isRecipientMode && countersignPlaceholder
                  ? {
                      left: countersignPlaceholder.xNorm * overlayWidth,
                      top: countersignPlaceholder.yNorm * overlayHeight,
                      width: countersignPlaceholder.wNorm * overlayWidth,
                      height: countersignPlaceholder.hNorm * overlayHeight,
                    }
                  : null;
              const next = resizeSignatureBox({
                corner,
                start,
                dx: ev.clientX - startX,
                dy: ev.clientY - startY,
                overlayWidth,
                overlayHeight,
                aspect: origW / Math.max(origH, 1),
                scale: phoneZoomRef.current,
                clampRect,
              });
              el.style.left = `${next.left}px`;
              el.style.top = `${next.top}px`;
              el.style.width = `${next.width}px`;
              el.style.height = `${next.height}px`;
            } else if (isRecipientMode && countersignPlaceholder) {
              const overlayWidth = overlay.clientWidth;
              const overlayHeight = overlay.clientHeight;
              const targetLeft = countersignPlaceholder.xNorm * overlayWidth;
              const targetTop = countersignPlaceholder.yNorm * overlayHeight;
              const targetRight = targetLeft + countersignPlaceholder.wNorm * overlayWidth;
              const targetBottom = targetTop + countersignPlaceholder.hNorm * overlayHeight;
              const aspect = origW / Math.max(origH, 1);
              let nextWidth = Math.max(24, origW + ev.clientX - startX);
              let nextHeight = nextWidth / aspect;
              const maxWidth = Math.max(24, targetRight - el.offsetLeft - 1);
              const maxHeight = Math.max(24, targetBottom - el.offsetTop - 1);
              if (nextWidth > maxWidth) {
                nextWidth = maxWidth;
                nextHeight = nextWidth / aspect;
              }
              if (nextHeight > maxHeight) {
                nextHeight = maxHeight;
                nextWidth = nextHeight * aspect;
              }
              el.style.width = `${nextWidth}px`;
              el.style.height = `${nextHeight}px`;
            } else {
              el.style.width = `${Math.max(32, origW + ev.clientX - startX)}px`;
              el.style.height = `${Math.max(24, origH + ev.clientY - startY)}px`;
            }
            document.querySelectorAll<HTMLDivElement>("[data-esign-resize-handle]").forEach((node) => {
              const handleCorner = (node.dataset.corner || "br") as EsignResizeCorner;
              placeHandle(node, handleCorner);
            });
          };
          const up = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            window.removeEventListener("pointercancel", up);
            const nw = overlay.clientWidth;
            const nh = overlay.clientHeight;
            setSignatures((prev) =>
              prev.map((s) =>
                s.id === selectedSignatureId
                  ? {
                      ...s,
                      xNorm: el.offsetLeft / nw,
                      yNorm: el.offsetTop / nh,
                      wNorm: el.offsetWidth / nw,
                      hNorm: el.offsetHeight / nh,
                    }
                  : s
              )
            );
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
          window.addEventListener("pointercancel", up);
        };
        overlay.appendChild(handle);
        });
      }
    }
  }, [signatures, selectedSignatureId, isRecipientMode, clientSignatureId, countersignPlaceholder, signaturePaintEpoch]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const next = token
        ? `/tools/esign/${documentId}?token=${encodeURIComponent(token)}`
        : null;
      router.replace(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
    }
  }, [loading, user, router, token, documentId]);

  useEffect(() => {
    let alive = true;
    if (!isRecipientMode || !user || !token) return;
    const run = async () => {
      try {
        setInviteValidating(true);
        const idToken = await user.getIdToken();
        const res = await fetch(
          `/api/esign/invite/validate?documentId=${encodeURIComponent(
            documentId
          )}&token=${encodeURIComponent(token)}`,
          {
            method: "GET",
            headers: { Authorization: `Bearer ${idToken}` },
          }
        );
        const json = await res.json().catch(() => null);
        if (!alive) return;
        if (json?.completed || json?.invite?.status === "completed") {
          setInviteValid(true);
          setRecipientComplete(true);
          setDocData((prev) =>
            prev
              ? {
                  ...prev,
                  status: "completed",
                  countersignStatus: "completed",
                  finalPdfUrl:
                    typeof json.finalPdfUrl === "string" ? json.finalPdfUrl : prev.finalPdfUrl,
                }
              : prev
          );
          return;
        }
        setInviteValid(res.ok);
      } catch {
        if (!alive) return;
        setInviteValid(false);
      } finally {
        if (!alive) return;
        setInviteValidating(false);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [isRecipientMode, user, token, documentId]);

  // One-time initial load for interactive state (signatures & placeholder).
  useEffect(() => {
    let alive = true;
    if (!user) return;
    const loadDoc = async () => {
      try {
        setLoadingDoc(true);
        const ref = doc(db, "esign_documents", documentId);
        const snap = await getDoc(ref);
        if (!alive) return;
        if (!snap.exists()) {
          setNotFound(true);
          setDocData(null);
          return;
        }
        const data = snap.data() as any;
        setDocData({
          ownerUid: data.ownerUid,
          fileName: data.fileName ?? "Untitled document",
          status: data.status ?? "draft",
          createdAt: data.createdAt ?? null,
          updatedAt: data.updatedAt ?? null,
          pagesCount: data.pagesCount ?? null,
          finalPdfUrl: data.finalPdfUrl ?? null,
          countersignStatus: data.countersignStatus ?? null,
        });
        const placements = Array.isArray(data.placements) ? data.placements : [];
        const restoredSignatures = placements
          .map((p: any) => ({
            id: p.id ?? crypto.randomUUID?.(),
            page: Number(p.page) || 1,
            xNorm: Number(p.xNorm) ?? 0,
            yNorm: Number(p.yNorm) ?? 0,
            wNorm: Number(p.wNorm) ?? 0.2,
            hNorm: Number(p.hNorm) ?? 0.08,
            imageDataUrl: typeof p.imageDataUrl === "string" ? p.imageDataUrl : "",
            locked: isRecipientMode ? true : Boolean(p.locked),
          }))
          .filter((s: SignatureModel) => s.imageDataUrl);
        setSignatures(restoredSignatures);
        const ph = data.countersignPlaceholder;
        setCountersignPlaceholder(
          ph && typeof ph === "object" && typeof ph.page === "number"
            ? {
                id: ph.id ?? crypto.randomUUID?.(),
                page: Number(ph.page) || 1,
                xNorm: Number(ph.xNorm) ?? 0,
                yNorm: Number(ph.yNorm) ?? 0,
                wNorm: Number(ph.wNorm) ?? 0.25,
                hNorm: Number(ph.hNorm) ?? 0.1,
                locked: Boolean(ph.locked),
              }
            : null
        );
        setNotFound(false);
      } catch (e) {
        if (!alive) return;
        console.warn("Failed to load e-sign document", e);
        setNotFound(true);
        setDocData(null);
      } finally {
        if (!alive) return;
        setLoadingDoc(false);
      }
    };

    loadDoc();

    return () => {
      alive = false;
    };
  }, [user, documentId, isRecipientMode]);

  // Start the original download as soon as the sender is known so it overlaps
  // Firestore metadata. A same-tab upload already stored these bytes.
  useEffect(() => {
    if (!user || !documentId) return;
    const url = `/api/esign/download?documentId=${encodeURIComponent(documentId)}`;
    loadEsignOriginalPreview(documentId, async () => {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to download document");
      return new Uint8Array(await response.arrayBuffer());
    }).catch(() => {
      // The PDF viewer surfaces the failure if the bytes are still unavailable.
    });
  }, [user, documentId]);

  useEffect(() => {
    if (
      docData?.countersignStatus === "sent" ||
      docData?.countersignStatus === "completed"
    ) {
      setCountersignSetupOpen(true);
    }
  }, [docData?.countersignStatus]);

  // Lightweight realtime listener for document metadata (status/progress only).
  useEffect(() => {
    if (!user) return;

    const ref = doc(db, "esign_documents", documentId);

    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as any;
        setDocData((prev) =>
          prev
            ? {
                ...prev,
                ownerUid: data.ownerUid,
                fileName: data.fileName ?? prev.fileName,
                status: data.status ?? "draft",
                createdAt: data.createdAt ?? null,
                updatedAt: data.updatedAt ?? null,
                pagesCount: data.pagesCount ?? null,
                finalPdfUrl: data.finalPdfUrl ?? null,
                countersignStatus: data.countersignStatus ?? null,
              }
            : {
                ownerUid: data.ownerUid,
                fileName: data.fileName ?? "Untitled document",
                status: data.status ?? "draft",
                createdAt: data.createdAt ?? null,
                updatedAt: data.updatedAt ?? null,
                pagesCount: data.pagesCount ?? null,
                finalPdfUrl: data.finalPdfUrl ?? null,
                countersignStatus: data.countersignStatus ?? null,
              }
        );
      },
      (error) => {
        console.warn("Failed to subscribe to e-sign document", error);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user, documentId]);

  // Ensure placeholder loads in recipient mode even if other fields don't.
  useEffect(() => {
    let alive = true;
    const loadPlaceholder = async () => {
      try {
        const snap = await getDoc(doc(db, "esign_documents", documentId));
        if (!alive) return;
        const data = snap.data() as any;
        if (data?.countersignPlaceholder) {
          setCountersignPlaceholder(data.countersignPlaceholder);
          // eslint-disable-next-line no-console
          console.log("Client placeholder:", data.countersignPlaceholder);
        }
      } catch {
        // ignore
      }
    };
    if (documentId && isRecipientMode) loadPlaceholder();
    return () => {
      alive = false;
    };
  }, [documentId, isRecipientMode]);

  const handleUploadSignature = (file: File) => {
    if (!file) return;
    if (!isPngOrJpegSignatureFile(file)) {
      alert(SIGNATURE_UPLOAD_REJECTED_MESSAGE);
      return;
    }
    const name = file.name || "";
    setSignatureFileName(name);
    try {
      setUploadingSignature(true);
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === "string") {
          setActiveSignature(result);
        }
        setUploadingSignature(false);
      };
      reader.onerror = () => {
        setUploadingSignature(false);
        alert("Failed to read signature file.");
      };
      reader.readAsDataURL(file);
    } catch {
      setUploadingSignature(false);
      alert("Failed to load signature file.");
    }
  };

  const handleGenerateMobileSigningLink = async () => {
    if (!user) {
      setMobileSigningError("Please sign in first.");
      return;
    }

    setMobileSigningLoading(true);
    setMobileSigningError(null);
    setMobileSigningStatusMessage(null);
    setMobileSignatureFetchError(null);
    setMobileSignatureReady(false);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/esign/mobile-sign/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          documentId,
          ...(isRecipientMode && token ? { inviteToken: token } : {}),
        }),
      });

      const json = await res.json().catch(() => null);
      if (
        !res.ok ||
        !json?.ok ||
        typeof json.mobileSigningUrl !== "string" ||
        typeof json.sessionId !== "string"
      ) {
        setMobileSigningError(
          "Mobile signing session could not be created. Please regenerate the QR link."
        );
        setMobileSigningSessionId(null);
        setMobileSigningQrDataUrl(null);
        setMobileSigningUrl(null);
        return;
      }

      const url = json.mobileSigningUrl as string;
      const sessionId = json.sessionId as string;
      const qrModule = await import("qrcode");
      const qrDataUrl = await qrModule.toDataURL(url, {
        width: 220,
        margin: 1,
        errorCorrectionLevel: "M",
      });

      setMobileSigningSessionId(sessionId);
      setMobileSigningUrl(url);
      setMobileSigningQrDataUrl(qrDataUrl);
      lastMobileSignatureRef.current = null;
      setMobileSigningExpiresAt(
        typeof json.expiresAt === "string" ? json.expiresAt : null
      );
      setMobileSignatureFetchError(null);
      setMobileSignatureReady(false);
    } catch {
      setMobileSigningError("Failed to generate mobile signing link.");
    } finally {
      setMobileSigningLoading(false);
    }
  };

  const handleFetchMobileSignature = async () => {
    console.log("[MobileSign] Fetch clicked", {
      hasUser: !!user,
      mobileSigningSessionId,
    });

    if (!mobileSigningSessionId) {
      setMobileSignatureFetchError(
        "Mobile session ID missing. Please regenerate the QR link."
      );
      setMobileSignatureReady(false);
      return;
    }
    if (!user) {
      setMobileSignatureFetchError(
        "Please sign in again to fetch the mobile signature."
      );
      setMobileSignatureReady(false);
      return;
    }

    setMobileSignatureFetching(true);
    setMobileSignatureFetchError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(
        `/api/esign/mobile-sign/fetch?sessionId=${encodeURIComponent(
          mobileSigningSessionId
        )}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok || typeof json.signatureDataUrl !== "string") {
        setMobileSignatureFetchError(
          typeof json?.error === "string"
            ? json.error
            : "Failed to fetch mobile signature."
        );
        setMobileSignatureReady(false);
        return;
      }

      const signatureDataUrl = json.signatureDataUrl as string;
      setActiveSignature(signatureDataUrl);
      lastMobileSignatureRef.current = signatureDataUrl;
      setMobileSignatureReady(true);
      setMobileSigningStatusMessage(
        "Mobile signature fetched. Click Insert mobile signature to place it."
      );
      setMobileSigningError(null);
      setMobileSignatureFetchError(null);
    } catch {
      setMobileSignatureFetchError("Failed to fetch mobile signature.");
      setMobileSignatureReady(false);
    } finally {
      setMobileSignatureFetching(false);
    }
  };

  useEffect(() => {
    if (!mobileSigningSessionId || isRecipientMode) return;

    const sessionRef = doc(
      db,
      "esign_mobile_signature_sessions",
      mobileSigningSessionId
    );

    const unsubscribe = onSnapshot(
      sessionRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as Record<string, unknown>;
        if (data.status !== "submitted") return;
        const signatureDataUrl =
          typeof data.signatureDataUrl === "string" ? data.signatureDataUrl : "";
        if (!signatureDataUrl.startsWith("data:image/png;base64,")) return;
        if (lastMobileSignatureRef.current === signatureDataUrl) return;

        lastMobileSignatureRef.current = signatureDataUrl;
        setActiveSignature(signatureDataUrl);
        setMobileSigningError(null);
        setMobileSignatureReady(true);
        setMobileSignatureFetchError(null);
        setMobileSigningStatusMessage(
          "Signature received from mobile. Click Insert to place it."
        );
      },
      (error) => {
        console.warn("Failed to subscribe to mobile signing session", error);
        setMobileSignatureReady(false);
        setMobileSigningStatusMessage(
          "Unable to receive mobile signature. Please refresh and try again."
        );
      }
    );

    return () => {
      unsubscribe();
    };
  }, [mobileSigningSessionId, isRecipientMode]);

  const handleSignatureFileChange = (e: any) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    handleUploadSignature(file);
  };

  const insertClientSignature = async (signatureData?: string) => {
    if (
      recipientInsertBlockedRef.current ||
      recipientInsertInFlightRef.current ||
      clientSignatureId
    ) {
      return;
    }
    const target = readLockedCountersignTarget(countersignPlaceholder);
    if (!target) {
      alert("This agreement has no countersign position. Completion is unavailable.");
      return;
    }
    const sig = signatureData || activeSignature;
    if (!sig) {
      alert("Please draw or upload your signature first");
      return;
    }
    recipientInsertBlockedRef.current = true;
    recipientInsertInFlightRef.current = true;
    pendingRecipientInsertRef.current = true;
    try {
      const placed = await viewerRef.current?.placeFittedInTarget(sig, target);
      if (!placed) {
        recipientInsertBlockedRef.current = false;
        pendingRecipientInsertRef.current = false;
        alert("The signature could not be placed inside the countersign box.");
        return;
      }
      clientSignatureInsertedRef.current = true;
      setClientSignatureInserted(true);
    } finally {
      recipientInsertInFlightRef.current = false;
    }
  };

  const handleDeleteSignature = () => {
    if (!selectedSignatureId) return;
    if (isRecipientMode && selectedSignatureId !== clientSignatureId) return;
    setSignatures((prev) => prev.filter((s) => s.id !== selectedSignatureId));
    document
      .querySelector(`[data-esign-sig-id="${selectedSignatureId}"]`)
      ?.remove();
    setSelectedSignatureId(null);
    if (isRecipientMode) {
      recipientInsertBlockedRef.current = false;
      clientSignatureInsertedRef.current = false;
      setClientSignatureInserted(false);
      setClientSignatureId(null);
    }
  };

  const handleLockSignature = () => {
    if (!selectedSignatureId) return;
    if (isRecipientMode && selectedSignatureId !== clientSignatureId) return;
    setSignatures((prev) =>
      prev.map((s) =>
        s.id === selectedSignatureId
          ? { ...s, locked: !(s.locked ?? false) }
          : s
      )
    );
  };

  const handleCountersignPlaceholderChange = useCallback(
    (next: { page: number; xNorm: number; yNorm: number; wNorm: number; hNorm: number }) => {
      const alreadySent =
        inviteSent ||
        docDataRef.current?.countersignStatus === "sent" ||
        docDataRef.current?.countersignStatus === "completed";
      if (alreadySent) return;
      setCountersignPlaceholder((current) => (current ? { ...current, ...next } : null));
    },
    [inviteSent]
  );

  const handleLockCountersignPosition = useCallback(
    (event?: { preventDefault?: () => void; stopPropagation?: () => void }) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      const now = Date.now();
      if (now - countersignLockTapRef.current < 400) return;
      countersignLockTapRef.current = now;
      if (countersignLockPending) return;
      const alreadySent =
        inviteSent ||
        docDataRef.current?.countersignStatus === "sent" ||
        docDataRef.current?.countersignStatus === "completed";
      const resolved = resolveCountersignLock({
        invitationAlreadySent: alreadySent,
        hasPlaceholder: Boolean(countersignPlaceholderRef.current),
        alreadyLocked: Boolean(countersignPlaceholderRef.current?.locked),
      });
      if (resolved.action === "error") {
        setCountersignLockError(resolved.error);
        return;
      }
      setCountersignLockError(null);
      if (resolved.action === "already_locked") return;
      setCountersignLockPending(true);
      setCountersignPlaceholder((current) =>
        current ? { ...current, locked: true } : current
      );
      setCountersignLockPending(false);
    },
    [inviteSent, countersignLockPending]
  );

  const handleShareForCountersign = useCallback(
    async (event?: { preventDefault?: () => void; stopPropagation?: () => void }) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      const now = Date.now();
      if (now - countersignShareTapRef.current < 400) return;
      countersignShareTapRef.current = now;
      if (countersignSendingRef.current) return;
      const alreadySent =
        inviteSent ||
        docDataRef.current?.countersignStatus === "sent" ||
        docDataRef.current?.countersignStatus === "completed";
      const placeholderLocked = Boolean(countersignPlaceholderRef.current?.locked);
      const lockedSignature = signaturesRef.current.some((signature) => signature.locked);
      const sender = senderEmail.trim();
      const client = clientEmail.trim();
      if (alreadySent) {
        setCountersignShareError("This countersign request was already sent.");
        return;
      }
      if (!lockedSignature || !placeholderLocked || !sender || !client) {
        setCountersignShareError(
          "Enter both official emails, then tap Share for countersign."
        );
        return;
      }
      if (!user) {
        setCountersignShareError("Please sign in first.");
        return;
      }
      countersignSendingRef.current = true;
      setCountersignSending(true);
      setCountersignShareError(null);
      try {
        const idToken = await user.getIdToken();
        const res = await fetch("/api/esign/invite", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            documentId,
            senderEmail: sender,
            clientEmail: client,
            message: counterMessage.trim(),
          }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          setCountersignShareError(
            json?.error || "Failed to create countersign invite. Please try again."
          );
          return;
        }
        trackEsignDataLayerEvent(
          esignCountersignShareDataLayerEvent({ inviteSucceeded: true })
        );
        const url = `${window.location.origin}${json.url}`;
        setGeneratedInviteLink(url);
        setCopiedInvite(false);
        setInviteSent(true);
        const snap = await getDoc(doc(db, "esign_documents", documentId));
        if (snap.exists()) {
          const d = snap.data() as EsignDocument;
          setDocData((prev) =>
            prev
              ? {
                  ...prev,
                  countersignStatus: d.countersignStatus ?? prev.countersignStatus,
                  status: d.status ?? prev.status,
                }
              : prev
          );
        }
      } catch {
        setCountersignShareError(
          "Failed to create countersign request. Please try again."
        );
      } finally {
        countersignSendingRef.current = false;
        setCountersignSending(false);
      }
    },
    [
      clientEmail,
      counterMessage,
      countersignSending,
      documentId,
      inviteSent,
      senderEmail,
      user,
    ]
  );

  useEffect(() => {
    if (
      signatures.length === 0 ||
      signatures.some((signature) => !signature.locked)
    ) {
      setSenderLockedHintDismissed(false);
    }
  }, [signatures]);

  const handleRecipientComplete = async () => {
    if (!user || !token) {
      alert("Please sign in first.");
      return;
    }
    const ownSignature = signatures.find((s) => s.id === clientSignatureId);
    if (
      !clientSignatureId ||
      !ownSignature ||
      typeof ownSignature.imageDataUrl !== "string" ||
      ownSignature.imageDataUrl.length === 0
    ) {
      alert("Recipient signature is missing. Refresh the page and try again.");
      return;
    }
    setRecipientCompleting(true);
    try {
      const idToken = await user.getIdToken();
      const placements = [
        {
          id: ownSignature.id,
          page: ownSignature.page,
          xNorm: ownSignature.xNorm,
          yNorm: ownSignature.yNorm,
          wNorm: ownSignature.wNorm,
          hNorm: ownSignature.hNorm,
          imageDataUrl: ownSignature.imageDataUrl,
          locked: ownSignature.locked ?? false,
        },
      ];
      const res = await fetch("/api/esign/invite/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ documentId, token, placements }),
      });
      const json = await res.json().catch(() => null);
      if (res.status === 409) {
        alert(json?.error ?? "Completion is already in progress.");
        return;
      }
      if (!res.ok || !json?.ok) {
        alert(json?.error ?? "Failed to complete signing.");
        return;
      }
      if (json.alreadyCompleted) {
        setRecipientComplete(true);
        setDocData((prev) =>
          prev
            ? {
                ...prev,
                status: "completed",
                countersignStatus: "completed",
                finalPdfUrl: json.signedPdfUrl ?? prev.finalPdfUrl,
              }
            : prev
        );
        return;
      }
      if (!completionTrackedRef.current) {
        trackEvent("esign_completion_success", { surface: "esign" });
        completionTrackedRef.current = true;
      }
      setRecipientComplete(true);
      setShowCompletionPopup(true);
    } catch {
      alert("Failed to complete signing. Please try again.");
    } finally {
      setRecipientCompleting(false);
    }
  };

  if (loading || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center text-zinc-700">
        Loading…
      </main>
    );
  }

  if (loadingDoc) {
    return (
      <main className="min-h-screen flex items-center justify-center text-zinc-700">
        Loading document…
      </main>
    );
  }

  if (notFound || !docData) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center text-zinc-700">
        <p className="text-sm">This e‑sign document could not be found.</p>
        <button
          type="button"
          onClick={() => router.push("/tools")}
          className="mt-4 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm hover:border-blue-300"
        >
          Back to e-sign tools
        </button>
      </main>
    );
  }

  const createdLabel = (() => {
    try {
      const ts: any = docData.createdAt;
      const d: Date | null =
        ts?.toDate?.() instanceof Date
          ? ts.toDate()
          : ts instanceof Date
          ? ts
          : null;
      if (!d) return "";
      return d.toLocaleString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "";
    }
  })();

  const statusLabel = esignTitleStatus({
    status: docData.status,
    countersignStatus: docData.countersignStatus,
    recipientComplete,
  });

  const hasLockedSignature = signatures.some((s) => s.locked ?? false);
  const invitationAlreadySent =
    inviteSent ||
    docData.countersignStatus === "sent" ||
    docData.countersignStatus === "completed";
  const canShareCountersign =
    signatures.length > 0 &&
    hasLockedSignature &&
    Boolean(countersignPlaceholder?.locked) &&
    senderEmail.trim().length > 0 &&
    clientEmail.trim().length > 0;

  const step1Done =
    signatures.length >= 1 && hasLockedSignature;

  const step2Done =
    countersignPlaceholder !== null &&
    (countersignPlaceholder.locked ?? false);

  const step3Done =
    docData.countersignStatus === "sent" ||
    docData.countersignStatus === "completed";

  const step4Done =
    docData.countersignStatus === "completed";

  const step5Done =
    docData.status === "completed" || recipientComplete;

  const currentStep =
    step5Done ? 5 :
    step4Done ? 4 :
    step3Done ? 3 :
    step2Done ? 2 :
    step1Done ? 1 :
    0;

  const steps = [
    { label: "Initial Sign", done: step1Done },
    { label: "Countersign Position", done: step2Done },
    { label: "Sent for Countersign", done: step3Done },
    { label: "Countersigned", done: step4Done },
    { label: "Agreement Completed", done: step5Done },
  ];

  const signatureLocked =
    selectedSignatureId != null
      ? Boolean(signatures.find((s) => s.id === selectedSignatureId)?.locked)
      : false;
  const recipientLockedSignature = signatures.some(
    (s) => s.id === clientSignatureId && s.locked && s.imageDataUrl
  );
  const phase = recipientPhase({
    status: docData.status,
    recipientComplete,
    recipientCompleting,
    recipientLockedSignature,
    clientSignatureInserted,
    inviteValid,
    inviteValidating,
  });
  const recipientCanComplete = recipientActionEnabled(phase);
      const handleSenderInsert = (signatureOverride?: string) => {
        const sig = signatureOverride || activeSignature;
        if (!sig) {
          alert("Please draw or upload your signature first.");
          return;
        }
        if (
          senderInsertBlockedRef.current ||
          signaturesRef.current.length > 0 ||
          insertingRef.current
        ) {
          return;
        }
        senderInsertBlockedRef.current = true;
        insertingRef.current = true;
        const placed = viewerRef.current?.placeSignatureAtCenter(
          sig,
          phoneLayout
            ? activePageRef.current || selectedPageNumber || visiblePageNumber || 1
            : selectedPageNumber || visiblePageNumber || 1
        );
        if (!placed) {
          senderInsertBlockedRef.current = signaturesRef.current.length > 0;
        }
        setTimeout(() => {
          insertingRef.current = false;
        }, 200);
      };

  const recipientTarget = isRecipientMode
    ? readLockedCountersignTarget(countersignPlaceholder)
    : null;
  const recipientFinished = isRecipientMode && phase === "completed";
  const recipientTargetMissing =
    isRecipientMode && !loadingDoc && !recipientFinished && !recipientTarget;
  const phoneLockButton = lockButtonView(
    !!selectedSignatureId,
    signatureLocked,
    isRecipientMode ? "recipient" : "sender"
  );
  const handleDownloadSignedCopy = async () => {
    if (signatures.length === 0 || !hasLockedSignature || downloading) return;
    setDownloadError(null);
    try {
      setDownloading(true);
      const placements = signatures.map((s) => ({
        page: s.page,
        xNorm: s.xNorm,
        yNorm: s.yNorm,
        wNorm: s.wNorm,
        hNorm: s.hNorm,
        imageDataUrl: s.imageDataUrl,
        locked: s.locked,
      }));
      const res = await fetch("/api/esign/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, placements }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setDownloadError(json?.error || "Export failed.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const name = (docData.fileName || documentId).replace(/\.pdf$/i, "") + ".pdf";
      a.download = `SIGNED-${name}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      trackEsignDataLayerEvent(
        esignPdfDownloadDataLayerEvent({
          exportSucceeded: true,
          downloadInitiated: true,
        })
      );
    } catch (e: any) {
      setDownloadError(e?.message || "Download failed.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <main
      ref={setShellEl}
      className={
        phoneLayout
          ? "flex h-[100dvh] flex-col overflow-hidden bg-[#ebecf0] text-zinc-900"
          : "min-h-screen bg-slate-50 text-zinc-900"
      }
    >
      <div className={phoneLayout ? "flex min-h-0 flex-1 flex-col" : "flex h-screen flex-col"}>
        <header
          className={`flex shrink-0 items-center justify-between gap-3 px-3 text-white shadow-sm sm:px-4 ${
            phoneLayout ? "min-h-12 bg-[#1f1f28]" : "h-14 bg-[#000000]"
          }`}
          style={
            phoneLayout
              ? { paddingTop: "max(0.4rem, env(safe-area-inset-top))", paddingBottom: "0.4rem" }
              : undefined
          }
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/tools")}
              className="shrink-0 rounded p-1.5 text-white/70 transition-colors duration-150 hover:bg-white/10 hover:text-white"
              aria-label="Back to e-sign tools"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            <Link
              href="/"
              className={`relative block shrink-0 ${
                phoneLayout
                  ? "h-8 w-[min(100%,168px)]"
                  : "h-9 w-[min(100%,220px)] sm:h-10 sm:w-[min(100%,260px)]"
              }`}
            >
              <Image
                src={HOME_LOGOS_DARK.header}
                alt="StudiosisLab — home"
                fill
                className="object-contain object-left"
                sizes="260px"
                priority
              />
            </Link>
            {phoneLayout ? (
              <div className="min-w-0 flex-1 truncate text-sm font-medium text-white">
                {phoneEsignHeaderFileName(docData.fileName)}
              </div>
            ) : (
              <>
            <div
              className="shrink-0 self-center w-px bg-white/15"
              style={{ height: 18 }}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">
                {docData.fileName || "Untitled document"}
              </div>
              <div className="text-xs text-white/60">
                {statusLabel}
                {createdLabel && ` • ${createdLabel}`}
              </div>
            </div>
              </>
            )}
          </div>
          <div className="hidden shrink-0 items-center gap-1 md:flex">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-1">
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] ${
                    s.done
                      ? "bg-green-500 text-white"
                      : currentStep === i + 1
                      ? "bg-white/25 text-white"
                      : "bg-white/10 text-white/60"
                  }`}
                  title={s.label}
                >
                  {s.done ? "✓" : i + 1}
                </div>
                <span className="hidden text-[10px] text-white/70 sm:inline">{s.label}</span>
                {i < steps.length - 1 && (
                  <div className="mx-0.5 h-px w-2 bg-white/20 sm:w-4" />
                )}
              </div>
            ))}
          </div>
          {!phoneLayout && (
          <div className="shrink-0 text-[11px] text-white/70 md:hidden">
            {statusLabel}
          </div>
          )}
        </header>

        <div
          className={
            phoneLayout
              ? "relative flex min-h-0 flex-1 flex-col overflow-hidden"
              : "flex flex-1 min-h-0 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden"
          }
        >
        {!recipientFinished && (!phoneLayout || phoneSheet === "sign") && (
        phoneLayout ? (
        <EsignPhoneSheet title="Sign" onClose={() => setPhoneSheet(null)}>
        <SignatureToolsPanel
          presentation="sheet"
          mode={isRecipientMode ? "recipient" : "sender"}
          activeSignature={activeSignature}
          hasPlacedSignature={
            isRecipientMode ? Boolean(clientSignatureId) : signatures.length > 0
          }
          hasSelectedSignature={!!selectedSignatureId}
          signatureLocked={signatureLocked}
          onSignatureDrawn={setActiveSignature}
          onInsertSignature={(dataUrl?: string) => {

            const signature = dataUrl || activeSignature;
          
            if (!signature) {
              alert("Please draw or upload your signature first");
              return;
            }
          
            if (isRecipientMode) {
              insertClientSignature(signature);
            } else {
              handleSenderInsert(signature);
            }
          
          }}
          onUploadSignature={handleUploadSignature}
          onDeleteSignature={handleDeleteSignature}
          onLockSignature={handleLockSignature}
          onGenerateMobileSigningLink={
            isRecipientMode && (!inviteValid || inviteValidating)
              ? undefined
              : handleGenerateMobileSigningLink
          }
          mobileSigningUrl={mobileSigningUrl}
          mobileSigningQrDataUrl={mobileSigningQrDataUrl}
          mobileSigningExpiresAt={mobileSigningExpiresAt}
          mobileSigningLoading={mobileSigningLoading}
          mobileSigningError={mobileSigningError}
          mobileSigningStatusMessage={mobileSigningStatusMessage}
          onFetchMobileSignature={handleFetchMobileSignature}
          mobileSignatureFetching={mobileSignatureFetching}
          mobileSignatureFetchError={mobileSignatureFetchError}
          mobileSignatureReady={mobileSignatureReady}
         />
        </EsignPhoneSheet>
        ) : (
        <SignatureToolsPanel
          mode={isRecipientMode ? "recipient" : "sender"}
          activeSignature={activeSignature}
          hasPlacedSignature={
            isRecipientMode ? Boolean(clientSignatureId) : signatures.length > 0
          }
          hasSelectedSignature={!!selectedSignatureId}
          signatureLocked={signatureLocked}
          onSignatureDrawn={setActiveSignature}
          onInsertSignature={(dataUrl?: string) => {

            const signature = dataUrl || activeSignature;
          
            if (!signature) {
              alert("Please draw or upload your signature first");
              return;
            }
          
            if (isRecipientMode) {
              insertClientSignature(signature);
            } else {
              handleSenderInsert(signature);
            }
          
          }}
          onUploadSignature={handleUploadSignature}
          onDeleteSignature={handleDeleteSignature}
          onLockSignature={handleLockSignature}
          onGenerateMobileSigningLink={
            isRecipientMode && (!inviteValid || inviteValidating)
              ? undefined
              : handleGenerateMobileSigningLink
          }
          mobileSigningUrl={mobileSigningUrl}
          mobileSigningQrDataUrl={mobileSigningQrDataUrl}
          mobileSigningExpiresAt={mobileSigningExpiresAt}
          mobileSigningLoading={mobileSigningLoading}
          mobileSigningError={mobileSigningError}
          mobileSigningStatusMessage={mobileSigningStatusMessage}
          onFetchMobileSignature={handleFetchMobileSignature}
          mobileSignatureFetching={mobileSignatureFetching}
          mobileSignatureFetchError={mobileSignatureFetchError}
          mobileSignatureReady={mobileSignatureReady}
         />
        )
        )}

          <section className={`relative flex min-h-0 flex-1 flex-col ${phoneLayout ? "order-none" : "order-2 min-h-[45vh] lg:order-none"}`}>
            {phoneLayout && (
              <div
                ref={phoneZoomHudElRef}
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-2 z-20 rounded-full bg-[#1f1f28]/80 px-2 py-0.5 text-[11px] font-medium text-white transition-opacity duration-300"
                style={{ opacity: 0 }}
              >
                {phoneZoomPercent(phoneZoom)}%
              </div>
            )}
            {!phoneLayout && (
            <div className="absolute left-1/2 top-2 z-10 flex max-w-[calc(100%-1rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-lg bg-white px-2 py-1.5 shadow-sm text-xs">
              <button
                type="button"
                className={`rounded-md px-2 py-1 transition-colors duration-150 hover:bg-[#f4f4f4] ${
                  zoomMode === "fit"
                    ? "bg-zinc-900 text-white hover:bg-zinc-800"
                    : "bg-transparent text-zinc-800 border border-zinc-200"
                }`}
                onClick={() => setZoomMode("fit")}
              >
                Fit
              </button>
              <button
                type="button"
                className={`rounded-md px-2 py-1 transition-colors duration-150 hover:bg-[#f4f4f4] ${
                  zoomMode === "custom" && Math.abs(zoomScale - 1) < 0.01
                    ? "bg-zinc-900 text-white hover:bg-zinc-800"
                    : "bg-transparent text-zinc-800 border border-zinc-200"
                }`}
                onClick={() => {
                  setZoomMode("custom");
                  setZoomScale(1);
                }}
              >
                100%
              </button>
              <button
                type="button"
                className={`rounded-md px-2 py-1 transition-colors duration-150 hover:bg-[#f4f4f4] ${
                  zoomMode === "custom" && Math.abs(zoomScale - 1.5) < 0.01
                    ? "bg-zinc-900 text-white hover:bg-zinc-800"
                    : "bg-transparent text-zinc-800 border border-zinc-200"
                }`}
                onClick={() => {
                  setZoomMode("custom");
                  setZoomScale(1.5);
                }}
              >
                150%
              </button>
              <button
                type="button"
                className="rounded-md px-2 py-1 bg-transparent text-zinc-800 border border-zinc-200 transition-colors duration-150 hover:bg-[#f4f4f4]"
                onClick={() => {
                  setZoomMode("custom");
                  setZoomScale((s) => Math.max(0.5, s - 0.1));
                }}
              >
                −
              </button>
              <button
                type="button"
                className="rounded-md px-2 py-1 bg-transparent text-zinc-800 border border-zinc-200 transition-colors duration-150 hover:bg-[#f4f4f4]"
                onClick={() => {
                  setZoomMode("custom");
                  setZoomScale((s) => s + 0.1);
                }}
              >
                +
              </button>
            </div>
            )}

            <div
              ref={scrollContainerRef}
              className={`flex-1 min-h-0 ${
                phoneLayout
                  ? ESIGN_PHONE_STAGE_TOUCH_CLASS
                  : "overflow-y-auto bg-zinc-100 pt-12 sm:pt-10"
              }`}
            >
              <div
                ref={phoneSpacerRef}
                className={phoneLayout ? "relative" : undefined}
              >
                <div
                  ref={phonePagesRef}
                  className={phoneLayout ? "absolute left-0 top-0 origin-top-left" : undefined}
                  style={
                    phoneLayout
                      ? { transform: `scale(${phoneZoom})`, transformOrigin: "top left" }
                      : undefined
                  }
                >
              <EsignPdfViewer
                ref={viewerRef}
                documentId={documentId}
                activeSignature={activeSignature}
                placing={placing}
                onSignaturePlaced={() => setPlacing(false)}
                zoomMode={phoneLayout ? "fit" : zoomMode}
                zoomScale={phoneLayout ? 1 : zoomScale}
                onSignatureCreated={(sig) => {
                  setSignatures((prev) => [...prev, sig]);
                  setSelectedSignatureId(sig.id);
                  if (phoneLayout) setPhoneSheet(null);
                  if (isRecipientMode && pendingRecipientInsertRef.current) {
                    setClientSignatureId(sig.id);
                    pendingRecipientInsertRef.current = false;
                  }
                }}
                onSignatureSelected={(id) => setSelectedSignatureId(id)}
                onSignatureUpdated={(id, norms) =>
                  setSignatures((prev) =>
                    prev.map((s) =>
                      s.id === id
                        ? {
                            ...s,
                            xNorm: norms.xNorm,
                            yNorm: norms.yNorm,
                            ...(norms.wNorm != null && { wNorm: norms.wNorm }),
                            ...(norms.hNorm != null && { hNorm: norms.hNorm }),
                          }
                        : s
                    )
                  )
                }
                lockedSignatureIds={signatures
                  .filter((s) => s.locked)
                  .map((s) => s.id)}
                signatures={recipientFinished ? [] : signatures}
                scrollContainerRef={scrollContainerRef}
                onVisiblePageChange={
                  phoneLayout ? commitPhoneActivePage : setVisiblePageNumber
                }
                touchChrome={phoneLayout}
                viewScale={phoneLayout ? phoneZoom : 1}
                selectedPage={selectedPageNumber}
                onPageSelect={phoneLayout ? commitPhoneActivePage : setSelectedPageNumber}
                pinchActiveRef={phonePinchActiveRef}
                countersignPlaceholder={
                  countersignPlaceholder
                    ? {
                        ...countersignPlaceholder,
                        locked:
                          Boolean(countersignPlaceholder.locked) ||
                          invitationAlreadySent,
                      }
                    : countersignPlaceholder
                }
                onCountersignPlaceholderChange={
                  isRecipientMode ? undefined : handleCountersignPlaceholderChange
                }
                recipientView={isRecipientMode && !recipientFinished}
                recipientSignatureId={clientSignatureId}
                showStaticTarget={Boolean(recipientTarget) && !recipientFinished}
                useFinalPdf={recipientFinished}
                onSignaturesPainted={() => setSignaturePaintEpoch((value) => value + 1)}
              />
                </div>
              </div>
            </div>
          </section>

        {isRecipientMode ? (
        <aside
          className={
            phoneLayout
              ? phoneSheet === "document" || recipientFinished
                ? ESIGN_PHONE_DOCUMENT_SHEET_CLASS
                : "hidden"
              : "order-3 w-full max-h-[48vh] overflow-y-auto border-t bg-white lg:order-none lg:max-h-none lg:w-[320px] lg:border-l lg:border-t-0 lg:overflow-visible lg:flex lg:flex-col"
          }
        >
          <div className="border-b px-4 py-3">
            <div className="font-semibold text-sm">Agreement Progress</div>
            <p className="mt-1 text-xs text-zinc-600">✓ Sender has signed</p>
            <p className="mt-1 text-xs text-zinc-600">
              {recipientTargetMissing
                ? ESIGN_TARGET_ERRORS.missing_countersign_target
                : recipientHelperText(phase)}
            </p>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3">
            {recipientFinished ? (
              <a
                href={`/api/esign/download?documentId=${encodeURIComponent(documentId)}&final=1`}
                className="inline-flex w-full items-center justify-center rounded-lg bg-orange-500 px-3 py-2 text-xs font-medium text-white hover:bg-orange-600"
              >
                Download completed agreement
              </a>
            ) : (
            <button
              type="button"
              onClick={handleRecipientComplete}
              disabled={!recipientCanComplete || recipientTargetMissing}
              className={`w-full rounded-lg px-3 py-2 text-xs font-medium ${
                recipientCanComplete && !recipientTargetMissing
                  ? "bg-green-600 text-white"
                  : "bg-zinc-200 text-zinc-500 cursor-not-allowed"
              }`}
            >
              {recipientActionLabel(phase)}
            </button>
            )}
          </div>
        </aside>
        ) : (
        <aside
          className={
            phoneLayout
              ? phoneSheet === "document"
                ? ESIGN_PHONE_DOCUMENT_SHEET_CLASS
                : "hidden"
              : "order-3 w-full max-h-[56vh] overflow-y-auto border-t bg-white lg:order-none lg:max-h-none lg:w-[320px] lg:border-l lg:border-t-0 lg:overflow-visible lg:flex lg:flex-col"
          }
        >
          <div
            className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 py-3 text-sm"
            style={phoneLayout ? { WebkitOverflowScrolling: "touch" } : undefined}
          >
            {/* Section A: Download Signed Document */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-sm">Download Signed Document</div>
                {saveState === "saving" && (
                  <span className="text-[11px] text-zinc-400 ml-2">Saving...</span>
                )}
                {saveState === "saved" && (
                  <span className="text-[11px] text-green-500 ml-2">Saved</span>
                )}
              </div>
              <button
                type="button"
                disabled={signatures.length === 0 || !hasLockedSignature || downloading}
                onClick={() => {
                  void handleDownloadSignedCopy();
                }}
                className={`w-full rounded px-3 py-2 text-xs font-medium ${
                  signatures.length === 0 || !hasLockedSignature || downloading
                    ? "bg-zinc-200 text-zinc-500 cursor-not-allowed"
                    : "bg-black text-white"
                }`}
              >
                {downloading ? "Preparing download…" : "Download signed document"}
              </button>
              {downloadError && (
                <p className="text-[11px] text-red-600">{downloadError}</p>
              )}
              <p className="text-[11px] text-zinc-500">
                {signatures.length === 0 || !hasLockedSignature
                  ? "Place and lock your signature to enable download."
                  : "Downloads a signed copy with your placed signature(s)."}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">
                Signatures placed: <span className="font-medium">{signatures.length}</span>
              </p>
            </div>

            <div className="h-px bg-zinc-200" />

            {/* Countersign */}
            <div className="space-y-3">
              {!countersignSetupOpen && (
                <button
                  type="button"
                  aria-disabled={!hasLockedSignature}
                  onClick={() => {
                    if (!hasLockedSignature) {
                      setCountersignLockHint(true);
                      return;
                    }
                    setCountersignLockHint(false);
                    setCountersignSetupOpen(true);
                  }}
                  className={`flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                    hasLockedSignature
                      ? "border-green-700 bg-green-600 text-white hover:bg-green-700 focus-visible:outline-green-700"
                      : "cursor-not-allowed border-zinc-200 bg-zinc-200 text-zinc-500"
                  }`}
                >
                  <Share2 aria-hidden className="h-4 w-4" strokeWidth={2} />
                  Click to share for countersignature
                </button>
              )}
              {(countersignLockHint || (countersignSetupOpen && !hasLockedSignature)) && (
                <p className="text-[11px] text-zinc-600">
                  Lock your signature before sharing for countersignature.
                </p>
              )}

              {countersignSetupOpen && (
                <div className="space-y-3">
                  {!countersignPlaceholder && !invitationAlreadySent && (
                    <button
                      type="button"
                      onClick={() => {
                        if (countersignPlaceholder) return;
                        setCountersignLockError(null);
                        const id =
                          typeof crypto !== "undefined" && "randomUUID" in crypto
                            ? crypto.randomUUID()
                            : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
                        setCountersignPlaceholder({
                          id,
                          page: visiblePageNumber || 1,
                          xNorm: 0.35,
                          yNorm: 0.65,
                          wNorm: 0.3,
                          hNorm: 0.1,
                          locked: false,
                        });
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-orange-600 bg-orange-500 px-3 py-2.5 text-xs font-medium text-white shadow-sm hover:bg-orange-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300"
                    >
                      <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
                      <span>Add countersign box to continue</span>
                      <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
                    </button>
                  )}

                  {countersignPlaceholder && !countersignPlaceholder.locked && !invitationAlreadySent && (
                    <button
                      type="button"
                      disabled={countersignLockPending}
                      onClick={handleLockCountersignPosition}
                      style={{ touchAction: "manipulation" }}
                      className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-sky-700 bg-sky-600 px-3 py-2.5 text-xs font-medium text-white shadow-sm hover:bg-sky-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 disabled:cursor-wait disabled:opacity-80"
                    >
                      <Lock aria-hidden className="h-4 w-4" strokeWidth={2} />
                      {countersignLockPending
                        ? "Locking countersign position…"
                        : "Lock countersign position to continue"}
                    </button>
                  )}
                  {countersignLockError && (
                    <p className="text-[11px] text-red-600" role="alert">
                      {countersignLockError}
                    </p>
                  )}

                  {countersignPlaceholder?.locked && !invitationAlreadySent && (
                    <button
                      type="button"
                      onClick={() =>
                        setCountersignPlaceholder((current) =>
                          current ? { ...current, locked: false } : current
                        )
                      }
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-xs font-medium text-zinc-800 shadow-sm hover:border-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                    >
                      <LockOpen aria-hidden className="h-4 w-4" strokeWidth={2} />
                      Unlock countersign position
                    </button>
                  )}

                  {invitationAlreadySent && countersignPlaceholder && (
                    <p className="text-[11px] text-zinc-600">
                      This countersign position is already shared and stays in place.
                    </p>
                  )}

                  {countersignPlaceholder?.locked && (
                    <>
                      <div className="grid grid-cols-1 gap-3 text-xs">
                        <div className="space-y-1">
                          <label className="font-medium" htmlFor="esign-sender-email">
                            Your official email
                          </label>
                          <input
                            id="esign-sender-email"
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            value={senderEmail}
                            onChange={(e) => {
                              setSenderEmail(e.target.value);
                              setCountersignShareError(null);
                            }}
                            placeholder="your-side@email.com"
                            className={
                              phoneLayout
                                ? ESIGN_PHONE_CONTROL_CLASS
                                : "w-full rounded border border-zinc-300 px-2 py-1 text-xs"
                            }
                          />
                          <p className="text-[11px] text-zinc-500">
                            This email will receive the final counter-signed agreement.
                          </p>
                        </div>
                        <div className="space-y-1">
                          <label className="font-medium" htmlFor="esign-client-email">
                            {"Client's official email"}
                          </label>
                          <input
                            id="esign-client-email"
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            value={clientEmail}
                            onChange={(e) => {
                              setClientEmail(e.target.value);
                              setCountersignShareError(null);
                            }}
                            placeholder="client-side@email.com"
                            className={
                              phoneLayout
                                ? ESIGN_PHONE_CONTROL_CLASS
                                : "w-full rounded border border-zinc-300 px-2 py-1 text-xs"
                            }
                          />
                          <p className="text-[11px] text-zinc-500">
                            The signing link will be sent here.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1 text-xs">
                        <label className="font-medium" htmlFor="esign-counter-message">
                          Message (optional)
                        </label>
                        <textarea
                          id="esign-counter-message"
                          value={counterMessage}
                          onChange={(e) => setCounterMessage(e.target.value)}
                          placeholder="Add a short note for the recipient…"
                          rows={3}
                          className={
                            phoneLayout
                              ? `${ESIGN_PHONE_CONTROL_CLASS} min-h-[5.5rem] resize-none`
                              : "w-full resize-none rounded border border-zinc-300 px-2 py-1 text-xs"
                          }
                        />
                      </div>

                      <button
                        type="button"
                        disabled={!canShareCountersign || countersignSending}
                        onClick={(event) => {
                          void handleShareForCountersign(event);
                        }}
                        style={{ touchAction: "manipulation" }}
                        className={`flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium ${
                          canShareCountersign && !countersignSending
                            ? "border-emerald-300 bg-emerald-100 text-emerald-950 hover:bg-emerald-200"
                            : "cursor-not-allowed border-zinc-200 bg-zinc-200 text-zinc-500"
                        }`}
                      >
                        <Mail aria-hidden className="h-4 w-4" strokeWidth={2} />
                        {countersignSending
                          ? "Sending countersign request…"
                          : "Share for countersign"}
                      </button>
                      {countersignShareError && (
                        <p className="text-[11px] text-red-600" role="alert">
                          {countersignShareError}
                        </p>
                      )}
                      <p className="text-[11px] text-zinc-500">
                        Lock both your signature and the countersign position before sharing.
                      </p>
                    </>
                  )}

                  {inviteSent && (
                    <div className="rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white">
                      Signing request successfully sent to the client.
                    </div>
                  )}

                  {docData.countersignStatus === "completed" && (
                    <button
                      type="button"
                      disabled={downloading}
                      onClick={async () => {
                        if (downloading) return;
                        setDownloadError(null);
                        try {
                          setDownloading(true);
                          if (!docData?.finalPdfUrl) {
                            setDownloadError("Final signed document not available.");
                            return;
                          }
                          const a = document.createElement("a");
                          a.href = docData.finalPdfUrl;
                          const name =
                            (docData.fileName || documentId).replace(/\.pdf$/i, "") +
                            "_signed.pdf";
                          a.download = name;
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                        } catch (e: any) {
                          setDownloadError(e?.message || "Download failed.");
                        } finally {
                          setDownloading(false);
                        }
                      }}
                      className="w-full rounded-lg bg-orange-500 px-3 py-2 text-xs font-medium text-white hover:bg-orange-600"
                    >
                      Download Completed Agreement
                    </button>
                  )}

                  {generatedInviteLink && (
                    <div className="mt-3 space-y-1 text-xs">
                      <div className="font-medium text-zinc-800">
                        Countersign link generated
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={generatedInviteLink}
                          className="min-w-0 flex-1 rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-[11px] text-zinc-700"
                          onFocus={(e) => e.currentTarget.select()}
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              if (!generatedInviteLink) return;
                              await navigator.clipboard.writeText(generatedInviteLink);
                              setCopiedInvite(true);
                              setTimeout(() => setCopiedInvite(false), 2000);
                            } catch {
                              alert("Failed to copy link. Please copy manually.");
                            }
                          }}
                          className="shrink-0 rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] font-medium text-zinc-800 hover:border-blue-400"
                        >
                          Copy link
                        </button>
                      </div>
                      {copiedInvite && (
                        <div className="text-[11px] text-green-600">Copied!</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </aside>
        )}
        </div>
        {phoneLayout && !recipientFinished && !keyboardOpen && (
          <EsignPhoneDock
            mode={isRecipientMode ? "recipient" : "sender"}
            signOpen={phoneSheet === "sign"}
            documentOpen={phoneSheet === "document"}
            lockButton={phoneLockButton}
            dockHint={phoneDockGuidance({
              phoneLayout,
              mode: isRecipientMode ? "recipient" : "sender",
              signatures,
              recipientFinished,
              senderLockedHintDismissed:
                senderLockedHintDismissed ||
                invitationAlreadySent ||
                phoneSheet === "document",
              recipientPhase: phase,
            })}
            hasSelectedSignature={!!selectedSignatureId}
            downloading={downloading}
            canDownload={signatures.length > 0 && hasLockedSignature}
            recipientCompleteLabel={recipientActionLabel(phase)}
            recipientCompleteEnabled={recipientCanComplete && !recipientTargetMissing}
            recipientCompleting={recipientCompleting}
            onOpenSign={() =>
              setPhoneSheet((current) => (current === "sign" ? null : "sign"))
            }
            onOpenDocument={() =>
              setPhoneSheet((current) => (current === "document" ? null : "document"))
            }
            onLock={handleLockSignature}
            onDelete={handleDeleteSignature}
            onDownload={() => {
              setSenderLockedHintDismissed(true);
              void handleDownloadSignedCopy();
            }}
            onShare={() => {
              if (hasLockedSignature) setSenderLockedHintDismissed(true);
              if (!hasLockedSignature) {
                setCountersignLockHint(true);
                setPhoneSheet("document");
                return;
              }
              setCountersignLockHint(false);
              setCountersignSetupOpen(true);
              setPhoneSheet("document");
            }}
            onRecipientComplete={() => {
              void handleRecipientComplete();
            }}
          />
        )}
      </div>

      {showCompletionPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <h2 className="mt-4 text-lg font-semibold text-zinc-900">Agreement Signing Completed</h2>
              <p className="mt-2 text-sm text-zinc-600">
                Signed copy of this agreement will be mailed to both parties.
              </p>
              <button
                type="button"
                onClick={() => window.close()}
                className="mt-6 rounded-lg bg-black px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <input
        ref={signatureInputRef}
        type="file"
        accept={SIGNATURE_UPLOAD_ACCEPT}
        className="hidden"
        onChange={handleSignatureFileChange}
      />
    </main>
  );
}

