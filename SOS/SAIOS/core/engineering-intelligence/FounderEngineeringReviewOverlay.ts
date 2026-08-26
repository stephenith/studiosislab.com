/**
 * Founder Engineering Review overlay — Agent #224.
 *
 * Lightweight status metadata only. Reuses Engineering Intelligence reports.
 * Never regenerates recommendations. Never executes cleanup/refactor/production.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  ENGINEERING_REPORT_PATH,
  type EngineeringRecommendation,
} from "./EngineeringIntelligence.js";

const REPO = resolve(import.meta.dirname, "../../../..");

export const FOUNDER_ENG_REVIEW_STATUS_PATH = join(
  REPO,
  "SOS/07_LOGS/saios/engineering-intelligence/founder-review-statuses.json",
);

export type FounderEngReviewStatus =
  | "OPEN"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "DEFERRED";

export type FounderEngReviewStatusEntry = {
  recommendation_id: string;
  status: FounderEngReviewStatus;
  updated_at: string;
  note?: string;
};

export type FounderEngReviewStatusStore = {
  schema_version: 1;
  agent: "224";
  updated_at: string;
  /** Status overlays only — never duplicates full recommendations. */
  statuses: Record<string, FounderEngReviewStatusEntry>;
  execution_triggered: false;
  code_modified: false;
  cleanup_triggered: false;
  openai_called: false;
  production_triggered: false;
  publication_allowed: false;
  live: false;
};

export type EngineeringReviewItem = Omit<EngineeringRecommendation, "status"> & {
  title: string;
  affected_files: string[];
  founder_status: FounderEngReviewStatus;
  report_status: string;
  status_updated_at: string | null;
};

export type EngineeringReviewProjection = {
  schema_version: 1;
  agent: "224";
  generated_at: string;
  report_path: string;
  report_generated_at: string | null;
  overall_score: number | null;
  scores: Record<string, number> | null;
  recommendations: EngineeringReviewItem[];
  counts: {
    open: number;
    under_review: number;
    approved: number;
    rejected: number;
    deferred: number;
    total: number;
  };
  newest_findings: string[];
  advisory_only: true;
  execution_triggered: false;
  code_modified: false;
  cleanup_triggered: false;
  openai_called: false;
  production_triggered: false;
  publication_allowed: false;
  live: false;
  founder_approval_required: true;
  duplicate_storage: false;
  duplicate_engine: false;
};

const ALLOWED: FounderEngReviewStatus[] = [
  "OPEN",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "DEFERRED",
];

function atomicWriteJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

function emptyStore(now: string): FounderEngReviewStatusStore {
  return {
    schema_version: 1,
    agent: "224",
    updated_at: now,
    statuses: {},
    execution_triggered: false,
    code_modified: false,
    cleanup_triggered: false,
    openai_called: false,
    production_triggered: false,
    publication_allowed: false,
    live: false,
  };
}

export function loadFounderEngReviewStatuses(
  repoRoot = REPO,
): FounderEngReviewStatusStore {
  const path = join(
    repoRoot,
    "SOS/07_LOGS/saios/engineering-intelligence/founder-review-statuses.json",
  );
  if (!existsSync(path)) return emptyStore(new Date().toISOString());
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as FounderEngReviewStatusStore;
    if (!raw || typeof raw !== "object" || !raw.statuses) {
      return emptyStore(new Date().toISOString());
    }
    return {
      ...emptyStore(raw.updated_at ?? new Date().toISOString()),
      ...raw,
      statuses: raw.statuses ?? {},
      execution_triggered: false,
      code_modified: false,
      cleanup_triggered: false,
      openai_called: false,
      production_triggered: false,
      publication_allowed: false,
      live: false,
    };
  } catch {
    return emptyStore(new Date().toISOString());
  }
}

function isPathLike(s: string): boolean {
  return (
    s.includes("/") ||
    s.endsWith(".ts") ||
    s.endsWith(".tsx") ||
    s.endsWith(".md") ||
    s.endsWith(".json")
  );
}

function toItem(
  rec: EngineeringRecommendation,
  overlay: FounderEngReviewStatusEntry | undefined,
): EngineeringReviewItem {
  const founder_status = overlay?.status ?? "OPEN";
  const { status: report_status, ...rest } = rec;
  return {
    ...rest,
    title: rec.suggested_action || rec.recommendation_id,
    affected_files: rec.affected_components.filter(isPathLike),
    founder_status,
    report_status: String(report_status),
    status_updated_at: overlay?.updated_at ?? null,
  };
}

/**
 * Project Engineering Intelligence report + lightweight Founder status overlays.
 * Does not regenerate recommendations. Does not mutate the engineering report.
 */
