"use client";

import { useState } from "react";
import { useAuth } from "@/lib/useAuth";

type User = {
  name: string;
  email?: string;
};

type AccountAvatarProps = {
  user?: User | null;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function AccountAvatar({ user }: AccountAvatarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { signOutUser } = useAuth();

  if (!user) {
    return (
      <button
        type="button"
        className="rounded-full bg-black px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-black/80 transition-colors"
      >
        Sign in
      </button>
    );
  }

  const initials = getInitials(user.name || "User");

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full bg-white/70 px-2 py-1 pr-3 text-xs shadow-sm backdrop-blur-sm hover:bg-white transition-colors"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-[11px] font-semibold text-white">
          {initials}
        </div>
        <span className="hidden sm:inline text-[11px] text-zinc-700">Account</span>
      </button>

      <div
        role="menu"
        aria-hidden={!isOpen}
        className={`absolute right-0 z-50 mt-2 w-44 origin-top-right rounded-2xl border border-zinc-200 bg-white p-2 text-xs shadow-lg transition-[opacity,transform] duration-150 ease-out ${
          isOpen
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none -translate-y-1 scale-[0.98] opacity-0"
        }`}
      >
        <div className="mb-2 rounded-xl bg-zinc-50 px-3 py-2">
          <div className="text-[11px] font-semibold text-zinc-900">{user.name}</div>
          {user.email && (
            <div className="mt-0.5 text-[10px] text-zinc-500">{user.email}</div>
          )}
        </div>
        <button
          type="button"
          role="menuitem"
          className="w-full rounded-xl px-3 py-1.5 text-left text-[11px] text-zinc-800 hover:bg-zinc-50"
        >
          Account settings
        </button>
        <button
          type="button"
          role="menuitem"
          className="mt-1 w-full rounded-xl px-3 py-1.5 text-left text-[11px] text-red-600 hover:bg-red-50"
          onClick={() => {
            setIsOpen(false);
            void signOutUser().catch(() => {});
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
