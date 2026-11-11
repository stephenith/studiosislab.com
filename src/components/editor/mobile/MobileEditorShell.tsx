"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
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

function TextStyleBar({
  style,
  onChange,
}: {
  style: NonNullable<ReturnType<typeof useMobileFabricEditor>["textStyle"]>;
  onChange: (props: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number;
    fontStyle?: "normal" | "italic";
    underline?: boolean;
    textAlign?: "left" | "center" | "right";
    fill?: string;
  }) => void;
}) {
  return (
    <div className="mb-2 rounded-2xl border border-[#d6deeb] bg-white p-2">
      <p className="px-1 text-[11px] font-semibold tracking-wide text-violet-700">TEXT</p>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {MOBILE_TEXT_FONTS.map((font) => (
          <button
            key={font}
            type="button"
            onClick={() => onChange({ fontFamily: font })}
            className={`inline-flex h-11 items-center rounded-xl px-3 text-xs ${style.fontFamily === font ? "bg-violet-600 text-white" : "bg-zinc-100 text-zinc-800"}`}
            style={{ fontFamily: font }}
          >
            {font}
          </button>
        ))}
        <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100" aria-label="Smaller text" onClick={() => onChange({ fontSize: Math.max(8, style.fontSize - 2) })}>
          <Minus className="h-4 w-4" />
        </button>
        <span className="min-w-8 text-center text-sm">{style.fontSize}</span>
        <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100" aria-label="Larger text" onClick={() => onChange({ fontSize: style.fontSize + 2 })}>
          <Plus className="h-4 w-4" />
        </button>
        <button type="button" className={`inline-flex h-11 w-11 items-center justify-center rounded-xl font-bold ${style.fontWeight >= 600 ? "bg-violet-600 text-white" : "bg-zinc-100"}`} aria-label="Bold" onClick={() => onChange({ fontWeight: style.fontWeight >= 600 ? 400 : 700 })}>
          B
        </button>
        <button type="button" className={`inline-flex h-11 w-11 items-center justify-center rounded-xl italic ${style.fontStyle === "italic" ? "bg-violet-600 text-white" : "bg-zinc-100"}`} aria-label="Italic" onClick={() => onChange({ fontStyle: style.fontStyle === "italic" ? "normal" : "italic" })}>
          I
        </button>
        <button type="button" className={`inline-flex h-11 w-11 items-center justify-center rounded-xl underline ${style.underline ? "bg-violet-600 text-white" : "bg-zinc-100"}`} aria-label="Underline" onClick={() => onChange({ underline: !style.underline })}>
          U
        </button>
        {(["left", "center", "right"] as const).map((align) => (
          <button key={align} type="button" className={`inline-flex h-11 items-center rounded-xl px-2 text-xs capitalize ${style.textAlign === align ? "bg-violet-600 text-white" : "bg-zinc-100"}`} aria-label={`Align ${align}`} onClick={() => onChange({ textAlign: align })}>
            {align}
          </button>
        ))}
        {COLORS.map((color) => (
          <button key={color} type="button" aria-label={`Text color ${color}`} onClick={() => onChange({ fill: color })} className="h-11 w-11 rounded-xl border border-zinc-200" style={{ background: color }} />
        ))}
      </div>
    </div>
  );
}

