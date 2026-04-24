"use client";

import { useContext } from "react";
import { AuthContext } from "@/app/providers";

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <Providers>");
  }
  return ctx;
}
