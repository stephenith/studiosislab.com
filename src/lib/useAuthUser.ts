"use client";
import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "./firebase";

export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const listenerAttachedRef = useRef(false);

  useEffect(() => {
    if (listenerAttachedRef.current) return;
    listenerAttachedRef.current = true;

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });

    return () => {
      listenerAttachedRef.current = false;
      unsub();
    };
  }, []);

  return { user, loading };
}