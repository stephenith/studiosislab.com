"use client";

import type { ReactNode } from "react";

type SidebarIconProps = {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
};

export function SidebarIcon({ icon, label, active, onClick }: SidebarIconProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`
        tool-item flex flex-col items-center gap-1 cursor-pointer transition-colors duration-150
        select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400
        text-gray-500 hover:text-blue-500
        ${active ? "text-blue-600" : ""}
      `}
      aria-label={label}
      aria-pressed={active}
    >
      <span className="flex items-center justify-center [&>svg]:h-[22px] [&>svg]:w-[22px]">
        {icon}
      </span>
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}
