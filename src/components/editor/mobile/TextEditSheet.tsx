"use client";

import { useEffect, useRef } from "react";

type TextEditSheetProps = {
  open: boolean;
  value: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
};

export default function TextEditSheet({
  open,
  value,
  onChange,
  onCancel,
  onSave,
}: TextEditSheetProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  return (
    <section aria-label="Edit text" className="rounded-2xl border border-[#d6deeb] bg-white p-3 shadow-[0_6px_14px_rgba(30,64,175,0.08)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold tracking-wide text-violet-700">TEXT</h2>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-11 min-w-11 items-center justify-center rounded-xl px-3 text-sm font-medium text-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 active:bg-zinc-100"
        >
          Cancel
        </button>
      </div>
      <label className="sr-only" htmlFor="mobile-resume-text">
        Selected resume text
      </label>
      <textarea
        id="mobile-resume-text"
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-base text-zinc-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
        placeholder="Enter text..."
      />
      <button
        type="button"
        onClick={onSave}
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 active:bg-violet-700"
      >
        Done
      </button>
    </section>
  );
}
