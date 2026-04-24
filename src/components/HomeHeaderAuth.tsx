"use client";

import AccountAvatar from "@/components/AccountAvatar";
import { useAuth } from "@/lib/useAuth";

export default function HomeHeaderAuth() {
  const { user, authReady, signInWithGoogle } = useAuth();

  if (!authReady) {
    return (
      <div
        className="h-8 w-24 rounded-full bg-white/40 animate-pulse"
        aria-hidden
      />
    );
  }

  if (user) {
    return (
      <AccountAvatar
        user={{
          name: user.displayName || user.email || "User",
          email: user.email || undefined,
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => void signInWithGoogle().catch(() => alert("Login failed"))}
      className="rounded-full bg-black px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-black/80 transition-colors"
    >
      Sign in
    </button>
  );
}
