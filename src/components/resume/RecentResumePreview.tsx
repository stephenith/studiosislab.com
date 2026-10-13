"use client";

import { useEffect, useState } from "react";
import { generateResumeThumbnail } from "@/lib/resumePreviewExport";
import {
  prepareFirstPageThumbnailJson,
  selectFirstPageSnapshot,
  type ThumbnailPageSize,
} from "@/lib/resumePreviewScene";

export type RecentResumePreviewDoc = {
  id: string;
  pageSize?: string;
  updatedAt?: any;
  thumbnail?: string;
  thumbnailRevision?: number;
  autosaveRevision?: number;
  pagesData?: any[] | null;
  canvasJson?: any;
};

const previewCache = new Map<string, string>();
const previewTokens = new Map<string, number>();

function updatedStamp(value: any): string {
  if (value && typeof value.toMillis === "function") return String(value.toMillis());
  if (value && typeof value.seconds === "number") return String(value.seconds);
  if (typeof value === "number" || typeof value === "string") return String(value);
  return "";
}

function cacheKey(doc: RecentResumePreviewDoc): string {
  return [
    doc.id,
    doc.autosaveRevision ?? "",
    doc.thumbnailRevision ?? "",
    updatedStamp(doc.updatedAt),
  ].join(":");
}

function trustedThumbnail(doc: RecentResumePreviewDoc): string | null {
  if (typeof doc.thumbnail !== "string" || !doc.thumbnail.startsWith("data:image/")) return null;
  if (typeof doc.thumbnailRevision !== "number") return null;
  if (typeof doc.autosaveRevision !== "number") return null;
  if (doc.thumbnailRevision !== doc.autosaveRevision) return null;
  return doc.thumbnail;
}

function pageSizeOf(doc: RecentResumePreviewDoc): ThumbnailPageSize {
  if (doc.pageSize === "A4" || doc.pageSize === "Letter" || doc.pageSize === "Custom") {
    return doc.pageSize;
  }
  return "A4";
}

export function RecentResumePreview({ doc }: { doc: RecentResumePreviewDoc }) {
  const trusted = trustedThumbnail(doc);
  const key = cacheKey(doc);
  const cached = previewCache.get(key) || trusted;
  const [src, setSrc] = useState<string | null>(cached || null);
  const [mode, setMode] = useState<"image" | "blank" | "unavailable">(cached ? "image" : "blank");

  const snapshotPages = doc.pagesData;
  const snapshotJson = doc.canvasJson;
  const legacyThumbnail = doc.thumbnail;
  const docId = doc.id;
  const pageSize = pageSizeOf(doc);

  useEffect(() => {
    const known = previewCache.get(key) || trusted;
    if (known) {
      setSrc(known);
      setMode("image");
      return;
    }

    const snapshot = selectFirstPageSnapshot({
      pagesData: snapshotPages,
      canvasJson: snapshotJson,
    });
    if (!snapshot) {
      if (typeof legacyThumbnail === "string" && legacyThumbnail.startsWith("data:image/")) {
        setSrc(legacyThumbnail);
        setMode("image");
      } else {
        setSrc(null);
        setMode("unavailable");
      }
      return;
    }

    const prepared = prepareFirstPageThumbnailJson(snapshot, pageSize);
    if (prepared.empty) {
      setSrc(null);
      setMode("blank");
      return;
    }

    const token = (previewTokens.get(docId) || 0) + 1;
    previewTokens.set(docId, token);
    let cancelled = false;
    void generateResumeThumbnail({
      pagesData: Array.isArray(snapshotPages) ? snapshotPages : undefined,
      canvasJson: Array.isArray(snapshotPages) && snapshotPages.length > 0 ? undefined : snapshotJson,
      pageSize,
    })
      .then((url) => {
        if (cancelled || previewTokens.get(docId) !== token) return;
        if (!url) {
          setSrc(null);
          setMode("unavailable");
          return;
        }
        previewCache.set(key, url);
        setSrc(url);
        setMode("image");
      })
      .catch(() => {
        if (cancelled || previewTokens.get(docId) !== token) return;
        setSrc(null);
        setMode("unavailable");
      });

    return () => {
      cancelled = true;
    };
  }, [docId, key, legacyThumbnail, pageSize, snapshotJson, snapshotPages, trusted]);

  if (mode === "image" && src) {
    return (
      <img
        src={src}
        alt="Recent resume preview"
        className="h-full w-full bg-white object-cover object-top"
      />
    );
  }

  if (mode === "unavailable") {
    return (
      <div className="flex h-full w-full items-center justify-center bg-white px-3 text-center text-sm text-zinc-500">
        Preview unavailable
      </div>
    );
  }

  return <div className="h-full w-full bg-white" aria-label="Blank resume page" />;
}
