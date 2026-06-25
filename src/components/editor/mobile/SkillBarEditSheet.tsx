"use client";

type SkillBarEditSheetProps = {
  open: boolean;
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
  onCancel: () => void;
  onDone: () => void;
};

export default function SkillBarEditSheet({
  open,
  label,
  value,
  max,
  onChange,
  onCancel,
  onDone,
}: SkillBarEditSheetProps) {
  if (!open) return null;

  const safeMax = Math.max(1, max);
  const percent = Math.round((value / safeMax) * 100);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close skill bar editor"
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
      />
      <div
        className="relative rounded-t-2xl border border-[#d6deeb] bg-white shadow-[0_-8px_30px_rgba(30,64,175,0.12)]"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-zinc-300" />
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-sm font-semibold text-zinc-900">Edit skill bar</h2>
          <p className="mt-1 text-xs text-zinc-500 truncate">
            {label || "Adjust the skill level."}
          </p>
        </div>
        <div className="px-4 pb-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Level</span>
            <span className="font-medium text-zinc-700">{percent}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={safeMax}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none bg-zinc-200 accent-emerald-600"
          />
          <div className="h-2 overflow-hidden rounded-full bg-[#d1d5db]">
            <div
              className="h-full rounded-full bg-[#22c55e] transition-[width] duration-75"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
        <div
          className="flex gap-3 border-t border-zinc-100 px-4 pt-3"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 active:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDone}
            className="flex-1 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white active:bg-zinc-800"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
