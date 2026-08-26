import type { ReactNode } from "react";

export type BadgeTone =
  | "neutral"
  | "waiting"
  | "approved"
  | "ready"
  | "rejected"
  | "blocked"
  | "processing";

type Props = {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
};

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: "ds-badge-neutral",
  waiting: "ds-badge-waiting",
  approved: "ds-badge-approved",
  ready: "ds-badge-ready",
  rejected: "ds-badge-rejected",
  blocked: "ds-badge-blocked",
  processing: "ds-badge-processing",
};

export function Badge({ children, tone = "neutral", className = "" }: Props) {
  return (
    <span className={`ds-badge ${TONE_CLASS[tone]}${className ? ` ${className}` : ""}`}>
      {children}
    </span>
  );
}
