"use client";

import { useRef, useEffect, useState } from "react";
import { Lock, RotateCcw, RotateCw } from "lucide-react";
import type { ShapeProps } from "@/types/editor";
import { toHexColor } from "@/lib/color";
import { getShapeCapabilities } from "@/data/shapes/catalog";

const PRESET_COLORS = [
  "#000000", "#374151", "#6b7280", "#9ca3af",
  "#dc2626", "#ea580c", "#ca8a04", "#65a30d",
  "#16a34a", "#059669", "#0d9488", "#0891b2",
  "#2563eb", "#4f46e5", "#7c3aed", "#9333ea",
];

type BorderStyle = "none" | "solid" | "dashed" | "double" | "dotted";

const DASH_ARRAYS: Record<BorderStyle, number[] | null> = {
  none: null,
  solid: null,
  dashed: [10, 5],
  double: [10, 5, 2, 5],
  dotted: [2, 4],
};

function getBorderStyleFromDashArray(arr: number[] | null | undefined, stroke: string | null | undefined): BorderStyle {
  if (stroke == null || stroke === "transparent" || String(stroke).trim() === "") return "none";
  if (!arr || !Array.isArray(arr) || arr.length === 0) return "solid";
  const key = arr.join(",");
  if (key === "10,5") return "dashed";
  if (key === "10,5,2,5") return "double";
  if (key === "2,4") return "dotted";
  return "solid";
}

function normalizeAngle(value: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return ((n % 360) + 360) % 360;
}

function normalizeHexIfValid(input: string): string | null {
  const trimmed = String(input || "").trim();
  if (!trimmed) return null;
  const hex = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (!/^[0-9a-fA-F]+$/.test(hex)) return null;
  if (hex.length !== 3 && hex.length !== 6) return null;
  return `#${hex.toUpperCase()}`;
}

export interface ShapeInspectorPanelProps {
  shapeProps: ShapeProps;
  activeObjectSnapshot: {
    fill?: string;
    stroke?: string | null;
    strokeWidth?: number;
    strokeDashArray?: number[] | null;
    opacity?: number;
    rx?: number;
    ry?: number;
    type?: string;
    lockMovementX?: boolean;
    lockMovementY?: boolean;
    lockScalingX?: boolean;
    lockScalingY?: boolean;
    lockRotation?: boolean;
    angle?: number;
  } | null;
  setShapeProp: (partial: Partial<ShapeProps>) => void;
  updateActiveObject: (patch: Record<string, unknown>) => void;
}

