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
      textareaRef.current?.select();
    }, 100);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close text editor"
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
      />
      <div
        className="relative rounded-t-2xl border border-[#d6deeb] bg-white shadow-[0_-8px_30px_rgba(30,64,175,0.12)]"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-zinc-300" />
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-sm font-semibold text-zinc-900">Edit text</h2>
          <p className="mt-1 text-xs text-zinc-500">Update the selected resume text.</p>
        </div>
        <div className="px-4 pb-4">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={5}
            className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            placeholder="Enter text..."
          />
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
            onClick={onSave}
            className="flex-1 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white active:bg-zinc-800"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
