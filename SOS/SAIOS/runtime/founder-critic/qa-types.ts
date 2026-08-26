/** Minimal QA report shape for critic scoring. */
export type QAStageReport = {
  pass?: boolean;
  checks?: Array<{ id: string; pass: boolean; detail?: string }>;
};
