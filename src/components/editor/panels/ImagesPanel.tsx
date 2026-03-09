"use client";

import { useState } from "react";
import { SidebarSection } from "../sidebar/SidebarSection";

type ImagesPanelProps = {
  onClose: () => void;
};

export function ImagesPanel({ onClose }: ImagesPanelProps) {
  const [search, setSearch] = useState("");

  return (
    <>
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 bg-white">
        <span className="text-sm font-medium text-zinc-800">Images</span>
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
        <SidebarSection title="Search images">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            aria-label="Search images"
          />
        </SidebarSection>
        <SidebarSection title="Results">
          <div className="min-h-[120px] rounded-lg border border-dashed border-zinc-200 bg-zinc-50 flex items-center justify-center">
            <p className="text-sm text-zinc-400">No images yet. Use Upload to add images.</p>
          </div>
        </SidebarSection>
      </div>
    </>
  );
}
