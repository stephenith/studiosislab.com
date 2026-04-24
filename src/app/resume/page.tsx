"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

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
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/useAuth";

import NoiseBackground from "@/components/home/NoiseBackground";
import { TEMPLATES, CATEGORIES } from "@/data/templates";

/** Thumbnail frame: subtle shadow + light ring (no heavy outer card). */
const THUMB_FRAME =
  "relative w-full overflow-hidden rounded-xl bg-zinc-100 aspect-[210/297] shadow-[0_4px_16px_-6px_rgba(0,0,0,0.14)] ring-1 ring-zinc-200/80 transition-shadow duration-200 group-hover:shadow-[0_8px_22px_-8px_rgba(0,0,0,0.18)]";

/** Same column breakpoints as templates; narrower max width shrinks strip tiles ~¼ vs full 7xl row. */
const RECENTS_STRIP_GRID =
  "grid w-full grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-7 lg:grid-cols-4 xl:grid-cols-5";

const TEMPLATE_GALLERY_GRID =
  "grid w-full grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";

type RecentDoc = {
  id: string;
  title?: string;
  templateId?: string;
  sourceTemplateId?: string;
  pageSize?: string;
  createdAt?: any;
  updatedAt?: any;

  // saved thumbnail (dataURL) from Firestore
  thumbnail?: string;
  canvasJson?: any;
};

