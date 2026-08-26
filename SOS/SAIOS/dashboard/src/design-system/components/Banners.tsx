import type { ReactNode } from "react";

type Props = {
  title?: string;
  children: ReactNode;
  icon?: string;
  className?: string;
};

export function InfoBanner({
  title,
  children,
  icon = "ℹ",
  className = "",
}: Props) {
  return (
    <aside className={`ds-banner ds-banner-info${className ? ` ${className}` : ""}`} role="status">
      <span className="ds-banner-icon" aria-hidden>
        {icon}
      </span>
      <div className="ds-banner-body">
        {title ? <p className="ds-banner-title">{title}</p> : null}
        <div className="ds-banner-text">{children}</div>
      </div>
    </aside>
  );
}

type AlertProps = Props & {
  tone?: "alert" | "warn" | "ok";
};

export function AlertBanner({
  title,
  children,
  icon,
  tone = "alert",
  className = "",
}: AlertProps) {
  const toneClass =
    tone === "warn"
      ? "ds-banner-warn"
      : tone === "ok"
        ? "ds-banner-ok"
        : "ds-banner-alert";
  const defaultIcon = tone === "warn" ? "!" : tone === "ok" ? "✓" : "⚠";
  return (
    <aside
      className={`ds-banner ${toneClass}${className ? ` ${className}` : ""}`}
      role="alert"
    >
      <span className="ds-banner-icon" aria-hidden>
        {icon ?? defaultIcon}
      </span>
      <div className="ds-banner-body">
        {title ? <p className="ds-banner-title">{title}</p> : null}
        <div className="ds-banner-text">{children}</div>
      </div>
    </aside>
  );
}
