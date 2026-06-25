"use client";

import type { SkillBarProps } from "@/types/editor";

type SkillBarInspectorPanelProps = {
  skillBarProps: SkillBarProps;
  onPreviewValue: (value: number) => void;
  onDone: () => void;
  onCancel: () => void;
};

export function SkillBarInspectorPanel({
  skillBarProps,
  onPreviewValue,
  onDone,
  onCancel,
}: SkillBarInspectorPanelProps) {
  const percent = Math.round((skillBarProps.value / Math.max(1, skillBarProps.max)) * 100);

  return (
    <div className="rounded-2xl bg-white border border-[#d6deeb] shadow-[0_6px_14px_rgba(30,64,175,0.08)] transition-shadow transition-colors duration-200 hover:shadow-lg hover:border-slate-400 p-4 space-y-4">
      <div className="text-sm font-medium text-zinc-700 pb-2 border-b border-zinc-200">
        Skill bar
      </div>

      {skillBarProps.label ? (
        <p className="text-xs text-zinc-500 truncate">{skillBarProps.label}</p>
      ) : null}

      <div>
        <label className="text-xs text-zinc-500 block mb-1">Level ({percent}%)</label>
        <div className="flex gap-2 items-center">
          <input
            type="range"
            min={0}
            max={skillBarProps.max}
            value={skillBarProps.value}
            onChange={(e) => onPreviewValue(Number(e.target.value))}
            className="flex-1 h-2 rounded-full appearance-none bg-zinc-200 accent-emerald-600"
          />
          <input
            type="number"
            min={0}
            max={skillBarProps.max}
            value={skillBarProps.value}
            onChange={(e) => onPreviewValue(Number(e.target.value) || 0)}
            className="w-14 rounded border border-zinc-200 px-2 py-1 text-sm text-center"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onDone}
          className="flex-1 rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Done
        </button>
      </div>
    </div>
  );
}
