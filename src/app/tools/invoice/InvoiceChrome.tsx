"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import NoiseBackground from "@/components/home/NoiseBackground";
import { HOME_LOGOS_LIGHT } from "@/components/home/homeLogoAssets";

const NOTICE_KEY = "studiosislab-invoice-notice-dismissed";

export function InvoiceChrome({ children, showToolsLink = true }: { children: ReactNode; showToolsLink?: boolean }) {
  return (
    <main className="relative min-h-dvh bg-white px-4 pb-16 pt-5 text-zinc-900 sm:px-6">
      <NoiseBackground />
      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-5">
        <header className="flex items-center justify-between gap-3">
          <Link href="/" className="block shrink-0">
            <Image
              src={HOME_LOGOS_LIGHT.header}
              alt="StudiosisLab — home"
              width={240}
              height={44}
              className="h-11 w-auto object-contain object-left"
              priority
            />
          </Link>
          <nav className="flex flex-wrap justify-end gap-2 text-sm">
            {showToolsLink ? (
              <Link href="/tools" className="rounded-full border border-zinc-300 bg-white px-3 py-2 font-medium text-zinc-800">
                Tools
              </Link>
            ) : null}
            <Link href="/tools/invoice" className="rounded-full border border-zinc-300 bg-white px-3 py-2 font-medium text-zinc-800">
              Invoice
            </Link>
            <Link href="/tools/invoice/history" className="rounded-full border border-zinc-300 bg-white px-3 py-2 font-medium text-zinc-800">
              History
            </Link>
          </nav>
        </header>
        {children}
      </div>
    </main>
  );
}

export function StorageNotice({ status }: { status: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(NOTICE_KEY) === "1") setVisible(false);
    } catch {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    try {
      sessionStorage.setItem(NOTICE_KEY, "1");
    } catch {
      // The notice can still close for this view when storage is blocked.
    }
    setVisible(false);
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p role="status" className="font-medium text-zinc-900">
          {status}
        </p>
        {visible ? (
          <button type="button" onClick={dismiss} className="shrink-0 text-sm font-medium text-zinc-600 underline">
            Dismiss
          </button>
        ) : null}
      </div>
      {visible ? (
        <p className="mt-1 text-zinc-600">
          These invoices stay in this browser. Another browser or device cannot open them. Clearing this site&apos;s data removes them.
        </p>
      ) : null}
    </div>
  );
}
