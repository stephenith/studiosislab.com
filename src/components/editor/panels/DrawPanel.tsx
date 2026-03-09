"use client";

import { SidebarSection } from "../sidebar/SidebarSection";

type DrawPanelProps = {
  onClose: () => void;
  editor?: unknown;
};

export function DrawPanel({ onClose }: DrawPanelProps) {
  // Hook to existing draw tools if available; otherwise placeholder
  const handlePencil = () => {
    // Stub: hook to editor drawing mode when available
  };
  const handleHighlighter = () => {};
  const handleEraser = () => {};

  return (
    <>
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 bg-white">
        <span className="text-sm font-medium text-zinc-800">Draw</span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700"
          aria-label="Close panel"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="p-3 overflow-y-auto">
        <SidebarSection title="Drawing tools">
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handlePencil}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-left text-sm text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Pencil
            </button>
            <button
              type="button"
              onClick={handleHighlighter}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-left text-sm text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21L3 17l12-12 4 4L7 21z" />
              </svg>
              Highlighter
            </button>
            <button
              type="button"
              onClick={handleEraser}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-left text-sm text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Eraser
            </button>
          </div>
        </SidebarSection>
        <p className="text-xs text-zinc-400 mt-2">Connect to canvas draw mode when available.</p>
      </div>
    </>
  );
}
