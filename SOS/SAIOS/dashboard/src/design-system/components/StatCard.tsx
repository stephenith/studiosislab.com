type Props = {
  value: string | number;
  label: string;
  hint?: string;
};

export function StatCard({ value, label, hint }: Props) {
  return (
    <div className="ds-stat-card">
      <div className="ds-stat-value">{value}</div>
      <div className="ds-stat-label">{label}</div>
      {hint ? <div className="muted ds-meta-mono">{hint}</div> : null}
    </div>
  );
}

export function MetricCard({ value, label, hint }: Props) {
  return (
    <div className="ds-metric-card">
      <div className="ds-metric-value">{value}</div>
      <div className="ds-metric-label">{label}</div>
      {hint ? <div className="muted ds-meta-mono">{hint}</div> : null}
    </div>
  );
}
