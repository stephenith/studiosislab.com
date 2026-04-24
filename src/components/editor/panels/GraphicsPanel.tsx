"use client";

import { useEffect, useState } from "react";
import { SidebarSection } from "../sidebar/SidebarSection";

type GraphicsResult = {
  id: string;
  name: string;
  svgUrl: string;
};

type GraphicsPanelProps = {
  onClose: () => void;
  editor?: {
    addGraphicFromUrl?: (url: string) => void | Promise<void>;
  } | null;
};

const DEFAULT_ICON_IDS = [
  "mdi:account",
  "mdi:account-circle-outline",
  "mdi:briefcase-outline",
  "mdi:email-outline",
  "mdi:phone-outline",
  "mdi:map-marker-outline",
  "mdi:linkedin",
  "mdi:github",
  "mdi:web",
  "mdi:star-outline",
  "mdi:check-circle-outline",
  "mdi:file-document-outline",
  "mdi:school-outline",
  "mdi:certificate-outline",
  "mdi:chart-line",
  "mdi:calendar-month-outline",
  "mdi:palette-outline",
  "mdi:lightbulb-outline",
  "mdi:target",
  "mdi:rocket-launch-outline",
  "mdi:handshake-outline",
  "mdi:tools",
  "mdi:code-tags",
  "mdi:database-outline",
  "mdi:cloud-outline",
  "mdi:language-html5",
  "mdi:language-javascript",
  "mdi:language-css3",
  "mdi:react",
  "mdi:monitor-dashboard",
  "mdi:account-group-outline",
  "mdi:bullseye-arrow",
  "mdi:earth",
  "mdi:shield-check-outline",
  "mdi:clock-outline",
  "mdi:message-outline",
  "mdi:bookmark-outline",
  "mdi:office-building-outline",
  "mdi:bank-outline",
  "mdi:medal-outline",
];

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function GraphicsPanel({ onClose, editor }: GraphicsPanelProps) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<GraphicsResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [defaultResults] = useState<GraphicsResult[]>(() =>
    shuffle(DEFAULT_ICON_IDS)
      .slice(0, 40)
      .map((id) => ({
        id,
        name: id,
        svgUrl: `https://api.iconify.design/${encodeURIComponent(id)}.svg`,
      }))
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(search.trim());
    }, 250);
    return () => {
      window.clearTimeout(timer);
    };
  }, [search]);

  useEffect(() => {
    if (!debounced) {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(`/api/graphics/search?q=${encodeURIComponent(debounced)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!cancelled) setResults(Array.isArray(json?.items) ? json.items : []);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const showingSearch = debounced.length > 0;
  const displayResults = showingSearch ? results : defaultResults;

  return (
    <>
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 bg-white">
        <span className="text-sm font-medium text-zinc-800">Graphics</span>
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
        <SidebarSection title="Search graphics">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search icons..."
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            aria-label="Search graphics"
          />
        </SidebarSection>
        <SidebarSection title={showingSearch ? "Results" : "Suggested"}>
          <div className="min-h-[120px]">
            {loading && (
              <div className="min-h-[120px] rounded-lg border border-dashed border-zinc-200 bg-zinc-50 flex items-center justify-center">
                <p className="text-sm text-zinc-400">Searching...</p>
              </div>
            )}

            {!loading && showingSearch && results.length === 0 && (
              <div className="min-h-[120px] rounded-lg border border-dashed border-zinc-200 bg-zinc-50 flex items-center justify-center">
                <p className="text-sm text-zinc-400">No results found.</p>
              </div>
            )}

            {!loading && displayResults.length > 0 && (
              <div className="grid grid-cols-4 gap-2 max-h-[60vh] overflow-y-auto pr-1">
                {displayResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => editor?.addGraphicFromUrl?.(item.svgUrl)}
                    className="aspect-square rounded-lg border border-zinc-200 bg-white p-2 hover:bg-zinc-50"
                    title={item.name}
                  >
                    <img
                      src={item.svgUrl}
                      alt={item.name}
                      loading="lazy"
                      className="h-full w-full object-contain"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </SidebarSection>
      </div>
    </>
  );
}
