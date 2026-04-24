"use client";

import { useAuth } from "@/lib/useAuth";

/** Backward-compatible alias: `loading` means auth not yet resolved (same as `!authReady`). */
export function useAuthUser() {
  const { user, authReady } = useAuth();
  return { user, loading: !authReady };
}
