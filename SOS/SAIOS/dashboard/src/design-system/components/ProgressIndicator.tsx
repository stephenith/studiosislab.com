type Props = {
  value: number;
  max?: number;
  label?: string;
  showPercent?: boolean;
  tone?: "neutral" | "processing" | "approved" | "waiting";
  className?: string;
};

export function ProgressIndicator({
  value,
  max = 100,
  label,
  showPercent = true,
  tone = "neutral",
  className = "",
}: Props) {
  const safeMax = max <= 0 ? 100 : max;
  const clamped = Math.max(0, Math.min(value, safeMax));
  const pct = Math.round((clamped / safeMax) * 100);

  return (
    <div
      className={`ds-progress${className ? ` ${className}` : ""}`}
      data-tone={tone === "neutral" ? undefined : tone}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-label={label ?? "Progress"}
    >
      {(label || showPercent) && (
        <div className="ds-progress-meta">
          <span>{label ?? ""}</span>
          {showPercent ? <span>{pct}%</span> : null}
        </div>
      )}
      <div className="ds-progress-track">
        <div className="ds-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
