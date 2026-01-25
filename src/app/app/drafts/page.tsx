"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TEMPLATE_EDITOR_CONFIG } from "../../../data/templates";

type DraftRecord = {
  storageKey: string;
  templateId: string;
  updatedAt: number;
  pageCount: number;
  pageIndex: number;
};

const PREFIX = "studiosislab:draft:";

export default function DraftsPage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<DraftRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  const templateMeta = useMemo(() => TEMPLATE_EDITOR_CONFIG || {}, []);

  const loadDrafts = () => {
    if (typeof window === "undefined") return;

    const out: DraftRecord[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(PREFIX)) continue;

        const raw = localStorage.getItem(k);
        if (!raw) continue;

        let parsed: any = null;
        try {
          parsed = JSON.parse(raw);
        } catch {
          continue;
        }

        const templateId = String(parsed?.templateId || k.replace(PREFIX, "") || "");
        const pages = Array.isArray(parsed?.pages) ? parsed.pages : [];
        if (!templateId || pages.length === 0) continue;

        out.push({
          storageKey: k,
          templateId,
          updatedAt: Number(parsed?.updatedAt || parsed?.savedAt || 0),
          pageCount: pages.length,
          pageIndex: typeof parsed?.pageIndex === "number" ? parsed.pageIndex : 0,
        });
      }
    } catch {}

    out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    setDrafts(out);
    setLoaded(true);
  };

  // ✅ Helpers (Step 12.3B)
  const deleteDraft = (storageKey: string) => {
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    loadDrafts();
  };

  const clearAllDrafts = () => {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX)) localStorage.removeItem(k);
      }
    } catch {}
    loadDrafts();
  };

  const formatTime = (ts?: number) => {
    if (!ts) return "—";
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return "—";
    }
  };

  useEffect(() => {
    loadDrafts();
  }, []);

  const openDraft = (templateId: string) => {
    router.push(`/app/editor/${templateId}`);
  };

  return (
    <main className="p-6">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex gap-2 items-center">
          <button onClick={() => router.back()} className="border px-3 py-1 rounded">
            Back
          </button>
          <div className="text-sm text-zinc-600">My Drafts</div>
        </div>

        <div className="flex gap-2 items-center">
          <button
            onClick={loadDrafts}
            className="border px-3 py-1 rounded"
            title="Reload drafts"
          >
            Refresh
          </button>

          <button
            onClick={() => {
              const ok = window.confirm("Delete ALL drafts? This cannot be undone.");
              if (ok) clearAllDrafts();
            }}
            className="border px-3 py-1 rounded"
            title="Delete all drafts"
          >
            Clear All
          </button>
        </div>
      </div>

      {!loaded ? (
        <div className="text-sm text-zinc-600">Loading…</div>
      ) : drafts.length === 0 ? (
        <div className="text-sm text-zinc-600">
          No drafts found yet. Open any template, edit something, and it will auto-save.
        </div>
      ) : (
        <div className="grid gap-3">
          {drafts.map((d) => {
            const meta: any = (templateMeta as any)[d.templateId];
            const title = meta?.name || meta?.title || `Template ${d.templateId}`;

            return (
              <div
                key={d.storageKey}
                className="border rounded-lg p-4 bg-white flex items-center justify-between gap-4 flex-wrap"
              >
                <div className="min-w-[260px]">
                  <div className="font-semibold">{title}</div>
                  <div className="text-sm text-zinc-600">
                    ID: {d.templateId} • Pages: {d.pageCount} • Last: {formatTime(d.updatedAt)}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    className="bg-black text-white px-3 py-1 rounded"
                    onClick={() => openDraft(d.templateId)}
                  >
                    Open
                  </button>

                  <button
                    className="border px-3 py-1 rounded"
                    onClick={() => {
                      const ok = window.confirm("Delete this draft?");
                      if (ok) deleteDraft(d.storageKey);
                    }}
                    title="Deletes this draft from localStorage"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}