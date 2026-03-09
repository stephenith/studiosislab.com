"use client";

import { useState } from "react";
import { SidebarSection } from "../sidebar/SidebarSection";

const GRID_ROWS = 5;
const GRID_COLS = 5;

type TablesPanelProps = {
  onClose: () => void;
};

export function TablesPanel({ onClose }: TablesPanelProps) {
  const [selected, setSelected] = useState<{ rows: number; cols: number } | null>(null);
  const [tablePlaceholder, setTablePlaceholder] = useState<{ rows: number; cols: number } | null>(null);

  const handleCellClick = (rows: number, cols: number) => {
    setSelected({ rows, cols });
    setTablePlaceholder({ rows, cols });
  };

  return (
    <>
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 bg-white">
        <span className="text-sm font-medium text-zinc-800">Tables</span>
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
        <SidebarSection title="Grid size">
          <p className="text-xs text-zinc-500 mb-2">Select dimensions (rows × columns)</p>
          <div className="grid gap-0.5 border border-zinc-200 rounded-lg overflow-hidden bg-zinc-100" style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)` }}>
            {Array.from({ length: GRID_ROWS * GRID_COLS }, (_, i) => {
              const row = Math.floor(i / GRID_COLS) + 1;
              const col = (i % GRID_COLS) + 1;
              const isSelected = selected?.rows === row && selected?.cols === col;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleCellClick(row, col)}
                  className={`
                    w-7 h-6 flex items-center justify-center text-[10px] border border-zinc-200
                    ${isSelected ? "bg-indigo-100 border-indigo-300 text-indigo-700" : "bg-white hover:bg-zinc-50 text-zinc-600"}
                  `}
                  title={`${row}×${col}`}
                >
                  {row}×{col}
                </button>
              );
            })}
          </div>
        </SidebarSection>
        {tablePlaceholder && (
          <SidebarSection title="Preview">
            <p className="text-sm text-zinc-600">
              Table {tablePlaceholder.rows}×{tablePlaceholder.cols} placeholder. Actual table rendering can be implemented later.
            </p>
          </SidebarSection>
        )}
      </div>
    </>
  );
}
