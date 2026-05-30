"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthModal from "@/app/components/AuthModal";
import { useAuth } from "@/lib/useAuth";
import { trackEvent } from "@/lib/analytics";
import { isSafeInternalNextPath } from "@/lib/safeNextPath";

function LoginInner() {
  const [loading, setLoading] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextRaw = searchParams.get("next");
  const next = nextRaw && isSafeInternalNextPath(nextRaw) ? nextRaw : null;
  const { user, authReady, signInWithGoogle } = useAuth();

  useEffect(() => {
    if (!authReady) return;
    if (user) {
      router.replace(next ?? "/resume");
    }
  }, [authReady, user, router, next]);

  async function signIn() {
    setSignInError(null);
    try {
      setLoading(true);
      trackEvent("sign_in_click", { surface: "login_page", method: "google" });
      await signInWithGoogle();
      trackEvent("sign_in_success", { surface: "login_page", method: "google" });
      if (next) {
        router.push(next);
      } else {
        router.push("/resume");
      }
    } catch {
      setSignInError("Sign-in didn’t complete. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!authReady) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 text-zinc-700">
        Loading…
      </main>
    );
  }

  if (user) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 text-zinc-700">
        Redirecting…
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-50 p-6">
      <AuthModal
        variant="inline"
        open
        loading={loading}
        error={signInError}
        onContinueWithGoogle={signIn}
        onClose={() => router.push("/")}
      />
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center p-6 text-zinc-700">
          Loading…
        </main>
      }
    >
      <LoginInner />
    </Suspense>
  );
}