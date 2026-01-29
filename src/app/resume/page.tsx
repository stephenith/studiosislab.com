"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";

import { TEMPLATES, CATEGORIES } from "@/data/templates";

export default function ResumeTemplatesPage() {
  const router = useRouter();

  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");

  // ✅ Auth guard (protect /resume)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);

      // If not logged in, send to your login page
      if (!u) router.replace("/login");
    });

    return () => unsub();
  }, [router]);

  const filteredTemplates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TEMPLATES.filter((t) => {
      const matchesCategory = category === "All" || t.category === category;
      if (!matchesCategory) return false;
      if (!q) return true;
      const hay = `${t.title} ${t.category} ${t.tags.join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query, category]);

  // ✅ Prevent UI flash while auth is loading
  if (authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-zinc-700">
        Loading…
      </main>
    );
  }

  // If logged out, we redirect; show nothing (avoids flicker)
  if (!user) return null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50 to-white text-zinc-900">
      <div className="mx-auto w-full max-w-6xl px-6 py-16">
        <header className="text-center">
          <h1 className="text-3xl md:text-4xl font-semibold">
            Type your role, pick a design, and shine.
          </h1>
          <p className="mt-3 text-zinc-600">
            Casual but clear — guides users smoothly.
          </p>
        </header>

        <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, category, or tags…"
            className="w-full md:max-w-md rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />

          <div className="flex flex-wrap justify-center gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  category === c
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-blue-300"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <section className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <button
            onClick={() => router.push("/editor/new")}
            className="group flex flex-col gap-4 rounded-2xl border border-dashed border-zinc-300 bg-white/70 p-5 text-left shadow-sm transition hover:border-blue-400 hover:shadow-md"
          >
            <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-blue-300 bg-white text-4xl font-semibold text-blue-500 shadow-sm aspect-[210/297]">
              +
            </div>
            <div>
              <div className="text-lg font-semibold">Create blank</div>
              <div className="text-sm text-zinc-600">
                Start from a clean canvas.
              </div>
            </div>
          </button>

          {filteredTemplates.map((template) => (
            <button
              key={template.id}
              onClick={() => router.push(`/editor/${template.id}`)}
              className="group flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md"
            >
              <div>
                <div className="relative mb-3 w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 shadow-sm aspect-[210/297]">
                  <Image
                    src={`/templates/${template.id}.png`}
                    alt={`${template.title} preview`}
                    fill
                    className="object-cover"
                    sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 100vw"
                  />
                </div>
                <div className="text-lg font-semibold">{template.title}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  {template.category}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {template.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </section>

        <footer className="mt-16 text-center text-sm text-zinc-500">
          designed and powered by Studiosis
        </footer>
      </div>
    </main>
  );
}