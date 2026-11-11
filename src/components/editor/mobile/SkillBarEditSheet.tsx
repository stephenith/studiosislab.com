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
    <section aria-label="Edit skill bar" className="rounded-2xl border border-[#d6deeb] bg-white p-3 shadow-[0_6px_14px_rgba(30,64,175,0.08)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="min-w-0 truncate text-xs font-semibold tracking-wide text-violet-700">
          {label || "SKILL"}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl px-3 text-sm font-medium text-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 active:bg-zinc-100"
        >
          Cancel
        </button>
      </div>
      <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
        <span>Level</span>
        <span className="font-medium text-zinc-800">{percent}%</span>
      </div>
      <label className="sr-only" htmlFor="mobile-skill-level">
        Skill level
      </label>
      <input
        id="mobile-skill-level"
        type="range"
        min={0}
        max={safeMax}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 w-full accent-violet-600"
      />
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200" aria-hidden="true">
        <div className="h-full rounded-full bg-[#22c55e]" style={{ width: `${percent}%` }} />
      </div>
      <button
        type="button"
        onClick={onDone}
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 active:bg-violet-700"
      >
        Done
      </button>
    </section>
  );
}
