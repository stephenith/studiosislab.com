"use client";

import { useRef, useEffect, useState } from "react";
import { ChevronDown, AlignLeft, AlignCenter, AlignRight, AlignJustify, Bold, Italic, Underline, Type, List, ListOrdered } from "lucide-react";
import type { TextProps } from "@/types/editor";
import { toHexColor } from "@/lib/color";
import fontCatalog from "@/data/fonts/catalog.json";
import { ensureFontLoaded } from "@/lib/fonts/fontLoader";
import { FontPicker, type FontFamily } from "@/components/editor/panels/FontPicker";

const typedFontCatalog = fontCatalog as FontFamily[];

const PRESET_COLORS = [
  "#000000", "#374151", "#6b7280", "#9ca3af",
  "#dc2626", "#ea580c", "#ca8a04", "#65a30d",
  "#16a34a", "#059669", "#0d9488", "#0891b2",
  "#2563eb", "#4f46e5", "#7c3aed", "#9333ea",
];

export interface TextInspectorPanelProps {
  textProps: TextProps;
  setTextProp: (partial: Partial<TextProps>) => void;
  updateActiveObject: (patch: Record<string, unknown>) => void;
  toggleUppercase: () => void;
  toggleBulletList: () => void;
  toggleNumberedList: () => void;
}

