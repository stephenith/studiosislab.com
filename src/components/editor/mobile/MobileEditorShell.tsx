"use client";

import Link from "next/link";
import { ArrowLeft, Download, Loader2, Scan } from "lucide-react";
import TextEditSheet from "@/components/editor/mobile/TextEditSheet";
import { useMobileFabricEditor } from "@/components/editor/mobile/useMobileFabricEditor";

type MobileEditorShellProps = {
  templateId: string;
};

const MOBILE_SAFE_AREA = {
  paddingTop: "max(0.75rem, env(safe-area-inset-top))",
  paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
  paddingRight: "max(1.25rem, calc(env(safe-area-inset-right, 0px) + 0.625rem))",
} as const;

function saveStatusLabel(status: string): string {
  switch (status) {
    case "saving":
      return "Saving…";
    case "saved":
      return "Saved";
    case "unsaved":
      return "Unsaved changes";
    case "error":
      return "Save failed";
    default:
      return "Tap text to edit";
  }
}

export default function MobileEditorShell({ templateId }: MobileEditorShellProps) {
  const editor = useMobileFabricEditor({ templateId });

  if (editor.loadError) {
    return (
      <main className="flex h-[100dvh] flex-col bg-[#ebecf0]">
        <header className="shrink-0 bg-[#1f1f28] text-white" style={MOBILE_SAFE_AREA}>
          <div className="flex items-center gap-3 pb-3">
            <Link
              href="/resume"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 active:bg-white/20"
              aria-label="Back to Resume Hub"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-sm font-medium">Resume Editor</h1>
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-sm rounded-2xl border border-[#d6deeb] bg-white p-6 text-center shadow-[0_6px_14px_rgba(30,64,175,0.08)]">
            <h2 className="text-base font-semibold text-zinc-900">Unable to load template</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">{editor.loadError}</p>
            <Link
              href="/resume"
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white active:bg-zinc-800"
            >
              Back to Resume Hub
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-[100dvh] w-full max-w-[100vw] flex-col overflow-x-hidden bg-[#ebecf0] font-[family-name:var(--font-inter)]">
      <header
        className="z-20 w-full max-w-full shrink-0 overflow-x-clip bg-[#1f1f28] text-white"
        style={{
          ...MOBILE_SAFE_AREA,
          touchAction: "pan-y",
          overscrollBehaviorX: "none",
        }}
      >
        <div className="flex w-full max-w-full min-w-0 items-center gap-2 pb-2 pt-1">
          <Link
            href="/resume"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 active:bg-white/20"
            aria-label="Back to Resume Hub"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <input
            type="text"
            value={editor.docTitle}
            onChange={(e) => {
              editor.setDocTitle(e.target.value);
            }}
            className="min-h-11 w-0 min-w-0 flex-1 truncate border-none bg-transparent text-sm font-medium text-white outline-none placeholder:text-white/60"
            aria-label="Resume title"
          />
        </div>

        <div className="flex w-full min-w-0 items-center gap-x-1.5 pb-3">
          <p className="min-w-0 flex-1 truncate text-xs text-white/60">
            {saveStatusLabel(editor.saveStatus)}
          </p>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={editor.resetView}
              disabled={editor.loading}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white active:bg-white/20 disabled:opacity-50"
              aria-label="Reset view"
            >
              <Scan className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => void editor.save()}
              disabled={editor.saveStatus === "saving" || editor.loading}
              className="inline-flex h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-white/10 px-1.5 text-sm font-medium text-white active:bg-white/20 disabled:opacity-50"
            >
              {editor.saveStatus === "saving" ? (
                <>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  <span className="hidden min-[400px]:inline min-[400px]:pl-1">Saving…</span>
                </>
              ) : (
                "Save"
              )}
            </button>

            <button
              type="button"
              onClick={() => void editor.downloadPdf()}
              disabled={editor.loading || editor.isDownloading}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-black active:bg-gray-200 min-[400px]:w-auto min-[400px]:gap-1 min-[400px]:px-2 disabled:opacity-50"
              aria-label="Download PDF"
            >
              {editor.isDownloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span className="hidden text-sm font-medium min-[400px]:inline">PDF</span>
            </button>
          </div>
        </div>
      </header>

      <div
        ref={editor.viewportRef}
        className="relative min-h-0 flex-1 overflow-hidden touch-none"
        style={{
          paddingLeft: "max(0.5rem, env(safe-area-inset-left))",
          paddingRight: "max(0.5rem, env(safe-area-inset-right))",
        }}
      >
        {editor.loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#ebecf0]/80">
            <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm text-zinc-700 shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading template…
            </div>
          </div>
        )}
        <div ref={editor.canvasWrapRef} className="h-full w-full">
          <canvas ref={editor.attachCanvasEl} className="block h-full w-full" />
        </div>
      </div>

      <div
        className={`shrink-0 border-t border-zinc-200 bg-white px-4 py-3 text-center text-xs text-zinc-500 ${
          editor.loading ? "invisible" : ""
        }`}
        style={{
          paddingLeft: "max(1rem, env(safe-area-inset-left))",
          paddingRight: "max(1rem, env(safe-area-inset-right))",
          paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
        }}
        aria-hidden={editor.loading}
      >
        Pinch to zoom, drag to pan, tap text to edit.
      </div>

      <TextEditSheet
        open={!!editor.textEdit}
        value={editor.textEdit?.draft ?? ""}
        onChange={(draft) => editor.setTextEdit({ draft })}
        onCancel={editor.closeTextEdit}
        onSave={editor.commitTextEdit}
      />
    </main>
  );
}
