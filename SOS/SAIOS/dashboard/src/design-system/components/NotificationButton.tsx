type Props = {
  hasNotification?: boolean;
  onClick?: () => void;
  "aria-label"?: string;
};

export function NotificationButton({
  hasNotification = false,
  onClick,
  "aria-label": ariaLabel = "Notifications",
}: Props) {
  return (
    <button
      type="button"
      className="ds-icon-btn"
      aria-label={ariaLabel}
      onClick={onClick}
    >
      <span className="ds-notify-glyph" aria-hidden>
        N
      </span>
      {hasNotification ? <span className="ds-dot" /> : null}
    </button>
  );
}
