"use client";

import { SidebarSection } from "../sidebar/SidebarSection";

type TemplatesPanelProps = {
  onClose: () => void;
};

export function TemplatesPanel({ onClose }: TemplatesPanelProps) {
  return (
    <>
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 bg-white">
        <span className="text-sm font-medium text-zinc-800">Templates</span>
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
        <SidebarSection title="Choose template">
          <p className="text-sm text-zinc-500">Template gallery placeholder. Load templates from resume page.</p>
        </SidebarSection>
      </div>
    </>
  );
}
