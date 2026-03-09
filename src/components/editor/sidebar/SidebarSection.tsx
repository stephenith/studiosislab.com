"use client";

import type { ReactNode } from "react";

type SidebarSectionProps = {
  title?: string;
  children: ReactNode;
  className?: string;
};

export function SidebarSection({ title, children, className = "" }: SidebarSectionProps) {
  return (
    <div className={`border-b border-zinc-200 last:border-b-0 ${className}`}>
      {title && (
        <div className="px-3 py-2 text-xs font-semibold uppercase text-zinc-500 tracking-wide">
          {title}
        </div>
      )}
      <div className="p-2">{children}</div>
    </div>
  );
}
