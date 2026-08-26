import { Badge, type BadgeTone } from "./Badge";

type Props = {
  department: string;
  status: string;
  statusTone?: BadgeTone;
  queue?: string | number;
  provider?: string;
  heartbeat?: string;
  /** Optional last activity label (ISO or display string). */
  lastActivity?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
};

export function DepartmentHealthCard({
  department,
  status,
  statusTone = "processing",
  queue = "—",
  provider = "Mock",
  heartbeat = "—",
  lastActivity,
  onClick,
  disabled = false,
  className = "",
}: Props) {
  const body = (
    <>
      <div className="ds-dept-head">
        <h3 className="ds-dept-name">{department}</h3>
        <Badge tone={statusTone}>{status}</Badge>
      </div>
      <div className="ds-dept-grid">
        <div>
          <span className="ds-dept-meta-label">Queue</span>
          <span className="ds-dept-meta-value">{queue}</span>
        </div>
        <div>
          <span className="ds-dept-meta-label">Provider</span>
          <span className="ds-dept-meta-value">{provider}</span>
        </div>
        <div>
          <span className="ds-dept-meta-label">Heartbeat</span>
          <span className="ds-dept-meta-value mono">{heartbeat}</span>
        </div>
        {lastActivity != null ? (
          <div>
            <span className="ds-dept-meta-label">Last activity</span>
            <span className="ds-dept-meta-value mono">{lastActivity}</span>
          </div>
        ) : null}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={`ds-lib-card ds-lib-interactive ds-dept ds-dept-clickable${className ? ` ${className}` : ""}`}
        onClick={onClick}
        disabled={disabled}
      >
        {body}
      </button>
    );
  }

  return (
    <article
      className={`ds-lib-card ds-lib-interactive ds-dept${className ? ` ${className}` : ""}`}
    >
      {body}
    </article>
  );
}
