"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

export type AuthContextValue = {
  user: User | null;
  authReady: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function Providers({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;

    const handler = (event: PromiseRejectionEvent) => {
      const reason: any = event.reason;

      const name = String(reason?.name || "");
      const message = String(reason?.message || reason || "").toLowerCase();
      const stack = String(reason?.stack || "").toLowerCase();

      const isAbort =
        name === "AbortError" ||
        message.includes("aborted") ||
        message.includes("aborterror");

      const isFirestoreInternal =
        stack.includes("webchannel_blob") ||
        stack.includes("persistent_stream") ||
        message.includes("webchannel") ||
        message.includes("persistent_stream");

      if (isAbort && isFirestoreInternal) {
        event.preventDefault();
        return;
      }
    };

    window.addEventListener("unhandledrejection", handler);

    return () => {
      window.removeEventListener("unhandledrejection", handler);
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut(auth);
  }, []);

  const value = useMemo(
    () => ({ user, authReady, signInWithGoogle, signOutUser }),
    [user, authReady, signInWithGoogle, signOutUser]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}
