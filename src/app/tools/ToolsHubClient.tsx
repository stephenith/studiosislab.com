"use client";

import Image from "next/image";
import Link from "next/link";
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
  Timestamp,
  where,
} from "firebase/firestore";
import HomeHeaderAuth from "@/components/HomeHeaderAuth";
import NoiseBackground from "@/components/home/NoiseBackground";
import { HOME_LOGOS_LIGHT } from "@/components/home/homeLogoAssets";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/useAuth";
import { trackEvent, uploadSizeBucket } from "@/lib/analytics";
import { getLoginRedirectUrl } from "@/lib/safeNextPath";

const IS_DEV = process.env.NODE_ENV !== "production";
const MAX_ESIGN_PDF_BYTES = 50 * 1024 * 1024;

function devLog(...args: unknown[]) {
  if (IS_DEV) globalThis["console"].log(...args);
}

function devWarn(...args: unknown[]) {
  if (IS_DEV) globalThis["console"].warn(...args);
}

type RecentAgreementItem = {
  id: string;
  ownerUid: string;
  fileName: string;
  status: string;
  createdAt?: Timestamp | Date | null;
  updatedAt?: Timestamp | Date | null;
  finalPdfUrl?: string | null;
  pagesCount?: number | null;
  countersignStatus?: string | null;
  auditId?: string | null;
};

function PdfThumbnail({ url }: { url?: string | null }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [phase, setPhase] = useState<"idle" | "loading" | "ready" | "unavailable">(
    () => (url ? "loading" : "unavailable")
  );

  useEffect(() => {
    let cancelled = false;

    if (!url) {
      setPhase("unavailable");
      return;
    }

    const safeUrl: string = url;

    setPhase("loading");

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width || 0, canvas.height || 0);
      }
      canvas.width = 0;
      canvas.height = 0;
    }

    async function probeLooksLikePdf(u: string) {
      // Small ranged read: enough to validate PDF magic without downloading the full file twice.
      try {
        const res = await fetch(u, {
          headers: { Range: "bytes=0-1023" },
          cache: "no-store",
        });
        if (!res.ok) return false;
        const buf = await res.arrayBuffer();
        const prefix = new TextDecoder().decode(new Uint8Array(buf).slice(0, 5));
        return prefix.startsWith("%PDF");
      } catch {
        return false;
      }
    }

    async function renderThumbnail() {
      try {
        const wrap = wrapRef.current;
        const canvas = canvasRef.current;
        if (!wrap || !canvas) return;

        const ok = await probeLooksLikePdf(safeUrl);
        if (cancelled) return;
        if (!ok) {
          setPhase("unavailable");
          return;
        }

        // Dynamically import pdf.js legacy build, same as the main viewer
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - pdfjs-dist ships no types for this legacy entry
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (pdfjsLib as any).GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const loadingTask = (pdfjsLib as any).getDocument(safeUrl);
        const pdf = await loadingTask.promise;

        if (cancelled) return;

        const page = await pdf.getPage(1);

        const viewport = page.getViewport({ scale: 1 });

        const rect = wrap.getBoundingClientRect();

        const targetWidth = rect.width || viewport.width;

        const scale = targetWidth / viewport.width;

        const scaledViewport = page.getViewport({ scale });

        const context = canvas.getContext("2d");

        if (!context) {
          setPhase("unavailable");
          return;
        }

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        await page.render({
          canvasContext: context,
          viewport: scaledViewport,
        }).promise;

        if (cancelled) return;
        setPhase("ready");
      } catch {
        if (cancelled) return;
        // Expected for stale/missing artifacts — keep console quiet.
        setPhase("unavailable");
      }
    }

    void renderThumbnail();

    return () => {
      cancelled = true;
      const c = canvasRef.current;
      if (c) {
        const ctx = c.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, c.width || 0, c.height || 0);
        c.width = 0;
        c.height = 0;
      }
    };
  }, [url]);

  return (
    <div
      ref={wrapRef}
      className="relative mb-1 w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 shadow-sm aspect-[210/297]"
    >
      {(phase === "loading" || phase === "unavailable") && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 bg-zinc-100 px-3 text-center">
          {phase === "loading" ? (
            <div className="h-6 w-6 animate-pulse rounded-full bg-zinc-300" />
          ) : (
            <>
              <div className="text-[11px] font-medium text-zinc-600">
                Preview unavailable
              </div>
              <div className="text-[10px] text-zinc-500 leading-snug">
                This agreement preview could not be loaded.
              </div>
            </>
          )}
        </div>
      )}
      <canvas ref={canvasRef} className="block h-full w-full bg-white" />
    </div>
  );
}

