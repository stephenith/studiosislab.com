"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthUser } from "@/lib/useAuthUser";
import { listUserUploads, uploadUserImage } from "@/lib/userUploads";
import { SidebarSection } from "../sidebar/SidebarSection";

export type UploadEditorApi = {
  addImage?: (file: File) => void;
  addImageFromUrl?: (url: string) => void | Promise<void>;
};

type UploadPanelProps = {
  onClose: () => void;
  editor: UploadEditorApi | null;
};

type UploadItem = {
  id: string;
  downloadURL: string;
  name: string;
  status: "ready" | "uploading" | "error";
  progress: number;
  localPreviewUrl?: string;
};

export function UploadPanel({ onClose, editor }: UploadPanelProps) {
  const { user, loading: authLoading } = useAuthUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadsRef = useRef<UploadItem[]>([]);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const loadUploads = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await listUserUploads({ uid: user.uid });
      setUploads(
        rows.map((row) => ({
          id: row.id,
          downloadURL: row.downloadURL,
          name: row.name || "Upload",
          status: "ready",
          progress: 100,
        }))
      );
    } catch (err) {
      console.error("[UploadPanel] load uploads failed", err);
      setError("Failed to load uploads.");
      setUploads([]);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadUploads();
  }, [loadUploads]);

  useEffect(() => {
    uploadsRef.current = uploads;
  }, [uploads]);

  useEffect(() => {
    return () => {
      uploadsRef.current.forEach((item) => {
        if (item.localPreviewUrl) URL.revokeObjectURL(item.localPreviewUrl);
      });
    };
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    if (authLoading || !user?.uid) {
      setError("Please wait, loading user session...");
      e.target.value = "";
      return;
    }

    setUploading(true);
    setError(null);
    let failedCount = 0;

    const tasks = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .map(async (file) => {
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const localUrl = URL.createObjectURL(file);

        setUploads((prev) => [
          {
            id: tempId,
            downloadURL: localUrl,
            localPreviewUrl: localUrl,
            name: file.name,
            status: "uploading",
            progress: 0,
          },
          ...prev,
        ]);

        // Preserve existing behavior: selected local file is still inserted immediately.
        editor?.addImage?.(file);

        try {
          const { assetId, downloadURL } = await uploadUserImage({
            uid: user.uid,
            file,
            onProgress: (percent) => {
              setUploads((prev) =>
                prev.map((item) =>
                  item.id === tempId ? { ...item, progress: percent } : item
                )
              );
            },
          });

          URL.revokeObjectURL(localUrl);
          setUploads((prev) =>
            prev.map((item) =>
              item.id === tempId
                ? {
                    id: assetId,
                    downloadURL,
                    name: file.name,
                    status: "ready",
                    progress: 100,
                  }
                : item
            )
          );
        } catch (err) {
          console.error("[UploadPanel] upload failed", err);
          failedCount += 1;
          setUploads((prev) =>
            prev.map((item) =>
              item.id === tempId
                ? { ...item, status: "error", progress: 0 }
                : item
            )
          );
        }
      });

    await Promise.allSettled(tasks);
    if (failedCount > 0) {
      setError("Some uploads failed. Please retry.");
    } else {
      setError(null);
    }
    setUploading(false);
    e.target.value = "";
  };

  const handleInsert = (item: UploadItem) => {
    if (!item.downloadURL || item.status !== "ready") return;
    editor?.addImageFromUrl?.(item.downloadURL);
  };

  return (
    <>
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 bg-white">
        <span className="text-sm font-medium text-zinc-800">Upload</span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700"
          aria-label="Close panel"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="p-3 overflow-y-auto">
        <SidebarSection title="Upload images">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
            aria-hidden
          />
          <button
            type="button"
            onClick={handleUploadClick}
            disabled={uploading}
            className="w-full rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 px-3 py-4 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:border-zinc-400"
          >
            {uploading ? "Uploading..." : "Upload images"}
          </button>
        </SidebarSection>

        {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
        {loading && <p className="mt-2 text-xs text-zinc-500">Loading uploads...</p>}

        {!loading && uploads.length === 0 && (
          <p className="mt-2 text-xs text-zinc-500">No uploads yet</p>
        )}

        {uploads.length > 0 && (
          <SidebarSection title="Uploaded">
            <div className="grid grid-cols-3 gap-2">
              {uploads.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleInsert(item)}
                  disabled={item.status !== "ready"}
                  className="relative aspect-square rounded-lg border border-zinc-200 bg-zinc-100 overflow-hidden disabled:cursor-wait"
                  title={item.name}
                >
                  <img
                    src={item.downloadURL}
                    alt={item.name}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                  {item.status === "uploading" && (
                    <div className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-[10px] text-white">
                      {item.progress}%
                    </div>
                  )}
                  {item.status === "error" && (
                    <div className="absolute inset-0 grid place-items-center bg-black/50 text-[10px] font-medium text-white">
                      Failed
                    </div>
                  )}
                </button>
              ))}
            </div>
          </SidebarSection>
        )}
      </div>
    </>
  );
}
