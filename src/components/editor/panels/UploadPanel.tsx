"use client";

import { useRef, useState } from "react";
import { SidebarSection } from "../sidebar/SidebarSection";

export type UploadEditorApi = {
  addImage?: (file: File) => void;
};

type UploadPanelProps = {
  onClose: () => void;
  editor: UploadEditorApi | null;
};

export function UploadPanel({ onClose, editor }: UploadPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [thumbnails, setThumbnails] = useState<{ id: string; url: string; file: File }[]>([]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const newThumbs: { id: string; url: string; file: File }[] = [];
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const url = URL.createObjectURL(file);
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      newThumbs.push({ id, url, file });
      editor?.addImage?.(file);
    });
    setThumbnails((prev) => [...prev, ...newThumbs]);
    e.target.value = "";
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
            className="w-full rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 px-3 py-4 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:border-zinc-400"
          >
            Upload images
          </button>
        </SidebarSection>
        {thumbnails.length > 0 && (
          <SidebarSection title="Uploaded">
            <div className="grid grid-cols-3 gap-2">
              {thumbnails.map(({ id, url }) => (
                <div
                  key={id}
                  className="aspect-square rounded-lg border border-zinc-200 bg-zinc-100 overflow-hidden"
                >
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </SidebarSection>
        )}
      </div>
    </>
  );
}
