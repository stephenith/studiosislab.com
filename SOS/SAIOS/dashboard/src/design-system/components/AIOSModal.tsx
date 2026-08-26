import { useEffect, type ReactNode } from "react";
import { DangerButton, PrimaryButton, SecondaryButton } from "./Buttons";

type Props = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  size?: "md" | "lg";
  footer?: ReactNode;
  "aria-label"?: string;
};

export function AIOSModal({
  open,
  title,
  children,
  onClose,
  size = "md",
  footer,
  "aria-label": ariaLabel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="ds-modal-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`ds-modal${size === "lg" ? " ds-modal-lg" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? title}
      >
        <h2 className="ds-modal-title">{title}</h2>
        <div className="ds-modal-body">{children}</div>
        {footer ? <div className="ds-modal-actions">{footer}</div> : null}
      </div>
    </div>
  );
}

type ConfirmProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmationDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmProps) {
  return (
    <AIOSModal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <SecondaryButton onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </SecondaryButton>
          {danger ? (
            <DangerButton onClick={onConfirm} disabled={busy}>
              {busy ? "Working…" : confirmLabel}
            </DangerButton>
          ) : (
            <PrimaryButton onClick={onConfirm} disabled={busy}>
              {busy ? "Working…" : confirmLabel}
            </PrimaryButton>
          )}
        </>
      }
    >
      <p className="ds-modal-body ds-meta">{message}</p>
    </AIOSModal>
  );
}