export default function MobileEditorShell({ templateId, docId, blank = false }: MobileEditorShellProps) {
  const editor = useMobileFabricEditor({ templateId, docId, blank });
  const shellRef = useRef<HTMLElement>(null);
  const [tool, setTool] = useState<DockTool | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
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
          className="ml-auto inline-flex h-11 shrink-0 items-center gap-1 rounded-xl bg-violet-600 px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300"
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
              <div
                className="pointer-events-none absolute z-10 rounded-sm ring-2 ring-violet-600"
                style={{
                  left: editor.selectionFrame.left,
                  top: editor.selectionFrame.top,
                  width: editor.selectionFrame.width,
                  height: editor.selectionFrame.height,
                }}
              />
            ) : null}
          </div>
        </div>
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

      <div className="flex max-h-[54%] min-h-0 flex-col overflow-y-auto">
      <div
        className="flex shrink-0 flex-wrap items-center gap-1 border-t border-[#d6deeb] bg-white px-2 py-1.5"
        style={{
          paddingLeft: "max(0.5rem, env(safe-area-inset-left))",
          paddingRight: "max(0.5rem, env(safe-area-inset-right))",
        }}
      >
        <label className="sr-only" htmlFor="mobile-resume-title">
          Resume title
        </label>
        <input
          id="mobile-resume-title"
          value={editor.docTitle}
          onChange={(event) => editor.setDocTitle(event.target.value)}
          className="h-11 min-w-[7.5rem] flex-1 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
        />
        <button
          type="button"
          onClick={() => void editor.save()}
          disabled={editor.saveStatus === "saving" || editor.saveStatus === "stale" || editor.loading}
          className="inline-flex h-11 shrink-0 items-center px-2 text-xs font-medium text-zinc-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300 disabled:opacity-50"
          aria-live="polite"
          aria-label={`${saveStatusLabel(editor.saveStatus)}. Save now`}
        >
          {editor.saveStatus === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : saveStatusLabel(editor.saveStatus)}
        </button>
        <button type="button" onClick={() => void editor.duplicateCurrentPage()} className="inline-flex h-11 items-center gap-1 rounded-xl px-2 text-xs font-medium text-zinc-800" aria-label="Duplicate page">
          <Copy className="h-4 w-4" />
          Duplicate
        </button>
        <button
          type="button"
          disabled={editor.pageCount < 2}
          onClick={() => {
            if (window.confirm("Delete this page? The other pages stay in the resume.")) void editor.deleteCurrentPage();
          }}
          className="inline-flex h-11 items-center gap-1 rounded-xl px-2 text-xs font-medium text-zinc-800 disabled:opacity-40"
          aria-label="Delete page"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
        <button type="button" onClick={() => void editor.addPageAfter()} className="inline-flex h-11 items-center gap-1 rounded-xl px-2 text-xs font-medium text-zinc-800" aria-label="Add page">
          <Plus className="h-4 w-4" />
          Add
        </button>
        <span className="text-xs text-zinc-500">
          {editor.pageIndex + 1}/{editor.pageCount}
        </span>
      </div>

      <div
        className="shrink-0 bg-[#f7f7f8]"
        style={{
          paddingBottom: "max(0.25rem, env(safe-area-inset-bottom))",
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
              <TextStyleBar style={editor.textStyle} onChange={editor.updateSelectedText} />
            ) : null}
            {selected && !editor.skillBarEdit ? (
              <div className="mb-2 flex flex-wrap gap-1">
                <button type="button" className="inline-flex h-11 items-center rounded-xl bg-white px-3 text-xs" aria-label="Resize larger" onClick={() => editor.resizeSelection(1.1)}>
                  Larger
                </button>
                <button type="button" className="inline-flex h-11 items-center rounded-xl bg-white px-3 text-xs" aria-label="Resize smaller" onClick={() => editor.resizeSelection(0.9)}>
                  Smaller
                </button>
                <button type="button" className="inline-flex h-11 items-center rounded-xl bg-white px-3 text-xs" aria-label="Duplicate selection" onClick={() => void editor.duplicateSelection()}>
                  Duplicate
                </button>
                <button type="button" className="inline-flex h-11 items-center rounded-xl bg-white px-3 text-xs" aria-label="Delete selection" onClick={editor.deleteSelection}>
                  Delete
                </button>
              </div>
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

        <nav aria-label="Editor tools" className="flex gap-1 overflow-x-auto bg-[#1f1f28] px-2 py-1.5">
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
      </div>
    </main>
  );
}
