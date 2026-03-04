"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query as fsQuery,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthUser } from "@/lib/useAuthUser";
import type { EsignDocumentWithId } from "@/lib/esign";

export default function EsignToolsPage() {
  const router = useRouter();
  const { user, loading } = useAuthUser();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [recents, setRecents] = useState<EsignDocumentWithId[]>([]);
  const [recentsLoading, setRecentsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || recentsLoading || loadedRef.current) return;
    loadedRef.current = true;

    let alive = true;
    const load = async () => {
      try {
        setRecentsLoading(true);
        const q = fsQuery(
          collection(db, "esign_documents"),
          where("ownerUid", "==", user.uid),
          orderBy("createdAt", "desc"),
          limit(20)
        );
        const snap = await getDocs(q);
        if (!alive) return;
        const items: EsignDocumentWithId[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            ownerUid: data.ownerUid,
            fileName: data.fileName ?? "Untitled document",
            status: data.status ?? "draft",
            createdAt: data.createdAt ?? null,
            finalPdfUrl: data.finalPdfUrl ?? null,
            pagesCount: data.pagesCount ?? null,
          };
        });
        setRecents(items);
      } catch (e) {
        console.warn("Failed to load recent e-sign documents", e);
        if (!alive) return;
        setRecents([]);
      } finally {
        if (!alive) return;
        setRecentsLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, [user, recentsLoading]);

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setSelectedFile(null);
      return;
    }
    const name = file.name || "";
    const lower = name.toLowerCase();
    const ok =
      lower.endsWith(".pdf") ||
      lower.endsWith(".doc") ||
      lower.endsWith(".docx");
    if (!ok) {
      alert("Please upload a PDF or Word document (.pdf, .doc, .docx).");
      e.target.value = "";
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };

  const handleProceed = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (!selectedFile) {
      alert("Please select a document first.");
      return;
    }

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/esign/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();

      if (!res.ok || !json?.ok) {
        const message = json?.error || "Upload failed";
        alert(message);
        return;
      }

      const documentId: string = json.documentId;
      const originalFilename: string =
        json.originalFilename || selectedFile.name || "Document";

      const ref = doc(db, "esign_documents", documentId);
      await setDoc(
        ref,
        {
          id: documentId,
          ownerUid: user.uid,
          fileName: originalFilename,
          status: "draft",
          createdAt: serverTimestamp(),
          finalPdfUrl: null,
          pagesCount: 0,
        },
        { merge: true }
      );

      router.push(`/tools/esign/${documentId}`);
    } catch (e) {
      alert("Something went wrong while uploading. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  if (loading || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center text-zinc-700">
        Loading…
      </main>
    );
  }

  const selectedLabel = selectedFile?.name || "Select file...";

  const formatDate = (ts: any) => {
    try {
      const d: Date | null =
        ts?.toDate?.() instanceof Date
          ? ts.toDate()
          : ts instanceof Date
          ? ts
          : null;
      if (!d) return "";
      return d.toLocaleString(undefined, {
        day: "2-digit",
        month: "short",
      });
    } catch {
      return "";
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50 to-white text-zinc-900">
      <div className="mx-auto w-full max-w-5xl px-6 py-12">
        <header className="text-center">
          <h1 className="text-2xl md:text-3xl font-semibold">
            E-Signing Tool
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Upload a document to start a digital signing flow.
          </p>
        </header>

        <section className="mt-10 flex flex-col items-center">
          <div className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-medium text-zinc-800 mb-3">
              Document
            </div>
            <div className="flex items-stretch rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1 shadow-sm">
              <div className="flex-1 flex items-center gap-2 px-2">
                <span className="text-sm text-zinc-500 truncate">
                  {selectedLabel}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBrowseClick}
                  className="rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-sm font-medium text-zinc-800 hover:border-blue-400"
                >
                  Browse
                </button>
                <button
                  type="button"
                  onClick={handleProceed}
                  disabled={uploading || !selectedFile}
                  className="rounded-full bg-black px-5 py-1.5 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {uploading ? "Uploading..." : "Proceed"}
                </button>
              </div>
            </div>

            <p className="mt-2 text-xs text-zinc-600">
              Please upload the document which needs to be signed. Only PDF or
              Word format supported.
            </p>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-semibold">Recent Documents</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {recentsLoading ? (
              <div className="col-span-full text-sm text-zinc-500">
                Loading…
              </div>
            ) : recents.length === 0 ? (
              <div className="col-span-full text-sm text-zinc-500">
                No e-sign documents yet. Upload a document to get started.
              </div>
            ) : (
              recents.map((docItem) => {
                const dateLabel = formatDate(docItem.createdAt);
                const statusLabel =
                  docItem.status === "completed"
                    ? "Completed"
                    : docItem.status === "pending_client"
                    ? "Pending"
                    : "Draft";

                return (
                  <button
                    key={docItem.id}
                    type="button"
                    onClick={() => router.push(`/tools/esign/${docItem.id}`)}
                    className="group flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md"
                  >
                    <div className="relative mb-1 w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 shadow-sm aspect-[210/297]" />
                    <div className="text-sm font-semibold leading-tight truncate">
                      {docItem.fileName}
                    </div>
                    <div className="mt-0.5 text-[11px] text-zinc-500">
                      {statusLabel}
                      {dateLabel && ` • ${dateLabel}`}
                    </div>
                    <span className="mt-1 text-xs font-medium text-blue-600">
                      Open
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </section>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        className="hidden"
        onChange={handleFileChange}
      />
    </main>
  );
}
