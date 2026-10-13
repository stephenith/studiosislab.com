"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import {
  ArrowRight,
  ChevronDown,
  ImageUp,
  Lock,
  LockOpen,
  PenLine,
  Smartphone,
} from "lucide-react";
import {
  isPngOrJpegSignatureFile,
  SIGNATURE_UPLOAD_ACCEPT,
  SIGNATURE_UPLOAD_REJECTED_MESSAGE,
} from "@/lib/esignSignatureUpload";
import { lockButtonClassName, lockButtonView } from "@/lib/esignViewerState";

type SignatureToolsPanelProps = {
  mode: "sender" | "recipient";
  activeSignature: string | null;
  hasPlacedSignature?: boolean;
  hasSelectedSignature?: boolean;
  onSignatureDrawn: (dataUrl: string) => void;
  onInsertSignature: (dataUrl?: string) => void;
  onUploadSignature: (file: File) => void;
  onDeleteSignature: () => void;
  onLockSignature: () => void;
  signatureLocked: boolean;
  onGenerateMobileSigningLink?: () => Promise<void> | void;
  mobileSigningUrl?: string | null;
  mobileSigningQrDataUrl?: string | null;
  mobileSigningExpiresAt?: string | Date | null;
  mobileSigningLoading?: boolean;
  mobileSigningError?: string | null;
  mobileSigningStatusMessage?: string | null;
  onFetchMobileSignature?: () => Promise<void> | void;
  mobileSignatureFetching?: boolean;
  mobileSignatureFetchError?: string | null;
  mobileSignatureReady?: boolean;
};

