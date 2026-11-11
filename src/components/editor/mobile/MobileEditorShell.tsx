"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Download,
  FileText,
  ImageIcon,
  Layers,
  Loader2,
  MoreHorizontal,
  Save,
  Scan,
  Type,
} from "lucide-react";
import TextEditSheet from "@/components/editor/mobile/TextEditSheet";
import SkillBarEditSheet from "@/components/editor/mobile/SkillBarEditSheet";
import { useMobileFabricEditor } from "@/components/editor/mobile/useMobileFabricEditor";

type MobileEditorShellProps = {
  templateId: string | null;
  docId: string | null;
  blank?: boolean;
};

type DockTab = "text" | "skills" | "pages" | "more";

const MOBILE_SAFE_AREA = {
  paddingTop: "max(0.5rem, env(safe-area-inset-top))",
  paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
  paddingRight: "max(0.75rem, env(safe-area-inset-right))",
} as const;

function saveStatusLabel(status: string): string {
  switch (status) {
    case "saving":
      return "Saving…";
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

const dockButtonClass = (active: boolean) =>
  `flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[11px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 ${
    active ? "bg-violet-600 text-white" : "text-white/75 active:bg-white/10"
  }`;

export default function MobileEditorShell({ templateId, docId, blank = false }: MobileEditorShellProps) {
  const editor = useMobileFabricEditor({ templateId, docId, blank });
  const [dock, setDock] = useState<DockTab>("text");
  const [downloadOpen, setDownloadOpen] = useState(false);
  const textOpen = Boolean(editor.textEdit);
  const skillOpen = Boolean(editor.skillBarEdit);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const sync = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      document.documentElement.style.setProperty("--slb-keyboard-inset", `${Math.round(inset)}px`);
    };
    sync();
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
      document.documentElement.style.removeProperty("--slb-keyboard-inset");
    };
  }, []);

  useEffect(() => {
    if (textOpen) setDock("text");
  }, [textOpen]);

  useEffect(() => {
    if (skillOpen) setDock("skills");
  }, [skillOpen]);

  if (editor.loadError) {
    return (
      <main className="flex h-[100dvh] flex-col bg-[#ebecf0] font-[family-name:var(--font-inter)]">
        <header className="shrink-0 bg-[#1f1f28] text-white" style={MOBILE_SAFE_AREA}>
          <div className="flex items-center gap-3 pb-3">
            <Link
              href="/resume"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 active:bg-white/10"
              aria-label="Back to Resume Hub"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-sm font-medium">Resume Editor</h1>
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-sm rounded-2xl border border-[#d6deeb] bg-white p-6 text-center shadow-[0_6px_14px_rgba(30,64,175,0.08)]">
            <h2 className="text-base font-semibold text-zinc-900">Unable to open resume</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">{editor.loadError}</p>
            <Link
              href="/resume"
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 active:bg-zinc-800"
            >
              Back to Resume Hub
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const busyDownload = editor.downloadKind !== null;

  return (
    <main className="flex h-[100dvh] w-full max-w-[100vw] flex-col overflow-hidden bg-[#ebecf0] font-[family-name:var(--font-inter)]">
      <header
        className="z-20 shrink-0 bg-[#1f1f28] text-white"
        style={{ ...MOBILE_SAFE_AREA, touchAction: "pan-y" }}
      >
        <div className="flex min-w-0 items-center gap-2 pb-2">
          <Link
            href="/resume"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 active:bg-white/10"
            aria-label="Back to Resume Hub"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="min-w-0 truncate font-[family-name:var(--font-poppins)] text-sm font-semibold">
            Studiosis<span className="text-violet-400">Lab</span>
            <span className="px-2 font-normal text-white/35" aria-hidden="true">
              |
            </span>
            <span className="font-medium text-white/90">Resume Editor</span>
          </h1>
        </div>
      </header>

      <div
        className="flex shrink-0 items-center gap-2 border-b border-[#d6deeb] bg-white px-3 py-2"
        style={{
          paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
          paddingRight: "max(0.75rem, env(safe-area-inset-right))",
        }}
      >
        <FileText className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
        <input
          type="text"
          value={editor.docTitle}
          onChange={(e) => {
            editor.setDocTitle(e.target.value);
          }}
          className="min-h-11 w-0 min-w-0 flex-1 truncate border-none bg-transparent font-[family-name:var(--font-poppins)] text-sm font-medium text-zinc-900 outline-none focus:ring-2 focus:ring-violet-100"
          aria-label="Resume title"
        />
        <p className="inline-flex shrink-0 items-center gap-1 text-xs text-zinc-500" aria-live="polite">
          <Cloud className="h-3.5 w-3.5" aria-hidden="true" />
          {saveStatusLabel(editor.saveStatus)}
        </p>
      </div>

      {editor.saveError ? (
        <div className="shrink-0 border-b border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-800">
          <p>{editor.saveError}</p>
          {editor.saveStatus === "stale" ? (
            <button
              type="button"
              onClick={editor.reloadLatest}
              className="mt-2 inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 active:bg-zinc-800"
            >
              Reload latest
            </button>
          ) : null}
        </div>
      ) : null}

      {editor.imageNotice ? (
        <p className="shrink-0 border-b border-zinc-200 bg-white px-4 py-2 text-xs leading-relaxed text-zinc-600">
          {editor.imageNotice}
        </p>
      ) : null}

      <div className="relative min-h-0 flex-1">
      <div
        ref={editor.viewportRef}
        className="absolute inset-0 overflow-hidden touch-none"
        style={{
          paddingLeft: "max(0.5rem, env(safe-area-inset-left))",
          paddingRight: "max(0.5rem, env(safe-area-inset-right))",
        }}
      >
        {editor.loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#ebecf0]/80">
            <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm text-zinc-700 shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              {docId ? "Loading saved resume…" : "Loading template…"}
            </div>
          </div>
        )}
        <div ref={editor.canvasWrapRef} className="relative h-full w-full">
          <canvas ref={editor.attachCanvasEl} className="block h-full w-full" />
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
          {editor.selectionLabel ? (
            <div className="pointer-events-none absolute left-2 top-2 z-10 max-w-[70%] truncate rounded-full bg-[#1f1f28] px-3 py-1 text-xs font-medium text-white">
              {editor.selectionLabel}
            </div>
          ) : null}
        </div>
      </div>
        <button
          type="button"
          onClick={editor.resetView}
          disabled={editor.loading}
          className="absolute bottom-3 z-10 inline-flex h-11 items-center gap-1 rounded-full border border-[#d6deeb] bg-white px-3 text-xs font-medium text-zinc-800 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 active:bg-zinc-50 disabled:opacity-50"
          style={{ left: "max(0.75rem, env(safe-area-inset-left))" }}
          aria-label="Reset view"
        >
          <Scan className="h-4 w-4" />
          Fit
        </button>
      </div>

      <div
        className="shrink-0 border-t border-[#d6deeb] bg-[#f7f7f8]"
        style={{
          paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
          paddingRight: "max(0.75rem, env(safe-area-inset-right))",
          paddingBottom: "calc(max(0.35rem, env(safe-area-inset-bottom)) + var(--slb-keyboard-inset, 0px))",
        }}
      >
        <div className="max-h-[42dvh] overflow-y-auto px-3 pt-3 [@media(max-height:520px)]:max-h-[34dvh]">
          {dock === "text" ? (
            editor.textEdit ? (
              <TextEditSheet
                open
                value={editor.textEdit.draft}
                onChange={(draft) => editor.setTextEdit({ draft })}
                onCancel={editor.closeTextEdit}
                onSave={editor.commitTextEdit}
              />
            ) : (
              <p className="rounded-2xl border border-[#d6deeb] bg-white px-3 py-3 text-sm leading-relaxed text-zinc-600">
                Tap text on the resume to edit it. Bold, italic, size, alignment, and color stay as they are on the page.
              </p>
            )
          ) : null}

          {dock === "skills" ? (
            editor.skillBarEdit ? (
              <SkillBarEditSheet
                open
                label={editor.skillBarEdit.label}
                value={editor.skillBarEdit.draftValue}
                max={editor.skillBarEdit.max}
                onChange={editor.setSkillBarDraftValue}
                onCancel={editor.cancelSkillBarEdit}
                onDone={editor.commitSkillBarEdit}
              />
            ) : (
              <p className="rounded-2xl border border-[#d6deeb] bg-white px-3 py-3 text-sm leading-relaxed text-zinc-600">
                Tap a skill bar on the resume to change its level. Star ratings can be tapped directly on the page.
              </p>
            )
          ) : null}

          {dock === "pages" ? (
            <div className="rounded-2xl border border-[#d6deeb] bg-white px-3 py-3">
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => void editor.showPage(editor.pageIndex - 1)}
                  disabled={editor.pageIndex === 0 || editor.pageCount < 2}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200 text-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 active:bg-zinc-50 disabled:opacity-40"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <p className="min-w-24 text-center text-sm font-medium text-zinc-800">
                  Page {editor.pageIndex + 1} of {editor.pageCount}
                </p>
                <button
                  type="button"
                  onClick={() => void editor.showPage(editor.pageIndex + 1)}
                  disabled={editor.pageIndex >= editor.pageCount - 1}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200 text-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 active:bg-zinc-50 disabled:opacity-40"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              {editor.pageCount > 1 ? (
                <p className="mt-2 text-center text-xs leading-relaxed text-zinc-500 [@media(max-height:520px)]:hidden">
                  This phone edits one page at a time. Other pages stay in the resume and are included in downloads.
                </p>
              ) : (
                <p className="mt-2 text-center text-xs text-zinc-500">This resume has one page.</p>
              )}
            </div>
          ) : null}

          {dock === "more" ? (
            <div className="rounded-2xl border border-[#d6deeb] bg-white px-3 py-3">
              <button
                type="button"
                onClick={editor.resetView}
                disabled={editor.loading}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 text-sm font-medium text-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 active:bg-zinc-50 disabled:opacity-50"
              >
                <Scan className="h-4 w-4" />
                Fit page
              </button>
              <p className="mt-2 text-center text-xs leading-relaxed text-zinc-500 [@media(max-height:520px)]:hidden">
                Pinch to zoom and drag to move around the page.
              </p>
            </div>
          ) : null}

          {downloadOpen ? (
            <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Download format">
              <button
                type="button"
                onClick={() => void editor.downloadPdf()}
                disabled={editor.loading || busyDownload}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white text-sm font-medium text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 active:bg-zinc-50 disabled:opacity-50"
              >
                {editor.downloadKind === "pdf" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                PDF
              </button>
              <button
                type="button"
                onClick={() => void editor.downloadPng()}
                disabled={editor.loading || busyDownload}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white text-sm font-medium text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 active:bg-zinc-50 disabled:opacity-50"
              >
                {editor.downloadKind === "png" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImageIcon className="h-4 w-4" />
                )}
                PNG
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 px-3 py-2">
          <button
            type="button"
            onClick={() => void editor.save()}
            disabled={editor.saveStatus === "saving" || editor.saveStatus === "stale" || editor.loading}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-zinc-300 bg-white text-sm font-semibold text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 active:bg-zinc-50 disabled:opacity-50"
          >
            {editor.saveStatus === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
          <button
            type="button"
            onClick={() => setDownloadOpen((open) => !open)}
            aria-expanded={downloadOpen}
            className="inline-flex min-h-12 flex-[1.4] items-center justify-center gap-2 rounded-2xl bg-violet-600 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-800 active:bg-violet-700"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
        </div>

        <nav
          className="grid grid-cols-4 gap-1 bg-[#1f1f28] px-2 py-1.5"
          aria-label="Editor tools"
          style={{
            marginLeft: "calc(-1 * max(0.75rem, env(safe-area-inset-left)))",
            marginRight: "calc(-1 * max(0.75rem, env(safe-area-inset-right)))",
            paddingLeft: "max(0.5rem, env(safe-area-inset-left))",
            paddingRight: "max(0.5rem, env(safe-area-inset-right))",
          }}
        >
          <button type="button" className={dockButtonClass(dock === "text")} aria-pressed={dock === "text"} onClick={() => setDock("text")}>
            <Type className="h-4 w-4" />
            Text
          </button>
          <button type="button" className={dockButtonClass(dock === "skills")} aria-pressed={dock === "skills"} onClick={() => setDock("skills")}>
            <BarChart3 className="h-4 w-4" />
            Skills
          </button>
          <button type="button" className={dockButtonClass(dock === "pages")} aria-pressed={dock === "pages"} onClick={() => setDock("pages")}>
            <Layers className="h-4 w-4" />
            Pages
          </button>
          <button type="button" className={dockButtonClass(dock === "more")} aria-pressed={dock === "more"} onClick={() => setDock("more")}>
            <MoreHorizontal className="h-4 w-4" />
            More
          </button>
        </nav>
      </div>
    </main>
  );
}