export function loadEngineeringReviewProjection(opts?: {
  repoRoot?: string;
  now?: Date;
}): EngineeringReviewProjection {
  const repoRoot = opts?.repoRoot ?? REPO;
  const now = (opts?.now ?? new Date()).toISOString();
  const reportPath = join(
    repoRoot,
    "SOS/07_LOGS/saios/engineering-intelligence/engineering-intelligence-report.json",
  );
  const store = loadFounderEngReviewStatuses(repoRoot);

  let report: Record<string, unknown> | null = null;
  if (existsSync(reportPath)) {
    try {
      report = JSON.parse(readFileSync(reportPath, "utf8")) as Record<
        string,
        unknown
      >;
    } catch {
      report = null;
    }
  }

  const rawRecs = Array.isArray(report?.recommendations)
    ? (report!.recommendations as EngineeringRecommendation[])
    : [];
  const recommendations = rawRecs.map((r) =>
    toItem(r, store.statuses[r.recommendation_id]),
  );

  const counts = {
    open: 0,
    under_review: 0,
    approved: 0,
    rejected: 0,
    deferred: 0,
    total: recommendations.length,
  };
  for (const r of recommendations) {
    if (r.founder_status === "OPEN") counts.open += 1;
    else if (r.founder_status === "UNDER_REVIEW") counts.under_review += 1;
    else if (r.founder_status === "APPROVED") counts.approved += 1;
    else if (r.founder_status === "REJECTED") counts.rejected += 1;
    else if (r.founder_status === "DEFERRED") counts.deferred += 1;
  }

  const scores =
    report?.scores && typeof report.scores === "object"
      ? (report.scores as Record<string, number>)
      : null;

  // Newest findings = recommendations still OPEN, sorted by id (stable) then severity
  const sevRank: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };
  const newest_findings = [...recommendations]
    .filter((r) => r.founder_status === "OPEN")
    .sort(
      (a, b) =>
        (sevRank[a.severity] ?? 9) - (sevRank[b.severity] ?? 9) ||
        a.recommendation_id.localeCompare(b.recommendation_id),
    )
    .slice(0, 5)
    .map((r) => r.recommendation_id);

  return {
    schema_version: 1,
    agent: "224",
    generated_at: now,
    report_path: existsSync(reportPath)
      ? "SOS/07_LOGS/saios/engineering-intelligence/engineering-intelligence-report.json"
      : "",
    report_generated_at:
      typeof report?.generated_at === "string" ? report.generated_at : null,
    overall_score: typeof scores?.overall === "number" ? scores.overall : null,
    scores,
    recommendations,
    counts,
    newest_findings,
    advisory_only: true,
    execution_triggered: false,
    code_modified: false,
    cleanup_triggered: false,
    openai_called: false,
    production_triggered: false,
    publication_allowed: false,
    live: false,
    founder_approval_required: true,
    duplicate_storage: false,
    duplicate_engine: false,
  };
}

/**
 * Persist Founder review status only. Never executes remediation.
 */
export function updateFounderEngReviewStatus(opts: {
  recommendation_id: string;
  status: FounderEngReviewStatus;
  note?: string;
  repoRoot?: string;
  now?: Date;
}): {
  ok: true;
  entry: FounderEngReviewStatusEntry;
  execution_triggered: false;
  code_modified: false;
  cleanup_triggered: false;
} {
  const repoRoot = opts.repoRoot ?? REPO;
  const now = (opts.now ?? new Date()).toISOString();
  if (!ALLOWED.includes(opts.status)) {
    throw new Error(`invalid status: ${opts.status}`);
  }
  if (!opts.recommendation_id || typeof opts.recommendation_id !== "string") {
    throw new Error("recommendation_id required");
  }

  // Ensure recommendation exists in current engineering report (no inventing)
  const projection = loadEngineeringReviewProjection({ repoRoot, now: opts.now });
  const exists = projection.recommendations.some(
    (r) => r.recommendation_id === opts.recommendation_id,
  );
  if (!exists) {
    throw new Error(`unknown recommendation_id: ${opts.recommendation_id}`);
  }

  const store = loadFounderEngReviewStatuses(repoRoot);
  const entry: FounderEngReviewStatusEntry = {
    recommendation_id: opts.recommendation_id,
    status: opts.status,
    updated_at: now,
    ...(opts.note ? { note: opts.note } : {}),
  };
  store.statuses[opts.recommendation_id] = entry;
  store.updated_at = now;
  store.execution_triggered = false;
  store.code_modified = false;
  store.cleanup_triggered = false;
  store.openai_called = false;
  store.production_triggered = false;
  store.publication_allowed = false;
  store.live = false;

  const path = join(
    repoRoot,
    "SOS/07_LOGS/saios/engineering-intelligence/founder-review-statuses.json",
  );
  atomicWriteJson(path, store);

  return {
    ok: true,
    entry,
    execution_triggered: false,
    code_modified: false,
    cleanup_triggered: false,
  };
}

export { ENGINEERING_REPORT_PATH };
