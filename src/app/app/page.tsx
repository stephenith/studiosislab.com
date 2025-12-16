"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useAuthUser } from "../../lib/useAuthUser";

export default function AppHome() {
  const router = useRouter();
  const { user, loading } = useAuthUser();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) return <main className="p-6">Loading...</main>;
  if (!user) return null;

  return (
    <main className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-zinc-600 text-sm">{user.email}</p>
        </div>

        <button
          className="rounded-xl border px-4 py-2"
          onClick={async () => {
            await signOut(auth);
            router.replace("/login");
          }}
        >
          Logout
        </button>
      </div>

      <p className="mt-6 text-zinc-600">Next: template search + editor.</p>
    </main>
  );
}