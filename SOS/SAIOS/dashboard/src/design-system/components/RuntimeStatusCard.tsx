import { Badge } from "./Badge";

type Props = {
  liveLabel?: string;
  provider?: string;
  cost?: string;
  /** Operational freshness (last gen / timer) — prop name kept for callers. */
  heartbeat?: string;
  queue?: string | number;
  className?: string;
};

function displayCell(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "Unavailable";
  if (typeof value === "number") return String(value);
  const v = value.trim();
  return v || "Unavailable";
}

export function RuntimeStatusCard({
  liveLabel,
  provider,
  cost,
  heartbeat,
  queue,
  className = "",
}: Props) {
  return (
    <section className={`ds-lib-card${className ? ` ${className}` : ""}`}>
      <div className="ds-runtime-head">
        <h3 className="ds-dept-name">Runtime</h3>
        <Badge tone="neutral">{displayCell(liveLabel)}</Badge>
      </div>
      <div className="ds-runtime">
        <div className="ds-runtime-cell">
          <span className="ds-runtime-cell-label">Provider</span>
          <span className="ds-runtime-cell-value">
            {displayCell(provider)}
          </span>
        </div>
        <div className="ds-runtime-cell">
          <span className="ds-runtime-cell-label">Cost</span>
          <span className="ds-runtime-cell-value mono">
            {displayCell(cost)}
          </span>
        </div>
        <div className="ds-runtime-cell">
          <span className="ds-runtime-cell-label">Freshness</span>
          <span className="ds-runtime-cell-value mono">
            {displayCell(heartbeat)}
          </span>
        </div>
        <div className="ds-runtime-cell">
          <span className="ds-runtime-cell-label">Queue</span>
          <span className="ds-runtime-cell-value">{displayCell(queue)}</span>
        </div>
      </div>
    </section>
  );
}
