"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Download,
  FileUp,
  Lock,
  LockOpen,
  PenLine,
  Share2,
  Trash2,
} from "lucide-react";
import {
  pinEsignShellToVisualViewport,
  wantsEsignPhoneLayout,
} from "@/lib/esignPhoneLayout";
import type { LockButtonView, PhoneDockGuidance } from "@/lib/esignViewerState";

export function useEsignPhoneLayout() {
  const [phone, setPhone] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [shellEl, setShellEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const syncPhone = () => {
      setPhone(
        wantsEsignPhoneLayout({
          match: (query) => window.matchMedia(query).matches,
          userAgent: navigator.userAgent,
          screenWidth: window.screen?.width,
          screenHeight: window.screen?.height,
          maxTouchPoints: navigator.maxTouchPoints,
        })
      );
    };
    syncPhone();
    window.addEventListener("resize", syncPhone);
    return () => window.removeEventListener("resize", syncPhone);
  }, []);

  useEffect(() => {
    if (!phone || !shellEl) return;
    const viewport = window.visualViewport;
    const sync = () => {
      const next = pinEsignShellToVisualViewport(
        shellEl,
        viewport
          ? { height: viewport.height, offsetTop: viewport.offsetTop }
          : null,
        window.innerHeight
      );
      setKeyboardOpen(next.keyboardOpen);
    };
    sync();
    viewport?.addEventListener("resize", sync);
    window.addEventListener("resize", sync);
    return () => {
      viewport?.removeEventListener("resize", sync);
      window.removeEventListener("resize", sync);
      shellEl.style.position = "";
      shellEl.style.left = "";
      shellEl.style.right = "";
      shellEl.style.width = "";
      shellEl.style.top = "";
      shellEl.style.height = "";
    };
  }, [phone, shellEl]);

  return { phone, keyboardOpen, setShellEl };
}

type DockButtonProps = {
  label: string;
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
};

function DockButton({
  label,
  disabled,
  active,
  onClick,
  children,
}: DockButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      style={{ touchAction: "manipulation" }}
      className={`flex h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium ${
        disabled
          ? "text-zinc-400"
          : active
          ? "text-[#1f1f28]"
          : "text-zinc-700"
      }`}
    >
      <span className="pointer-events-none flex flex-col items-center justify-center gap-0.5">
        {children}
        <span className="max-w-full truncate">{label}</span>
      </span>
    </button>
  );
}

export function EsignPhoneDock({
  mode,
  signOpen,
  documentOpen,
  lockButton,
  dockHint = null,
  hasSelectedSignature,
  downloading,
  canDownload,
  recipientCompleteLabel,
  recipientCompleteEnabled,
  recipientCompleting,
  onOpenSign,
  onOpenDocument,
  onLock,
  onDelete,
  onDownload,
  onShare,
  onRecipientComplete,
}: {
  mode: "sender" | "recipient";
  signOpen: boolean;
  documentOpen: boolean;
  lockButton: LockButtonView;
  dockHint?: PhoneDockGuidance | null;
  hasSelectedSignature: boolean;
  downloading: boolean;
  canDownload: boolean;
  recipientCompleteLabel: string;
  recipientCompleteEnabled: boolean;
  recipientCompleting: boolean;
  onOpenSign: () => void;
  onOpenDocument: () => void;
  onLock: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onShare: () => void;
  onRecipientComplete: () => void;
}) {
  return (
    <div
      className="relative z-50 shrink-0 overflow-visible bg-white"
      style={{ paddingBottom: "max(0.25rem, env(safe-area-inset-bottom))" }}
    >
      {dockHint ? (
        <div
          role="status"
          aria-live="polite"
          className={`pointer-events-none relative z-20 overflow-visible px-3 pb-2 pt-1.5 ${
            dockHint.tone === "green" ? "bg-lime-400" : "bg-orange-400"
          }`}
        >
          <p className="text-center text-[11px] font-medium leading-snug text-zinc-900">
            {dockHint.text}
          </p>
          <span
            aria-hidden
            className={`absolute bottom-0 z-20 h-0 w-0 -translate-x-1/2 translate-y-full border-x-[6px] border-x-transparent border-t-[7px] ${
              dockHint.tone === "green" ? "border-t-lime-400" : "border-t-orange-400"
            } ${
              dockHint.arrow === "lock"
                ? "left-[30%]"
                : dockHint.arrow === "share"
                ? "left-[90%]"
                : "left-[70%]"
            }`}
          />
        </div>
      ) : null}
    <nav
      aria-label="E-sign actions"
      className="flex h-11 items-stretch border-t border-zinc-200 bg-white"
    >
      <DockButton label="Sign" active={signOpen} onClick={onOpenSign}>
        <PenLine aria-hidden className="h-4 w-4" strokeWidth={2} />
      </DockButton>
      <DockButton
        label={lockButton.tone === "unlock" ? "Unlock" : "Lock"}
        disabled={lockButton.disabled}
        onClick={onLock}
      >
        {lockButton.tone === "unlock" ? (
          <LockOpen aria-hidden className="h-4 w-4" strokeWidth={2} />
        ) : (
          <Lock aria-hidden className="h-4 w-4" strokeWidth={2} />
        )}
      </DockButton>
      <DockButton
        label="Delete"
        disabled={!hasSelectedSignature}
        onClick={onDelete}
      >
        <Trash2 aria-hidden className="h-4 w-4" strokeWidth={2} />
      </DockButton>
      {mode === "sender" ? (
        <>
          <DockButton
            label={downloading ? "Saving" : "Download"}
            disabled={!canDownload || downloading}
            onClick={onDownload}
          >
            <Download aria-hidden className="h-4 w-4" strokeWidth={2} />
          </DockButton>
          <DockButton label="Share" active={documentOpen} onClick={onShare}>
            <Share2 aria-hidden className="h-4 w-4" strokeWidth={2} />
          </DockButton>
        </>
      ) : (
        <>
          <DockButton
            label={
              recipientCompleting
                ? "Sending"
                : recipientCompleteLabel === "Complete agreement"
                ? "Complete"
                : recipientCompleteLabel
            }
            disabled={!recipientCompleteEnabled || recipientCompleting}
            onClick={onRecipientComplete}
          >
            <Share2 aria-hidden className="h-4 w-4" strokeWidth={2} />
          </DockButton>
          <DockButton label="Document" active={documentOpen} onClick={onOpenDocument}>
            <FileUp aria-hidden className="h-4 w-4" strokeWidth={2} />
          </DockButton>
        </>
      )}
    </nav>
    </div>
  );
}

export function EsignPhoneSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex max-h-[min(58vh,28rem)] flex-col">
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="pointer-events-auto h-8 shrink-0 bg-gradient-to-t from-black/20 to-transparent"
      />
      <div className="pointer-events-auto flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-2xl border-t border-zinc-200 bg-white shadow-[0_-8px_24px_rgba(0,0,0,0.12)]">
        <div className="flex shrink-0 items-center justify-between px-4 py-2">
          <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}
