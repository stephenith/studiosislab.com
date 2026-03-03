"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query as fsQuery,
  serverTimestamp,
  setDoc,
  doc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

import { TEMPLATES } from "@/data/templates";

type RecentDoc = {
  id: string;
  title?: string;
  templateId?: string;
  sourceTemplateId?: string;
  pageSize?: string;
  createdAt?: any;
  updatedAt?: any;
  thumbnail?: string;
  canvasJson?: any;
};

const KNOWN_TEMPLATE_IDS = new Set(TEMPLATES.map((t) => t.id).concat(["blank"]));

export default function ResumeRecentsPage() {
  const router = useRouter();

  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [recents, setRecents] = useState<RecentDoc[]>([]);
  const [recentsLoading, setRecentsLoading] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const authListenerAttachedRef = useRef(false);

  useEffect(() => {
    if (authListenerAttachedRef.current) return;
    authListenerAttachedRef.current = true;

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
      if (!u) router.replace("/login");
    });

    return () => {
      authListenerAttachedRef.current = false;
      unsub();
    };
  }, [router]);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (!user) return;
      try {
        if (!alive) return;
        setRecentsLoading(true);
        const q = fsQuery(
          collection(db, "users", user.uid, "resume_docs"),
          orderBy("updatedAt", "desc"),
          limit(20)
        );
        const snap = await getDocs(q);
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        })) as RecentDoc[];
        if (!alive) return;
        setRecents(items);
      } catch (e: any) {
        const msg = e?.message || "";
        if (e?.name === "AbortError" || msg.toLowerCase().includes("aborted")) {
          return;
        }
        console.warn("Failed to load recents:", e);
        if (!alive) return;
        setRecents([]);
      } finally {
        if (!alive) return;
        setRecentsLoading(false);
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [user]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('[data-menu-root="1"]')) return;
      setOpenMenuId(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const updateRecentTitle = useCallback((id: string, title: string) => {
    setRecents((prev) =>
      prev.map((r) => (r.id === id ? { ...r, title } : r))
    );
  }, []);

  const formatUpdated = (ts: any) => {
    try {
      const d: Date | null =
        ts?.toDate?.() instanceof Date
          ? ts.toDate()
          : ts instanceof Date
          ? ts
          : null;
      if (!d) return "";
      return d.toLocaleString(undefined, { day: "2-digit", month: "short" });
    } catch {
      return "";
    }
  };

  if (authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-zinc-700">
        Loading…
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50 to-white text-zinc-900">
      <div className="mx-auto w-full max-w-7xl px-6 py-16">
        <header className="text-center">
          <h1 className="text-3xl md:text-4xl font-semibold">
            Recent resumes
          </h1>
          <p className="mt-3 text-zinc-600">
            Your saved resumes, most recent first.
          </p>
        </header>

        <section className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {/* Create blank */}
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

          {recentsLoading ? (
            <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-sm">
              <div className="relative mb-3 w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 shadow-sm aspect-[210/297]" />
              <div className="h-5 w-40 rounded bg-zinc-100" />
              <div className="h-4 w-24 rounded bg-zinc-100" />
              <div className="text-xs text-zinc-500">Loading recent…</div>
            </div>
          ) : (
            recents.map((r) => {
              const fallbackTemplateId = String(
                r.sourceTemplateId || r.templateId || "blank"
              );
              const canUseStaticFallback =
                KNOWN_TEMPLATE_IDS.has(fallbackTemplateId);
              const isBlank = fallbackTemplateId === "blank";

              return (
                <div
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/editor/${r.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      router.push(`/editor/${r.id}`);
                    }
                  }}
                  className="group flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md"
                >
                  <div>
                    <div className="relative mb-3 w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 shadow-sm aspect-[210/297]">
                      <div
                        className="absolute right-2 top-2 z-10"
                        data-menu-root="1"
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setOpenMenuId((prev) =>
                              prev === r.id ? null : r.id
                            );
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-white text-lg leading-none text-zinc-700 shadow-sm hover:bg-zinc-50"
                          aria-label="Open menu"
                        >
                          ⋯
                        </button>
                        {openMenuId === r.id && (
                          <div className="absolute right-0 top-9 w-40 rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg">
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const current =
                                  r.title?.toString().trim() ||
                                  "Untitled Resume";
                                const next = window.prompt(
                                  "Rename resume",
                                  current
                                );
                                if (!next || !next.trim()) return;
                                if (!user) return;
                                await setDoc(
                                  doc(
                                    db,
                                    "users",
                                    user.uid,
                                    "resume_docs",
                                    r.id
                                  ),
                                  {
                                    title: next.trim(),
                                    updatedAt: serverTimestamp(),
                                  },
                                  { merge: true }
                                );
                                updateRecentTitle(r.id, next.trim());
                                setOpenMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-zinc-50"
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!user) return;
                                const srcRef = doc(
                                  db,
                                  "users",
                                  user.uid,
                                  "resume_docs",
                                  r.id
                                );
                                const srcSnap = await getDoc(srcRef);
                                if (!srcSnap.exists()) return;
                                const srcData = srcSnap.data() as any;
                                const baseTitle = (
                                  srcData?.title ||
                                  r.title ||
                                  "Untitled Resume"
                                )
                                  .toString()
                                  .trim();
                                const newTitle = `Copy - ${baseTitle}`;
                                const tpl = String(
                                  srcData?.sourceTemplateId ||
                                    srcData?.templateId ||
                                    r.sourceTemplateId ||
                                    r.templateId ||
                                    "blank"
                                );
                                const newId =
                                  typeof crypto !== "undefined" &&
                                  crypto.randomUUID
                                    ? crypto.randomUUID()
                                    : String(Date.now());
                                const payload: any = {
                                  ...srcData,
                                  title: newTitle,
                                  templateId: tpl,
                                  sourceTemplateId: tpl,
                                  createdAt: serverTimestamp(),
                                  updatedAt: serverTimestamp(),
                                };
                                await setDoc(
                                  doc(
                                    db,
                                    "users",
                                    user.uid,
                                    "resume_docs",
                                    newId
                                  ),
                                  payload,
                                  { merge: false }
                                );
                                setRecents((prev) => {
                                  const local = {
                                    id: newId,
                                    ...payload,
                                    createdAt: new Date(),
                                    updatedAt: new Date(),
                                  };
                                  return [
                                    local,
                                    ...prev.filter((x) => x.id !== newId),
                                  ].slice(0, 20);
                                });
                                setOpenMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-zinc-50"
                            >
                              Duplicate
                            </button>
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!window.confirm("Delete this resume?")) return;
                                if (!user) return;
                                await deleteDoc(
                                  doc(
                                    db,
                                    "users",
                                    user.uid,
                                    "resume_docs",
                                    r.id
                                  )
                                );
                                setRecents((prev) =>
                                  prev.filter((x) => x.id !== r.id)
                                );
                                setOpenMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left text-red-600 hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                      {r.thumbnail ? (
                        <img
                          src={r.thumbnail}
                          alt="Recent resume thumbnail"
                          className="h-full w-full object-cover"
                        />
                      ) : isBlank ? (
                        <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500">
                          Saved (blank)
                        </div>
                      ) : canUseStaticFallback && !isBlank ? (
                        <Image
                          src={`/templates/${fallbackTemplateId}.png`}
                          alt="Recent resume preview"
                          fill
                          className="object-cover"
                          sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 100vw"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500">
                          Preview unavailable
                        </div>
                      )}
                    </div>

                    <div className="text-sm font-semibold leading-tight truncate">
                      {r.title?.toString()?.trim() ? r.title : "Untitled Resume"}
                    </div>
                    <div className="mt-0.5 text-[11px] text-zinc-500">
                      Recent • {formatUpdated(r.updatedAt) || "—"}
                    </div>
                  </div>

                </div>
              );
            })
          )}
        </section>

        <footer className="mt-16 text-center text-sm text-zinc-500">
          designed and powered by Studiosis
        </footer>
      </div>
    </main>
  );
}