export default function ResumeTemplatesPage() {
  const router = useRouter();
  const { user, authReady } = useAuth();

  const [queryText, setQueryText] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");

  const [recents, setRecents] = useState<RecentDoc[]>([]);
  const [recentsLoading, setRecentsLoading] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      router.replace("/login");
    }
  }, [authReady, user, router]);

  // Load recents
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
          limit(4)
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

  const filteredTemplates = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    return TEMPLATES.filter((t) => {
      const matchesCategory = category === "All" || t.category === category;
      if (!matchesCategory) return false;
      if (!q) return true;
      const hay = `${t.id} ${t.title} ${t.category} ${t.tags.join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [queryText, category]);

  const isSearching = queryText.trim().length > 0;

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

  // allow only known static template ids for fallback
  const KNOWN_TEMPLATE_IDS = new Set(
    TEMPLATES.map((t) => t.id).concat(["blank"])
  );

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('[data-menu-root="1"]')) return;
      setOpenMenuId(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const updateRecentTitle = useCallback(
    (id: string, title: string) => {
      setRecents((prev) =>
        prev.map((r) => (r.id === id ? { ...r, title } : r))
      );
    },
    []
  );

  if (!authReady) {
    return (
      <main className="min-h-screen flex items-center justify-center text-zinc-700">
        Loading…
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="relative min-h-dvh w-full bg-white px-5 pb-20 pt-10 text-zinc-900 sm:pt-12">
      <NoiseBackground />
      <div className="relative z-10 mx-auto w-full max-w-7xl">
        <header className="px-1 pt-2 text-center sm:px-2 sm:pt-4">
          <h1 className="mx-auto max-w-4xl font-heading text-xl font-medium leading-[1.08] tracking-tight text-zinc-900 sm:text-2xl md:text-3xl lg:text-4xl">
            Type your role, pick a <span className="text-violet-600">design</span>, and shine.
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-sm text-zinc-600 sm:text-base">
            Casual but clear — guides users smoothly.
          </p>
        </header>

        <div className="mx-auto mt-10 flex w-full max-w-2xl flex-col items-center gap-3 sm:mt-12 sm:gap-3.5">
          <input
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Search by title, category, or tags…"
            aria-label="Search templates"
            className="w-full max-w-md rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-left text-sm text-zinc-900 shadow-sm outline-none ring-zinc-900/5 transition placeholder:text-zinc-400 focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-violet-500/15"
          />

          <div className="flex w-full max-w-xl flex-wrap justify-center gap-2 px-1">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  category === c
                    ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
                    : "border-zinc-200 bg-white/90 text-zinc-700 shadow-sm hover:border-zinc-300 hover:bg-zinc-50"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {!isSearching && (
          <div className="mt-12 flex items-center justify-between gap-3 sm:mt-14">
            <h2 className="text-lg font-semibold tracking-tight">Recent resumes</h2>
            <button
              type="button"
              onClick={() => router.push("/resume/recents")}
              className="shrink-0 text-sm font-medium text-zinc-700 underline-offset-4 transition-colors hover:text-zinc-900 hover:underline"
            >
              View all
            </button>
          </div>
        )}

        {!isSearching && (
          <section
            className={`${RECENTS_STRIP_GRID} mx-auto mt-8 max-w-[60rem] sm:mt-10`}
            aria-label="Recent resumes and create blank"
          >
            {/* Create blank */}
            <button
              type="button"
              onClick={() => router.push("/editor/new")}
              className="group flex w-full flex-col gap-1.5 border-0 bg-transparent p-0 text-left shadow-none outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              <div
                className={`${THUMB_FRAME} flex items-center justify-center border border-dashed border-zinc-300/90 bg-zinc-50/80 text-2xl font-semibold text-zinc-400 transition-colors group-hover:border-zinc-400 group-hover:text-zinc-600 sm:text-3xl`}
              >
                +
              </div>
              <div className="min-w-0 pt-0.5">
                <div className="text-xs font-semibold leading-tight text-zinc-900 sm:text-sm">Create blank</div>
                <div className="mt-0.5 text-[11px] text-zinc-500 sm:text-xs">Start from a clean canvas.</div>
              </div>
            </button>

            {/* Recents */}
            {recentsLoading ? (
              <div className="flex flex-col gap-1.5">
                <div className={`${THUMB_FRAME} animate-pulse bg-zinc-100`} />
                <div className="h-3.5 w-28 max-w-full rounded bg-zinc-100" />
                <div className="h-3 w-16 max-w-full rounded bg-zinc-100" />
                <div className="text-[11px] text-zinc-500">Loading recent…</div>
              </div>
            ) : (
                recents.map((r) => {
                  const fallbackTemplateId = String(
                    r.sourceTemplateId || r.templateId || "blank"
                  );
                  const canUseStaticFallback = KNOWN_TEMPLATE_IDS.has(
                    fallbackTemplateId
                  );
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
                      className="group flex w-full cursor-pointer flex-col gap-1.5 border-0 bg-transparent p-0 text-left outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-zinc-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    >
                      <div className={THUMB_FRAME}>
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
                                    const current = r.title?.toString().trim() || "Untitled Resume";
                                    const next = window.prompt("Rename resume", current);
                                    if (!next || !next.trim()) return;
                                    if (!user) return;
                                    await setDoc(
                                      doc(db, "users", user.uid, "resume_docs", r.id),
                                      { title: next.trim(), updatedAt: serverTimestamp() },
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
                                      typeof crypto !== "undefined" && crypto.randomUUID
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
                                      doc(db, "users", user.uid, "resume_docs", newId),
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
                                      return [local, ...prev.filter((x) => x.id !== newId)].slice(0, 4);
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
                                      doc(db, "users", user.uid, "resume_docs", r.id)
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
                            // Use <img> for dataURL (no Next config needed)
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

                      <div className="min-w-0 pt-0.5">
                        <div className="text-xs font-semibold leading-tight text-zinc-900 truncate sm:text-sm">
                          {r.title?.toString()?.trim() ? r.title : "Untitled Resume"}
                        </div>
                        <div className="mt-0.5 text-[10px] text-zinc-500 sm:text-[11px]">
                          Recent • {formatUpdated(r.updatedAt) || "—"}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
          </section>
        )}

        <section
          className={`${TEMPLATE_GALLERY_GRID} ${isSearching ? "mt-10 sm:mt-12" : "mt-12 sm:mt-14"}`}
          aria-label="Resume templates"
        >
          {filteredTemplates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => router.push(`/editor/${template.id}`)}
              className="group flex w-full flex-col gap-2 border-0 bg-transparent p-0 text-left shadow-none outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              <div className={THUMB_FRAME}>
                <Image
                  src={`/templates/${template.id}.png`}
                  alt={`${template.title} preview`}
                  fill
                  className="object-cover"
                  sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 100vw"
                  priority={template.id === filteredTemplates[0]?.id}
                  loading={
                    template.id === filteredTemplates[0]?.id
                      ? "eager"
                      : "lazy"
                  }
                />
              </div>
              <div className="min-w-0 pt-0.5">
                <div className="text-sm font-semibold leading-tight text-zinc-900">{template.title}</div>
                <div className="mt-0.5 text-xs text-zinc-500">{template.category}</div>
              </div>
            </button>
          ))}
        </section>

        <footer className="mt-20 text-center text-sm text-zinc-500">
          designed and powered by Studiosis
        </footer>
      </div>
    </main>
  );
}
