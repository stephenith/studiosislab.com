"use client";

import Link from "next/link";
import type { BlogArticle } from "@/data/blog/types";
import { trackEvent } from "@/lib/analytics";

type BlogCTAProps = {
  cta: BlogArticle["cta"];
};

function ctaDestination(href: string): string {
  if (href.startsWith("/")) return href;
  try {
    const u = new URL(href);
    if (u.hostname === "studiosislab.com" || u.hostname === "www.studiosislab.com") {
      return `${u.pathname}${u.search}`.slice(0, 200);
    }
  } catch {
    /* ignore */
  }
  return "external";
}

export default function BlogCTA({ cta }: BlogCTAProps) {
  return (
    <aside className="rounded-2xl border border-zinc-200/80 bg-white/90 p-5 shadow-sm sm:p-6">
      <h2 className="font-heading text-xl font-semibold tracking-tight text-zinc-900">Take the next step</h2>
      {cta.note ? <p className="mt-2 text-sm text-zinc-600">{cta.note}</p> : null}
      <div className="mt-4">
        <Link
          href={cta.href}
          className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
          onClick={() =>
            trackEvent("blog_cta_click", {
              surface: "blog_article",
              destination: ctaDestination(cta.href),
              link_type: "primary_cta",
            })
          }
        >
          {cta.label}
        </Link>
      </div>
    </aside>
  );
}
