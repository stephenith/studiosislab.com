"use client";

import { useEffect, useState } from "react";
import { HOME_LOGOS_DARK, HOME_LOGOS_LIGHT } from "@/components/home/homeLogoAssets";

export const BRAND_LOAD_DELAY_MS = 200;

type BrandLoadMarkProps = {
  label: string;
  variant?: "light" | "dark";
};

export default function BrandLoadMark({ label, variant = "light" }: BrandLoadMarkProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), BRAND_LOAD_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const logo = variant === "dark" ? HOME_LOGOS_DARK.header : HOME_LOGOS_LIGHT.header;
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4" role="status" aria-live="polite" aria-busy="true">
      <div className="relative h-16 w-16">
        <span
          className="brand-load-arc pointer-events-none absolute inset-0 rounded-full border-2 border-violet-200 border-t-violet-600"
          aria-hidden
        />
        <img src={logo} alt="" className="absolute inset-2 h-12 w-12 object-contain" />
      </div>
      <p className={`text-sm ${variant === "dark" ? "text-zinc-200" : "text-zinc-600"}`}>{label}</p>
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .brand-load-arc { animation: none; }
        }
        @media (prefers-reduced-motion: no-preference) {
          .brand-load-arc { animation: brand-load-spin 0.9s linear infinite; }
        }
        @keyframes brand-load-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
