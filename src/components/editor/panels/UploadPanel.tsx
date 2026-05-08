"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthUser } from "@/lib/useAuthUser";
import {
  listAssets,
  saveAsset,
  type LocalAssetRecord,
  updateLastAccess,
} from "@/lib/localAssets";
import { SidebarSection } from "../sidebar/SidebarSection";

export type UploadEditorApi = {
  docId?: string | null;
  addImageFromUrl?: (
    url: string,
    meta?: { slbAssetId?: string; slbSource?: "local" | "cloud" | "template" }
  ) => void | Promise<void>;
};

type UploadPanelProps = {
  onClose: () => void;
  editor: UploadEditorApi | null;
};

type AssetThumb = {
  assetId: string;
  url: string;
};

export function UploadPanel({ onClose, editor }: UploadPanelProps) {
  const { user, loading: authLoading } = useAuthUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbUrlsRef = useRef<Map<string, string>>(new Map());
  const [assets, setAssets] = useState<LocalAssetRecord[]>([]);
  const [assetThumbs, setAssetThumbs] = useState<AssetThumb[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const loadAssets = useCallback(async () => {
    if (!user?.uid) {
      setAssets([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await listAssets(user.uid);
      setAssets(rows);
    } catch (err) {
      console.error("[UploadPanel] load local assets failed", err);
      setError("Failed to load local assets.");
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    const next = new Map<string, string>();
    const thumbs: AssetThumb[] = assets.map((asset) => {
      const existing = thumbUrlsRef.current.get(asset.assetId);
      const url = existing ?? URL.createObjectURL(asset.blob);
      next.set(asset.assetId, url);
      return { assetId: asset.assetId, url };
    });

    thumbUrlsRef.current.forEach((url, assetId) => {
      if (!next.has(assetId)) {
        URL.revokeObjectURL(url);
      }
    });

    thumbUrlsRef.current = next;
    setAssetThumbs(thumbs);
  }, [assets]);

  useEffect(() => {
    return () => {
      thumbUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      thumbUrlsRef.current.clear();
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
      .filter((file) => {
        const mime = (file.type || "").toLowerCase();
        if (mime.startsWith("image/")) return true;
        return /\.(png|jpe?g|webp|gif|bmp|svg|heic|heif)$/i.test(file.name || "");
      })
      .map(async (file) => {
        const localUrl = URL.createObjectURL(file);

        try {
          const assetId = await saveAsset({
            uid: user.uid,
            docId: String(editor?.docId || "draft"),
            file,
          });
          if (editor?.addImageFromUrl) {
            await editor.addImageFromUrl(localUrl, {
              slbAssetId: assetId,
              slbSource: "local",
            });
          }
        } catch (err) {
          console.error("[UploadPanel] upload failed", err);
          failedCount += 1;
        } finally {
          URL.revokeObjectURL(localUrl);
        }
      });

    await Promise.allSettled(tasks);
    await loadAssets();
    if (failedCount > 0) {
      setError("Some uploads failed. Please retry.");
    } else {
      setError(null);
    }
    setUploading(false);
    e.target.value = "";
  };

  const handleInsert = async (asset: LocalAssetRecord) => {
    const url = thumbUrlsRef.current.get(asset.assetId);
    if (!url) return;
    await updateLastAccess(asset.assetId).catch(() => {});
    await editor?.addImageFromUrl?.(url, {
      slbAssetId: asset.assetId,
      slbSource: "local",
    });
    void loadAssets();
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
        {loading && <p className="mt-2 text-xs text-zinc-500">Loading assets...</p>}

        {!loading && assets.length === 0 && (
          <p className="mt-2 text-xs text-zinc-500">No assets yet</p>
        )}

        {assets.length > 0 && (
          <SidebarSection title="Asset Library">
            <div className="grid grid-cols-3 gap-2">
              {assets.map((asset) => {
                const thumb = assetThumbs.find((item) => item.assetId === asset.assetId);
                if (!thumb) return null;
                return (
                <button
                  key={asset.assetId}
                  type="button"
                  onClick={() => {
                    void handleInsert(asset);
                  }}
                  className="relative aspect-square rounded-lg border border-zinc-200 bg-zinc-100 overflow-hidden"
                  title={`Asset ${asset.assetId.slice(0, 8)}`}
                >
                  <img
                    src={thumb.url}
                    alt={`Local asset ${asset.assetId.slice(0, 8)}`}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </button>
                );
              })}
            </div>
          </SidebarSection>
        )}
      </div>
    </>
  );
}
