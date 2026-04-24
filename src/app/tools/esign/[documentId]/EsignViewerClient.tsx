"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthUser } from "@/lib/useAuthUser";
import type { EsignDocument } from "@/lib/esign";
import { removeBackgroundFromDataUrl } from "@/lib/esignRemoveBackground";
import SignatureToolsPanel from "@/components/esign/SignatureToolsPanel";
import { HOME_LOGOS_DARK } from "@/components/home/homeLogoAssets";

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
  placeSignatureAtCenter: (dataUrl: string, pageNumber: number) => void;
  placeSignatureAtNormalized: (
    dataUrl: string,
    pageNumber: number,
    xNorm: number,
    yNorm: number,
    wNorm: number,
    hNorm: number,
    locked: boolean
  ) => void;
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
  },
  ref: React.Ref<EsignPdfViewerRef>
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const pageWrapperRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const activeSignatureRef = useRef<string | null>(activeSignature);
  const placingRef = useRef<boolean>(placing);
  const onSignaturePlacedRef = useRef<() => void>(() => {});
  const onSignatureCreatedRef = useRef<(sig: SignatureModel) => void>(() => {});
  const onSignatureSelectedRef = useRef<(id: string) => void>(() => {});
  const onSignatureUpdatedRef = useRef<((id: string, n: { xNorm: number; yNorm: number; wNorm?: number; hNorm?: number }) => void) | undefined>(undefined);
  const onCountersignPlaceholderChangeRef = useRef<((n: { page: number; xNorm: number; yNorm: number; wNorm: number; hNorm: number }) => void) | undefined>(undefined);
  const signaturesLockedRef = useRef<Set<string>>(new Set());

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

  const placeAtCenter = useCallback((dataUrl: string, pageNumber: number) => {
    if (!dataUrl) return;
    const overlay = containerRef.current?.querySelector<HTMLDivElement>(
      `[data-esign-overlay][data-page-number="${pageNumber}"]`
    );
    if (!overlay) return;
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

  useImperativeHandle(
    ref,
    () => ({
      placeSignatureAtCenter: placeAtCenter,
      placeSignatureAtNormalized: placeAtNormalized,
    }),
    [placeAtCenter, placeAtNormalized]
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
        setError(null);
        // Dynamically import pdf.js only in the browser using the legacy build.
        // This avoids SSR issues and DOM-related errors in Next.js App Router.
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - pdfjs-dist ships no types for this legacy entry
        const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf");

        (pdfjsLib as any).GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

        const url = `/api/esign/download?documentId=${encodeURIComponent(
          documentId
        )}`;
        const loadingTask = (pdfjsLib as any).getDocument(url);
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = "";

        const effectiveWidth =
          (containerWidth ?? container.clientWidth) || 800;

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
          const page = await pdf.getPage(pageNumber);
          if (cancelled) return;

          const baseViewport = page.getViewport({ scale: 1 });
          const scale =
            zoomMode === "fit"
              ? effectiveWidth / baseViewport.width
              : zoomScale;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.display = "block";
          canvas.style.margin = "0 auto";

          const pageWrapper = document.createElement("div");
          pageWrapper.style.position = "relative";
          pageWrapper.style.marginBottom = "24px";
          pageWrapper.dataset.pageNumber = String(pageNumber);
          pageWrapper.appendChild(canvas);

          const overlay = document.createElement("div");
          overlay.style.position = "absolute";
          overlay.style.inset = "0";
          overlay.style.cursor = "crosshair";
          overlay.dataset.pageNumber = String(pageNumber);
          overlay.setAttribute("data-esign-overlay", "true");

          overlay.addEventListener("click", (event) => {
            if (!placingRef.current) return;
            const dataUrl = activeSignatureRef.current;
            if (!dataUrl) return;
            const rect = overlay.getBoundingClientRect();
            const px = event.clientX - rect.left;
            const py = event.clientY - rect.top;
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

          await page.render({
            canvasContext: context!,
            viewport,
          }).promise;
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
    };
    // PDF pages only rerender when document/zoom/source change. Signatures are rendered in a separate effect.
  }, [documentId, zoomMode, zoomScale, containerWidth]);

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
        img.style.cursor = model.locked ? "default" : "move";
        img.style.pointerEvents = model.locked ? "none" : "auto";
        img.style.border = model.locked ? "2px dashed red" : "none";
        img.addEventListener("click", (e) => {
          e.stopPropagation();
          onSignatureSelectedRef.current?.(model.id);
        });
        if (!model.locked) {
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
              onSignatureUpdatedRef.current?.(model.id, { xNorm: newXNorm, yNorm: newYNorm });
            };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", up);
          };
        }
        overlay.appendChild(img);
      });
    });
  }, [signatures, loading]);

  // Track visible page for "Use this" / "Place Signature" instant placement.
  useEffect(() => {
    const root = scrollContainerRef?.current;
    if (!root || !onVisiblePageChange) return;
    const container = containerRef.current;
    if (!container) return;
    const wrappers = container.querySelectorAll<HTMLElement>("[data-page-number]");
    if (wrappers.length === 0) return;
    const ratiosRef = { current: new Map<number, number>() };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const page = parseInt(entry.target.getAttribute("data-page-number") ?? "1", 10);
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
      },
      { root, rootMargin: "0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    wrappers.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [signatures.length, loading, scrollContainerRef, onVisiblePageChange]);

  // Sync countersign placeholder box (sender-only) into the overlay.
  useEffect(() => {
    if (loading || !countersignPlaceholder || !onCountersignPlaceholderChange) return;
    const container = containerRef.current;
    if (!container) return;
    const overlays = container.querySelectorAll<HTMLDivElement>("[data-esign-overlay]");
    const overlay = Array.from(overlays).find((el) => el.getAttribute("data-page-number") === String(countersignPlaceholder.page));
    if (!overlay) return;

    const existing = overlay.querySelector("[data-esign-countersign-box]");
    existing?.remove();

    const w = overlay.clientWidth;
    const h = overlay.clientHeight;
    const box = document.createElement("div");
    box.setAttribute("data-esign-countersign-box", countersignPlaceholder.id);
    box.style.position = "absolute";
    box.style.left = `${countersignPlaceholder.xNorm * w}px`;
    box.style.top = `${countersignPlaceholder.yNorm * h}px`;
    box.style.width = `${countersignPlaceholder.wNorm * w}px`;
    box.style.height = `${countersignPlaceholder.hNorm * h}px`;
    box.style.border = "2px dashed #dc2626";
    box.style.backgroundColor = "rgba(254,226,226,0.3)";
    box.style.boxSizing = "border-box";
    box.style.pointerEvents = countersignPlaceholder.locked ? "none" : "auto";
    box.style.cursor = countersignPlaceholder.locked ? "default" : "move";

    const commitPlaceholder = () => {
      const nw = overlay.clientWidth;
      const nh = overlay.clientHeight;
      onCountersignPlaceholderChangeRef.current?.({
        page: countersignPlaceholder.page,
        xNorm: box.offsetLeft / nw,
        yNorm: box.offsetTop / nh,
        wNorm: box.offsetWidth / nw,
        hNorm: box.offsetHeight / nh,
      });
    };

    if (!countersignPlaceholder.locked) {
      box.onpointerdown = (e) => {
        if ((e.target as HTMLElement).dataset.resize === "true") return;
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startY = e.clientY;
        const origLeft = box.offsetLeft;
        const origTop = box.offsetTop;
        const move = (ev: PointerEvent) => {
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;
          let nextLeft = Math.max(0, Math.min(origLeft + dx, overlay.clientWidth - box.offsetWidth));
          let nextTop = Math.max(0, Math.min(origTop + dy, overlay.clientHeight - box.offsetHeight));
          box.style.left = `${nextLeft}px`;
          box.style.top = `${nextTop}px`;
        };
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          commitPlaceholder();
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      };
      const handle = document.createElement("div");
      handle.setAttribute("data-resize", "true");
      handle.style.position = "absolute";
      handle.style.right = "0";
      handle.style.bottom = "0";
      handle.style.width = "12px";
      handle.style.height = "12px";
      handle.style.backgroundColor = "rgba(0,0,0,0.3)";
      handle.style.cursor = "nwse-resize";
      handle.onpointerdown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startY = e.clientY;
        const origW = box.offsetWidth;
        const origH = box.offsetHeight;
        const move = (ev: PointerEvent) => {
          const dw = ev.clientX - startX;
          const dh = ev.clientY - startY;
          box.style.width = `${Math.max(40, origW + dw)}px`;
          box.style.height = `${Math.max(24, origH + dh)}px`;
        };
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          commitPlaceholder();
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      };
      box.appendChild(handle);
    }

    overlay.appendChild(box);
    return () => {
      box.remove();
    };
  }, [loading, countersignPlaceholder]);

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
    placeSignatureAtCenter: (dataUrl: string, page: number) => void;
    placeSignatureAtNormalized: (
      dataUrl: string,
      page: number,
      xNorm: number,
      yNorm: number,
      wNorm: number,
      hNorm: number,
      locked: boolean
    ) => void;
  } | null>(null);
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const isRecipientMode = Boolean(token);
  const [inviteValid, setInviteValid] = useState<boolean>(false);
  const [inviteValidating, setInviteValidating] = useState<boolean>(false);
  const [recipientComplete, setRecipientComplete] = useState(false);
  const [recipientCompleting, setRecipientCompleting] = useState(false);
  const [clientSignatureInserted, setClientSignatureInserted] = useState(false);
  const [clientSignatureId, setClientSignatureId] = useState<string | null>(null);
  const [showCompletionPopup, setShowCompletionPopup] = useState(false);
  const [visiblePageNumber, setVisiblePageNumber] = useState(1);
  const [zoomMode, setZoomMode] = useState<ZoomMode>("fit");
  const [zoomScale, setZoomScale] = useState(1);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [counterMode, setCounterMode] = useState<"single" | "multi">("single");
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
  const [countersignPlaceholder, setCountersignPlaceholder] = useState<CountersignPlaceholderModel | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  const signaturesRef = useRef<SignatureModel[]>(signatures);
  const countersignPlaceholderRef = useRef<CountersignPlaceholderModel | null>(countersignPlaceholder);
  const docDataRef = useRef<EsignDocument | null>(docData);
  const initialLoadDoneRef = useRef(false);
  const insertingRef = useRef(false);
  const clientSignatureInsertedRef = useRef(false);
  const pendingRecipientInsertRef = useRef(false);
  signaturesRef.current = signatures;
  countersignPlaceholderRef.current = countersignPlaceholder;
  docDataRef.current = docData;

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
      el.style.pointerEvents = locked ? "none" : "auto";
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
    if (selected && !(selected.locked ?? false)) {
      const el = document.querySelector<HTMLImageElement>(
        `[data-esign-sig-id="${selectedSignatureId}"]`
      );
      const overlay = el?.parentElement as HTMLDivElement | null;
      if (el && overlay) {
        const handle = document.createElement("div");
        handle.setAttribute("data-esign-resize-handle", selected.id);
        handle.style.position = "absolute";
        handle.style.width = "10px";
        handle.style.height = "10px";
        handle.style.backgroundColor = "#3b82f6";
        handle.style.cursor = "nwse-resize";
        handle.style.borderRadius = "2px";
        const updatePos = () => {
          handle.style.left = `${el.offsetLeft + el.offsetWidth - 10}px`;
          handle.style.top = `${el.offsetTop + el.offsetHeight - 10}px`;
        };
        updatePos();
        handle.onpointerdown = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const startX = e.clientX;
          const startY = e.clientY;
          const origW = el.offsetWidth;
          const origH = el.offsetHeight;
          const move = (ev: PointerEvent) => {
            const dw = ev.clientX - startX;
            const dh = ev.clientY - startY;
            el.style.width = `${Math.max(32, origW + dw)}px`;
            el.style.height = `${Math.max(24, origH + dh)}px`;
            updatePos();
          };
          const up = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            const nw = overlay.clientWidth;
            const nh = overlay.clientHeight;
            setSignatures((prev) =>
              prev.map((s) =>
                s.id === selectedSignatureId
                  ? {
                      ...s,
                      wNorm: el.offsetWidth / nw,
                      hNorm: el.offsetHeight / nh,
                    }
                  : s
              )
            );
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
        };
        overlay.appendChild(handle);
      }
    }
  }, [signatures, selectedSignatureId]);

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
        if (!alive) return;
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

  const handleSignatureFileChange = (e: any) => {
    const file = e.target.files?.[0];
    handleUploadSignature(file);
  };

  const insertClientSignature = (signatureData?: string) => {
    if (clientSignatureInsertedRef.current) return;

    const sig = signatureData || activeSignature;

    if (!sig) {
      alert("Please draw or upload your signature first");
      return;
    }

    if (!countersignPlaceholder) {
      console.error("Countersign placeholder missing");
      return;
    }

    const page = Number(countersignPlaceholder.page) || 1;

    clientSignatureInsertedRef.current = true;
    pendingRecipientInsertRef.current = true;
    viewerRef.current?.placeSignatureAtNormalized(
      sig,
      page,
      countersignPlaceholder.xNorm,
      countersignPlaceholder.yNorm,
      countersignPlaceholder.wNorm,
      countersignPlaceholder.hNorm,
      false
    );
    setClientSignatureInserted(true);
  };

  const handleDeleteSignature = () => {
    if (!selectedSignatureId) return;
    setSignatures((prev) => prev.filter((s) => s.id !== selectedSignatureId));
    document
      .querySelector(`[data-esign-sig-id="${selectedSignatureId}"]`)
      ?.remove();
    setSelectedSignatureId(null);
    if (isRecipientMode) {
      clientSignatureInsertedRef.current = false;
      setClientSignatureInserted(false);
      setActiveSignature(null);
    }
  };

  const handleLockSignature = () => {
    if (!selectedSignatureId) return;
    setSignatures((prev) =>
      prev.map((s) =>
        s.id === selectedSignatureId
          ? { ...s, locked: !(s.locked ?? false) }
          : s
      )
    );
  };

  const handleRecipientComplete = async () => {
    if (!user || !token) {
      alert("Please sign in first.");
      return;
    }
    setRecipientCompleting(true);
    try {
      const idToken = await user.getIdToken();
      const placements = signatures.map((s) => ({
        page: s.page,
        xNorm: s.xNorm,
        yNorm: s.yNorm,
        wNorm: s.wNorm,
        hNorm: s.hNorm,
        imageDataUrl: s.imageDataUrl,
        locked: s.locked ?? false,
      }));
      const res = await fetch("/api/esign/invite/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        // Backend currently expects placements; keep payload compatible.
        body: JSON.stringify({ documentId, token, placements }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        alert(json?.error ?? "Failed to complete signing.");
        return;
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
          Back to E-Signing Tool
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

  const statusLabel =
    docData.status === "completed"
      ? "Completed"
      : docData.status === "pending_client"
      ? "Pending"
      : "Draft";

  const hasLockedSignature = signatures.some((s) => s.locked ?? false);

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
      const handleSenderInsert = (signatureOverride?: string) => {
        const sig = signatureOverride || activeSignature;
        
        if (!sig) {
        alert("Please draw or upload your signature first.");
        return;
        }
        
        if (insertingRef.current) return;
        
        insertingRef.current = true;
        
        viewerRef.current?.placeSignatureAtCenter(
        sig,
        visiblePageNumber || 1
        );
        
        setTimeout(() => {
        insertingRef.current = false;
        }, 200);
        };

        const handleRecipientInsert = () => {

          if (clientSignatureInserted) return;
        
          if (!activeSignature) {
            alert("Please draw or upload your signature first.");
            return;
          }
        
          if (insertingRef.current) return;
        
          insertingRef.current = true;
        
          insertClientSignature();
        
          setTimeout(() => {
            insertingRef.current = false;
          }, 200);
        };

  return (
    <main className="min-h-screen bg-slate-50 text-zinc-900">
      <div className="flex h-screen flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 bg-[#000000] px-4 text-white shadow-sm">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/tools")}
              className="shrink-0 rounded p-1.5 text-white/70 transition-colors duration-150 hover:bg-white/10 hover:text-white"
              aria-label="Back to E-Signing Tool"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            <Link
              href="/"
              className="relative block h-9 w-[min(100%,220px)] shrink-0 sm:h-10 sm:w-[min(100%,260px)]"
            >
              <Image
                src={HOME_LOGOS_DARK.header}
                alt="Studiosis Lab — home"
                fill
                className="object-contain object-left"
                sizes="260px"
                priority
              />
            </Link>
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
          </div>
          <div className="flex shrink-0 items-center gap-1">
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
        </header>

        <div className="flex flex-1 overflow-hidden">
        <SignatureToolsPanel
          mode={isRecipientMode ? "recipient" : "sender"}
          activeSignature={activeSignature}
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
         />

          <section className="relative flex-1 min-h-0 flex flex-col">
            <div className="absolute left-1/2 top-2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-lg bg-white px-2 py-1.5 shadow-sm text-xs">
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

            <div
              ref={scrollContainerRef}
              className="flex-1 min-h-0 overflow-y-auto bg-zinc-100 pt-10"
            >
              <EsignPdfViewer
                ref={viewerRef}
                documentId={documentId}
                activeSignature={activeSignature}
                placing={placing}
                onSignaturePlaced={() => setPlacing(false)}
                zoomMode={zoomMode}
                zoomScale={zoomScale}
                onSignatureCreated={(sig) => {
                  setSignatures((prev) => [...prev, sig]);
                  setSelectedSignatureId(sig.id);
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
                signatures={signatures}
                scrollContainerRef={scrollContainerRef}
                onVisiblePageChange={setVisiblePageNumber}
                countersignPlaceholder={countersignPlaceholder}
                onCountersignPlaceholderChange={
                  isRecipientMode
                    ? undefined
                    : (n) =>
                        setCountersignPlaceholder((p) =>
                          p ? { ...p, ...n } : null
                        )
                }
              />
            </div>
          </section>

        {isRecipientMode ? (
        <aside className="w-[320px] border-l bg-white flex flex-col">
          <div className="border-b px-4 py-3">
            <div className="font-semibold text-sm">Agreement Progress</div>
            <p className="mt-1 text-xs text-zinc-600">✓ Sender has signed</p>
            <p className="mt-1 text-xs text-zinc-600">
              Please insert your signature to complete this agreement.
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            <button
              type="button"
              onClick={handleRecipientComplete}
              disabled={!recipientLockedSignature || recipientCompleting || !inviteValid}
              className={`w-full rounded-lg px-3 py-2 text-xs font-medium ${
                !recipientLockedSignature || recipientCompleting || !inviteValid
                  ? "bg-zinc-200 text-zinc-500 cursor-not-allowed"
                  : "bg-green-600 text-white"
              }`}
            >
              {recipientCompleting ? "Completing…" : "Agreement Completed"}
            </button>
          </div>
        </aside>
        ) : (
        <aside className="w-[320px] border-l bg-white flex flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-3 text-sm space-y-6">
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
              {counterMode === "multi" ? (
                <>
                  <button
                    type="button"
                    disabled
                    className="w-full rounded px-3 py-2 text-xs font-medium bg-zinc-200 text-zinc-500 cursor-not-allowed"
                  >
                    Download signed document
                  </button>
                  <p className="text-[11px] text-zinc-500">
                    Final agreement will be available after countersign is completed.
                  </p>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={signatures.length === 0 || !hasLockedSignature || downloading}
                    onClick={async () => {
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
                      } catch (e: any) {
                        setDownloadError(e?.message || "Download failed.");
                      } finally {
                        setDownloading(false);
                      }
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
                </>
              )}
              <p className="mt-1 text-[11px] text-zinc-500">
                Signatures placed: <span className="font-medium">{signatures.length}</span>
              </p>
            </div>

            <div className="h-px bg-zinc-200" />

            {/* Section B: Workflow Type */}
            <div className="space-y-3">
              <div className="font-semibold text-sm">Workflow Type</div>
              <div className="space-y-2 text-xs">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="esign-counter-mode"
                    value="single"
                    checked={counterMode === "single"}
                    onChange={() => setCounterMode("single")}
                  />
                  <span>Solo Sign</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="esign-counter-mode"
                    value="multi"
                    checked={counterMode === "multi"}
                    onChange={() => setCounterMode("multi")}
                  />
                  <span>Countersign</span>
                </label>
              </div>

              {counterMode === "multi" && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
                    className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:border-zinc-400"
                  >
                    Add Countersign Box
                  </button>
                  {countersignPlaceholder && (
                    <button
                      type="button"
                      onClick={() => setCountersignPlaceholder((p) => p ? { ...p, locked: true } : null)}
                      disabled={countersignPlaceholder.locked}
                      className={`w-full rounded px-3 py-2 text-xs font-medium ${
                        countersignPlaceholder.locked
                          ? "bg-zinc-100 text-zinc-500 cursor-default"
                          : "border border-zinc-300 bg-white text-zinc-800 hover:border-zinc-400"
                      }`}
                    >
                      Lock Countersign Position
                    </button>
                  )}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <label className="font-medium">Your official email</label>
                      <input
                        type="email"
                        value={senderEmail}
                        onChange={(e) => setSenderEmail(e.target.value)}
                        placeholder="your-side@email.com"
                        className="w-full rounded border border-zinc-300 px-2 py-1 text-xs"
                      />
                      <p className="text-[11px] text-zinc-500">
                        This email will receive the final counter-signed agreement.
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className="font-medium">Client email</label>
                      <input
                        type="email"
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        placeholder="client-side@email.com"
                        className="w-full rounded border border-zinc-300 px-2 py-1 text-xs"
                      />
                      <p className="text-[11px] text-zinc-500">
                        The signing link will be sent here.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs">
                    <label className="font-medium">Message (optional)</label>
                    <textarea
                      value={counterMessage}
                      onChange={(e) => setCounterMessage(e.target.value)}
                      placeholder="Add a short note for the recipient…"
                      rows={3}
                      className="w-full rounded border border-zinc-300 px-2 py-1 text-xs resize-none"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={
                      signatures.length === 0 ||
                      !hasLockedSignature ||
                      counterMode !== "multi" ||
                      !countersignPlaceholder ||
                      !countersignPlaceholder.locked ||
                      !senderEmail.trim() ||
                      !clientEmail.trim()
                    }
                    onClick={async () => {
                      try {
                        if (!user) {
                          alert("Please sign in first.");
                          return;
                        }
                        const idToken = await user.getIdToken();
                        const res = await fetch("/api/esign/invite", {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${idToken}`,
                          },
                          body: JSON.stringify({
                            documentId,
                            senderEmail: senderEmail.trim(),
                            clientEmail: clientEmail.trim(),
                            message: counterMessage.trim(),
                          }),
                        });
                        const json = await res.json().catch(() => null);
                        if (!res.ok || !json?.ok) {
                          const msg =
                            json?.error ||
                            "Failed to create countersign invite. Please try again.";
                          alert(msg);
                          return;
                        }
                        const url = `${window.location.origin}${json.url}`;
                        setGeneratedInviteLink(url);
                        setCopiedInvite(false);
                        setInviteSent(true);
                        const snap = await getDoc(doc(db, "esign_documents", documentId));
                        if (snap.exists()) {
                          const d = snap.data() as any;
                          setDocData((prev) => (prev ? { ...prev, countersignStatus: d.countersignStatus ?? prev.countersignStatus, status: d.status ?? prev.status } : prev));
                        }
                        // eslint-disable-next-line no-console
                        console.log("Countersign link:", url);
                      } catch (e) {
                        alert(
                          "Failed to create countersign request. Please try again."
                        );
                      }
                    }}
                    className={`w-full rounded px-3 py-2 text-xs font-medium ${
                      signatures.length === 0 ||
                      !hasLockedSignature ||
                      !countersignPlaceholder ||
                      !countersignPlaceholder.locked ||
                      !senderEmail.trim() ||
                      !clientEmail.trim()
                        ? "bg-zinc-200 text-zinc-500 cursor-not-allowed"
                        : "bg-black text-white"
                    }`}
                  >
                    Share for countersign
                  </button>
                  <p className="text-[11px] text-zinc-500">
                    Lock both your signature and the countersign position before sharing.
                  </p>

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
                            (docData.fileName || documentId).replace(/\.pdf$/i, "") + "_signed.pdf";
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
                          className="flex-1 min-w-0 rounded border border-zinc-300 px-2 py-1 text-[11px] text-zinc-700 bg-zinc-50"
                          onFocus={(e) => e.currentTarget.select()}
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              if (!generatedInviteLink) return;
                              await navigator.clipboard.writeText(
                                generatedInviteLink
                              );
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
        accept="image/*"
        className="hidden"
        onChange={handleSignatureFileChange}
      />
    </main>
  );
}