export function TextInspectorPanel({
  textProps,
  setTextProp,
  updateActiveObject,
  toggleUppercase,
  toggleBulletList,
  toggleNumberedList,
}: TextInspectorPanelProps) {
  const colorPopoverRef = useRef<HTMLDivElement>(null);
  const spacingPopoverRef = useRef<HTMLDivElement>(null);
  const [colorOpen, setColorOpen] = useState(false);
  const [spacingOpen, setSpacingOpen] = useState(false);
  const [fontSizeDraft, setFontSizeDraft] = useState<string | null>(null);
  const [isEditingFontSize, setIsEditingFontSize] = useState(false);

  const fillHex = toHexColor(textProps.fill, "#111827");
  const charSpacing = Number(textProps.charSpacing ?? 0);
  const lineHeight = Number(textProps.lineHeight ?? 1.3);
  const opacity = Number(textProps.opacity ?? 1);
  const isUppercase = !!textProps.uppercaseEnabled;
  const activeListMode = textProps.listMode || "none";
  const activeWeight = Number(textProps.fontWeight ?? 400);
  const activeStyle: "normal" | "italic" = textProps.fontStyle === "italic" ? "italic" : "normal";
  const activeVariantId = textProps.fontVariantId || `${activeWeight}-${activeStyle}`;
  const selectedFont = typedFontCatalog.find((font) => font.family === textProps.fontFamily);
  const variants = selectedFont?.variants || [];

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (
        colorPopoverRef.current && !colorPopoverRef.current.contains(e.target as Node) &&
        !(e.target as HTMLElement).closest("[data-color-swatch]")
      ) setColorOpen(false);
      if (
        spacingPopoverRef.current && !spacingPopoverRef.current.contains(e.target as Node) &&
        !(e.target as HTMLElement).closest("[data-spacing-trigger]")
      ) setSpacingOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    if (!isEditingFontSize) {
      setFontSizeDraft(null);
    }
  }, [isEditingFontSize, textProps.fontSize]);

  const commitFontSize = () => {
    const parsed = parseInt(fontSizeDraft || "", 10);
    if (!Number.isNaN(parsed)) {
      const clamped = Math.max(1, Math.min(parsed, 500));
      setTextProp({ fontSize: clamped });
    }
    setIsEditingFontSize(false);
    setFontSizeDraft(null);
  };

  const handleVariantChange = async (variantId: string) => {
    const font = typedFontCatalog.find((item) => item.family === textProps.fontFamily);
    if (!font) return;
    const variant = font.variants.find((item) => item.id === variantId);
    if (!variant) return;

    await ensureFontLoaded(font.family, variant);

    setTextProp({
      fontFamily: font.family,
      fontWeight: variant.weight,
      fontStyle: variant.style,
      fontVariantId: variant.id,
    });
  };

  const handleFontChange = async (family: string) => {
    const font = typedFontCatalog.find((item) => item.family === family);
    if (!font) return;

    const defaultVariant =
      font.variants.find((item) => item.weight === 400 && item.style === "normal") ||
      font.variants[0];
    if (!defaultVariant) return;

    await ensureFontLoaded(family, defaultVariant);

    setTextProp({
      fontFamily: family,
      fontWeight: defaultVariant.weight,
      fontStyle: defaultVariant.style,
      fontVariantId: defaultVariant.id,
    });
  };

  return (
    <div className="rounded-2xl bg-white border border-[#d6deeb] shadow-[0_6px_14px_rgba(30,64,175,0.08)] transition-shadow transition-colors duration-200 hover:shadow-lg hover:border-slate-400 p-4 space-y-4">
      <div className="text-sm font-medium text-zinc-700 pb-2 border-b border-zinc-200">Text</div>

      {/* 1. Font family */}
      <div>
        <label className="text-xs text-zinc-500 block mb-1">Font</label>
        <FontPicker
          fonts={typedFontCatalog}
          value={textProps.fontFamily}
          onSelect={(family) => {
            void handleFontChange(family);
          }}
        />
      </div>

      <div>
        <label className="text-xs text-zinc-500 block mb-1">Font Style</label>
        <div className="relative">
          <select
            value={activeVariantId}
            onChange={(e) => {
              void handleVariantChange(e.target.value);
            }}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm appearance-none bg-white pr-8"
            disabled={variants.length === 0}
          >
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.label}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400" />
        </div>
      </div>

      {/* 2. Font size */}
      <div>
        <label className="text-xs text-zinc-500 block mb-1">Size</label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setTextProp({ fontSize: Math.max(8, (textProps.fontSize ?? 32) - 1) })}
            className="w-8 h-8 rounded-lg border border-zinc-200 flex items-center justify-center text-sm hover:bg-zinc-50"
          >
            −
          </button>
          <input
            type="number"
            min={8}
            max={200}
            value={isEditingFontSize ? (fontSizeDraft ?? "") : String(textProps.fontSize ?? "")}
            onChange={(e) => {
              setFontSizeDraft(e.target.value);
            }}
            onFocus={() => {
              setIsEditingFontSize(true);
              setFontSizeDraft(String(textProps.fontSize ?? ""));
            }}
            onBlur={commitFontSize}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitFontSize();
              }
            }}
            className="w-14 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm text-center"
          />
          <button
            type="button"
            onClick={() => setTextProp({ fontSize: Math.min(200, (textProps.fontSize ?? 32) + 1) })}
            className="w-8 h-8 rounded-lg border border-zinc-200 flex items-center justify-center text-sm hover:bg-zinc-50"
          >
            +
          </button>
        </div>
      </div>

      {/* 3. Font color */}
      <div>
        <label className="text-xs text-zinc-500 block mb-1">Color</label>
        <div className="relative">
          <button
            type="button"
            data-color-swatch
            onClick={() => setColorOpen((o) => !o)}
            className="w-full h-9 rounded-lg border border-zinc-200 flex items-center gap-2 px-2"
          >
            <span className="w-5 h-5 rounded border border-zinc-200 shrink-0" style={{ backgroundColor: fillHex }} />
            <span className="text-xs text-zinc-600 truncate">{fillHex}</span>
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
                    onClick={() => { setTextProp({ fill: c }); setColorOpen(false); }}
                    className="w-8 h-8 rounded border border-zinc-200 hover:ring-2 ring-blue-500"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={fillHex}
                  onChange={(e) => setTextProp({ fill: e.target.value })}
                  className="w-10 h-8 rounded border cursor-pointer"
                />
                <input
                  type="text"
                  value={fillHex}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    if (v.startsWith("#") || /^[0-9a-fA-F]{3,6}$/.test(v)) setTextProp({ fill: v.startsWith("#") ? v : `#${v}` });
                  }}
                  className="flex-1 rounded border border-zinc-200 px-2 py-1 text-xs font-mono"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Style buttons */}
      <div>
        <label className="text-xs text-zinc-500 block mb-1">Style</label>
        <div className="flex gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => setTextProp({ fontWeight: activeWeight >= 600 ? 400 : 700, fontVariantId: `${activeWeight >= 600 ? 400 : 700}-${activeStyle}` })}
            className={`w-8 h-8 rounded-lg border flex items-center justify-center ${activeWeight >= 600 ? "bg-blue-600 text-white border-blue-600" : "border-zinc-200 hover:bg-zinc-50"}`}
            title="Bold"
          >
            <Bold size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              const nextStyle: "normal" | "italic" = activeStyle === "italic" ? "normal" : "italic";
              setTextProp({ fontStyle: nextStyle, fontVariantId: `${activeWeight}-${nextStyle}` });
            }}
            className={`w-8 h-8 rounded-lg border flex items-center justify-center ${activeStyle === "italic" ? "bg-blue-600 text-white border-blue-600" : "border-zinc-200 hover:bg-zinc-50"}`}
            title="Italic"
          >
            <Italic size={16} />
          </button>
          <button
            type="button"
            onClick={() => setTextProp({ underline: !textProps.underline })}
            className={`w-8 h-8 rounded-lg border flex items-center justify-center ${textProps.underline ? "bg-blue-600 text-white border-blue-600" : "border-zinc-200 hover:bg-zinc-50"}`}
            title="Underline"
          >
            <Underline size={16} />
          </button>
          <button
            type="button"
            onClick={toggleUppercase}
            className={`w-8 h-8 rounded-lg border flex items-center justify-center ${isUppercase ? "bg-blue-600 text-white border-blue-600" : "border-zinc-200 hover:bg-zinc-50"}`}
            title="Uppercase"
          >
            <Type size={16} />
          </button>
        </div>
      </div>

      {/* 5. Alignment */}
      <div>
        <label className="text-xs text-zinc-500 block mb-1">Align</label>
        <div className="flex gap-1">
          {(["left", "center", "right", "justify"] as const).map((align) => (
            <button
              key={align}
              type="button"
              onClick={() => setTextProp({ textAlign: align })}
              className={`w-8 h-8 rounded-lg border flex items-center justify-center ${textProps.textAlign === align ? "bg-blue-600 text-white border-blue-600" : "border-zinc-200 hover:bg-zinc-50"}`}
              title={align.charAt(0).toUpperCase() + align.slice(1)}
            >
              {align === "left" && <AlignLeft size={16} />}
              {align === "center" && <AlignCenter size={16} />}
              {align === "right" && <AlignRight size={16} />}
              {align === "justify" && <AlignJustify size={16} />}
            </button>
          ))}
        </div>
      </div>

      {/* 6. List controls */}
      <div>
        <label className="text-xs text-zinc-500 block mb-1">List</label>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={toggleBulletList}
            className={`w-8 h-8 rounded-lg border flex items-center justify-center ${activeListMode === "bullet" ? "bg-blue-600 text-white border-blue-600" : "border-zinc-200 hover:bg-zinc-50"}`}
            title="Bullet list"
          >
            <List size={16} />
          </button>
          <button
            type="button"
            onClick={toggleNumberedList}
            className={`w-8 h-8 rounded-lg border flex items-center justify-center ${activeListMode === "number" ? "bg-blue-600 text-white border-blue-600" : "border-zinc-200 hover:bg-zinc-50"}`}
            title="Numbered list"
          >
            <ListOrdered size={16} />
          </button>
        </div>
      </div>

      {/* 7. Line spacing popover */}
      <div>
        <label className="text-xs text-zinc-500 block mb-1">Spacing</label>
        <div className="relative">
          <button
            type="button"
            data-spacing-trigger
            onClick={() => setSpacingOpen((o) => !o)}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-left flex items-center justify-between hover:bg-zinc-50"
          >
            <span>Letter & line</span>
            <ChevronDown size={14} className={`text-zinc-400 transition-transform ${spacingOpen ? "rotate-180" : ""}`} />
          </button>
          {spacingOpen && (
            <div
              ref={spacingPopoverRef}
              className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl bg-white border border-zinc-200 shadow-lg p-3 space-y-3"
            >
              <div>
                <div className="text-xs text-zinc-500 mb-1">Letter spacing</div>
                <div className="flex gap-2 items-center">
                  <input
                    type="range"
                    min={-200}
                    max={500}
                    value={charSpacing}
                    onChange={(e) => updateActiveObject({ charSpacing: Number(e.target.value) })}
                    className="flex-1 h-2 rounded-full appearance-none bg-zinc-200 accent-blue-600"
                  />
                  <input
                    type="number"
                    value={Math.round(charSpacing)}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isFinite(n)) updateActiveObject({ charSpacing: n });
                    }}
                    className="w-14 rounded border border-zinc-200 px-2 py-1 text-sm"
                  />
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 mb-1">Line height</div>
                <div className="flex gap-2 items-center">
                  <input
                    type="range"
                    min={0.5}
                    max={3}
                    step={0.1}
                    value={lineHeight}
                    onChange={(e) => setTextProp({ lineHeight: Number(e.target.value) })}
                    className="flex-1 h-2 rounded-full appearance-none bg-zinc-200 accent-blue-600"
                  />
                  <input
                    type="number"
                    min={0.5}
                    max={3}
                    step={0.1}
                    value={lineHeight}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isFinite(n)) setTextProp({ lineHeight: Math.max(0.5, Math.min(3, n)) });
                    }}
                    className="w-14 rounded border border-zinc-200 px-2 py-1 text-sm"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 8. Effects placeholder */}
      <div>
        <div className="text-sm font-medium text-zinc-600">Effects</div>
        <div className="text-xs text-zinc-400 mt-1">—</div>
      </div>

      {/* 9. Opacity */}
      <div>
        <label className="text-xs text-zinc-500 block mb-1">Opacity</label>
        <div className="flex gap-2 items-center">
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(opacity * 100)}
            onChange={(e) => setTextProp({ opacity: Number(e.target.value) / 100 })}
            className="flex-1 h-2 rounded-full appearance-none bg-zinc-200 accent-blue-600"
          />
          <span className="text-xs text-zinc-500 w-8">{Math.round(opacity * 100)}%</span>
        </div>
      </div>
    </div>
  );
}
