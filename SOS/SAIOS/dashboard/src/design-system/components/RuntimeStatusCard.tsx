import { Badge } from "./Badge";

type Props = {
  liveLabel?: string;
  provider?: string;
  cost?: string;
  heartbeat?: string;
  queue?: string | number;
  className?: string;
};

export function RuntimeStatusCard({
  liveLabel = "LIVE OFF",
  provider = "Mock",
  cost = "$0",
  heartbeat = "—",
  queue = 0,
  className = "",
}: Props) {
  return (
    <section className={`ds-lib-card${className ? ` ${className}` : ""}`}>
      <div className="ds-runtime-head">
        <h3 className="ds-dept-name">Runtime</h3>
        <Badge tone="neutral" className="badge live-off">
          {liveLabel}
        </Badge>
      </div>
      <div className="ds-runtime">
        <div className="ds-runtime-cell">
          <span className="ds-runtime-cell-label">Provider</span>
          <span className="ds-runtime-cell-value">{provider}</span>
        </div>
        <div className="ds-runtime-cell">
          <span className="ds-runtime-cell-label">Cost</span>
          <span className="ds-runtime-cell-value mono">{cost}</span>
        </div>
        <div className="ds-runtime-cell">
          <span className="ds-runtime-cell-label">Heartbeat</span>
          <span className="ds-runtime-cell-value mono">{heartbeat}</span>
        </div>
        <div className="ds-runtime-cell">
          <span className="ds-runtime-cell-label">Queue</span>
          <span className="ds-runtime-cell-value">{queue}</span>
        </div>
      </div>
    </section>
  );
}
