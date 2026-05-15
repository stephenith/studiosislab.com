"use client";

import type { ReactNode } from "react";
import { trackEvent } from "@/lib/analytics";

type ContactMailtoLinkProps = {
  href: string;
  children: ReactNode;
  linkType: "support" | "business";
};

/** Mailto only — logs link_type, not the address as a custom dimension beyond GA default. */
export function ContactMailtoLink({ href, children, linkType }: ContactMailtoLinkProps) {
  return (
    <a
      className="font-medium text-zinc-900 underline"
      href={href}
      onClick={() =>
        trackEvent("contact_link_click", {
          surface: "contact",
          destination: "mailto",
          link_type: linkType,
        })
      }
    >
      {children}
    </a>
  );
}
