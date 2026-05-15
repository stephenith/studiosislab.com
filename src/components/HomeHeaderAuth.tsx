"use client";

import { useEffect, useState } from "react";
import AccountAvatar from "@/components/AccountAvatar";
import { useAuth } from "@/lib/useAuth";
import { trackEvent } from "@/lib/analytics";

export default function HomeHeaderAuth() {
  const { user, authReady, signInWithGoogle } = useAuth();
  const [signInError, setSignInError] = useState<string | null>(null);

  useEffect(() => {
    if (!signInError) return;
    const t = window.setTimeout(() => setSignInError(null), 6000);
    return () => window.clearTimeout(t);
  }, [signInError]);

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
    <div className="flex max-w-[11rem] flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => {
          setSignInError(null);
          trackEvent("sign_in_click", { surface: "header", method: "google" });
          void signInWithGoogle()
            .then(() => {
              trackEvent("sign_in_success", { surface: "header", method: "google" });
            })
            .catch(() => {
              setSignInError("Sign-in didn’t complete. Please try again.");
            });
        }}
        className="rounded-full bg-black px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-black/80 transition-colors"
      >
        Sign in
      </button>
      {signInError ? (
        <p className="text-right text-[11px] leading-snug text-red-700" role="status">
          {signInError}
        </p>
      ) : null}
    </div>
  );
}