function SignaturePad({
  mode,
  activeSignature,
  onSignatureDrawn,
  onInsertSignature,
  showTitle = true,
  fitWidth = false,
  active = true,
}: {
  mode: "sender" | "recipient";
  activeSignature: string | null;
  onSignatureDrawn: (dataUrl: string) => void;
  onInsertSignature: (dataUrl?: string) => void;
  showTitle?: boolean;
  fitWidth?: boolean;
  active?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [color, setColor] = useState<"black" | "blue">("black");
  const [strokes, setStrokes] = useState<
    { points: { x: number; y: number }[]; color: string }[]
  >([]);
  const isDrawingRef = useRef(false);
  const MIN_POINT_DISTANCE = 1.4;

  const smoothStroke = (
    ctx: CanvasRenderingContext2D,
    points: { x: number; y: number }[],
    strokeColor: string
  ) => {
    if (points.length === 0) return;

    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = strokeColor;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.5;

    if (points.length === 1) {
      const p = points[0];
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (points.length === 2) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[1].x, points[1].y);
      ctx.stroke();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  };

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

  useEffect(() => {
    if (!fitWidth || !active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const frame = requestAnimationFrame(() => {
      const width = Math.round(canvas.getBoundingClientRect().width);
      if (width < 20) return;
      if (canvas.width !== width || canvas.height !== 140) {
        canvas.width = width;
        canvas.height = 140;
      }
      redraw();
    });
    return () => cancelAnimationFrame(frame);
    // Fit once when the sender accordion opens. Strokes stay in component state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitWidth, active]);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
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

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const pt = getPoint(e);
    setStrokes((prev) => {
      if (!prev.length) return prev;
      const next = [...prev];
      const last = next[next.length - 1];
      const prevPt = last.points[last.points.length - 1];
      if (!prevPt) return prev;
      const dx = pt.x - prevPt.x;
      const dy = pt.y - prevPt.y;
      if (Math.hypot(dx, dy) < MIN_POINT_DISTANCE) {
        return prev;
      }
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
    const dataUrl = canvasRef.current.toDataURL("image/png");
    if (!dataUrl) return;
    onSignatureDrawn(dataUrl);
    onInsertSignature(dataUrl);
  };

  return (
    <div className="space-y-3">
      {showTitle && (
        <div className="text-xs font-semibold uppercase text-zinc-500">
          Draw Signature
        </div>
      )}
      <div className="rounded-xl border border-zinc-300 bg-white p-2">
        <canvas
          ref={canvasRef}
          width={fitWidth ? undefined : 320}
          height={fitWidth ? undefined : 120}
          className={
            fitWidth
              ? "block h-[140px] w-full touch-none rounded-lg bg-white"
              : "w-full touch-none rounded-lg bg-white"
          }
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
        <button
          type="button"
          onClick={handleUseSignature}
          disabled={mode === "recipient" && activeSignature !== null}
          className={`ml-auto rounded-lg px-3 py-1.5 text-xs font-medium
          ${mode === "recipient" && activeSignature !== null
            ? "bg-zinc-300 text-zinc-500 cursor-not-allowed"
            : "bg-black text-white"}
          `}
         >
        Insert
       </button>
      </div>
    </div>
  );
}

function MethodAccordion({
  id,
  title,
  icon,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const panelId = `esign-sign-method-${id}`;
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-medium text-zinc-900 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
      >
        <span className="text-zinc-700">{icon}</span>
        <span className="flex-1">{title}</span>
        <ChevronDown
          aria-hidden
          strokeWidth={2}
          className={`h-4 w-4 text-zinc-500 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div id={panelId} role="region" aria-label={title} hidden={!open} className="border-t border-zinc-100 px-4 py-3">
        {children}
      </div>
    </div>
  );
}

function MobileSigningFields({
  activeSignature,
  expiryLabel,
  mobileSigningError,
  mobileSigningLoading,
  mobileSigningQrDataUrl,
  mobileSigningStatusMessage,
  mobileSigningUrl,
  mobileSignatureFetchError,
  mobileSignatureFetching,
  mobileSignatureReady,
  onFetchMobileSignature,
  onGenerateMobileSigningLink,
  onInsertSignature,
}: {
  activeSignature: string | null;
  expiryLabel: string | null;
  mobileSigningError?: string | null;
  mobileSigningLoading?: boolean;
  mobileSigningQrDataUrl?: string | null;
  mobileSigningStatusMessage?: string | null;
  mobileSigningUrl?: string | null;
  mobileSignatureFetchError?: string | null;
  mobileSignatureFetching?: boolean;
  mobileSignatureReady?: boolean;
  onFetchMobileSignature?: () => Promise<void> | void;
  onGenerateMobileSigningLink?: () => Promise<void> | void;
  onInsertSignature: (dataUrl?: string) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-zinc-600">
        Scan this QR code with your phone to draw your signature using touch.
      </p>
      <button
        type="button"
        onClick={() => onGenerateMobileSigningLink?.()}
        disabled={mobileSigningLoading || !onGenerateMobileSigningLink}
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 transition hover:border-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {mobileSigningLoading ? "Generating..." : "Generate mobile signing link"}
      </button>
      {mobileSigningQrDataUrl && (
        <div className="mx-auto w-fit rounded-lg border border-zinc-200 bg-white p-2">
          <Image
            src={mobileSigningQrDataUrl}
            alt="Mobile signing QR code"
            className="h-40 w-40"
            width={160}
            height={160}
            unoptimized
          />
        </div>
      )}
      {mobileSigningUrl && (
        <div className="space-y-2">
          <a
            href={mobileSigningUrl}
            target="_blank"
            rel="noreferrer"
            className="block break-all rounded border border-zinc-200 bg-white px-2 py-1.5 text-[11px] font-medium text-zinc-700 hover:border-blue-300 hover:text-zinc-900"
          >
            {mobileSigningUrl}
          </a>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(mobileSigningUrl);
              } catch {
                // no-op
              }
            }}
            className="w-full rounded border border-zinc-300 bg-white px-3 py-1.5 text-[11px] font-medium text-zinc-700 hover:border-blue-400"
          >
            Copy mobile signing link
          </button>
        </div>
      )}
      {mobileSigningUrl && onFetchMobileSignature && (
        <button
          type="button"
          onClick={() => onFetchMobileSignature()}
          disabled={mobileSignatureFetching}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 transition hover:border-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {mobileSignatureFetching ? "Checking..." : "Fetch mobile signature"}
        </button>
      )}
      {expiryLabel && <p className="text-[11px] text-zinc-500">Expires at {expiryLabel}</p>}
      {mobileSigningError && <p className="text-xs text-red-600">{mobileSigningError}</p>}
      {mobileSignatureFetchError && (
        <p className="text-xs text-red-600">{mobileSignatureFetchError}</p>
      )}
      {mobileSignatureReady && activeSignature && (
        <div className="space-y-2 rounded border border-green-200 bg-green-50 px-2 py-2">
          <p className="text-xs font-medium text-green-800">Mobile signature received.</p>
          <p className="text-xs text-green-700">Click below to insert it into this document.</p>
          {mobileSigningStatusMessage && (
            <p className="text-[11px] text-green-700">{mobileSigningStatusMessage}</p>
          )}
          <button
            type="button"
            onClick={() => onInsertSignature()}
            className="w-full rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white"
          >
            Insert mobile signature
          </button>
        </div>
      )}
    </div>
  );
}

const SignatureToolsPanel: React.FC<SignatureToolsPanelProps> = ({
  mode,
  activeSignature,
  hasPlacedSignature = false,
  hasSelectedSignature,
  onSignatureDrawn,
  onInsertSignature,
  onUploadSignature,
  onDeleteSignature,
  onLockSignature,
  signatureLocked,
  onGenerateMobileSigningLink,
  mobileSigningUrl,
  mobileSigningQrDataUrl,
  mobileSigningExpiresAt,
  mobileSigningLoading,
  mobileSigningError,
  mobileSigningStatusMessage,
  onFetchMobileSignature,
  mobileSignatureFetching,
  mobileSignatureFetchError,
  mobileSignatureReady,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [showOnboardingTip, setShowOnboardingTip] = useState(true);
  const [showManageSignatureTip, setShowManageSignatureTip] = useState(true);

  const showManageSignatureHelper =
    mode === "sender" &&
    showManageSignatureTip &&
    (!!hasSelectedSignature || !!activeSignature);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!isPngOrJpegSignatureFile(file)) {
      setFileName(null);
      alert(SIGNATURE_UPLOAD_REJECTED_MESSAGE);
      return;
    }
    setFileName(file.name || "Signature");
    onUploadSignature(file);
  };

  const expiryLabel = (() => {
    if (!mobileSigningExpiresAt) return null;
    try {
      const d =
        typeof mobileSigningExpiresAt === "string"
          ? new Date(mobileSigningExpiresAt)
          : mobileSigningExpiresAt;
      if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return null;
    }
  })();

  const [openMethod, setOpenMethod] = useState<"draw" | "upload" | "mobile" | null>(null);
  const lockButton = lockButtonView(!!hasSelectedSignature, signatureLocked, mode);

  return (
    <aside className="h-auto min-h-0 w-full shrink-0 overflow-y-auto overscroll-contain border-b bg-white p-4 space-y-6 lg:h-full lg:w-[320px] lg:border-b-0 lg:border-r">
      {mode === "sender" && showOnboardingTip && (
        <div className="sticky top-0 z-10 shrink-0 -mx-1">
          <div className="relative rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 pr-9 text-emerald-950 shadow-md ring-1 ring-emerald-100/80">
            <button
              type="button"
              onClick={() => setShowOnboardingTip(false)}
              className="absolute right-2 top-2 rounded p-0.5 text-emerald-800 hover:bg-emerald-100/90"
              aria-label="Dismiss onboarding tip"
            >
              <span className="block text-sm font-medium leading-none">×</span>
            </button>
            <h2 className="text-xs font-semibold text-emerald-950">
              How to sign
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-emerald-900/90">
              Draw, upload, or sign on your phone. Place the signature, then lock it.
            </p>
          </div>
        </div>
      )}

      {mode === "sender" ? (
        <div className="space-y-3">
          <MethodAccordion
            id="draw"
            title="Draw signature"
            icon={<PenLine aria-hidden className="h-5 w-5" strokeWidth={2} />}
            open={openMethod === "draw"}
            onToggle={() =>
              setOpenMethod((current) => (current === "draw" ? null : "draw"))
            }
          >
            <SignaturePad
              mode={mode}
              activeSignature={activeSignature}
              onSignatureDrawn={onSignatureDrawn}
              onInsertSignature={onInsertSignature}
              showTitle={false}
              fitWidth
              active={openMethod === "draw"}
            />
          </MethodAccordion>
          <MethodAccordion
            id="upload"
            title="Upload signature"
            icon={<ImageUp aria-hidden className="h-5 w-5" strokeWidth={2} />}
            open={openMethod === "upload"}
            onToggle={() =>
              setOpenMethod((current) => (current === "upload" ? null : "upload"))
            }
          >
            <div className="space-y-3">
              {activeSignature && (
                <Image
                  src={activeSignature}
                  alt="Selected signature preview"
                  width={160}
                  height={48}
                  unoptimized
                  className="mx-auto h-12 w-auto object-contain"
                />
              )}
              <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-w-0 flex-1 truncate text-left text-xs text-zinc-600"
                >
                  {fileName || "Select file"}
                </button>
              </div>
              <button
                type="button"
                onClick={() => onInsertSignature()}
                className="w-full rounded-lg bg-black px-3 py-1.5 text-xs font-medium text-white"
              >
                Insert
              </button>
            </div>
          </MethodAccordion>
          <MethodAccordion
            id="mobile"
            title="Sign using your mobile"
            icon={<Smartphone aria-hidden className="h-5 w-5" strokeWidth={2} />}
            open={openMethod === "mobile"}
            onToggle={() =>
              setOpenMethod((current) => (current === "mobile" ? null : "mobile"))
            }
          >
            <MobileSigningFields
              activeSignature={activeSignature}
              expiryLabel={expiryLabel}
              mobileSigningError={mobileSigningError}
              mobileSigningLoading={mobileSigningLoading}
              mobileSigningQrDataUrl={mobileSigningQrDataUrl}
              mobileSigningStatusMessage={mobileSigningStatusMessage}
              mobileSigningUrl={mobileSigningUrl}
              mobileSignatureFetchError={mobileSignatureFetchError}
              mobileSignatureFetching={mobileSignatureFetching}
              mobileSignatureReady={mobileSignatureReady}
              onFetchMobileSignature={onFetchMobileSignature}
              onGenerateMobileSigningLink={onGenerateMobileSigningLink}
              onInsertSignature={onInsertSignature}
            />
          </MethodAccordion>
        </div>
      ) : (
        <>
      <SignaturePad
        mode={mode}
        activeSignature={activeSignature}
        onSignatureDrawn={onSignatureDrawn}
        onInsertSignature={onInsertSignature}
      />

      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase text-zinc-500">
          Upload Signature
        </div>
        <div className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 min-w-0 text-left text-xs text-zinc-600 truncate"
          >
            {fileName || "Select file"}
          </button>
          {fileName && (
            <button
              type="button"
              className="shrink-0 text-zinc-500 hover:text-red-600 text-sm leading-none"
              aria-label="Clear"
            >
              ×
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => onInsertSignature()}
          className="w-full rounded-lg bg-black px-3 py-1.5 text-xs font-medium text-white"
        >
          Insert
        </button>
      </div>
        </>
      )}

      {((mode === "sender" && hasPlacedSignature) ||
        (mode === "recipient" && activeSignature)) && (
        <div className="space-y-2 border-t border-zinc-200 pt-4">
          <div className="text-xs font-semibold uppercase text-zinc-500">
            Selected Signature
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onDeleteSignature}
              disabled={!hasSelectedSignature}
              className="w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Delete Signature
            </button>
            {!hasSelectedSignature && mode === "recipient" && (
              <p className="text-[11px] text-zinc-500">
                Select a placed signature to delete it.
              </p>
            )}
            <button
              type="button"
              onClick={onLockSignature}
              disabled={lockButton.disabled}
              className={lockButtonClassName(lockButton.tone, mode)}
            >
              {mode === "sender" && lockButton.tone === "lock" && (
                <Lock aria-hidden className="h-4 w-4" strokeWidth={2} />
              )}
              {mode === "sender" && lockButton.tone === "unlock" && (
                <LockOpen aria-hidden className="h-4 w-4" strokeWidth={2} />
              )}
              <span>{lockButton.label}</span>
              {mode === "sender" && lockButton.tone === "lock" && (
                <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
              )}
            </button>
            {lockButton.guidance && (
              <p className="text-[11px] text-zinc-500">{lockButton.guidance}</p>
            )}
          </div>
          {showManageSignatureHelper && (
            <div className="relative mt-2 shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 pr-9 text-emerald-950 shadow-md ring-1 ring-emerald-100/80">
              <button
                type="button"
                onClick={() => setShowManageSignatureTip(false)}
                className="absolute right-2 top-2 rounded p-0.5 text-emerald-800 hover:bg-emerald-100/90"
                aria-label="Dismiss manage signature tip"
              >
                <span className="block text-sm font-medium leading-none">×</span>
              </button>
              <h2 className="text-xs font-semibold text-emerald-950">
                Manage your signature
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-emerald-900/90">
                Click Delete Signature if you want to redo the sign and insert
                it again.
                <br />
                Once you are happy with the signature position, click Lock
                signature to continue.
              </p>
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={SIGNATURE_UPLOAD_ACCEPT}
        className="hidden"
        onChange={handleFileChange}
      />
    </aside>
  );
};

export default SignatureToolsPanel;

