"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

function LoginInner() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const { user, authReady, signInWithGoogle } = useAuth();

  useEffect(() => {
    if (!authReady) return;
    if (user) {
      router.replace(next || "/resume");
    }
  }, [authReady, user, router, next]);

  async function signIn() {
    try {
      setLoading(true);
      await signInWithGoogle();
      if (next) {
        router.push(next);
      } else {
        router.push("/resume");
      }
    } catch {
      alert("Login failed");
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
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border p-6">
        <h1 className="text-2xl font-semibold">Studiosis Lab</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Login with Google to continue
        </p>

        <button
          onClick={signIn}
          disabled={loading}
          className="mt-6 w-full bg-black text-white py-3 rounded-xl"
        >
          {loading ? "Signing in..." : "Continue with Google"}
        </button>
      </div>
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