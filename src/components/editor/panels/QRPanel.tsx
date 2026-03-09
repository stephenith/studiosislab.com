"use client";

import { useState } from "react";
import { SidebarSection } from "../sidebar/SidebarSection";

type QRPanelProps = {
  onClose: () => void;
};

export function QRPanel({ onClose }: QRPanelProps) {
  const [value, setValue] = useState("");

  const handleGenerate = () => {
    // Stub: functionality can be implemented later
    console.log("[QRPanel] Generate QR for:", value);
  };

  return (
    <>
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 bg-white">
        <span className="text-sm font-medium text-zinc-800">QR Code</span>
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
        <SidebarSection title="QR content">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter URL or text..."
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent mb-2"
            aria-label="QR content"
          />
          <button
            type="button"
            onClick={handleGenerate}
            className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Generate QR
          </button>
        </SidebarSection>
      </div>
    </>
  );
}
