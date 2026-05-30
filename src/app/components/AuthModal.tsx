"use client";

import Image from "next/image";
import { useEffect } from "react";
import { HOME_LOGOS_LIGHT } from "@/components/home/homeLogoAssets";

type AuthModalProps = {
  variant?: "modal" | "inline";
  open: boolean;
  loading?: boolean;
  error?: string | null;
  onContinueWithGoogle: () => void;
  onClose: () => void;
};

function AuthPanel({
  loading = false,
  error = null,
  onContinueWithGoogle,
  onClose,
}: Pick<AuthModalProps, "loading" | "error" | "onContinueWithGoogle" | "onClose">) {
  return (
    <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl sm:p-7">
      <button
        type="button"
        onClick={onClose}
        className="ml-auto flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700"
        aria-label="Close"
      >
        ×
      </button>

      <div className="mt-1 flex flex-col items-center text-center">
        <div className="relative h-16 w-52 sm:h-20 sm:w-64">
          <Image
            src={HOME_LOGOS_LIGHT.heroLab}
            alt="StudiosisLab"
            fill
            className="object-contain"
            sizes="256px"
            priority
          />
        </div>

        <h2 className="mt-4 text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
          One-time Google sign-up
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 sm:text-base">
          Sign in once and your resumes, downloads, and documents stay saved for the next time you
          come back.
        </p>

        <button
          type="button"
          onClick={onContinueWithGoogle}
          disabled={loading}
          className="mt-6 w-full rounded-xl bg-black px-4 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Signing in..." : "Continue with Google"}
        </button>

        <button
          type="button"
          onClick={onClose}
          className="mt-2 text-sm font-medium text-zinc-500 underline-offset-2 transition-colors hover:text-zinc-700 hover:underline"
        >
          Maybe later
        </button>

        {error ? (
          <p className="mt-3 text-sm text-red-700" role="status">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default function AuthModal({
  variant = "modal",
  open,
  loading = false,
  error = null,
  onContinueWithGoogle,
  onClose,
}: AuthModalProps) {
  const isModal = variant === "modal";

  useEffect(() => {
    if (!isModal || !open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isModal, open, onClose]);

  if (!open) return null;

  if (!isModal) {
    return (
      <AuthPanel
        loading={loading}
        error={error}
        onContinueWithGoogle={onContinueWithGoogle}
        onClose={onClose}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to StudiosisLab"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <AuthPanel
          loading={loading}
          error={error}
          onContinueWithGoogle={onContinueWithGoogle}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
