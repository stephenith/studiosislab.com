"use client";

import { useMemo } from "react";
import type { TableProps } from "@/types/editor";
import { toHexColor } from "@/lib/color";

type TableInspectorPanelProps = {
  tableProps: TableProps;
  setTableProp: (partial: Partial<TableProps>) => void;
};

export function TableInspectorPanel({ tableProps, setTableProp }: TableInspectorPanelProps) {
  const borderColor = useMemo(
    () => toHexColor(tableProps.borderColor, "#111827"),
    [tableProps.borderColor]
  );

  return (
    <div className="rounded-2xl bg-white border border-[#d6deeb] shadow-[0_6px_14px_rgba(30,64,175,0.08)] transition-shadow transition-colors duration-200 hover:shadow-lg hover:border-slate-400 p-4 space-y-4">
      <div className="text-sm font-medium text-zinc-700 pb-2 border-b border-zinc-200">Table</div>

      <div>
        <label className="text-xs text-zinc-500 block mb-1">Border color</label>
        <div className="flex gap-2 items-center">
          <input
            type="color"
            value={borderColor}
            onChange={(e) => setTableProp({ borderColor: e.target.value })}
            className="w-10 h-8 rounded border cursor-pointer"
          />
          <input
            type="text"
            value={borderColor}
            onChange={(e) => {
              const v = e.target.value.trim();
              if (v.startsWith("#") || /^[0-9a-fA-F]{3,6}$/.test(v)) {
                setTableProp({ borderColor: v.startsWith("#") ? v : `#${v}` });
              }
            }}
            className="flex-1 rounded border border-zinc-200 px-2 py-1 text-xs font-mono"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-zinc-500 block mb-1">Border width</label>
        <div className="flex gap-2 items-center">
          <input
            type="range"
            min={0}
            max={12}
            value={tableProps.borderWidth}
            onChange={(e) => setTableProp({ borderWidth: Number(e.target.value) })}
            className="flex-1 h-2 rounded-full appearance-none bg-zinc-200 accent-blue-600"
          />
          <input
            type="number"
            min={0}
            max={12}
            value={tableProps.borderWidth}
            onChange={(e) => setTableProp({ borderWidth: Number(e.target.value) || 0 })}
            className="w-14 rounded border border-zinc-200 px-2 py-1 text-sm text-center"
          />
        </div>
      </div>
    </div>
  );
}
