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

function PdfThumbnail({ url }: { url?: string | null }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    console.log("[PdfThumbnail] URL =", url);

    if (!url) {
      const container = containerRef.current;
      if (container) {
        container.innerHTML = "";
      }
      return;
    }

    let cancelled = false;

    async function renderThumbnail() {
      try {
        const container = containerRef.current;
        if (!container) return;

        console.log("[PdfThumbnail] starting render for", url);

        // Dynamically import pdf.js legacy build, same as the main viewer
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - pdfjs-dist ships no types for this legacy entry
        const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf");

        (pdfjsLib as any).GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

        console.log("[PdfThumbnail] pdfjs loaded");

        console.log("[PdfThumbnail] loading document", url);

        const loadingTask = (pdfjsLib as any).getDocument(url);
        const pdf = await loadingTask.promise;

        console.log("[PdfThumbnail] PDF loaded");

        if (cancelled) return;

        const page = await pdf.getPage(1);

        console.log("[PdfThumbnail] page 1 ready");

        const viewport = page.getViewport({ scale: 1 });

        const rect = container.getBoundingClientRect();

        console.log("[PdfThumbnail] container width", rect.width);

        const targetWidth = rect.width || viewport.width;

        const scale = targetWidth / viewport.width;

        const scaledViewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");

        const context = canvas.getContext("2d");

        if (!context) return;

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        container.innerHTML = "";

        container.appendChild(canvas);

        await page.render({
          canvasContext: context,
          viewport: scaledViewport,
        }).promise;

        console.log("[PdfThumbnail] render finished");

      } catch (err) {
        console.warn("Failed to render PDF thumbnail", err);
      }
    }

    renderThumbnail();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div
      ref={containerRef}
      className="relative mb-1 w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 shadow-sm aspect-[210/297]"
    />
  );
}

