"use client";

import { useState } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function signIn() {
    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.push("/app");
    } catch (e) {
      alert("Login failed");
    } finally {
      setLoading(false);
    }
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