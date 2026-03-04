"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthUser } from "@/lib/useAuthUser";
import type { EsignDocument } from "@/lib/esign";

type EsignViewerClientProps = {
  documentId: string;
};

type SignatureModel = {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
};

function SignaturePad({
  onSignatureReady,
}: {
  onSignatureReady: (dataUrl: string) => void;
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
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.5;
    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      ctx.strokeStyle = stroke.color;
      ctx.beginPath();
      const [first, ...rest] = stroke.points;
      ctx.moveTo(first.x, first.y);
      for (const p of rest) {
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
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
    onSignatureReady(canvas.toDataURL("image/png"));
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
          Use this
        </button>
      </div>
    </div>
  );
}

type ZoomMode = "fit" | "custom";

function EsignPdfViewer({
  documentId,
  activeSignature,
  placing,
  onSignaturePlaced,
  zoomMode,
  zoomScale,
  onSignatureCreated,
  onSignatureSelected,
}: {
  documentId: string;
  activeSignature: string | null;
  placing: boolean;
  onSignaturePlaced: () => void;
  zoomMode: ZoomMode;
  zoomScale: number;
  onSignatureCreated: (sig: SignatureModel) => void;
  onSignatureSelected: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  const activeSignatureRef = useRef<string | null>(activeSignature);
  const placingRef = useRef<boolean>(placing);
  const onSignaturePlacedRef = useRef<() => void>(() => {});
  const onSignatureCreatedRef = useRef<(sig: SignatureModel) => void>(() => {});
  const onSignatureSelectedRef = useRef<(id: string) => void>(() => {});

  useEffect(() => {
    activeSignatureRef.current = activeSignature;
  }, [activeSignature]);

  useEffect(() => {
    placingRef.current = placing;
  }, [placing]);

  useEffect(() => {
    onSignaturePlacedRef.current = onSignaturePlaced;
  }, [onSignaturePlaced]);

  useEffect(() => {
    onSignatureCreatedRef.current = onSignatureCreated;
  }, [onSignatureCreated]);

  useEffect(() => {
    onSignatureSelectedRef.current = onSignatureSelected;
  }, [onSignatureSelected]);

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
          pageWrapper.appendChild(canvas);

          const overlay = document.createElement("div");
          overlay.style.position = "absolute";
          overlay.style.inset = "0";
          overlay.style.cursor = "crosshair";

          overlay.addEventListener("click", (event) => {
            if (!placingRef.current || !activeSignatureRef.current) return;
            const rect = overlay.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            const id =
              (typeof crypto !== "undefined" && "randomUUID" in crypto
                ? (crypto as any).randomUUID()
                : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

            const sig = document.createElement("img");
            sig.src = activeSignatureRef.current;
            sig.style.position = "absolute";
            sig.style.width = "160px";
            sig.style.left = `${x - 80}px`;
            sig.style.top = `${y}px`;
            sig.style.cursor = "move";
            sig.dataset.esignSigId = id;

            sig.addEventListener("click", (e) => {
              e.stopPropagation();
              onSignatureSelectedRef.current?.(id);
            });

            sig.onpointerdown = (e) => {
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

                const maxX = overlay.clientWidth - sig.offsetWidth;
                const maxY = overlay.clientHeight - sig.offsetHeight;
                nextX = Math.max(0, Math.min(nextX, maxX));
                nextY = Math.max(0, Math.min(nextY, maxY));

                sig.style.left = `${nextX}px`;
                sig.style.top = `${nextY}px`;
              };

              const up = () => {
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", up);
              };

              window.addEventListener("pointermove", move);
              window.addEventListener("pointerup", up);
            };

            overlay.appendChild(sig);
            placingRef.current = false;
            onSignaturePlacedRef.current?.();

            onSignatureCreatedRef.current?.({
              id,
              page: pageNumber,
              x: x - 80,
              y,
              width: 160,
              height: 60,
              rotation: 0,
              opacity: 1,
            });
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
  }, [documentId, zoomMode, zoomScale, containerWidth]);

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
  const [zoomMode, setZoomMode] = useState<ZoomMode>("fit");
  const [zoomScale, setZoomScale] = useState(1);
  const [downloading, setDownloading] = useState(false);
  const [counterMode, setCounterMode] = useState<"single" | "multi">("single");
  const [senderEmail, setSenderEmail] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [counterMessage, setCounterMessage] = useState("");

  // Sync signature model changes to DOM elements (size, rotation, opacity, selection outline).
  useEffect(() => {
    signatures.forEach((sig) => {
      const el = document.querySelector<HTMLImageElement>(
        `[data-esign-sig-id="${sig.id}"]`
      );
      if (!el) return;
      el.style.width = `${sig.width}px`;
      el.style.height = `${sig.height}px`;
      el.style.opacity = String(sig.opacity);
      el.style.transform = `rotate(${sig.rotation}deg)`;
      el.style.border =
        sig.id === selectedSignatureId ? "2px solid #3b82f6" : "none";
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
    setPlacing(true);
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
            <SignaturePad onSignatureReady={setActiveSignature} />

            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase text-zinc-500">
                Upload Signature
              </div>
              <div className="rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1 flex items-center justify-between gap-2">
                <span className="text-xs text-zinc-600 truncate">
                  {signatureFileName || "Select signature file"}
                </span>
                <button
                  type="button"
                  onClick={() => signatureInputRef.current?.click()}
                  className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-800 hover:border-blue-400"
                >
                  {uploadingSignature ? "Loading..." : "Upload"}
                </button>
              </div>
              <button
                type="button"
                onClick={handlePlaceSignatureClick}
                className="w-full rounded-lg bg-black px-3 py-2 text-xs font-medium text-white"
              >
                Place Signature
              </button>
            </div>
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

            <div className="flex-1 min-h-0 overflow-y-auto bg-zinc-100">
              <EsignPdfViewer
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
              />
            </div>
          </section>

        <aside className="w-[320px] border-l bg-white flex flex-col">
          <div className="border-b px-4 py-3 font-semibold text-sm">
            Download Signed Document
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 text-sm space-y-6">
            {/* SECTION 1: Download */}
            <div className="space-y-2">
              <button
                type="button"
                disabled={signatures.length === 0 || downloading}
                onClick={async () => {
                  if (signatures.length === 0 || downloading) return;
                  try {
                    setDownloading(true);
                    const res = await fetch(
                      `/api/esign/export?documentId=${encodeURIComponent(
                        documentId
                      )}`
                    );
                    if (!res.ok) {
                      alert("Failed to export signed PDF.");
                      return;
                    }
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `signed-${docData.fileName || "document"}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
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
              <p className="text-[11px] text-zinc-500">
                {signatures.length === 0
                  ? "Place at least one signature to enable download."
                  : "Downloads a signed copy of this document."}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">
                Status:{" "}
                <span className="font-medium">
                  Signatures placed: {signatures.length}
                </span>
              </p>
            </div>

            <div className="h-px bg-zinc-200" />

            {/* SECTION 3: Counter-sign workflow (UI only) */}
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
                  <span>Signed by several people</span>
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
                    onClick={() => {
                      // Phase-1/2: UI-only, no actual email sending.
                      // eslint-disable-next-line no-console
                      console.log("esign invite payload", {
                        documentId,
                        senderEmail: senderEmail.trim(),
                        clientEmail: clientEmail.trim(),
                        message: counterMessage.trim(),
                      });
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

