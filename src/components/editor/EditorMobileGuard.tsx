"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";

type EditorMobileGuardProps = {
  children: ReactNode;
};

export default function EditorMobileGuard({ children }: EditorMobileGuardProps) {
  const [isPhone, setIsPhone] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => {
      setIsPhone(media.matches);
      setChecked(true);
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  if (!checked) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#ebecf0] text-zinc-600 text-sm">
        Loading editor...
      </div>
    );
  }

  if (isPhone) {
    return (
      <main className="h-screen flex items-center justify-center bg-[#ebecf0] px-4">
        <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-zinc-900">
            Best on tablet or desktop
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600">
            For the best resume editing experience, please use a tablet or desktop.
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            You can continue browsing templates and resume drafts from the hub.
          </p>
          <Link
            href="/resume"
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Back to Resume Hub
          </Link>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
