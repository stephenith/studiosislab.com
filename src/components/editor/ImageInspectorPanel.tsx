"use client";

import { useRef, useEffect, useState } from "react";
import {
  ImagePlus,
  Eraser,
  Square,
  Ruler,
  Crop,
  FlipHorizontal,
  FlipVertical,
  SlidersHorizontal,
  Check,
} from "lucide-react";
import { Rect } from "fabric";
import type { ImageProps } from "@/types/editor";

type BorderStyle = "none" | "solid" | "dashed" | "double" | "dotted";

const DASH_ARRAYS: Record<BorderStyle, number[] | null> = {
  none: null,
  solid: null,
  dashed: [10, 5],
  double: [10, 5, 2, 5],
  dotted: [2, 4],
};

function getBorderStyleFromDashArray(
  arr: number[] | null | undefined,
  stroke: string | null | undefined
): BorderStyle {
  if (stroke == null || stroke === "transparent" || String(stroke).trim() === "") return "none";
  if (!arr || !Array.isArray(arr) || arr.length === 0) return "solid";
  const key = arr.join(",");
  if (key === "10,5") return "dashed";
  if (key === "10,5,2,5") return "double";
  if (key === "2,4") return "dotted";
  return "solid";
}

export interface ImageInspectorPanelProps {
  imageProps: ImageProps;
  activeObjectSnapshot: {
    width?: number;
    height?: number;
    stroke?: string | null;
    strokeWidth?: number;
    strokeDashArray?: number[] | null;
    clipPath?: unknown;
    flipX?: boolean;
    flipY?: boolean;
    opacity?: number;
  } | null;
  updateActiveObject: (patch: Record<string, unknown>) => void;
}

