"use client";

import { ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

export type FontVariant = {
  id: string;
  label: string;
  weight: number;
  style: "normal" | "italic";
  fileUrl?: string;
};

export type FontFamily = {
  family: string;
  category?: string;
  variants: FontVariant[];
};

type FontPickerProps = {
  fonts: FontFamily[];
  value?: string;
  onSelect: (family: string) => void;
  placeholder?: string;
};

const ROW_HEIGHT = 40;

export function FontPicker({
  fonts,
  value,
  onSelect,
  placeholder = "Search fonts...",
}: FontPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const filteredFonts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return fonts;
    return fonts.filter((font) => font.family.toLowerCase().includes(q));
  }, [fonts, searchQuery]);

  const rowVirtualizer = useVirtualizer({
    count: filteredFonts.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const nextIndex = Math.max(0, filteredFonts.findIndex((font) => font.family === value));
    setHighlightedIndex(nextIndex);
    searchInputRef.current?.focus();
  }, [open, filteredFonts, value]);

  useEffect(() => {
    if (filteredFonts.length === 0) {
      setHighlightedIndex(0);
      return;
    }
    if (highlightedIndex > filteredFonts.length - 1) {
      setHighlightedIndex(filteredFonts.length - 1);
    }
  }, [filteredFonts.length, highlightedIndex]);

  const selectFont = (family: string) => {
    onSelect(family);
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }

    if (filteredFonts.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = Math.min(filteredFonts.length - 1, highlightedIndex + 1);
      setHighlightedIndex(next);
      rowVirtualizer.scrollToIndex(next, { align: "auto" });
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      const prev = Math.max(0, highlightedIndex - 1);
      setHighlightedIndex(prev);
      rowVirtualizer.scrollToIndex(prev, { align: "auto" });
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const selected = filteredFonts[highlightedIndex];
      if (selected) selectFont(selected.family);
    }
  };

  return (
    <div ref={rootRef} className="relative" onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white flex items-center justify-between gap-2 hover:bg-zinc-50"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate text-left">{value || "Select font"}</span>
        <ChevronDown size={14} className={`text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-zinc-200 bg-white shadow-lg">
          <div className="p-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={placeholder}
                className="w-full rounded-md border border-zinc-200 pl-8 pr-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25"
              />
            </div>
          </div>
          <div className="border-t border-zinc-100" />

          {filteredFonts.length === 0 ? (
            <div className="px-3 py-6 text-sm text-zinc-500 text-center">No fonts found</div>
          ) : (
            <div
              ref={listRef}
              className="h-64 overflow-y-auto scroll-smooth pr-1"
              role="listbox"
              aria-activedescendant={filteredFonts[highlightedIndex]?.family}
            >
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  position: "relative",
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const font = filteredFonts[virtualRow.index];
                  const isSelected = font.family === value;
                  const isHighlighted = virtualRow.index === highlightedIndex;
                  return (
                    <button
                      key={font.family}
                      id={font.family}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setHighlightedIndex(virtualRow.index)}
                      onClick={() => selectFont(font.family)}
                      className={`absolute left-0 right-0 px-3 text-left text-sm transition-colors ${
                        isSelected
                          ? "bg-blue-50 text-blue-700"
                          : isHighlighted
                            ? "bg-zinc-100 text-zinc-900"
                            : "text-zinc-700 hover:bg-zinc-50"
                      }`}
                      style={{
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <span className="block truncate leading-10">{font.family}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
