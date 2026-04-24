"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

export function EditorAuthGate({ children }: { children: ReactNode }) {
  const { user, authReady } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      router.replace("/login");
    }
  }, [authReady, user, router]);

  if (!authReady) {
    return (
      <div className="h-screen flex items-center justify-center text-zinc-600 text-sm">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center text-zinc-600 text-sm">
        Redirecting…
      </div>
    );
  }

  return <>{children}</>;
}
