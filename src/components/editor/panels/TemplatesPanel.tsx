"use client";

import { useMemo, useState } from "react";
import { SYSTEM_TEMPLATES } from "@/data/systemTemplates/registry";
import { SidebarSection } from "../sidebar/SidebarSection";

type TemplatesPanelProps = {
  onClose?: () => void;
  editor?: any;
};

export function TemplatesPanel({ onClose, editor }: TemplatesPanelProps) {
  const [query, setQuery] = useState("");

  const filteredTemplates = useMemo(() => {
    const q = query.toLowerCase();
    return SYSTEM_TEMPLATES.filter((t) =>
      (t.name + " " + t.tags.join(" ")).toLowerCase().includes(q)
    );
  }, [query]);

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
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search templates..."
          className="mb-3 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
        />

        <SidebarSection title="Choose template">
          {filteredTemplates.length === 0 ? (
            <p className="text-sm text-zinc-500">No templates found</p>
          ) : (
            <div className="space-y-2">
              {filteredTemplates.map((t) => {
                const thumb =
                  t.thumbnail && t.thumbnail.startsWith("/")
                    ? t.thumbnail
                    : `/templates/${t.id}.png`;

                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => editor?.applyTemplateToCurrentPage?.(t.id)}
                    className="w-full rounded-lg border border-zinc-200 bg-white p-2 text-left hover:border-zinc-300 hover:bg-zinc-50"
                  >
                    <div className="flex items-center gap-3">
                    <div className="flex flex-col items-start">
                    <div className="text-[10px] text-red-500 break-all">
                      {`/templates/${t.id}.png`}
                       </div>

                       <img
                          src={`/templates/${t.id}.png`}
                          alt="thumb"
                          className="h-14 w-10 bg-yellow-200 border border-red-500"
                         />
                     </div>

                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-zinc-800">
                          {t.name}
                        </div>
                        <div className="truncate text-xs text-zinc-500">
                          {t.tags.join(", ")}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </SidebarSection>
      </div>
    </>
  );
}