export default function EsignToolsPage() {
  const router = useRouter();
  const { user, authReady } = useAuth();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [recents, setRecents] = useState<RecentAgreementItem[]>([]);
  const [recentsLoading, setRecentsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmDocumentId, setDeleteConfirmDocumentId] = useState<string | null>(
    null
  );
  const [deleteConfirmFileName, setDeleteConfirmFileName] = useState<string | null>(null);
  const [deleteModalError, setDeleteModalError] = useState<string | null>(null);
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
  const [hubNotice, setHubNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      router.replace(getLoginRedirectUrl());
    }
  }, [authReady, user, router]);

  useEffect(() => {
    if (!authReady || !user || recentsLoading || loadedRef.current) return;
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
        const items: RecentAgreementItem[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const ownerUid = typeof data.ownerUid === "string" ? data.ownerUid : "";
          const fileName =
            typeof data.fileName === "string" ? data.fileName : "Untitled document";
          const status = typeof data.status === "string" ? data.status : "draft";
          const createdAt =
            data.createdAt instanceof Timestamp ||
            data.createdAt instanceof Date ||
            data.createdAt == null
              ? (data.createdAt as Timestamp | Date | null | undefined)
              : undefined;
          const updatedAt =
            data.updatedAt instanceof Timestamp ||
            data.updatedAt instanceof Date ||
            data.updatedAt == null
              ? (data.updatedAt as Timestamp | Date | null | undefined)
              : undefined;
          const finalPdfUrl =
            typeof data.finalPdfUrl === "string"
              ? data.finalPdfUrl
              : data.finalPdfUrl === null
                ? null
                : null;
          const pagesCount =
            typeof data.pagesCount === "number" ? data.pagesCount : null;
          const countersignStatus =
            typeof data.countersignStatus === "string"
              ? data.countersignStatus
              : data.countersignStatus === null
                ? null
                : null;
          const auditId =
            typeof data.auditId === "string"
              ? data.auditId
              : data.auditId === null
                ? null
                : null;

          return {
            id: d.id,
            ownerUid,
            fileName,
            status,
            createdAt: createdAt ?? null,
            updatedAt: updatedAt ?? null,
            finalPdfUrl,
            pagesCount,
            countersignStatus,
            auditId,
          };
        });
        setRecents(items);
      } catch (e) {
        devWarn("Failed to load recent e-sign documents", e);
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
  }, [authReady, user, recentsLoading]);

  function openDeleteAgreementModal(documentId: string, fileName: string) {
    setDeleteConfirmDocumentId(documentId);
    setDeleteConfirmFileName(fileName);
    setDeleteModalError(null);
  }

  function closeDeleteAgreementModal() {
    if (deletingId) return;
    setDeleteConfirmDocumentId(null);
    setDeleteConfirmFileName(null);
    setDeleteModalError(null);
  }

  async function confirmDeleteAgreement() {
    if (!user) {
      setHubNotice("Please sign in first.");
      return;
    }
    const documentId = deleteConfirmDocumentId;
    if (!documentId) return;

    setDeleteModalError(null);
    setDeletingId(documentId);

    try {
      const idToken = await user.getIdToken();

      const res = await fetch("/api/esign/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ documentId }),
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        setDeleteModalError(
          typeof json?.error === "string" ? json.error : "Delete failed"
        );
        return;
      }

      setRecents((prev) => prev.filter((d) => d.id !== documentId));
      setDeleteConfirmDocumentId(null);
      setDeleteConfirmFileName(null);
      setDeleteModalError(null);
    } catch {
      setDeleteModalError("Delete failed. Try again.");
    } finally {
      setDeletingId(null);
    }
  }

  const handleBrowseClick = () => {
    setHubNotice(null);
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
      lower.endsWith(".pdf") || file.type === "application/pdf";
    if (!ok) {
      setHubNotice("Only PDF files are currently supported for e-signing.");
      e.target.value = "";
      setSelectedFile(null);
      return;
    }
    if (file.size > MAX_ESIGN_PDF_BYTES) {
      setHubNotice("This PDF is too large. Please upload a PDF under 50 MB.");
      e.target.value = "";
      setSelectedFile(null);
      return;
    }
    setHubNotice(null);
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
      trackEvent("verify_submit", { flow: "tools_hub" });
      const res = await fetch("/api/esign/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationId: trimmed }),
      });
      const json = await res.json();
      if (json?.ok) {
        setVerifyResult("success");
        trackEvent("verify_success", { flow: "tools_hub", outcome: "success" });
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

    async function parsePdf(file: File): Promise<string | null> {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - pdfjs-dist ships no types for this legacy entry
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

      const data = new Uint8Array(await file.arrayBuffer());
      const loadingTask = pdfjsLib.getDocument({ data });
      const pdf = await loadingTask.promise;

      const uuidRegex =
        /[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}/i;
      let extractedId: string | null = null;

      for (let pageNum = pdf.numPages; pageNum >= 1; pageNum--) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        type TextItem = { str?: string };
        const items = textContent.items as TextItem[];

        devLog("[Verify PDF] Page", pageNum, "textItems:", items.length);

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
        if (IS_DEV) {
          console.error("[Verify PDF] Parsing error:", err);
        } else {
          console.error(
            "[Verify PDF] Parsing error:",
            err instanceof Error ? err.message : "unknown"
          );
        }
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
      router.push(getLoginRedirectUrl());
      return;
    }
    if (!selectedFile) {
      setHubNotice("Please select a document first.");
      return;
    }
    if (selectedFile.size > MAX_ESIGN_PDF_BYTES) {
      setHubNotice("This PDF is too large. Please upload a PDF under 50 MB.");
      return;
    }

    try {
      setHubNotice(null);
      setUploading(true);
      trackEvent("esign_upload_start", { flow: "tools_hub" });

      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/esign/upload", {
        method: "POST",
        body: formData,
      });

      type UploadJson = {
        ok?: boolean;
        error?: string;
        documentId?: string;
        originalFilename?: string;
      };
      let json: UploadJson = {};
      try {
        json = (await res.json()) as UploadJson;
      } catch {
        json = {};
      }

      if (!res.ok || !json?.ok) {
        if (res.status === 413) {
          setHubNotice(
            "This PDF is too large. Please upload a PDF under 50 MB."
          );
        } else {
          const serverMsg =
            typeof json?.error === "string" && json.error.trim() ? json.error.trim() : null;
          setHubNotice(
            serverMsg ||
              "Something went wrong while uploading. Please try again."
          );
        }
        return;
      }

      const documentId = json.documentId;
      if (!documentId) {
        setHubNotice("Something went wrong while uploading. Please try again.");
        return;
      }

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

      trackEvent("esign_upload_success", {
        flow: "tools_hub",
        size_bucket: uploadSizeBucket(selectedFile.size),
      });

      router.push(`/tools/esign/${documentId}`);
    } catch {
      setHubNotice("Something went wrong while uploading. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  if (!authReady) {
    return (
      <main className="relative flex min-h-dvh w-full flex-col bg-white text-zinc-700">
        <NoiseBackground />
        <div className="relative z-10 flex min-h-dvh flex-1 flex-col items-center justify-center px-4">
          <div
            className="h-8 w-8 rounded-full border-2 border-zinc-200 border-t-zinc-700 animate-spin"
            aria-hidden
          />
          <p className="mt-4 text-sm text-zinc-600">Loading…</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="relative flex min-h-dvh w-full flex-col bg-white text-zinc-900">
        <NoiseBackground />
        <div className="relative z-10 flex min-h-dvh flex-1 flex-col items-center justify-center px-4">
          <div
            className="h-8 w-8 rounded-full border-2 border-zinc-200 border-t-violet-600 animate-spin"
            aria-hidden
          />
          <h2 className="mt-5 text-center font-heading text-lg font-semibold tracking-tight text-zinc-900">
            Sign in required
          </h2>
          <p className="mt-2 max-w-sm text-center text-sm leading-relaxed text-zinc-600">
            Redirecting you to continue with StudiosisLab tools.
          </p>
        </div>
      </main>
    );
  }

  const selectedLabel = selectedFile?.name || "Select file...";

  const formatDate = (ts: unknown, withYear = false) => {
    try {
      const d: Date | null =
        ts &&
        typeof ts === "object" &&
        "toDate" in ts &&
        typeof (ts as { toDate?: () => Date }).toDate === "function" &&
        (ts as { toDate: () => Date }).toDate() instanceof Date
          ? (ts as { toDate: () => Date }).toDate()
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
    <main className="relative flex min-h-dvh w-full flex-col bg-white px-5 pb-24 pt-5 text-zinc-900">
      <NoiseBackground />
      <div className="relative z-10 flex min-h-0 w-full flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between px-1 pb-4 sm:px-2">
          <Link href="/" className="relative block h-11 w-[min(100%,280px)] shrink-0">
            <Image
              src={HOME_LOGOS_LIGHT.header}
              alt="StudiosisLab — home"
              fill
              className="object-contain object-left"
              sizes="280px"
              priority
            />
          </Link>
          <HomeHeaderAuth />
        </header>

        <div className="mx-auto flex w-full max-w-5xl flex-col">
        {hubNotice ? (
          <div className="mb-3 px-1 sm:px-2" role="alert">
            <div className="flex items-start justify-between gap-3 rounded-xl border border-amber-200/90 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <span className="min-w-0 pt-0.5">{hubNotice}</span>
              <button
                type="button"
                onClick={() => setHubNotice(null)}
                className="shrink-0 text-xs font-medium text-amber-900 underline underline-offset-2 hover:text-amber-950"
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-2 pb-2 text-center sm:px-4">
          <div className="relative mb-6 flex h-40 w-full max-w-[280px] shrink-0 items-center justify-center sm:mb-8 sm:h-48 sm:max-w-[336px]">
            <Image
              src={HOME_LOGOS_LIGHT.heroLab}
              alt="StudiosisLab"
              fill
              className="object-contain object-center"
              sizes="(max-width: 768px) 90vw, 336px"
              priority
            />
          </div>
          <div className="w-full text-center">
            <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
              E-sign tools
            </h1>
            <p className="mt-3 text-sm text-zinc-600 sm:text-base">
              Upload a PDF to start a signing flow, or verify an agreement you already have.
            </p>
          </div>
        </div>

        <section className="mt-10 flex flex-col items-center">
          <div className="w-full max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-lg">
            <div className="text-sm font-medium text-white mb-3">
              Document
            </div>
            <div className="flex flex-col gap-3 rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-3 shadow-sm sm:flex-row sm:items-stretch sm:gap-2 sm:rounded-full sm:px-3 sm:py-1">
              <div className="flex min-w-0 flex-1 items-center gap-2 px-1 sm:px-2">
                <span className="min-w-0 truncate text-sm text-zinc-300">
                  {selectedLabel}
                </span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={handleBrowseClick}
                  className="min-h-10 rounded-full border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 transition-colors hover:border-zinc-500 hover:bg-zinc-700 sm:min-h-0 sm:py-1.5"
                >
                  Browse
                </button>
                <button
                  type="button"
                  onClick={handleProceed}
                  disabled={uploading || !selectedFile}
                  className="min-h-10 rounded-full bg-emerald-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-0 sm:py-1.5"
                >
                  {uploading ? "Uploading..." : selectedFile ? "Upload and continue" : "Proceed"}
                </button>
              </div>
            </div>

            <p className="mt-2 text-xs text-zinc-400">
              Upload the PDF that needs to be signed. PDF only • Up to 50 MB.
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <input
                type="text"
                value={verificationIdInput}
                onChange={(e) => setVerificationIdInput(e.target.value)}
                placeholder="Verification code"
                className="flex-1 min-w-0 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-500 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => verifyFileInputRef.current?.click()}
                  className="min-h-10 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:border-zinc-400 sm:min-h-0"
                >
                  Browse
                </button>
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={verifying}
                  className="min-h-10 rounded-full bg-black px-5 py-2 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-0"
                >
                  {verifying ? "Verifying…" : "Verify"}
                </button>
              </div>
            </div>
            {verifyFile && (
              <p className="mt-2 text-xs text-zinc-500 truncate">
                File selected: {verifyFile.name} —{" "}
                {verifyFile.type === "application/pdf"
                  ? extractingVerifyCode
                    ? "Reading your PDF…"
                    : verificationIdInput.trim()
                      ? "Verification code found."
                      : "No verification code found in this PDF."
                  : "Only PDFs can be scanned for a verification code automatically."}
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

                const preferFinalPreview =
                  docItem.status === "completed" &&
                  (!!docItem.finalPdfUrl ||
                    !!docItem.auditId ||
                    docItem.countersignStatus === "completed");

                const thumbUrl = preferFinalPreview
                  ? `/api/esign/download?documentId=${docItem.id}&final=1`
                  : `/api/esign/download?documentId=${docItem.id}`;

                return (
                  <div
                    key={docItem.id}
                    className="flex w-full flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:border-zinc-300 hover:shadow-md"
                  >
                    <PdfThumbnail url={thumbUrl} />
                    <div className="text-sm font-semibold leading-tight truncate">
                      {docItem.fileName}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
                      <span
                        className={`inline-flex rounded-full px-1.5 py-0.5 font-medium ${statusBadge.class}`}
                      >
                        {statusBadge.label}
                      </span>
                      {dateLabel && <span>{dateLabel}</span>}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => router.push(`/tools/esign/${docItem.id}`)}
                        className="text-xs font-medium text-zinc-800 underline-offset-2 transition-colors hover:text-zinc-950 hover:underline"
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDeleteAgreementModal(docItem.id, docItem.fileName);
                        }}
                        disabled={deletingId === docItem.id}
                        className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                      >
                        {deletingId === docItem.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        </div>

      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
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

      {deleteConfirmDocumentId && (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deletingId) {
              closeDeleteAgreementModal();
            }
          }}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-agreement-title"
          >
            <h2
              id="delete-agreement-title"
              className="text-lg font-semibold text-zinc-900"
            >
              Delete agreement?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              Are you sure you want to delete this agreement? This will remove the
              document and related stored files.
            </p>
            {deleteConfirmFileName ? (
              <p
                className="mt-2 truncate text-sm font-medium text-zinc-800"
                title={deleteConfirmFileName}
              >
                {deleteConfirmFileName}
              </p>
            ) : null}
            {deleteModalError ? (
              <p className="mt-3 text-sm text-red-600">{deleteModalError}</p>
            ) : null}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={closeDeleteAgreementModal}
                disabled={!!deletingId}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteAgreement}
                disabled={!!deletingId}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingId === deleteConfirmDocumentId ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

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
