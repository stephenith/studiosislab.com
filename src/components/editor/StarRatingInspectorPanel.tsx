"use client";

import type { StarRatingProps } from "@/types/editor";

type StarRatingInspectorPanelProps = {
  starRatingProps: StarRatingProps;
  onPreviewValue: (value: number) => void;
  onDone: () => void;
  onCancel: () => void;
};

export function StarRatingInspectorPanel({
  starRatingProps,
  onPreviewValue,
  onDone,
  onCancel,
}: StarRatingInspectorPanelProps) {
  const { max, value } = starRatingProps;

  return (
    <div className="rounded-2xl bg-white border border-[#d6deeb] shadow-[0_6px_14px_rgba(30,64,175,0.08)] transition-shadow transition-colors duration-200 hover:shadow-lg hover:border-slate-400 p-4 space-y-4">
      <div className="text-sm font-medium text-zinc-700 pb-2 border-b border-zinc-200">
        Star rating
      </div>

      {starRatingProps.label ? (
        <p className="text-xs text-zinc-500 truncate">{starRatingProps.label}</p>
      ) : null}

      <div>
        <label className="text-xs text-zinc-500 block mb-2">Rating</label>
        <div className="flex items-center gap-1" role="group" aria-label="Star rating">
          {Array.from({ length: max }, (_, i) => {
            const starValue = i + 1;
            const filled = starValue <= value;
            return (
              <button
                key={starValue}
                type="button"
                aria-label={`${starValue} star${starValue === 1 ? "" : "s"}`}
                onClick={() => onPreviewValue(starValue)}
                className="p-0.5 rounded hover:opacity-80 transition-opacity"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill={filled ? "#ca8a04" : "none"}
                  stroke={filled ? "#ca8a04" : "#9ca3af"}
                  strokeWidth="1.5"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-xs text-zinc-500 block mb-1">Value</label>
        <input
          type="number"
          min={1}
          max={max}
          value={value}
          onChange={(e) => onPreviewValue(Number(e.target.value) || 1)}
          className="w-full rounded border border-zinc-200 px-2 py-1.5 text-sm"
        />
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
