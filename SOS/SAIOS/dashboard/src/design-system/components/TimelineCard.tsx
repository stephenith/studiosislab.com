export type TimelineSeverity = "info" | "warn" | "error" | "ok";

export type TimelineEntry = {
  id: string;
  title: string;
  timestamp: string;
  body?: string;
  icon?: string;
  severity?: TimelineSeverity;
  onClick?: () => void;
};

type Props = {
  title?: string;
  items: TimelineEntry[];
  className?: string;
  emptyLabel?: string;
};

export function TimelineCard({
  title = "Recent activity",
  items,
  className = "",
  emptyLabel = "No recent activity",
}: Props) {
  return (
    <section className={`ds-lib-card${className ? ` ${className}` : ""}`}>
      <h3 className="ds-dept-name ds-timeline-heading">{title}</h3>
      {items.length === 0 ? (
        <p className="ds-meta">{emptyLabel}</p>
      ) : (
        <ul className="ds-timeline">
          {items.map((item) => (
            <li key={item.id} className="ds-timeline-item">
              <span
                className="ds-timeline-icon"
                data-severity={item.severity ?? "info"}
                aria-hidden
              >
                {item.icon ?? "•"}
              </span>
              <div>
                {item.onClick ? (
                  <button
                    type="button"
                    className="ds-timeline-title ds-timeline-title-btn"
                    onClick={item.onClick}
                  >
                    {item.title}
                  </button>
                ) : (
                  <p className="ds-timeline-title">{item.title}</p>
                )}
                <p className="ds-timeline-time mono">{item.timestamp}</p>
                {item.body ? (
                  <p className="ds-timeline-body">{item.body}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