export function ImageInspectorPanel({
  imageProps,
  activeObjectSnapshot,
  updateActiveObject,
}: ImageInspectorPanelProps) {
  const borderPopoverRef = useRef<HTMLDivElement>(null);
  const flipPopoverRef = useRef<HTMLDivElement>(null);

  const [borderOpen, setBorderOpen] = useState(false);
  const [cornerOpen, setCornerOpen] = useState(false);
  const [flipOpen, setFlipOpen] = useState(false);
  const [cropMode, setCropMode] = useState(false);

  const stroke = activeObjectSnapshot?.stroke ?? "#111827";
  const strokeWidth = Number(activeObjectSnapshot?.strokeWidth ?? 0);
  const dashArr = activeObjectSnapshot?.strokeDashArray ?? null;
  const borderStyle = getBorderStyleFromDashArray(dashArr, stroke);

  const imgW = Number(activeObjectSnapshot?.width ?? 100);
  const imgH = Number(activeObjectSnapshot?.height ?? 100);
  const clipPathObj = activeObjectSnapshot?.clipPath as { rx?: number; ry?: number } | undefined;
  const cornerRadius = clipPathObj?.rx ?? clipPathObj?.ry ?? 0;

  const flipX = activeObjectSnapshot?.flipX ?? false;
  const flipY = activeObjectSnapshot?.flipY ?? false;

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (
        borderPopoverRef.current &&
        !borderPopoverRef.current.contains(e.target as Node) &&
        !(e.target as HTMLElement).closest("[data-image-border-trigger]")
      )
        setBorderOpen(false);
      if (
        flipPopoverRef.current &&
        !flipPopoverRef.current.contains(e.target as Node) &&
        !(e.target as HTMLElement).closest("[data-image-flip-trigger]")
      )
        setFlipOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

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

  const setStrokeWidth = (v: number) =>
    updateActiveObject({ strokeWidth: Math.max(0, Math.min(50, v)) });

  const setCornerRadius = (value: number) => {
    const r = Math.max(0, Math.min(200, value));
    const clipPath = new Rect({
      width: imgW,
      height: imgH,
      rx: r,
      ry: r,
      originX: "center",
      originY: "center",
      left: 0,
      top: 0,
      selectable: false,
      evented: false,
    });
    updateActiveObject({ clipPath });
  };

  const setFlipX = () => updateActiveObject({ flipX: !flipX });
  const setFlipY = () => updateActiveObject({ flipY: !flipY });

  const handleCropDone = () => {
    setCropMode(false);
  };

  return (
    <div className="rounded-2xl bg-white border border-[#d6deeb] shadow-[0_6px_14px_rgba(30,64,175,0.08)] transition-shadow transition-colors duration-200 hover:shadow-lg hover:border-slate-400 p-4 space-y-4">
      <div className="text-sm font-medium text-zinc-700 pb-2 border-b border-zinc-200">Image</div>

      {/* Section 1 — Image Actions (placeholders) */}
      <div>
        <label className="text-xs text-zinc-500 block mb-1">Actions</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => console.log("Edit image clicked")}
            className="flex-1 h-9 rounded-lg border border-zinc-200 flex items-center justify-center gap-2 hover:bg-zinc-50 text-sm"
          >
            <ImagePlus size={16} className="text-zinc-600" />
            <span>Edit Image</span>
          </button>
          <button
            type="button"
            onClick={() => console.log("Background remover clicked")}
            className="flex-1 h-9 rounded-lg border border-zinc-200 flex items-center justify-center gap-2 hover:bg-zinc-50 text-sm"
          >
            <Eraser size={16} className="text-zinc-600" />
            <span>BG Remover</span>
          </button>
        </div>
      </div>

      {/* Section 2 — Image Toolbar */}
      <div>
        <label className="text-xs text-zinc-500 block mb-1">Tools</label>
        <div className="flex gap-1 flex-wrap">
          <div className="relative">
            <button
              type="button"
              data-image-border-trigger
              onClick={() => { setBorderOpen((o) => !o); setCornerOpen(false); setFlipOpen(false); }}
              className={`w-9 h-9 rounded-lg border flex items-center justify-center ${
                borderOpen ? "bg-blue-600 text-white border-blue-600" : "border-zinc-200 hover:bg-zinc-50"
              }`}
              title="Border"
            >
              <Square size={16} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => { setCornerOpen((o) => !o); setBorderOpen(false); setFlipOpen(false); }}
            className={`w-9 h-9 rounded-lg border flex items-center justify-center ${
              cornerOpen ? "bg-blue-600 text-white border-blue-600" : "border-zinc-200 hover:bg-zinc-50"
            }`}
            title="Corner rounding"
          >
            <Ruler size={16} />
          </button>
          <button
            type="button"
            onClick={() => { setCropMode((c) => !c); setBorderOpen(false); setFlipOpen(false); setCornerOpen(false); }}
            className={`w-9 h-9 rounded-lg border flex items-center justify-center ${
              cropMode ? "bg-blue-600 text-white border-blue-600" : "border-zinc-200 hover:bg-zinc-50"
            }`}
            title="Crop"
          >
            <Crop size={16} />
          </button>
          <div className="relative">
            <button
              type="button"
              data-image-flip-trigger
              onClick={() => { setFlipOpen((o) => !o); setBorderOpen(false); setCornerOpen(false); }}
              className={`w-9 h-9 rounded-lg border flex items-center justify-center ${
                flipOpen ? "bg-blue-600 text-white border-blue-600" : "border-zinc-200 hover:bg-zinc-50"
              }`}
              title="Flip"
            >
              <FlipHorizontal size={16} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => console.log("Adjust tool clicked")}
            className="w-9 h-9 rounded-lg border border-zinc-200 flex items-center justify-center hover:bg-zinc-50"
            title="Adjust"
          >
            <SlidersHorizontal size={16} />
          </button>
        </div>
      </div>

      {/* Section 3 — Border popup */}
      {borderOpen && (
        <div
          ref={borderPopoverRef}
          className="rounded-xl bg-white border border-zinc-200 shadow-lg p-3 space-y-3"
        >
          <div className="text-xs font-medium text-zinc-600">Border</div>
          <div className="flex gap-1 flex-wrap">
            {(["none", "solid", "dashed", "double", "dotted"] as BorderStyle[]).map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => setStrokeStyle(style)}
                className={`px-2 py-1.5 rounded-lg border text-xs capitalize ${
                  borderStyle === style ? "bg-blue-600 text-white border-blue-600" : "border-zinc-200 hover:bg-zinc-50"
                }`}
              >
                {style === "none" ? "None" : style === "double" ? "Double dash" : style}
              </button>
            ))}
          </div>
          <div>
            <div className="text-xs text-zinc-500 mb-1">Border weight</div>
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
        </div>
      )}

      {/* Section 4 — Corner rounding */}
      {cornerOpen && (
        <div className="rounded-xl bg-white border border-zinc-200 shadow-lg p-3 space-y-3">
          <div className="text-xs font-medium text-zinc-600">Corner rounding</div>
          <div className="flex gap-2 items-center">
            <input
              type="range"
              min={0}
              max={200}
              value={cornerRadius}
              onChange={(e) => setCornerRadius(Number(e.target.value))}
              className="flex-1 h-2 rounded-full appearance-none bg-zinc-200 accent-blue-600"
            />
            <input
              type="number"
              min={0}
              max={200}
              value={cornerRadius}
              onChange={(e) => setCornerRadius(Number(e.target.value) || 0)}
              className="w-14 rounded border border-zinc-200 px-2 py-1 text-sm text-center"
            />
          </div>
        </div>
      )}

      {/* Section 5 — Crop mode */}
      {cropMode && (
        <div className="rounded-xl bg-white border border-zinc-200 shadow-lg p-3 space-y-3">
          <div className="text-xs font-medium text-zinc-600">Crop mode</div>
          <p className="text-xs text-zinc-500">Cropping frame would appear on canvas. Use DONE to apply and exit.</p>
          <button
            type="button"
            onClick={handleCropDone}
            className="w-full h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center gap-2 text-sm font-medium hover:bg-blue-700"
          >
            <Check size={16} />
            Done
          </button>
        </div>
      )}

      {/* Section 6 — Flip popup */}
      {flipOpen && (
        <div
          ref={flipPopoverRef}
          className="rounded-xl bg-white border border-zinc-200 shadow-lg p-3 space-y-2"
        >
          <div className="text-xs font-medium text-zinc-600">Flip</div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setFlipX(); setFlipOpen(false); }}
              className={`flex-1 h-9 rounded-lg border flex items-center justify-center gap-2 text-sm ${
                flipX ? "bg-blue-600 text-white border-blue-600" : "border-zinc-200 hover:bg-zinc-50"
              }`}
            >
              <FlipHorizontal size={16} />
              Horizontal
            </button>
            <button
              type="button"
              onClick={() => { setFlipY(); setFlipOpen(false); }}
              className={`flex-1 h-9 rounded-lg border flex items-center justify-center gap-2 text-sm ${
                flipY ? "bg-blue-600 text-white border-blue-600" : "border-zinc-200 hover:bg-zinc-50"
              }`}
            >
              <FlipVertical size={16} />
              Vertical
            </button>
          </div>
        </div>
      )}

      {/* Opacity from imageProps */}
      <div>
        <label className="text-xs text-zinc-500 block mb-1">Opacity</label>
        <div className="flex gap-2 items-center">
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round((imageProps?.opacity ?? 1) * 100)}
            onChange={(e) => updateActiveObject({ opacity: Number(e.target.value) / 100 })}
            className="flex-1 h-2 rounded-full appearance-none bg-zinc-200 accent-blue-600"
          />
          <span className="text-xs text-zinc-500 w-8">{Math.round((imageProps?.opacity ?? 1) * 100)}%</span>
        </div>
      </div>
    </div>
  );
}
