"use client";

import Link from "next/link";

export default function GlobalError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col items-center justify-center bg-zinc-50 px-4 py-16 text-center font-sans text-zinc-800">
        <p className="font-heading text-2xl font-semibold tracking-tight">Something went wrong</p>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-600">
          Please try again. If the problem continues, go back to the home page or contact support.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-8 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
        >
          Try again
        </button>
        <Link
          href="/"
          className="mt-4 text-sm font-medium text-violet-700 underline underline-offset-2 hover:text-violet-800"
        >
          Back to home
        </Link>
        <Link
          href="/contact"
          className="mt-3 text-sm text-zinc-600 underline underline-offset-2 hover:text-zinc-800"
        >
          Contact
        </Link>
      </body>
    </html>
  );
}
