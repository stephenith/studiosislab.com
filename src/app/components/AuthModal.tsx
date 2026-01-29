"use client";

import { useEffect } from "react";

type AuthModalProps = {
  open: boolean;
  mode: "login" | "signup";
  onClose: () => void;
};

export default function AuthModal({ open, mode, onClose }: AuthModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full border border-zinc-200 px-3 py-1 text-sm hover:bg-zinc-50"
            aria-label="Close"
          >
            Close
          </button>
        </div>

        <p className="mt-2 text-sm text-zinc-600">
          Continue to save progress and access your tools.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <button className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium shadow-sm hover:bg-zinc-50">
            Continue with Google
          </button>
          <button className="w-full rounded-xl bg-black px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-neutral-800">
            Continue with email
          </button>
        </div>
      </div>
    </div>
  );
}
