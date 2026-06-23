"use client";

import Link from "next/link";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import TextEditSheet from "@/components/editor/mobile/TextEditSheet";
import { useMobileFabricEditor } from "@/components/editor/mobile/useMobileFabricEditor";

type MobileEditorShellProps = {
  templateId: string;
};

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
        <header
          className="flex shrink-0 items-center gap-3 bg-[#1f1f28] px-4 text-white"
          style={{
            paddingTop: "max(0.75rem, env(safe-area-inset-top))",
            paddingBottom: "0.75rem",
          }}
        >
          <Link
            href="/resume"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 active:bg-white/20"
            aria-label="Back to Resume Hub"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-sm font-medium">Resume Editor</h1>
        </header>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-sm rounded-2xl border border-[#d6deeb] bg-white p-6 text-center shadow-[0_6px_14px_rgba(30,64,175,0.08)]">
            <h2 className="text-base font-semibold text-zinc-900">Unable to load template</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">{editor.loadError}</p>
            <Link
              href="/resume"
              className="mt-5 inline-flex rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white active:bg-zinc-800"
            >
              Back to Resume Hub
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden bg-[#ebecf0] font-[family-name:var(--font-inter)]">
      <header
        className="z-20 flex shrink-0 items-center gap-2 bg-[#1f1f28] px-3 text-white"
        style={{
          paddingTop: "max(0.5rem, env(safe-area-inset-top))",
          paddingBottom: "0.5rem",
          minHeight: "3.5rem",
        }}
      >
        <Link
          href="/resume"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 active:bg-white/20"
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
          className="min-w-0 flex-1 truncate border-none bg-transparent text-sm font-medium text-white outline-none placeholder:text-white/60"
          aria-label="Resume title"
        />

        <span className="hidden max-w-[7rem] truncate text-[11px] text-white/60 sm:inline">
          {saveStatusLabel(editor.saveStatus)}
        </span>

        <button
          type="button"
          onClick={() => void editor.save()}
          disabled={editor.saveStatus === "saving" || editor.loading}
          className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-xs font-medium text-white active:bg-white/20 disabled:opacity-50"
        >
          {editor.saveStatus === "saving" ? "Saving…" : "Save"}
        </button>

        <button
          type="button"
          onClick={() => void editor.downloadPdf()}
          disabled={editor.loading || editor.isDownloading}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-medium text-black active:bg-gray-200 disabled:opacity-50"
        >
          {editor.isDownloading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          PDF
        </button>
      </header>

      <p className="shrink-0 bg-[#1f1f28] px-4 pb-2 text-center text-[11px] text-white/60 sm:hidden">
        {saveStatusLabel(editor.saveStatus)}
      </p>

      <div
        ref={editor.viewportRef}
        className="relative min-h-0 flex-1 overflow-auto touch-manipulation"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {editor.loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#ebecf0]/80">
            <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm text-zinc-700 shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading template…
            </div>
          </div>
        )}
        <div className="flex min-h-full items-start justify-center p-2">
          <canvas ref={editor.attachCanvasEl} className="block" />
        </div>
      </div>

      {!editor.loading && (
        <div
          className="shrink-0 border-t border-zinc-200 bg-white px-4 py-3 text-center text-xs text-zinc-500"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          Tap any text on the resume to edit it.
        </div>
      )}

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
