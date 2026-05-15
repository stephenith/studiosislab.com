"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { trackEvent } from "@/lib/analytics";

type HomeCtaLinkProps = {
  href: string;
  surface: string;
  className: string;
  children: ReactNode;
};

export function HomeCtaLink({ href, surface, className, children }: HomeCtaLinkProps) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => trackEvent("cta_click", { surface, destination: href })}
    >
      {children}
    </Link>
  );
}