export default function EsignToolsPage() {
  const router = useRouter();
  const { user, loading } = useAuthUser();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [recents, setRecents] = useState<EsignDocumentWithId[]>([]);
  const [recentsLoading, setRecentsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const loadedRef = useRef(false);

  // Verify Existing Agreement (Phase 1: verification ID only)
  const [verificationIdInput, setVerificationIdInput] = useState("");
  const [verifyFile, setVerifyFile] = useState<File | null>(null);
  const [extractingVerifyCode, setExtractingVerifyCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyResult, setVerifyResult] = useState<"success" | "failure" | null>(null);
  const [verifyDetails, setVerifyDetails] = useState<{
    verificationId: string;
    documentId: string;
    fileName?: string | null;
    senderEmail: string;
    recipientEmail: string;
    completedAt: string;
    recipientIp: string;
  } | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const verifyFileInputRef = useRef<HTMLInputElement | null>(null);

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
          orderBy("updatedAt", "desc"),
          limit(20)
        );
        const snap = await getDocs(q);
        console.log("Recent agreements snapshot:", snap.docs.length);
        const items: EsignDocumentWithId[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            ownerUid: data.ownerUid,
            fileName: data.fileName ?? "Untitled document",
            status: data.status ?? "draft",
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
            finalPdfUrl: data.finalPdfUrl ?? null,
            pagesCount: data.pagesCount ?? null,
          };
        });
        console.log("Recent agreements items:", items);
        setRecents(items);
      } catch (e) {
        console.warn("Failed to load recent e-sign documents", e);
        if (!alive) return;
        setRecents([]);
      } finally {
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

  const handleCloseVerifyModal = () => {
    setShowVerifyModal(false);
    setVerificationIdInput("");
    setVerifyFile(null);
    setExtractingVerifyCode(false);
    setVerifyResult(null);
    setVerifyDetails(null);
    setVerifyError(null);
    if (verifyFileInputRef.current) {
      verifyFileInputRef.current.value = "";
    }
  };

  async function verifyById(id: string) {
    const trimmed = id.trim();
    if (!trimmed) {
      setVerifyResult("failure");
      setVerifyError("Please enter a verification code.");
      setVerifyDetails(null);
      setShowVerifyModal(true);
      return;
    }
    try {
      setVerifying(true);
      const res = await fetch("/api/esign/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationId: trimmed }),
      });
      const json = await res.json();
      if (json?.ok) {
        setVerifyResult("success");
        setVerifyDetails({
          verificationId: json.verificationId ?? trimmed,
          documentId: json.documentId ?? "",
          fileName: json.fileName ?? null,
          senderEmail: json.senderEmail ?? "",
          recipientEmail: json.recipientEmail ?? "",
          completedAt: json.completedAt ?? "",
          recipientIp: json.recipientIp ?? "",
        });
        setVerifyError(null);
      } else {
        setVerifyResult("failure");
        setVerifyError(json?.error ?? "Invalid verification code or no matching agreement found.");
        setVerifyDetails(null);
      }
      setShowVerifyModal(true);
    } catch {
      setVerifyResult("failure");
      setVerifyError("Verification failed. Please try again.");
      setVerifyDetails(null);
      setShowVerifyModal(true);
    } finally {
      setVerifying(false);
    }
  }

  const handleVerify = async () => {
    await verifyById(verificationIdInput.trim());
  };

  const handleVerifyFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;

    console.log("Uploaded file:", file);
    console.log("File type:", file?.type);
    console.log("File name:", file?.name);

    async function parsePdf(file: File): Promise<string | null> {
      console.log("Starting PDF parsing...");

      const pdfjsLib: any = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

      const data = new Uint8Array(await file.arrayBuffer());
      const loadingTask = pdfjsLib.getDocument({ data });
      const pdf = await loadingTask.promise;

      const uuidRegex =
        /[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}/i;
      let extractedId: string | null = null;

      for (let pageNum = pdf.numPages; pageNum >= 1; pageNum--) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const items = textContent.items as any[];

        console.log(
          "[Verify PDF] Page",
          pageNum,
          "TEXT ITEMS:",
          items.map((it) => it?.str)
        );
        const pageText = items.map((it) => it?.str ?? "").join(" ");
        console.log("[Verify PDF] Page", pageNum, "PAGE TEXT:", pageText);

        const labelIndex = items.findIndex(
          (it) =>
            typeof it?.str === "string" &&
            it.str.toLowerCase().includes("verification id")
        );
        if (labelIndex === -1) continue;

        const afterLabel = items
          .slice(labelIndex + 1, labelIndex + 12)
          .map((it) => it?.str ?? "");
        const combined = afterLabel.join("");
        const normalized = combined.replace(/\s+/g, "");

        const match = normalized.match(uuidRegex);
        if (match?.[0]) {
          extractedId = match[0];
          break;
        }
      }

      return extractedId;
    }

    setExtractingVerifyCode(true);
    parsePdf(file)
      .then((extractedId) => {
        setVerifyFile(file);
        if (extractedId) {
          setVerificationIdInput(extractedId);
          setVerifyError(null);
        } else {
          setVerificationIdInput("");
          setVerifyError("Verification code could not be extracted from this PDF.");
        }
      })
      .catch((err) => {
        console.error("[Verify PDF] Parsing error:", err);
        setVerifyFile(file);
        setVerificationIdInput("");
        setVerifyError("Verification code could not be extracted from this PDF.");
      })
      .finally(() => {
        setExtractingVerifyCode(false);
      });
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
          updatedAt: serverTimestamp(),
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

  const formatDate = (ts: any, withYear = false) => {
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
        ...(withYear && { year: "numeric" }),
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

        <section className="mt-10 flex flex-col items-center">
          <div className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-medium text-zinc-800 mb-3">
              Verify Existing Agreement
            </div>
            <p className="text-xs text-zinc-600 mb-3">
              Upload the signed PDF you want to verify or enter the verification code.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-stretch">
              <input
                type="text"
                value={verificationIdInput}
                onChange={(e) => setVerificationIdInput(e.target.value)}
                placeholder="Verification code"
                className="flex-1 min-w-0 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-500 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => verifyFileInputRef.current?.click()}
                  className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:border-blue-400"
                >
                  Browse
                </button>
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={verifying}
                  className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {verifying ? "Verifying…" : "Verify"}
                </button>
              </div>
            </div>
            {verifyFile && (
              <p className="mt-2 text-xs text-zinc-500 truncate">
                File selected: {verifyFile.name} —{" "}
                {verifyFile.type === "application/pdf" && extractingVerifyCode
                  ? "extracting verification code..."
                  : verificationIdInput.trim()
                    ? "verification code extracted"
                    : "verification code not found in this document"}
              </p>
            )}
            {verifyFile?.type === "application/pdf" && !extractingVerifyCode && verifyError && (
              <p className="mt-2 text-xs text-amber-700">
                {verifyError}
              </p>
            )}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-semibold">Recent Agreements</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Your e-sign documents. Click to open and continue.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {recentsLoading ? (
              <div className="col-span-full text-sm text-zinc-500">
                Loading…
              </div>
            ) : recents.length === 0 ? (
              <div className="col-span-full text-sm text-zinc-500">
                No agreements yet. Upload a document to get started.
              </div>
            ) : (
              recents.map((docItem) => {
                const dateLabel = formatDate(docItem.updatedAt ?? docItem.createdAt, true);
                const status =
                  docItem.status === "completed"
                    ? "completed"
                    : docItem.status === "waiting_countersign"
                    ? "waiting_countersign"
                    : docItem.status === "pending_client"
                    ? "pending"
                    : "draft";
                const statusBadge =
                  status === "completed"
                    ? { label: "Completed", class: "bg-green-100 text-green-800" }
                    : status === "waiting_countersign"
                    ? { label: "Waiting for Countersign", class: "bg-amber-100 text-amber-800" }
                    : status === "pending"
                    ? { label: "Pending", class: "bg-amber-100 text-amber-800" }
                    : { label: "Draft", class: "bg-zinc-200 text-zinc-700" };

                return (
                  <button
                    key={docItem.id}
                    type="button"
                    onClick={() => router.push(`/tools/esign/${docItem.id}`)}
                    className="group flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md"
                  >
                    <PdfThumbnail
                      url={
                        status === "completed"
                          ? `/api/esign/download?documentId=${docItem.id}&final=1`
                          : `/api/esign/download?documentId=${docItem.id}`
                      }
                    />
                    <div className="text-sm font-semibold leading-tight truncate">
                      {docItem.fileName}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
                      <span className={`inline-flex rounded-full px-1.5 py-0.5 font-medium ${statusBadge.class}`}>
                        {statusBadge.label}
                      </span>
                      {dateLabel && <span>{dateLabel}</span>}
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
      <input
        ref={verifyFileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleVerifyFileChange}
      />

      {showVerifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
            <div className="flex flex-col items-center text-center">
              {verifyResult === "success" ? (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </div>
                  <h2 className="mt-4 text-lg font-semibold text-zinc-900">Agreement Verified</h2>
                  {verifyDetails && (
                    <div className="mt-3 w-full text-left text-sm text-zinc-600 space-y-1">
                      <p><span className="font-medium text-zinc-700">Verification ID:</span> {verifyDetails.verificationId}</p>
                      <p><span className="font-medium text-zinc-700">Document ID:</span> {verifyDetails.documentId}</p>
                      {verifyDetails.fileName && <p><span className="font-medium text-zinc-700">File:</span> {verifyDetails.fileName}</p>}
                      <p><span className="font-medium text-zinc-700">Sender:</span> {verifyDetails.senderEmail}</p>
                      <p><span className="font-medium text-zinc-700">Recipient:</span> {verifyDetails.recipientEmail}</p>
                      {verifyDetails.completedAt && <p><span className="font-medium text-zinc-700">Completed:</span> {verifyDetails.completedAt}</p>}
                      {verifyDetails.recipientIp && <p><span className="font-medium text-zinc-700">Signer IP:</span> {verifyDetails.recipientIp}</p>}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </div>
                  <h2 className="mt-4 text-lg font-semibold text-zinc-900">Agreement Not Verified</h2>
                  <p className="mt-2 text-sm text-zinc-600">
                    {verifyError ?? "Invalid verification code or no matching agreement found."}
                  </p>
                </>
              )}
              <button
                type="button"
                onClick={handleCloseVerifyModal}
                className="mt-6 rounded-lg bg-black px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
