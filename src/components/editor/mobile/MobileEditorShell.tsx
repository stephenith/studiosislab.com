"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Copy,
  Download,
  Frame,
  ImagePlus,
  Loader2,
  Minus,
  Plus,
  Shapes,
  Table2,
  Trash2,
  Type,
  X,
  LayoutTemplate,
} from "lucide-react";
import { HOME_LOGOS_DARK } from "@/components/home/homeLogoAssets";
import TextEditSheet from "@/components/editor/mobile/TextEditSheet";
import SkillBarEditSheet from "@/components/editor/mobile/SkillBarEditSheet";
import { MOBILE_SHAPE_CHOICES, MOBILE_TEXT_FONTS } from "@/components/editor/mobile/mobileCanvasActions";
import { useMobileFabricEditor } from "@/components/editor/mobile/useMobileFabricEditor";
import { SYSTEM_TEMPLATES } from "@/data/systemTemplates/registry";

type MobileEditorShellProps = {
  templateId: string | null;
  docId: string | null;
  blank?: boolean;
};

type DockTool = "templates" | "text" | "shapes" | "tables" | "frames" | "upload";

const DOCK: { id: DockTool; label: string; icon: typeof Type }[] = [
  { id: "templates", label: "Templates", icon: LayoutTemplate },
  { id: "text", label: "Text", icon: Type },
  { id: "shapes", label: "Shapes", icon: Shapes },
  { id: "tables", label: "Tables", icon: Table2 },
  { id: "frames", label: "Frames", icon: Frame },
  { id: "upload", label: "Upload", icon: ImagePlus },
];

const COLORS = ["#111827", "#374151", "#7C3AED", "#1d4ed8", "#b91c1c", "#15803d"];

function saveStatusLabel(status: string): string {
  switch (status) {
    case "saving":
      return "Saving";
    case "saved":
      return "Saved";
    case "unsaved":
      return "Unsaved";
    case "error":
      return "Save failed";
    case "stale":
      return "Newer version";
    default:
      return "Not saved yet";
  }
}

const ACTIVE_TEXT_CONTROL = "border-blue-600 bg-blue-600 text-white";
const IDLE_TEXT_CONTROL = "border-zinc-200 bg-white text-zinc-800";

function keepTextFieldFocus(event: { preventDefault: () => void }) {
  event.preventDefault();
}

