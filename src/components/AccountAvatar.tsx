"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
  // Simple UI-only mock: if no user is passed, treat as logged out.
  const [isOpen, setIsOpen] = useState(false);

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
        className="flex items-center gap-2 rounded-full bg-white/70 px-2 py-1 pr-3 text-xs shadow-sm backdrop-blur-sm hover:bg-white transition-colors"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-[11px] font-semibold text-white">
          {initials}
        </div>
        <span className="hidden sm:inline text-[11px] text-zinc-700">
          Account
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 mt-2 w-44 rounded-2xl border border-zinc-200 bg-white p-2 text-xs shadow-lg"
          >
            <div className="mb-2 rounded-xl bg-zinc-50 px-3 py-2">
              <div className="text-[11px] font-semibold text-zinc-900">
                {user.name}
              </div>
              {user.email && (
                <div className="mt-0.5 text-[10px] text-zinc-500">
                  {user.email}
                </div>
              )}
            </div>
            <button
              type="button"
              className="w-full rounded-xl px-3 py-1.5 text-left text-[11px] text-zinc-800 hover:bg-zinc-50"
            >
              Account settings
            </button>
            <button
              type="button"
              className="mt-1 w-full rounded-xl px-3 py-1.5 text-left text-[11px] text-red-600 hover:bg-red-50"
            >
              Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

