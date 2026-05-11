"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { HOME_LOGOS_DARK } from "@/components/home/homeLogoAssets";

type MobileSignClientProps = {
  sessionId: string;
};

type ValidateState =
  | { phase: "loading"; error: null }
  | { phase: "invalid"; error: string }
  | { phase: "ready"; error: null }
  | { phase: "submitted"; error: null };

function smoothStroke(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  strokeColor: string
) {
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
}

export default function MobileSignClient({ sessionId }: MobileSignClientProps) {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [state, setState] = useState<ValidateState>({
    phase: "loading",
    error: null,
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [color, setColor] = useState<"black" | "blue">("black");
  const [strokes, setStrokes] = useState<
    { points: { x: number; y: number }[]; color: string }[]
  >([]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const MIN_POINT_DISTANCE = 1.4;

  useEffect(() => {
    let alive = true;

    const validate = async () => {
      if (!sessionId || !token) {
        if (!alive) return;
        setState({
          phase: "invalid",
          error: "Invalid or missing signing link.",
        });
        return;
      }

      try {
        setState({ phase: "loading", error: null });
        const res = await fetch(
          `/api/esign/mobile-sign/validate?sessionId=${encodeURIComponent(
            sessionId
          )}&token=${encodeURIComponent(token)}`,
          {
            method: "GET",
          }
        );
        const json = await res.json().catch(() => null);
        if (!alive) return;
        if (!res.ok || !json?.ok) {
          setState({
            phase: "invalid",
            error:
              typeof json?.error === "string"
                ? json.error
                : "This mobile signing session is invalid or expired.",
          });
          return;
        }
        setState({ phase: "ready", error: null });
      } catch {
        if (!alive) return;
        setState({
          phase: "invalid",
          error: "Failed to validate this mobile signing session.",
        });
      }
    };

    validate();
    return () => {
      alive = false;
    };
  }, [sessionId, token]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokes) {
      smoothStroke(ctx, stroke.points, stroke.color);
    }
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
      const prevPt = last.points[last.points.length - 1];
      if (!prevPt) return prev;
      const dx = pt.x - prevPt.x;
      const dy = pt.y - prevPt.y;
      if (Math.hypot(dx, dy) < MIN_POINT_DISTANCE) return prev;
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

  const handleSubmit = async () => {
    if (!canvasRef.current) return;
    const signatureDataUrl = canvasRef.current.toDataURL("image/png");
    if (!signatureDataUrl || !signatureDataUrl.startsWith("data:image/png;base64,")) {
      setSubmitError("Please draw your signature first.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/esign/mobile-sign/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          token,
          signatureDataUrl,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setSubmitError(
          typeof json?.error === "string"
            ? json.error
            : "Failed to submit signature."
        );
        return;
      }
      setState({ phase: "submitted", error: null });
    } catch {
      setSubmitError("Failed to submit signature.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-dvh bg-zinc-50 text-zinc-900">
      <div className="mx-auto w-full max-w-md px-4 py-6">
        <div className="mb-5 flex items-center justify-between">
          <Link
            href="/"
            className="relative block h-9 w-[190px]"
            aria-label="StudiosisLab home"
          >
            <Image
              src={HOME_LOGOS_DARK.header}
              alt="StudiosisLab"
              fill
              className="object-contain object-left"
              sizes="190px"
              priority
            />
          </Link>
        </div>

        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h1 className="text-lg font-semibold">Sign using your mobile</h1>

          {state.phase === "loading" && (
            <p className="mt-3 text-sm text-zinc-600">Validating signing link…</p>
          )}

          {state.phase === "invalid" && (
            <p className="mt-3 text-sm text-red-600">
              {state.error || "This signing session is invalid or expired."}
            </p>
          )}

          {state.phase === "submitted" && (
            <p className="mt-3 text-sm text-green-700">
              Signature sent to your document. You can return to your computer.
            </p>
          )}

          {state.phase === "ready" && (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-zinc-600">Sign here</p>
              <div className="rounded-xl border border-zinc-300 bg-white p-2">
                <canvas
                  ref={canvasRef}
                  width={320}
                  height={120}
                  className="w-full rounded-lg bg-white touch-none"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                />
              </div>

              <div className="flex items-center gap-2">
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
                    aria-label="Black signature color"
                  />
                  <button
                    type="button"
                    onClick={() => setColor("blue")}
                    className={`h-6 w-6 rounded-full border ${
                      color === "blue"
                        ? "border-blue-500 ring-2 ring-blue-200"
                        : "border-zinc-300"
                    } bg-blue-600`}
                    aria-label="Blue signature color"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full rounded-lg bg-black px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting
                  ? "Sending signature..."
                  : "Insert this sign on your document"}
              </button>

              {submitError && (
                <p className="text-xs text-red-600">{submitError}</p>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
