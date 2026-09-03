/**
 * Project-state projection merge for Website Department.
 * Testable without writing the real SOS/project-state.json.
 */
import type { WebsiteDepartmentResult } from "./types.js";

export type ProjectStateLike = {
  latest_agent?: string;
  next_agent?: string;
  generated_at?: string;
  history?: Array<{ at: string; type: string; summary: string; ref: string }>;
  operations?: Record<string, unknown>;
  [key: string]: unknown;
};

const PRESERVED_WEBSITE_KEYS = [
  "enabled",
  "reason",
  "scheduled_checks",
  "autonomous_changes",
] as const;

/**
 * Merge website_department ops without clobbering enablement/schedule policy
 * and without mutating global agent fields.
 */
export function mergeWebsiteDepartmentProjection(
  state: ProjectStateLike,
  result: WebsiteDepartmentResult,
  opts?: { history_ref?: string },
): ProjectStateLike {
  const prevOps = (state.operations ?? {}) as Record<string, unknown>;
  const prevWeb = (prevOps.website_department ?? {}) as Record<string, unknown>;

  const preserved: Record<string, unknown> = {};
  for (const key of PRESERVED_WEBSITE_KEYS) {
    if (key in prevWeb) preserved[key] = prevWeb[key];
  }

  const website_department = {
    ...prevWeb,
    ...preserved,
    last_run: result.generated_at,
    last_run_id: result.run.run_id,
    status: result.status,
    mode: result.mode,
    alert_count: result.alerts.length,
    route_failures: result.routes.filter((r) => !r.ok).length,
    output_dir: result.output_dir,
    evidence_kind: result.run.evidence_kind,
    browser_coverage: result.run.browser_coverage,
    auth_coverage: result.run.auth_coverage,
    mobile_coverage: result.run.mobile_coverage,
    download_coverage: result.run.download_coverage,
  };

  const historyEntry = {
    at: result.generated_at,
    type: "website_department",
    summary: `Website Department ${result.status} (${result.mode}) run_id=${result.run.run_id}`,
    ref: opts?.history_ref ?? `${result.output_dir}/latest/website-health.json`,
  };

  return {
    ...state,
    // Explicitly preserve agent numbering — do not overwrite.
    latest_agent: state.latest_agent,
    next_agent: state.next_agent,
    operations: {
      ...prevOps,
      website_department,
    },
    history: [...(state.history ?? []), historyEntry],
  };
}

export function assertNoAgentMutation(
  before: ProjectStateLike,
  after: ProjectStateLike,
): void {
  if (before.latest_agent !== after.latest_agent) {
    throw new Error(
      `latest_agent mutated: ${String(before.latest_agent)} → ${String(after.latest_agent)}`,
    );
  }
  if (before.next_agent !== after.next_agent) {
    throw new Error(
      `next_agent mutated: ${String(before.next_agent)} → ${String(after.next_agent)}`,
    );
  }
}
