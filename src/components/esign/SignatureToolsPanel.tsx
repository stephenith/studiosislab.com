"use client";

import React, { useState, useRef, useEffect } from "react";

type SignatureToolsPanelProps = {
  mode: "sender" | "recipient";
  activeSignature: string | null;
  onSignatureDrawn: (dataUrl: string) => void;
  onInsertSignature: (dataUrl?: string) => void;
  onUploadSignature: (file: File) => void;
  onDeleteSignature: () => void;
  onLockSignature: () => void;
  signatureLocked: boolean;
};

function SignaturePad({
  mode,
  activeSignature,
  onSignatureDrawn,
  onInsertSignature,
}: {
  mode: "sender" | "recipient";
  activeSignature: string | null;
  onSignatureDrawn: (dataUrl: string) => void;
  onInsertSignature: (dataUrl?: string) => void;
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
      if (stroke.points.length < 2) continue;
      ctx.strokeStyle = stroke.color;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
  };

  useEffect(() => {
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes]);

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

const SignatureToolsPanel: React.FC<SignatureToolsPanelProps> = ({
  mode,
  activeSignature,
  onSignatureDrawn,
  onInsertSignature,
  onUploadSignature,
  onDeleteSignature,
  onLockSignature,
  signatureLocked,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name || "Signature");
    onUploadSignature(file);
  };

  return (
    <aside className="w-[320px] shrink-0 border-r bg-white p-4 space-y-6">
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

      {activeSignature && (
        <div className="space-y-2 border-t border-zinc-200 pt-4">
          <div className="text-xs font-semibold uppercase text-zinc-500">
            Selected Signature
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onDeleteSignature}
              className="w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
            >
              Delete Signature
            </button>
            <button
              type="button"
              onClick={onLockSignature}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:border-blue-400"
            >
              {signatureLocked ? "Unlock Signature" : "Lock Signature"}
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </aside>
  );
};

export default SignatureToolsPanel;

