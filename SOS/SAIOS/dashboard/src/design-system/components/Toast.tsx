export type ToastTone = "default" | "ok" | "error" | "warn";

export type ToastItem = {
  id: string;
  message: string;
  tone?: ToastTone;
};

type Props = {
  toasts: ToastItem[];
  onDismiss?: (id: string) => void;
};

export function Toast({ toasts, onDismiss }: Props) {
  if (!toasts.length) return null;
  return (
    <div className="ds-toast-region" aria-live="polite" aria-relevant="additions">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="ds-toast"
          data-tone={t.tone && t.tone !== "default" ? t.tone : undefined}
          role="status"
        >
          <p className="ds-toast-msg">{t.message}</p>
          {onDismiss ? (
            <button
              type="button"
              className="ds-toast-close"
              aria-label="Dismiss"
              onClick={() => onDismiss(t.id)}
            >
              ×
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