function TextStyleBar({
  style,
  text,
  onChange,
  onTextChange,
  onClose,
}: {
  style: NonNullable<ReturnType<typeof useMobileFabricEditor>["textStyle"]>;
  text: string;
  onChange: (props: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number;
    fontStyle?: "normal" | "italic";
    underline?: boolean;
    textAlign?: "left" | "center" | "right";
    fill?: string;
  }) => void;
  onTextChange: (value: string) => void;
  onClose: () => void;
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const fonts = MOBILE_TEXT_FONTS.includes(style.fontFamily as (typeof MOBILE_TEXT_FONTS)[number])
    ? [...MOBILE_TEXT_FONTS]
    : [style.fontFamily, ...MOBILE_TEXT_FONTS];
  const colorValue = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(style.fill) ? style.fill.toUpperCase() : style.fill;
  const swatches = COLORS.includes(style.fill) ? COLORS : [style.fill, ...COLORS];
  return (
    <section aria-label="Text formatting" className="mb-2 max-w-full rounded-2xl border border-[#d6deeb] bg-white p-3" onPointerDown={(event) => event.stopPropagation()}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold tracking-wide text-zinc-900">TEXT</h2>
        <button type="button" aria-label="Close text editing" onMouseDown={keepTextFieldFocus} onClick={onClose} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-zinc-700">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 flex min-w-0 items-center gap-2">
        <input
          aria-label="Selected text"
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          onFocus={(event) => {
            const scroller = event.currentTarget.closest("[data-slb-tool-scroll]");
            if (scroller instanceof HTMLElement) scroller.scrollTop = 0;
          }}
          className="h-11 min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900"
        />
        <div className="inline-flex shrink-0 items-center rounded-xl border border-zinc-200 bg-white" role="group" aria-label="Font size">
          <button type="button" className="inline-flex h-11 w-11 items-center justify-center" aria-label="Smaller text" onMouseDown={keepTextFieldFocus} onClick={() => onChange({ fontSize: Math.max(8, style.fontSize - 2) })}>
            <Minus className="h-4 w-4" />
          </button>
          <span className="min-w-8 text-center text-sm tabular-nums text-zinc-900">{style.fontSize}</span>
          <button type="button" className="inline-flex h-11 w-11 items-center justify-center" aria-label="Larger text" onMouseDown={keepTextFieldFocus} onClick={() => onChange({ fontSize: style.fontSize + 2 })}>
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
      <label className="mt-2 block min-w-0">
        <span className="sr-only">Font family</span>
        <select
          aria-label="Font family"
          value={style.fontFamily}
          onChange={(event) => onChange({ fontFamily: event.target.value })}
          className="h-11 w-full max-w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
        >
          {fonts.map((font) => (
            <option key={font} value={font}>
              {font}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-2 flex max-w-full flex-wrap items-center gap-2">
        <div className="inline-flex shrink-0 rounded-xl border border-zinc-200 p-0.5" role="group" aria-label="Text style">
          <button type="button" className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border font-bold ${style.fontWeight >= 600 ? ACTIVE_TEXT_CONTROL : IDLE_TEXT_CONTROL}`} aria-label="Bold" aria-pressed={style.fontWeight >= 600} onMouseDown={keepTextFieldFocus} onClick={() => onChange({ fontWeight: style.fontWeight >= 600 ? 400 : 700 })}>
            B
          </button>
          <button type="button" className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border italic ${style.fontStyle === "italic" ? ACTIVE_TEXT_CONTROL : IDLE_TEXT_CONTROL}`} aria-label="Italic" aria-pressed={style.fontStyle === "italic"} onMouseDown={keepTextFieldFocus} onClick={() => onChange({ fontStyle: style.fontStyle === "italic" ? "normal" : "italic" })}>
            I
          </button>
          <button type="button" className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border underline ${style.underline ? ACTIVE_TEXT_CONTROL : IDLE_TEXT_CONTROL}`} aria-label="Underline" aria-pressed={style.underline} onMouseDown={keepTextFieldFocus} onClick={() => onChange({ underline: !style.underline })}>
            U
          </button>
        </div>
        <div className="inline-flex shrink-0 rounded-xl border border-zinc-200 p-0.5" role="group" aria-label="Text alignment">
          {([
            ["left", AlignLeft],
            ["center", AlignCenter],
            ["right", AlignRight],
          ] as const).map(([align, Icon]) => (
            <button key={align} type="button" className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border ${style.textAlign === align ? ACTIVE_TEXT_CONTROL : IDLE_TEXT_CONTROL}`} aria-label={`Align ${align}`} aria-pressed={style.textAlign === align} onMouseDown={keepTextFieldFocus} onClick={() => onChange({ textAlign: align })}>
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
        <div className="relative min-w-0">
          <button type="button" className="inline-flex h-10 max-w-full items-center gap-2 rounded-xl border border-zinc-200 bg-white px-2 text-xs text-zinc-800" aria-label="Text color" aria-expanded={paletteOpen} onMouseDown={keepTextFieldFocus} onClick={() => setPaletteOpen((open) => !open)}>
            <span className="h-5 w-5 shrink-0 rounded-md border border-zinc-200" style={{ background: style.fill }} />
            <span className="truncate font-mono">{colorValue}</span>
          </button>
          {paletteOpen ? (
            <div className="absolute bottom-full left-0 z-20 mb-1 w-48 max-w-[calc(100vw-2rem)] rounded-xl border border-zinc-200 bg-white p-2 shadow-sm" role="group" aria-label="Text color palette">
              <div className="grid grid-cols-6 gap-1">
                {swatches.map((color) => (
                  <button key={color} type="button" aria-label={`Text color ${color}`} onMouseDown={keepTextFieldFocus} onClick={() => { onChange({ fill: color }); setPaletteOpen(false); }} className="aspect-square w-full rounded-md border border-zinc-200" style={{ background: color }} />
                ))}
              </div>
              <label className="mt-2 flex items-center gap-2 text-xs text-zinc-600">
                Custom
                <input aria-label="Custom text color" type="color" value={/^#[0-9a-f]{6}$/i.test(style.fill) ? style.fill : "#111827"} onChange={(event) => onChange({ fill: event.target.value })} className="h-8 w-10 border-0 bg-transparent p-0" />
              </label>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

const RESIZE_CORNERS = [
  { id: "tl" as const, label: "Resize from the top left corner" },
  { id: "tr" as const, label: "Resize from the top right corner" },
  { id: "bl" as const, label: "Resize from the bottom left corner" },
  { id: "br" as const, label: "Resize from the bottom right corner" },
];

function SelectionChrome({
  frame,
  boundsWidth,
  boundsHeight,
  showHandles,
  showActions,
  accent,
  onResize,
  onDuplicate,
  onDelete,
}: {
  frame: { left: number; top: number; width: number; height: number };
  boundsWidth: number;
  boundsHeight: number;
  showHandles: boolean;
  showActions: boolean;
  accent: "blue" | "violet";
  onResize: (corner: "tl" | "tr" | "bl" | "br", phase: "start" | "move" | "end", clientX: number, clientY: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const actionWidth = 96;
  let actionLeft = frame.left + frame.width / 2 - actionWidth / 2;
  let actionTop = frame.top - 52;
  if (actionTop < 8) actionTop = frame.top + frame.height + 8;
  if (boundsWidth > 0) {
    actionLeft = Math.max(8, Math.min(actionLeft, boundsWidth - actionWidth - 8));
    actionTop = Math.max(8, Math.min(actionTop, Math.max(8, boundsHeight - 52)));
  }
  return (
    <>
      <div
        className={`pointer-events-none absolute z-10 rounded-sm ring-2 ${accent === "blue" ? "ring-[#2563eb]" : "ring-violet-600"}`}
        style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height }}
      />
      {showHandles
        ? RESIZE_CORNERS.map((corner) => {
            const x = corner.id === "tl" || corner.id === "bl" ? frame.left : frame.left + frame.width;
            const y = corner.id === "tl" || corner.id === "tr" ? frame.top : frame.top + frame.height;
            let left = x - 22;
            let top = y - 22;
            if (boundsWidth > 0) {
              left = Math.max(0, Math.min(left, boundsWidth - 44));
              top = Math.max(0, Math.min(top, boundsHeight - 44));
            }
            return (
              <button
                key={corner.id}
                type="button"
                data-slb-canvas-control="true"
                data-slb-resize-handle="true"
                aria-label={corner.label}
                className="absolute z-30 inline-flex h-11 w-11 items-center justify-center"
                style={{ left, top, touchAction: "none" }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  onResize(corner.id, "start", event.clientX, event.clientY);
                }}
                onPointerMove={(event) => {
                  if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
                  onResize(corner.id, "move", event.clientX, event.clientY);
                }}
                onPointerUp={(event) => {
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
                  onResize(corner.id, "end", event.clientX, event.clientY);
                }}
                onPointerCancel={(event) => onResize(corner.id, "end", event.clientX, event.clientY)}
                onTouchStart={(event) => event.stopPropagation()}
                onTouchMove={(event) => {
                  event.stopPropagation();
                  event.preventDefault();
                }}
              >
                <span className={`pointer-events-none h-3.5 w-3.5 rounded-full border-2 bg-white shadow-sm ${accent === "blue" ? "border-[#2563eb]" : "border-violet-600"}`} />
              </button>
            );
          })
        : null}
      {showActions ? (
        <div
          data-slb-canvas-control="true"
          className="absolute z-30 flex items-center gap-2"
          style={{ left: actionLeft, top: actionTop }}
          onTouchStart={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            aria-label="Duplicate selection"
            onClick={onDuplicate}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-zinc-800 shadow-sm backdrop-blur-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Delete selection"
            onClick={onDelete}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-zinc-800 shadow-sm backdrop-blur-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </>
  );
}

export default function MobileEditorShell({ templateId, docId, blank = false }: MobileEditorShellProps) {
  const editor = useMobileFabricEditor({ templateId, docId, blank });
  const shellRef = useRef<HTMLElement>(null);
  const [tool, setTool] = useState<DockTool | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const busyDownload = editor.downloadKind !== null;
  const selected = Boolean(editor.selectionLabel);

  useEffect(() => {
    const root = shellRef.current;
    const viewport = window.visualViewport;
    if (!root) return;
    const sync = () => {
      const height = viewport?.height ?? window.innerHeight;
      const top = viewport?.offsetTop ?? 0;
      setKeyboardOpen(window.innerHeight - height > 80);
      root.style.position = "fixed";
      root.style.left = "0";
      root.style.right = "0";
      root.style.width = "100%";
      root.style.top = `${top}px`;
      root.style.height = `${Math.round(height)}px`;
    };
    sync();
    viewport?.addEventListener("resize", sync);
    viewport?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    return () => {
      viewport?.removeEventListener("resize", sync);
      viewport?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [editor.loadError]);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files || []).filter((file) => file.type.startsWith("image/"));
      if (!files.length) return;
      event.preventDefault();
      void editor.uploadImages(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [editor]);

  if (editor.loadError) {
    return (
      <main className="flex h-[100dvh] flex-col bg-[#ebecf0] font-[family-name:var(--font-inter)]">
        <header
          className="flex items-center gap-2 bg-[#1f1f28] px-3 pb-3 text-white"
          style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
        >
          <Link href="/resume" className="inline-flex h-11 w-11 items-center justify-center" aria-label="Back to Resume Hub">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <img src={HOME_LOGOS_DARK.header} alt="StudiosisLab" className="h-6 w-auto" />
        </header>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-sm rounded-2xl border border-[#d6deeb] bg-white p-6 text-center">
            <h1 className="text-base font-semibold text-zinc-900">Unable to open resume</h1>
            <p className="mt-2 text-sm text-zinc-600">{editor.loadError}</p>
            <Link href="/resume" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-zinc-900 px-5 text-sm text-white">
              Back to Resume Hub
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      ref={shellRef}
      className="flex h-[100dvh] w-full max-w-[100vw] flex-col overflow-hidden bg-[#ebecf0] font-[family-name:var(--font-inter)]"
    >
      <header
        className="z-30 flex shrink-0 items-center gap-2 bg-[#1f1f28] px-2 pb-2 text-white"
        style={{
          paddingTop: "max(0.4rem, env(safe-area-inset-top))",
          paddingLeft: "max(0.5rem, env(safe-area-inset-left))",
          paddingRight: "max(0.5rem, env(safe-area-inset-right))",
        }}
      >
        <Link
          href="/resume"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300"
          aria-label="Back to Resume Hub"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <img src={HOME_LOGOS_DARK.header} alt="StudiosisLab" className="h-6 w-auto max-w-[46vw] shrink object-contain object-left" />
        <button
          type="button"
          onClick={() => setDownloadOpen((open) => !open)}
          aria-expanded={downloadOpen}
          className="ml-auto inline-flex h-11 shrink-0 items-center gap-1 rounded-xl bg-white px-3 text-sm font-medium text-[#1f1f28] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300"
        >
          <Download className="h-4 w-4" />
          Download
        </button>
      </header>

      {downloadOpen ? (
        <div className="flex shrink-0 gap-2 border-b border-[#d6deeb] bg-white px-3 py-2" role="group" aria-label="Download format">
          <button
            type="button"
            onClick={() => void editor.downloadPdf()}
            disabled={editor.loading || busyDownload}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-zinc-200 text-sm font-medium disabled:opacity-50"
          >
            {editor.downloadKind === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : "PDF"}
          </button>
          <button
            type="button"
            onClick={() => void editor.downloadPng()}
            disabled={editor.loading || busyDownload}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-zinc-200 text-sm font-medium disabled:opacity-50"
          >
            {editor.downloadKind === "png" ? <Loader2 className="h-4 w-4 animate-spin" /> : "PNG"}
          </button>
        </div>
      ) : null}

      {editor.saveError ? (
        <div className="shrink-0 bg-white px-3 py-2 text-sm text-zinc-800">
          <p>{editor.saveError}</p>
          {editor.saveStatus === "stale" ? (
            <button type="button" onClick={editor.reloadLatest} className="mt-2 inline-flex min-h-11 items-center rounded-xl bg-zinc-900 px-4 text-sm text-white">
              Reload latest
            </button>
          ) : null}
        </div>
      ) : null}
      {editor.imageNotice ? <p className="shrink-0 bg-white px-3 py-2 text-xs text-zinc-600">{editor.imageNotice}</p> : null}
      {editor.actionNotice ? <p className="shrink-0 bg-white px-3 py-2 text-xs text-zinc-700">{editor.actionNotice}</p> : null}

      <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative z-0 min-h-[46%] flex-1 overflow-hidden">
        <div ref={editor.viewportRef} className="absolute inset-0 overflow-hidden touch-none">
          {editor.loading ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#ebecf0]/80">
              <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm text-zinc-700">
                <Loader2 className="h-4 w-4 animate-spin" />
                {docId ? "Loading saved resume…" : "Loading template…"}
              </div>
            </div>
          ) : null}
          <div ref={editor.canvasWrapRef} className="relative h-full w-full">
            <canvas ref={editor.attachCanvasEl} className="block" />
            {editor.selectionFrame ? (
              <SelectionChrome
                frame={editor.selectionFrame}
                boundsWidth={editor.viewportRef.current?.clientWidth || 0}
                boundsHeight={editor.viewportRef.current?.clientHeight || 0}
                showHandles={editor.selectionResizable && !keyboardOpen && !editor.textEdit && !editor.skillBarEdit}
                showActions={!keyboardOpen && !tool && !editor.textEdit && !editor.skillBarEdit}
                accent={editor.textStyle ? "blue" : "violet"}
                onResize={editor.resizeSelectionByCorner}
                onDuplicate={() => void editor.duplicateSelection()}
                onDelete={editor.deleteSelection}
              />
            ) : null}
          </div>
        </div>
        {editor.pageFrames.map((frame) => (
          <div
            key={frame.index}
            data-slb-canvas-control="true"
            role="group"
            aria-label="Page controls"
            className="absolute z-20 flex items-center justify-center gap-3"
            style={{ left: frame.left, top: frame.top + frame.height + 8, width: frame.width }}
          >
            <button type="button" onClick={() => void editor.duplicateCurrentPage(frame.index)} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-zinc-800 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300" aria-label="Duplicate page">
              <Copy className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={editor.pageCount < 2}
              onClick={() => {
                if (window.confirm("Delete this page? The other pages stay in the resume.")) void editor.deleteCurrentPage(frame.index);
              }}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-zinc-800 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300 disabled:opacity-40"
              aria-label="Delete page"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => void editor.addPageAfter(frame.index)} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-zinc-800 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300" aria-label="Add page">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        ))}
        <div
          data-slb-canvas-control="true"
          className="absolute bottom-2 right-2 z-20 flex items-center gap-1"
          style={{ right: "max(0.5rem, env(safe-area-inset-right))" }}
        >
          <button type="button" onClick={() => editor.zoomBy(1 / 1.15)} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#d6deeb] bg-white" aria-label="Zoom out">
            <Minus className="h-4 w-4" />
          </button>
          <button type="button" onClick={editor.resetView} className="inline-flex h-11 items-center rounded-full border border-[#d6deeb] bg-white px-3 text-xs font-medium" aria-label="Fit page">
            {editor.zoomPercent}%
          </button>
          <button type="button" onClick={() => editor.zoomBy(1.15)} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#d6deeb] bg-white" aria-label="Zoom in">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex max-h-[54%] min-h-0 flex-col overflow-hidden">
      {editor.saveStatus === "saving" || editor.saveStatus === "unsaved" || editor.saveStatus === "error" || editor.saveStatus === "stale" ? (
        <p className="shrink-0 bg-white px-3 py-1 text-center text-xs text-zinc-600" aria-live="polite">
          {saveStatusLabel(editor.saveStatus)}
        </p>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {`Page ${editor.pageIndex + 1} of ${editor.pageCount}`}
      </p>
      <div
        data-slb-tool-scroll="true"
        className="min-h-0 overflow-y-auto bg-[#f7f7f8]"
        style={{
          paddingLeft: "max(0.5rem, env(safe-area-inset-left))",
          paddingRight: "max(0.5rem, env(safe-area-inset-right))",
        }}
      >
        {selected || tool || editor.skillBarEdit || editor.textEdit ? (
          <div className="overflow-y-auto px-2 py-2">
            {editor.skillBarEdit ? (
              <SkillBarEditSheet
                open
                label={editor.skillBarEdit.label}
                value={editor.skillBarEdit.draftValue}
                max={editor.skillBarEdit.max}
                onChange={editor.setSkillBarDraftValue}
                onCancel={editor.cancelSkillBarEdit}
                onDone={editor.commitSkillBarEdit}
              />
            ) : null}
            {editor.textEdit ? (
              <TextEditSheet
                open
                value={editor.textEdit.draft}
                onChange={(draft) => editor.setTextEdit({ draft })}
                onCancel={editor.closeTextEdit}
                onSave={editor.commitTextEdit}
              />
            ) : null}
            {editor.textStyle ? (
              <TextStyleBar
                style={editor.textStyle}
                text={editor.selectedText}
                onChange={editor.updateSelectedText}
                onTextChange={editor.setSelectedTextContent}
                onClose={editor.clearSelection}
              />
            ) : null}
            {tool === "templates" ? (
              <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Resume templates">
                {SYSTEM_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className="w-24 shrink-0 text-left"
                    onClick={() => {
                      const ok = window.confirm(`Replace the current page with ${template.name}? Other pages stay in this resume.`);
                      if (ok) void editor.applyTemplateToPage(template.id);
                    }}
                  >
                    <img src={template.thumbnail} alt="" className="h-28 w-24 rounded-lg border border-[#d6deeb] bg-white object-cover" />
                    <span className="mt-1 block truncate text-[11px] text-zinc-700">{template.name}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {tool === "text" ? (
              <button type="button" onClick={editor.addTextBox} className="inline-flex h-11 items-center rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white">
                Add text
              </button>
            ) : null}
            {tool === "shapes" ? (
              <div className="flex flex-wrap gap-1">
                {MOBILE_SHAPE_CHOICES.map((shape) => (
                  <button key={shape.id} type="button" onClick={() => editor.addShape(shape.id)} className="inline-flex h-11 items-center rounded-xl bg-white px-3 text-xs">
                    {shape.label}
                  </button>
                ))}
              </div>
            ) : null}
            {tool === "tables" ? (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-2">
                <label className="text-xs text-zinc-600">
                  Rows
                  <input type="number" min={1} max={8} value={tableRows} onChange={(event) => setTableRows(Number(event.target.value) || 1)} className="ml-1 h-11 w-16 rounded-lg border border-zinc-200 px-2" />
                </label>
                <label className="text-xs text-zinc-600">
                  Columns
                  <input type="number" min={1} max={6} value={tableCols} onChange={(event) => setTableCols(Number(event.target.value) || 1)} className="ml-1 h-11 w-16 rounded-lg border border-zinc-200 px-2" />
                </label>
                <button type="button" onClick={() => editor.addTable(tableRows, tableCols)} className="inline-flex h-11 items-center rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white">
                  Insert table
                </button>
              </div>
            ) : null}
            {tool === "frames" ? (
              <div className="flex gap-2">
                <button type="button" onClick={() => editor.addFrame("square")} className="inline-flex h-11 items-center rounded-xl bg-white px-3 text-sm">
                  Square frame
                </button>
                <button type="button" onClick={() => editor.addFrame("circle")} className="inline-flex h-11 items-center rounded-xl bg-white px-3 text-sm">
                  Circle frame
                </button>
              </div>
            ) : null}
            {tool === "upload" ? (
              <div className="rounded-2xl bg-white p-3">
                <label className="inline-flex min-h-11 cursor-pointer items-center rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white">
                  Choose photo
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => {
                      const files = Array.from(event.target.files || []);
                      if (files.length) void editor.uploadImages(files);
                      event.target.value = "";
                    }}
                  />
                </label>
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                  Upload uses your photo library. Pasting an image works only when this browser allows it.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

        <nav
          aria-label="Editor tools"
          className="flex shrink-0 gap-1 overflow-x-auto bg-[#1f1f28] px-2 py-1.5"
          style={{ paddingBottom: "max(0.25rem, env(safe-area-inset-bottom))" }}
        >
          {DOCK.map((item) => {
            const Icon = item.icon;
            const active = tool === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => setTool((current) => (current === item.id ? null : item.id))}
                className={`inline-flex h-14 min-w-16 shrink-0 flex-col items-center justify-center rounded-xl px-2 text-[11px] font-medium ${active ? "bg-violet-600 text-white" : "text-white/75"}`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
      </div>
    </main>
  );
}
