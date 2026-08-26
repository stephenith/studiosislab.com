/**
 * AIOS pipeline strip — reusable stage chips (Agent #150).
 * Presentational only; parents supply stage list + status.
 */
import { Badge, type BadgeTone } from "./Badge";

export type PipelineStageStatus =
  | "completed"
  | "running"
  | "waiting"
  | "blocked"
  | "idle";

export type PipelineStage = {
  id: string;
  label: string;
  status: PipelineStageStatus;
};

const TONE: Record<PipelineStageStatus, BadgeTone> = {
  completed: "approved",
  running: "processing",
  waiting: "waiting",
  blocked: "rejected",
  idle: "neutral",
};

type Props = {
  stages: PipelineStage[];
  className?: string;
  emptyLabel?: string;
};

export function PipelineStrip({
  stages,
  className = "",
  emptyLabel = "No runtime data available",
}: Props) {
  if (!stages.length) {
    return <p className="ds-meta">{emptyLabel}</p>;
  }

  return (
    <ol className={`ds-pipeline${className ? ` ${className}` : ""}`}>
      {stages.map((stage, i) => (
        <li key={stage.id} className="ds-pipeline-item">
          <div className="ds-pipeline-node" data-status={stage.status}>
            <span className="ds-pipeline-label">{stage.label}</span>
            <Badge tone={TONE[stage.status]}>{stage.status}</Badge>
          </div>
          {i < stages.length - 1 ? (
            <span className="ds-pipeline-arrow" aria-hidden>
              →
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
