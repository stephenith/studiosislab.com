"use client";

import { SidebarSection } from "../sidebar/SidebarSection";

export type ShapesEditorApi = {
  addRect?: () => void;
  addCircle?: () => void;
  addLine?: () => void;
};

type ShapesPanelProps = {
  onClose: () => void;
  editor: ShapesEditorApi | null;
};

export function ShapesPanel({ onClose, editor }: ShapesPanelProps) {
  return (
    <>
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 bg-white">
        <span className="text-sm font-medium text-zinc-800">Shapes</span>
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
        <SidebarSection title="Add shape">
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => editor?.addRect?.()}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-left text-sm text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
            >
              <span className="inline-block w-6 h-4 border-2 border-current rounded" />
              Rectangle
            </button>
            <button
              type="button"
              onClick={() => editor?.addCircle?.()}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-left text-sm text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
            >
              <span className="inline-block w-5 h-5 border-2 border-current rounded-full" />
              Circle
            </button>
            <button
              type="button"
              onClick={() => editor?.addLine?.()}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-left text-sm text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
            >
              <span className="inline-block w-6 border-t-2 border-current" />
              Line
            </button>
            <button
              type="button"
              disabled
              className="w-full rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2.5 text-left text-sm text-zinc-400 cursor-not-allowed flex items-center gap-2"
            >
              <span className="inline-block w-0 h-0 border-l-[10px] border-r-[10px] border-b-[16px] border-l-transparent border-r-transparent border-b-current" />
              Triangle (coming soon)
            </button>
          </div>
        </SidebarSection>
      </div>
    </>
  );
}