export function ShapeInspectorPanel({
  shapeProps,
  activeObjectSnapshot,
  setShapeProp,
  updateActiveObject,
}: ShapeInspectorPanelProps) {
  const colorPopoverRef = useRef<HTMLDivElement>(null);
  const [colorOpen, setColorOpen] = useState(false);

  const fill = toHexColor(shapeProps?.fill ?? activeObjectSnapshot?.fill, "#111827");
  const stroke = shapeProps?.stroke ?? activeObjectSnapshot?.stroke;
  const strokeHex = toHexColor(stroke, "#111827");
  const strokeWidth = Number(shapeProps?.strokeWidth ?? activeObjectSnapshot?.strokeWidth ?? 2);
  const opacity = Number(shapeProps?.opacity ?? activeObjectSnapshot?.opacity ?? 1);
  const cornerRadius = Number(shapeProps?.cornerRadius ?? activeObjectSnapshot?.rx ?? activeObjectSnapshot?.ry ?? 0);
  const objectType = String(activeObjectSnapshot?.type ?? "").toLowerCase();
  const shapeKind = String((activeObjectSnapshot as any)?.data?.shapeKind ?? "").toLowerCase();
  const capabilities = getShapeCapabilities(objectType, shapeKind);
  const isRect = objectType === "rect" || shapeKind === "rect";
  const isLine = objectType === "line" || shapeKind === "line";
  const styleLabel = isLine ? "Line Style" : "Border Style";
  const colorLabel = isLine ? "Line Color" : "Border Color";
  const thicknessLabel = isLine ? "Line Thickness" : "Border Thickness";

  const dashArr = activeObjectSnapshot?.strokeDashArray ?? null;
  const borderStyle = getBorderStyleFromDashArray(dashArr, stroke);

  const isLocked =
    activeObjectSnapshot?.lockMovementX === true ||
    activeObjectSnapshot?.lockMovementY === true ||
    activeObjectSnapshot?.lockScalingX === true ||
    activeObjectSnapshot?.lockScalingY === true ||
    activeObjectSnapshot?.lockRotation === true;
  const angle = normalizeAngle(Number(activeObjectSnapshot?.angle ?? 0));
  const canonicalFill = fill.toUpperCase();
  const canonicalStroke = strokeHex.toUpperCase();
  const [fillHexInput, setFillHexInput] = useState(canonicalFill);
  const [strokeHexInput, setStrokeHexInput] = useState(canonicalStroke);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (
        colorPopoverRef.current && !colorPopoverRef.current.contains(e.target as Node) &&
        !(e.target as HTMLElement).closest("[data-shape-color-swatch]")
      ) setColorOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    setFillHexInput(canonicalFill);
  }, [canonicalFill]);

  useEffect(() => {
    setStrokeHexInput(canonicalStroke);
  }, [canonicalStroke]);

  const setFill = (value: string) => setShapeProp({ fill: value });
  const setStroke = (value: string) => setShapeProp({ stroke: value, strokeWidth: strokeWidth > 0 ? strokeWidth : 2 });
  const setStrokeStyle = (style: BorderStyle) => {
    if (style === "none") {
      updateActiveObject({ stroke: null, strokeDashArray: null, strokeWidth: 0 });
    } else {
      const arr = DASH_ARRAYS[style];
      updateActiveObject({
        stroke: stroke ?? "#111827",
        strokeDashArray: arr ?? undefined,
        strokeWidth: strokeWidth > 0 ? strokeWidth : 2,
      });
    }
  };
  const setStrokeWidth = (v: number) => setShapeProp({ strokeWidth: Math.max(0, Math.min(50, v)) });
  const setCornerRadius = (v: number) => setShapeProp({ cornerRadius: v });
  const setOpacity = (v: number) => setShapeProp({ opacity: Math.max(0, Math.min(1, v / 100)) });
  const setLocked = (locked: boolean) => updateActiveObject({
    lockMovementX: locked,
    lockMovementY: locked,
    lockScalingX: locked,
    lockScalingY: locked,
    lockRotation: locked,
  });
  const setAngle = (value: number) =>
    updateActiveObject({
      angle: normalizeAngle(value),
      lockRotation: false,
      hasControls: true,
      padding: 10,
      snapAngle: 45,
      snapThreshold: 5,
    });

  return (
    <div className="rounded-2xl bg-white border border-[#d6deeb] shadow-[0_6px_14px_rgba(30,64,175,0.08)] transition-shadow transition-colors duration-200 hover:shadow-lg hover:border-slate-400 p-4 space-y-4">
      <div className="text-sm font-medium text-zinc-700 pb-2 border-b border-zinc-200">Shape</div>

      {capabilities.fill && (
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Fill</label>
          <div className="relative">
            <button
              type="button"
              data-shape-color-swatch
              onClick={() => setColorOpen((o) => !o)}
              className="w-full h-9 rounded-lg border border-zinc-200 flex items-center gap-2 px-2 hover:bg-zinc-50"
            >
              <span
                className="w-6 h-6 rounded border border-zinc-200 shrink-0"
                style={{ backgroundColor: fill }}
              />
              <span className="text-xs text-zinc-600 truncate">{fill}</span>
            </button>
            {colorOpen && (
              <div
                ref={colorPopoverRef}
                className="absolute left-0 top-full mt-1 z-50 w-56 rounded-xl bg-white border border-zinc-200 shadow-lg p-3"
              >
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => { setFill(c); setColorOpen(false); }}
                      className="w-8 h-8 rounded border border-zinc-200 hover:ring-2 ring-blue-500"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={fill}
                    onChange={(e) => {
                      const next = normalizeHexIfValid(e.target.value) ?? canonicalFill;
                      setFill(next);
                      setFillHexInput(next);
                    }}
                    className="w-10 h-8 rounded border cursor-pointer"
                  />
                  <input
                    type="text"
                    value={fillHexInput}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setFillHexInput(raw);
                      const normalized = normalizeHexIfValid(raw);
                      if (normalized) setFill(normalized);
                    }}
                    onBlur={() => {
                      const normalized = normalizeHexIfValid(fillHexInput);
                      if (normalized) {
                        setFill(normalized);
                        setFillHexInput(normalized);
                      } else {
                        setFillHexInput(canonicalFill);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      const normalized = normalizeHexIfValid(fillHexInput);
                      if (normalized) {
                        setFill(normalized);
                        setFillHexInput(normalized);
                      } else {
                        setFillHexInput(canonicalFill);
                      }
                    }}
                    className="flex-1 rounded border border-zinc-200 px-2 py-1 text-xs font-mono"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {(capabilities.stroke || capabilities.strokeWidth) && (
      <div className="space-y-3">
        <div>
          <div className="text-xs text-zinc-500 mb-1">{styleLabel}</div>
          <div className="flex gap-1 flex-wrap">
            {(
              [
                { value: "solid", label: "Solid" },
                { value: "dashed", label: "Dash" },
                { value: "double", label: "Double Dash" },
                { value: "dotted", label: "Dotted" },
              ] as const
            ).map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setStrokeStyle(item.value)}
                className={`px-2 py-1.5 rounded-lg border text-xs ${
                  borderStyle === item.value
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-zinc-200 hover:bg-zinc-50"
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setStrokeStyle("none")}
              className={`px-2 py-1.5 rounded-lg border text-xs ${
                borderStyle === "none"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              No Border
            </button>
          </div>
        </div>

        {capabilities.stroke && (
        <div>
          <div className="text-xs text-zinc-500 mb-1">{colorLabel}</div>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={strokeHex}
              onChange={(e) => {
                const next = normalizeHexIfValid(e.target.value) ?? canonicalStroke;
                setStroke(next);
                setStrokeHexInput(next);
              }}
              className="w-10 h-8 rounded border cursor-pointer"
            />
            <input
              type="text"
              value={strokeHexInput}
              onChange={(e) => {
                const raw = e.target.value;
                setStrokeHexInput(raw);
                const normalized = normalizeHexIfValid(raw);
                if (normalized) setStroke(normalized);
              }}
              onBlur={() => {
                const normalized = normalizeHexIfValid(strokeHexInput);
                if (normalized) {
                  setStroke(normalized);
                  setStrokeHexInput(normalized);
                } else {
                  setStrokeHexInput(canonicalStroke);
                }
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const normalized = normalizeHexIfValid(strokeHexInput);
                if (normalized) {
                  setStroke(normalized);
                  setStrokeHexInput(normalized);
                } else {
                  setStrokeHexInput(canonicalStroke);
                }
              }}
              className="flex-1 rounded border border-zinc-200 px-2 py-1 text-xs font-mono"
            />
          </div>
        </div>
        )}

        {capabilities.strokeWidth && (
        <div>
          <div className="text-xs text-zinc-500 mb-1">{thicknessLabel}</div>
          <div className="flex gap-2 items-center">
            <input
              type="range"
              min={0}
              max={50}
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value))}
              className="flex-1 h-2 rounded-full appearance-none bg-zinc-200 accent-blue-600"
            />
            <input
              type="number"
              min={0}
              max={50}
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value) || 0)}
              className="w-14 rounded border border-zinc-200 px-2 py-1 text-sm text-center"
            />
          </div>
        </div>
        )}
      </div>
      )}

      {capabilities.cornerRadius && isRect && (
        <div>
          <div className="text-xs text-zinc-500 mb-1">Corner rounding</div>
          <div className="flex gap-2 items-center">
            <input
              type="range"
              min={0}
              max={100}
              value={cornerRadius}
              onChange={(e) => setCornerRadius(Number(e.target.value))}
              className="flex-1 h-2 rounded-full appearance-none bg-zinc-200 accent-blue-600"
            />
            <input
              type="number"
              min={0}
              max={100}
              value={cornerRadius}
              onChange={(e) => setCornerRadius(Number(e.target.value) || 0)}
              className="w-14 rounded border border-zinc-200 px-2 py-1 text-sm text-center"
            />
          </div>
        </div>
      )}

      {/* 3. Opacity */}
      {capabilities.opacity && (
      <div>
        <label className="text-xs text-zinc-500 block mb-1">Opacity</label>
        <div className="flex gap-2 items-center">
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(opacity * 100)}
            onChange={(e) => setOpacity(Number(e.target.value))}
            className="flex-1 h-2 rounded-full appearance-none bg-zinc-200 accent-blue-600"
          />
          <span className="text-xs text-zinc-500 w-8">{Math.round(opacity * 100)}%</span>
        </div>
      </div>
      )}

      <div>
        <label className="text-xs text-zinc-500 block mb-1">Rotation</label>
        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={() => setAngle(angle - 15)}
            className="h-9 px-3 rounded-lg border border-zinc-200 hover:bg-zinc-50 flex items-center justify-center"
            title="Rotate left 15 degrees"
          >
            <RotateCcw size={16} />
          </button>
          <input
            type="number"
            min={0}
            max={360}
            value={Math.round(angle)}
            onChange={(e) => setAngle(Number(e.target.value))}
            className="flex-1 h-9 rounded-lg border border-zinc-200 px-2 text-sm text-center"
          />
          <button
            type="button"
            onClick={() => setAngle(angle + 15)}
            className="h-9 px-3 rounded-lg border border-zinc-200 hover:bg-zinc-50 flex items-center justify-center"
            title="Rotate right 15 degrees"
          >
            <RotateCw size={16} />
          </button>
        </div>
      </div>

      {/* 4. Lock shape */}
      <div>
        <label className="text-xs text-zinc-500 block mb-1">Lock</label>
        <button
          type="button"
          onClick={() => setLocked(!isLocked)}
          className={`w-full h-9 rounded-lg border flex items-center justify-center gap-2 ${
            isLocked ? "bg-blue-600 text-white border-blue-600" : "border-zinc-200 hover:bg-zinc-50"
          }`}
        >
          <Lock size={16} />
          <span className="text-sm">{isLocked ? "Unlock" : "Lock shape"}</span>
        </button>
      </div>
    </div>
  );
}
