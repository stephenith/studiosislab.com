"use client";

import { useEffect, useState } from "react";
import { SidebarSection } from "../sidebar/SidebarSection";

type ImageResult = {
  id: string;
  previewUrl: string;
  fullUrl: string;
  width: number;
  height: number;
  photographer: string;
  source: "pixabay";
};

type ImagesPanelProps = {
  onClose: () => void;
  editor?: {
    addImageFromUrl?: (url: string) => void | Promise<void>;
  } | null;
};

export function ImagesPanel({ onClose, editor }: ImagesPanelProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [results, setResults] = useState<ImageResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 250);
    return () => {
      window.clearTimeout(timer);
    };
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);

    fetch(`/api/images/search?q=${encodeURIComponent(debouncedSearch)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = await res.json();
        setResults(Array.isArray(json?.items) ? json.items : []);
      })
      .catch((err: any) => {
        if (err?.name === "AbortError") return;
        setResults([]);
        setLoadError("Unable to load images");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [debouncedSearch]);

  const showingSearch = debouncedSearch.length > 0;
  const displayItems = results;

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
            placeholder="Search images..."
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            aria-label="Search images"
          />
        </SidebarSection>
        <SidebarSection title={showingSearch ? "Results" : "Suggested"}>
          <div className="min-h-[120px]">
            {loading && (
              <div className="min-h-[120px] rounded-lg border border-dashed border-zinc-200 bg-zinc-50 flex items-center justify-center">
                <p className="text-sm text-zinc-400">Searching...</p>
              </div>
            )}

            {!loading && loadError && (
              <div className="min-h-[120px] rounded-lg border border-dashed border-zinc-200 bg-zinc-50 flex items-center justify-center">
                <p className="text-sm text-zinc-400">{loadError}</p>
              </div>
            )}

            {!loading && !loadError && showingSearch && displayItems.length === 0 && (
              <div className="min-h-[120px] rounded-lg border border-dashed border-zinc-200 bg-zinc-50 flex items-center justify-center">
                <p className="text-sm text-zinc-400">No images found</p>
              </div>
            )}

            {!loading && !loadError && displayItems.length > 0 && (
              <div className="grid grid-cols-4 gap-2 max-h-[60vh] overflow-y-auto pr-1">
                {displayItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => editor?.addImageFromUrl?.(item.fullUrl)}
                    className="aspect-square rounded-lg border border-zinc-200 bg-white p-0.5 hover:bg-zinc-50"
                    title={item.photographer ? `Photo by ${item.photographer}` : "Pixabay image"}
                  >
                    <img
                      src={item.previewUrl}
                      alt={item.photographer ? `Photo by ${item.photographer}` : "Pixabay image"}
                      loading="lazy"
                      className="h-full w-full object-cover rounded"
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
