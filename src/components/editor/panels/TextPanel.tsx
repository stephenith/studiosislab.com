"use client";

import { SidebarSection } from "../sidebar/SidebarSection";

export type EditorApi = {
  addText?: () => void;
  setTextProp?: (patch: Record<string, unknown>) => void;
};

type TextPanelProps = {
  onClose: () => void;
  editor: EditorApi | null;
};

export function TextPanel({ onClose, editor }: TextPanelProps) {
  const handleHeading = () => {
    editor?.addText?.();
    requestAnimationFrame(() => {
      editor?.setTextProp?.({ fontSize: 36, fontWeight: "bold" });
    });
  };

  const handleSubheading = () => {
    editor?.addText?.();
    requestAnimationFrame(() => {
      editor?.setTextProp?.({ fontSize: 24 });
    });
  };

  const handleBody = () => {
    editor?.addText?.();
    requestAnimationFrame(() => {
      editor?.setTextProp?.({ fontSize: 16, fontWeight: "normal" });
    });
  };

  return (
    <>
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 bg-white">
        <span className="text-sm font-medium text-zinc-800">Text</span>
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
        <SidebarSection title="Add text">
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleHeading}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
            >
              Heading
            </button>
            <button
              type="button"
              onClick={handleSubheading}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-left text-sm text-zinc-700 hover:bg-zinc-50"
            >
              Subheading
            </button>
            <button
              type="button"
              onClick={handleBody}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-left text-sm text-zinc-600 hover:bg-zinc-50"
            >
              Body Text
            </button>
          </div>
        </SidebarSection>
      </div>
    </>
  );
}
