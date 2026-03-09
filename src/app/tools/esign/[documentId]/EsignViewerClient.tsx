"use client";

import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthUser } from "@/lib/useAuthUser";
import type { EsignDocument } from "@/lib/esign";
import { removeBackgroundFromDataUrl } from "@/lib/esignRemoveBackground";

type EsignViewerClientProps = {
  documentId: string;
};

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
}: {
  onSignatureReady: (dataUrl: string) => void;
  onUseAndPlace?: (dataUrl: string) => void;
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
    const canvas = canvasRef.current;
    if (!canvas) return;
    const hasContent = strokes.some((s) => s.points.length > 1);
    if (!hasContent) {
      alert("Please draw a signature first.");
      return;
    }
    const dataUrl = canvas.toDataURL("image/png");
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
      <div className="flex items-center justify-between gap-2">
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
        <button
          type="button"
          onClick={handleUseSignature}
          className="rounded-lg bg-black px-3 py-1.5 text-xs font-medium text-white"
        >
          Insert
        </button>
      </div>
    </div>
  );
}

type ZoomMode = "fit" | "custom";

type EsignPdfViewerRef = {
  placeSignatureAtCenter: (dataUrl: string, pageNumber: number) => void;
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
  }: {
    documentId: string;
    activeSignature: string | null;
    placing: boolean;
    onSignaturePlaced: () => void;
    zoomMode: ZoomMode;
    zoomScale: number;
    onSignatureCreated: (sig: SignatureModel) => void;
    onSignatureSelected: (id: string) => void;
    onSignatureUpdated?: (id: string, norms: { xNorm: number; yNorm: number }) => void;
    lockedSignatureIds?: string[];
    signatures: SignatureModel[];
    scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
    onVisiblePageChange?: (page: number) => void;
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
  const onSignatureUpdatedRef = useRef<((id: string, n: { xNorm: number; yNorm: number }) => void) | undefined>(undefined);
  const signaturesLockedRef = useRef<Set<string>>(new Set());

  activeSignatureRef.current = activeSignature;
  placingRef.current = placing;
  onSignatureUpdatedRef.current = onSignatureUpdated;

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
    const overlay = containerRef.current?.querySelector<HTMLDivElement>(
      `[data-page-number="${pageNumber}"]`
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
    const img = document.createElement("img");
    img.src = dataUrl;
    img.alt = "Signature";
    img.dataset.esignSigId = id;
    img.style.position = "absolute";
    img.style.width = `${defaultW}px`;
    img.style.height = "auto";
    img.style.left = `${sig.xNorm * w}px`;
    img.style.top = `${sig.yNorm * h}px`;
    img.style.cursor = "move";
    img.style.pointerEvents = "auto";
    img.addEventListener("click", (e) => {
      e.stopPropagation();
      onSignatureSelectedRef.current?.(id);
    });
    const setupDrag = (sigEl: HTMLImageElement, sigId: string) => {
      sigEl.onpointerdown = (e) => {
        if (signaturesLockedRef.current.has(sigId)) return;
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startY = e.clientY;
        const origLeft = sigEl.offsetLeft;
        const origTop = sigEl.offsetTop;
        const move = (ev: PointerEvent) => {
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;
          let nextLeft = origLeft + dx;
          let nextTop = origTop + dy;
          const maxLeft = overlay.clientWidth - sigEl.offsetWidth;
          const maxTop = overlay.clientHeight - sigEl.offsetHeight;
          nextLeft = Math.max(0, Math.min(nextLeft, maxLeft));
          nextTop = Math.max(0, Math.min(nextTop, maxTop));
          sigEl.style.left = `${nextLeft}px`;
          sigEl.style.top = `${nextTop}px`;
        };
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          const newXNorm = sigEl.offsetLeft / overlay.clientWidth;
          const newYNorm = sigEl.offsetTop / overlay.clientHeight;
          onSignatureUpdatedRef.current?.(sigId, { xNorm: newXNorm, yNorm: newYNorm });
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      };
    };
    setupDrag(img, id);
    overlay.appendChild(img);
    onSignaturePlacedRef.current?.();
    onSignatureCreatedRef.current?.(sig);
  }, []);

  useImperativeHandle(ref, () => ({
    placeSignatureAtCenter: placeAtCenter,
  }), [placeAtCenter]);

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

          const addSignatureToOverlay = (
            o: HTMLDivElement,
            model: SignatureModel
          ) => {
            const w = o.clientWidth;
            const h = o.clientHeight;
            const img = document.createElement("img");
            img.src = model.imageDataUrl;
            img.alt = "Signature";
            img.dataset.esignSigId = model.id;
            img.style.position = "absolute";
            img.style.width = `${model.wNorm * w}px`;
            img.style.height = "auto";
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
                  nextLeft = Math.max(0, Math.min(nextLeft, o.clientWidth - img.offsetWidth));
                  nextTop = Math.max(0, Math.min(nextTop, o.clientHeight - img.offsetHeight));
                  img.style.left = `${nextLeft}px`;
                  img.style.top = `${nextTop}px`;
                };
                const up = () => {
                  window.removeEventListener("pointermove", move);
                  window.removeEventListener("pointerup", up);
                  const newXNorm = img.offsetLeft / o.clientWidth;
                  const newYNorm = img.offsetTop / o.clientHeight;
                  onSignatureUpdatedRef.current?.(model.id, { xNorm: newXNorm, yNorm: newYNorm });
                };
                window.addEventListener("pointermove", move);
                window.addEventListener("pointerup", up);
              };
            }
            o.appendChild(img);
          };

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
            const sig = document.createElement("img");
            sig.src = dataUrl;
            sig.alt = "Signature";
            sig.dataset.esignSigId = id;
            sig.style.position = "absolute";
            sig.style.width = `${defaultW}px`;
            sig.style.height = "auto";
            sig.style.left = `${left}px`;
            sig.style.top = `${top}px`;
            sig.style.cursor = "move";
            sig.style.pointerEvents = "auto";
            sig.addEventListener("click", (e) => {
              e.stopPropagation();
              onSignatureSelectedRef.current?.(id);
            });
            sig.onpointerdown = (e) => {
              if (signaturesLockedRef.current.has(id)) return;
              e.preventDefault();
              e.stopPropagation();
              const startX = e.clientX;
              const startY = e.clientY;
              const origX = sig.offsetLeft;
              const origY = sig.offsetTop;
              const move = (ev: PointerEvent) => {
                const dx = ev.clientX - startX;
                const dy = ev.clientY - startY;
                let nextX = origX + dx;
                let nextY = origY + dy;
                nextX = Math.max(0, Math.min(nextX, overlay.clientWidth - sig.offsetWidth));
                nextY = Math.max(0, Math.min(nextY, overlay.clientHeight - sig.offsetHeight));
                sig.style.left = `${nextX}px`;
                sig.style.top = `${nextY}px`;
              };
              const up = () => {
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", up);
                onSignatureUpdatedRef.current?.(id, {
                  xNorm: sig.offsetLeft / overlay.clientWidth,
                  yNorm: sig.offsetTop / overlay.clientHeight,
                });
              };
              window.addEventListener("pointermove", move);
              window.addEventListener("pointerup", up);
            };
            overlay.appendChild(sig);
            placingRef.current = false;
            onSignaturePlacedRef.current?.();
            onSignatureCreatedRef.current?.(model);
          });

          signatures
            .filter((s) => s.page === pageNumber)
            .forEach((s) => addSignatureToOverlay(overlay, s));

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
    // Important: do NOT depend on `signatures` here.
    // New signatures are added directly to the overlay and stored in React state.
    // If we re-run this effect on every signatures change, we clear the container
    // (`container.innerHTML = ""`) and the newly placed signature would briefly
    // appear then disappear.
  }, [documentId, zoomMode, zoomScale, containerWidth]);

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
  const viewerRef = useRef<{ placeSignatureAtCenter: (dataUrl: string, page: number) => void } | null>(null);
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

  // Sync selection and locked state to signature DOM elements (border, pointerEvents).
  useEffect(() => {
    signatures.forEach((sig) => {
      const el = document.querySelector<HTMLImageElement>(
        `[data-esign-sig-id="${sig.id}"]`
      );
      if (!el) return;
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
  }, [signatures, selectedSignatureId]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

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
          pagesCount: data.pagesCount ?? null,
          finalPdfUrl: data.finalPdfUrl ?? null,
        });
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

    if (user) {
      loadDoc();
    }

    return () => {
      alive = false;
    };
  }, [user, documentId]);

  const handleSignatureFileChange = (e: any) => {
    const file = e.target.files?.[0];
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

  const handlePlaceSignatureClick = () => {
    if (!activeSignature) {
      alert("Create or upload a signature first.");
      return;
    }
    viewerRef.current?.placeSignatureAtCenter(activeSignature, visiblePageNumber || 1);
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

  return (
    <main className="min-h-screen bg-slate-50 text-zinc-900">
      <div className="flex h-screen flex-col">
        <header className="flex items-center justify-between border-b bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/tools")}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:border-blue-300"
            >
              Back
            </button>
            <div>
              <div className="text-sm font-semibold truncate max-w-[240px] md:max-w-xs">
                {docData.fileName || "Untitled document"}
              </div>
              <div className="text-xs text-zinc-500">
                {statusLabel}
                {createdLabel && ` • ${createdLabel}`}
              </div>
            </div>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <aside className="w-[320px] shrink-0 border-r bg-white p-4 space-y-6">
            <SignaturePad
              onSignatureReady={setActiveSignature}
              onUseAndPlace={(dataUrl) => {
                setActiveSignature(dataUrl);
                viewerRef.current?.placeSignatureAtCenter(dataUrl, visiblePageNumber || 1);
              }}
            />

            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase text-zinc-500">
                Upload Signature
              </div>
              <div className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => signatureInputRef.current?.click()}
                  className="flex-1 min-w-0 text-left text-xs text-zinc-600 truncate"
                >
                  {signatureFileName || "Select file"}
                </button>
                {signatureFileName && (
                  <button
                    type="button"
                    onClick={() => {
                      setSignatureFileName(null);
                      setActiveSignature(null);
                      setBackgroundRemoved(false);
                      if (signatureInputRef.current) signatureInputRef.current.value = "";
                    }}
                    className="shrink-0 text-zinc-500 hover:text-red-600 text-sm leading-none"
                    aria-label="Clear"
                  >
                    ×
                  </button>
                )}
              </div>
              {activeSignature && signatureFileName && (
                <button
                  type="button"
                  onClick={() => {
                    viewerRef.current?.placeSignatureAtCenter(activeSignature, visiblePageNumber || 1);
                  }}
                  className="w-full rounded-lg bg-black px-3 py-1.5 text-xs font-medium text-white"
                >
                  Insert
                </button>
              )}
              {signatureFileName && activeSignature && (
                <button
                  type="button"
                  disabled={removingBg}
                  onClick={async () => {
                    setRemovingBg(true);
                    try {
                      const out = await removeBackgroundFromDataUrl(activeSignature, 240);
                      setActiveSignature(out);
                      setBackgroundRemoved(true);
                    } catch {
                      alert("Failed to remove background.");
                    } finally {
                      setRemovingBg(false);
                    }
                  }}
                  className={`w-full rounded-lg px-3 py-2 text-xs font-medium ${
                    backgroundRemoved
                      ? "bg-green-600 text-white"
                      : "bg-orange-500 text-white hover:bg-orange-600"
                  }`}
                >
                  {backgroundRemoved ? "✓ Background removed" : "Remove background"}
                </button>
              )}
            </div>

            {selectedSignatureId !== null && (
              <div className="space-y-2 border-t border-zinc-200 pt-4">
                <div className="text-xs font-semibold uppercase text-zinc-500">
                  Selected Signature
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSignatures((prev) =>
                        prev.filter((s) => s.id !== selectedSignatureId)
                      );
                      document
                        .querySelector(
                          `[data-esign-sig-id="${selectedSignatureId}"]`
                        )
                        ?.remove();
                      setSelectedSignatureId(null);
                    }}
                    className="w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
                  >
                    Delete Signature
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSignatures((prev) =>
                        prev.map((s) =>
                          s.id === selectedSignatureId
                            ? { ...s, locked: !(s.locked ?? false) }
                            : s
                        )
                      );
                    }}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:border-blue-400"
                  >
                    {signatures.find((s) => s.id === selectedSignatureId)
                      ?.locked
                      ? "Unlock Signature"
                      : "Lock Signature"}
                  </button>
                </div>
              </div>
            )}
          </aside>

          <section className="flex-1 min-h-0 flex flex-col">
            <div className="flex items-center gap-2 border-b bg-white px-4 py-2 text-xs">
              <button
                type="button"
                className={`rounded px-2 py-1 ${
                  zoomMode === "fit"
                    ? "bg-zinc-900 text-white"
                    : "bg-white text-zinc-800 border border-zinc-300"
                }`}
                onClick={() => setZoomMode("fit")}
              >
                Fit
              </button>
              <button
                type="button"
                className={`rounded px-2 py-1 ${
                  zoomMode === "custom" && Math.abs(zoomScale - 1) < 0.01
                    ? "bg-zinc-900 text-white"
                    : "bg-white text-zinc-800 border border-zinc-300"
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
                className={`rounded px-2 py-1 ${
                  zoomMode === "custom" && Math.abs(zoomScale - 1.5) < 0.01
                    ? "bg-zinc-900 text-white"
                    : "bg-white text-zinc-800 border border-zinc-300"
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
                className="rounded px-2 py-1 bg-white text-zinc-800 border border-zinc-300"
                onClick={() => {
                  setZoomMode("custom");
                  setZoomScale((s) => Math.max(0.5, s - 0.1));
                }}
              >
                -
              </button>
              <button
                type="button"
                className="rounded px-2 py-1 bg-white text-zinc-800 border border-zinc-300"
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
              className="flex-1 min-h-0 overflow-y-auto bg-zinc-100"
            >
              <EsignPdfViewer
                ref={viewerRef}
                documentId={documentId}
                activeSignature={activeSignature}
                placing={placing}
                onSignaturePlaced={() => setPlacing(false)}
                zoomMode={zoomMode}
                zoomScale={zoomScale}
                onSignatureCreated={(sig) =>
                  setSignatures((prev) => [...prev, sig])
                }
                onSignatureSelected={(id) => setSelectedSignatureId(id)}
                onSignatureUpdated={(id, norms) =>
                  setSignatures((prev) =>
                    prev.map((s) =>
                      s.id === id ? { ...s, xNorm: norms.xNorm, yNorm: norms.yNorm } : s
                    )
                  )
                }
                lockedSignatureIds={signatures
                  .filter((s) => s.locked)
                  .map((s) => s.id)}
                signatures={signatures}
                scrollContainerRef={scrollContainerRef}
                onVisiblePageChange={setVisiblePageNumber}
              />
            </div>
          </section>

        <aside className="w-[320px] border-l bg-white flex flex-col">
          <div className="border-b px-4 py-3">
            <div className="font-semibold text-sm">Download Signed Document</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {signatures.length === 0 && (
                <span className="inline-flex items-center rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
                  Draft
                </span>
              )}
              {signatures.length >= 1 && counterMode === "single" && (
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                  Signed by me
                </span>
              )}
              {docData.status === "pending_client" && (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                  Awaiting countersign
                </span>
              )}
              {docData.status === "completed" && (
                <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                  Completed
                </span>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 text-sm space-y-6">
            <div className="space-y-2">
              <button
                type="button"
                disabled={signatures.length === 0 || downloading}
                onClick={async () => {
                  if (signatures.length === 0 || downloading) return;
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
                  signatures.length === 0 || downloading
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
                {signatures.length === 0
                  ? "Place at least one signature to enable download."
                  : "Downloads a signed copy with your placed signature(s)."}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">
                Signatures placed: <span className="font-medium">{signatures.length}</span>
              </p>
            </div>

            <div className="h-px bg-zinc-200" />

            <div className="space-y-3">
              <div className="font-semibold text-sm">Counter-sign workflow</div>
              <div className="space-y-2 text-xs">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="esign-counter-mode"
                    value="single"
                    checked={counterMode === "single"}
                    onChange={() => setCounterMode("single")}
                  />
                  <span>Sign only by me</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="esign-counter-mode"
                    value="multi"
                    checked={counterMode === "multi"}
                    onChange={() => setCounterMode("multi")}
                  />
                  <span>Signed by two people</span>
                </label>
              </div>

              {counterMode === "multi" && (
                <div className="space-y-3">
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
                        This email will receive the final counter-signed
                        agreement.
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
                      !senderEmail.trim() ||
                      !clientEmail.trim()
                        ? "bg-zinc-200 text-zinc-500 cursor-not-allowed"
                        : "bg-black text-white"
                    }`}
                  >
                    Share for countersign
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>
        </div>
      </div>

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

