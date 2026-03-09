"use client";

import { SidebarSection } from "../sidebar/SidebarSection";

export type FramesEditorApi = {
  addImageFrame?: (type: "square" | "circle") => void;
};

type FramesPanelProps = {
  onClose: () => void;
  editor: FramesEditorApi | null;
};

export function FramesPanel({ onClose, editor }: FramesPanelProps) {
  return (
    <>
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 bg-white">
        <span className="text-sm font-medium text-zinc-800">Frames</span>
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
        <SidebarSection title="Image frames">
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => editor?.addImageFrame?.("square")}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-left text-sm text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
            >
              <span className="inline-block w-8 h-8 border-2 border-zinc-300 rounded" />
              Square Frame
            </button>
            <button
              type="button"
              onClick={() => editor?.addImageFrame?.("circle")}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-left text-sm text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
            >
              <span className="inline-block w-8 h-8 border-2 border-zinc-300 rounded-full" />
              Circle Frame
            </button>
          </div>
        </SidebarSection>
      </div>
    </>
  );
}
