/**
 * Canonical Founder Review projection for resume templates.
 *
 * Single source of truth for:
 * - Founder Review queue
 * - Mission Control Ready for Review
 * - Founder queue capacity / backpressure (Budget, Health, Autonomous, BatchRunner)
 *
 * Storage paths/ids remain legacy (candidate_id, candidates/, candidate.json).
 * Does not rewrite decisions. Does not publish. Does not call OpenAI.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type {
  FounderReviewCriticScores,
  FounderReviewProjectionItem,
  FounderReviewProjectionStatus,
  FounderReviewProjectionSummary,
} from "./FounderReviewProjectionTypes.js";

export const CYCLE_LOG_REL = "SOS/07_LOGS/saios/first-production-cycle";

/** Resolve repository root from first-production-cycle log directory. */
export function resolveRepoRootFromCycleLog(cycleLog: string): string {
  return resolve(cycleLog, "../../../..");
}

type CandidateManifestView = {
  schema_version?: number;
  candidate_id: string;
  task_id: string;
  review_id: string;
  cycle_id: string;
  created_at: string;
  status: string;
  publication_allowed?: boolean;
  provider?: string | null;
  superseded_by_revision?: string;
  target?: {
    category?: string;
    title?: string;
    industry?: string;
    seniority?: string;
    objective?: string;
  };
  artifacts?: Record<string, string | null>;
};

function artifactUrl(relUnderLogs: string | null): string | null {
  if (!relUnderLogs) return null;
  const clean = relUnderLogs.replace(/^\/+/, "");
  if (!clean.startsWith("SOS/07_LOGS/")) return null;
  return `/artifacts/${clean}`;
}

function isThumbnailRel(rel: string | null | undefined): boolean {
  if (!rel) return false;
  return /thumbnail/i.test(rel);
}

function resolveExisting(
  repo: string,
  paths: string[],
): { rel: string | null; url: string | null } {
  for (const rel of paths) {
    if (existsSync(join(repo, rel))) {
      return { rel, url: artifactUrl(rel) };
    }
  }
  return { rel: null, url: null };
}

function resolveFullPreview(
  repo: string,
  paths: string[],
): { rel: string | null; url: string | null } {
  return resolveExisting(
    repo,
    paths.filter((rel) => !isThumbnailRel(rel)),
  );
}

function resolveThumbnail(
  repo: string,
  paths: string[],
): { rel: string | null; url: string | null } {
  return resolveExisting(repo, paths);
}

function attachPreviewFields(
  repo: string,
  fullCandidates: string[],
  thumbCandidates: string[],
): Pick<
  FounderReviewProjectionItem,
  "preview_url" | "preview_path" | "thumbnail_path"
> {
  const full = resolveFullPreview(repo, fullCandidates);
  const thumb = resolveThumbnail(repo, thumbCandidates);
  return {
    preview_url: full.url,
    preview_path: full.rel,
    thumbnail_path: thumb.rel,
  };
}

const EMPTY_MEDIA: Pick<
  FounderReviewProjectionItem,
  "preview_url" | "preview_path" | "thumbnail_path"
> = {
  preview_url: null,
  preview_path: null,
  thumbnail_path: null,
};

function ownMediaForReview(
  repo: string,
  reviewId: string,
  extraFull: string[] = [],
  extraThumb: string[] = [],
): Pick<
  FounderReviewProjectionItem,
  "preview_url" | "preview_path" | "thumbnail_path"
> {
  const fr = reviewId.match(/founder-review-(\d{3})\b/i);
  const frDir = fr
    ? `SOS/07_LOGS/saios/founder-review-${fr[1]}`
    : reviewId.startsWith("founder-review-") &&
        existsSync(join(repo, `SOS/07_LOGS/saios/${reviewId}`))
      ? `SOS/07_LOGS/saios/${reviewId}`
      : null;

  const full = [
    ...extraFull,
    ...(frDir ? [`${frDir}/before/preview.png`, `${frDir}/preview.png`] : []),
  ];
  const thumb = [
    ...extraThumb,
    ...(frDir
      ? [`${frDir}/before/thumbnail.png`, `${frDir}/thumbnail.png`]
      : []),
  ];
  if (!full.length && !thumb.length) return { ...EMPTY_MEDIA };
  return attachPreviewFields(repo, full, thumb);
}

function parseIso(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Registry-admitted resume templates awaiting Founder review (pre-decision overlay).
 * Requires preview + thumbnail; hides superseded revisions.
 */
export function loadWaitingTemplatesFromRegistry(
  repoRoot: string,
): FounderReviewProjectionItem[] {
  const root = join(repoRoot, CYCLE_LOG_REL, "candidates");
  if (!existsSync(root)) return [];

  const items: FounderReviewProjectionItem[] = [];
  for (const name of readdirSync(root)) {
    const manifestPath = join(root, name, "candidate.json");
    if (!existsSync(manifestPath)) continue;
    let m: CandidateManifestView;
    try {
      m = JSON.parse(readFileSync(manifestPath, "utf8")) as CandidateManifestView;
    } catch {
      continue;
    }
    if (
      m.status !== "WAITING_FOUNDER" &&
      m.status !== "READY_FOR_FOUNDER_REVIEW"
    ) {
      continue;
    }
    const supersededBy = m.superseded_by_revision;
    if (typeof supersededBy === "string" && supersededBy.length > 0) {
      continue;
    }
    if (existsSync(join(root, name, "revisions/rev249/forward-link.json"))) {
      continue;
    }
    if (existsSync(join(root, name, "revisions/revfb/forward-link.json"))) {
      continue;
    }
    if (!existsSync(join(root, name, "preview.png"))) continue;
    if (!existsSync(join(root, name, "thumbnail.png"))) continue;
    if (!m.candidate_id || !m.review_id) continue;

    const candRel = `${CYCLE_LOG_REL}/candidates/${m.candidate_id}`;
    const art = m.artifacts ?? {};
    const relInCand = (key: string, fallback: string): string | null => {
      const v = art[key];
      if (typeof v === "string" && v.length > 0) {
        return `${candRel}/${v.replace(/^\.\//, "")}`;
      }
      const fb = `${candRel}/${fallback}`;
      return existsSync(join(repoRoot, fb)) ? fb : null;
    };

    const production_target = relInCand(
      "production_target",
      "production-target.json",
    );
    const research_context = relInCand(
      "research_context",
      "research-context.json",
    );
    const canvas = relInCand("canvas", "canvas.json");
    const criticPath = relInCand("critic", "critic.json");
    const gate = relInCand("gate", "gate.json");
    const dashboard = relInCand("dashboard", "dashboard.json");
    const review = relInCand("review", "review.json");
    const preview = relInCand("preview", "preview.png");
    const thumbnail = relInCand("thumbnail", "thumbnail.png");

    let critic: FounderReviewCriticScores | null = null;
    if (criticPath && existsSync(join(repoRoot, criticPath))) {
      try {
        const raw = JSON.parse(
          readFileSync(join(repoRoot, criticPath), "utf8"),
        ) as {
          scores?: Record<string, number>;
          ready?: boolean;
          readiness?: { ready?: boolean; founder_review_allowed?: boolean };
          gate?: { ready?: boolean };
          report?: { scores?: Record<string, number>; ready?: boolean };
        };
        const scores =
          raw.scores ??
          raw.report?.scores ??
          (raw as { critic?: { scores?: Record<string, number> } }).critic
            ?.scores;
        const ready = Boolean(
          raw.readiness?.ready ??
            raw.ready ??
            raw.report?.ready ??
            raw.gate?.ready ??
            false,
        );
        if (scores) {
          critic = {
            overall: Number(scores.overall ?? 0),
            ats: Number(scores.ats ?? 0),
            visual: Number(scores.visual ?? 0),
            typography: Number(scores.typography ?? 0),
            layout: Number(scores.layout ?? 0),
            technical: Number(scores.technical ?? 0),
            consistency: Number(scores.consistency ?? 0),
            sections: Number(scores.sections ?? 0),
            ready,
            founder_review_allowed: ready,
            publication_allowed: false,
            blocking_reasons: [],
            critic_report_reference: criticPath,
            gate_id: null,
            source: criticPath,
          };
        }
      } catch {
        critic = null;
      }
    }

    const target = m.target ?? {};
    const revisionSummaryPath = join(root, name, "revision-summary.json");
    let revisionMeta: FounderReviewProjectionItem["revision"] = null;
    if (existsSync(revisionSummaryPath)) {
      try {
        const rs = JSON.parse(
          readFileSync(revisionSummaryPath, "utf8"),
        ) as {
          revision_number?: number;
          requested_changes?: string[];
          changes_applied?: string[];
          role?: string;
          prior_candidate_id?: string;
          prior_decision_id?: string | null;
        };
        revisionMeta = {
          revised: true,
          revision_number: rs.revision_number ?? 1,
          prior_status: "CHANGES_REQUESTED",
          requested_changes: rs.requested_changes ?? [],
          changes_applied: rs.changes_applied ?? [],
          role: rs.role,
          prior_candidate_id: rs.prior_candidate_id,
          prior_decision_id: rs.prior_decision_id ?? undefined,
        };
      } catch {
        revisionMeta = { revised: true, revision_number: 1 };
      }
    }
    const isRevised = Boolean(revisionMeta?.revised);
    const title = isRevised
      ? `${revisionMeta?.role ?? target.title ?? "Resume"} — Revision ${revisionMeta?.revision_number ?? 1} · Ready for Review`
      : m.status === "READY_FOR_FOUNDER_REVIEW" && target.title != null
        ? `${target.title} — Ready for Review`
        : target.title != null
          ? `${target.title} Resume Template`
          : `Resume Template ${m.candidate_id}`;
    const template =
      target.category && target.title
        ? `${target.category} · ${target.title}`
        : target.title ?? m.candidate_id;

    const media = attachPreviewFields(
      repoRoot,
      preview ? [preview] : [],
      thumbnail ? [thumbnail] : [],
    );

    items.push({
      review_id: m.review_id,
      candidate_id: m.candidate_id,
      task_id: m.task_id,
      cycle_id: m.cycle_id,
      title,
      template,
      department: "resume",
      provider: m.provider ?? "mock",
      status: "waiting_founder",
      ready: Boolean(critic?.ready ?? true),
      badge: critic?.ready === false ? "blocked" : "waiting",
      created_at: m.created_at,
      ...media,
      critic,
      learning_impact: isRevised
        ? "Revised after Founder feedback — awaiting explicit Approve / Request Changes / Reject. No auto-approval. No publication."
        : "Learning write-back occurs only after a founder decision.",
      source: candRel,
      candidate_directory: candRel,
      revision: revisionMeta,
      production_target: target.category
        ? {
            category: String(target.category),
            title: String(target.title ?? ""),
            industry: String(target.industry ?? ""),
            seniority: String(target.seniority ?? ""),
            objective: target.objective,
          }
        : null,
      artifact_refs: {
        production_target,
        research_context,
        canvas,
        critic: criticPath,
        gate,
        dashboard,
        review,
        preview,
      },
    });
  }

  return items.sort((a, b) => parseIso(b.created_at) - parseIso(a.created_at));
}

/**
 * Full Founder Review projection (registry + decision overlay + optional legacy inject).
 * Preserves active_registry_only workspace behavior.
 */
export function loadFounderReviewProjection(
  repoRoot: string,
): FounderReviewProjectionItem[] {
  const readJson = (rel: string): unknown | null => {
    const p = join(repoRoot, rel);
    if (!existsSync(p)) return null;
    try {
      return JSON.parse(readFileSync(p, "utf8"));
    } catch {
      return null;
    }
  };

  const byId = new Map<string, FounderReviewProjectionItem>();
  const upsert = (item: FounderReviewProjectionItem) => {
    const prev = byId.get(item.review_id);
    if (!prev) {
      byId.set(item.review_id, item);
      return;
    }
    const rank = (x: FounderReviewProjectionItem) =>
      (x.status === "waiting_founder" ? 2 : 0) +
      (x.artifact_refs ? 2 : 0) +
      (x.critic ? 1 : 0);
    if (rank(item) >= rank(prev)) {
      byId.set(item.review_id, {
        ...prev,
        ...item,
        artifact_refs: item.artifact_refs ?? prev.artifact_refs,
        production_target: item.production_target ?? prev.production_target,
        candidate_directory:
          item.candidate_directory ?? prev.candidate_directory,
        preview_url: item.preview_url ?? prev.preview_url,
        preview_path: item.preview_path ?? prev.preview_path,
        thumbnail_path: item.thumbnail_path ?? prev.thumbnail_path,
        critic: item.critic ?? prev.critic,
      });
    }
  };

  const workspace = readJson(
    "SOS/07_LOGS/saios/founder-review-workspace/active.json",
  ) as { mode?: string } | null;
  const activeRegistryOnly = workspace?.mode === "active_registry_only";

  for (const item of loadWaitingTemplatesFromRegistry(repoRoot)) {
    upsert(item);
  }

  if (activeRegistryOnly) {
    const decisionsPath = join(
      repoRoot,
      "SOS/07_LOGS/saios/founder-decisions/decisions.jsonl",
    );
    if (existsSync(decisionsPath)) {
      const latestByReview = new Map<
        string,
        {
          decision_id: string;
          review_id: string;
          decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
          created_at: string;
          fixture?: boolean;
        }
      >();
      for (const line of readFileSync(decisionsPath, "utf8").split("\n")) {
        if (!line.trim()) continue;
        const d = JSON.parse(line) as {
          decision_id: string;
          review_id: string;
          decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
          created_at: string;
          fixture?: boolean;
        };
        if (d.fixture) continue;
        const prev = latestByReview.get(d.review_id);
        if (!prev || String(d.created_at) >= String(prev.created_at)) {
          latestByReview.set(d.review_id, d);
        }
      }
      for (const d of latestByReview.values()) {
        const existing = byId.get(d.review_id);
        if (!existing) continue;
        const status: FounderReviewProjectionStatus =
          d.decision === "APPROVED"
            ? "approved"
            : d.decision === "REJECTED"
              ? "rejected"
              : "changes_requested";
        byId.set(d.review_id, {
          ...existing,
          status,
          decision_id: d.decision_id,
          badge: status === "rejected" ? "blocked" : "ready",
        });
      }
    }
    return [...byId.values()].sort(
      (a, b) => parseIso(b.created_at) - parseIso(a.created_at),
    );
  }

  const dry = readJson(
    "SOS/07_LOGS/saios/first-dry-run/founder-review.json",
  ) as Record<string, unknown> | null;
  if (dry?.id && !byId.has(String(dry.id))) {
    const media = attachPreviewFields(
      repoRoot,
      ["SOS/07_LOGS/saios/first-dry-run/preview.png"],
      ["SOS/07_LOGS/saios/first-dry-run/thumbnail.png"],
    );
    upsert({
      review_id: String(dry.id),
      candidate_id: String(dry.candidate_id ?? dry.task_id ?? dry.id),
      task_id: String(dry.task_id ?? ""),
      cycle_id: String(dry.task_id ?? ""),
      title: String(dry.title ?? "Dry-run review"),
      template: "ATS Marketing Manager (planning)",
      department: "resume",
      provider: "Mock",
      status: "waiting_founder",
      ready: Boolean(dry.qa_pass ?? true),
      badge: "waiting",
      created_at: String(dry.created_at ?? ""),
      ...media,
      critic: null,
      learning_impact:
        "Planning dry-run — learning writes after founder decision.",
      source: String(dry.source ?? "SOS/07_LOGS/saios/first-dry-run"),
    });
  }

  const decisionsPath = join(
    repoRoot,
    "SOS/07_LOGS/saios/founder-decisions/decisions.jsonl",
  );
  const decisions = existsSync(decisionsPath)
    ? readFileSync(decisionsPath, "utf8")
        .split("\n")
        .filter(Boolean)
        .map(
          (l) =>
            JSON.parse(l) as {
              decision_id: string;
              review_id: string;
              task_id: string;
              cycle_id: string;
              decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
              created_at: string;
              fixture?: boolean;
            },
        )
    : [];

  for (const n of ["001", "002", "003", "004", "005"] as const) {
    const dir = `SOS/07_LOGS/saios/founder-review-${n}`;
    if (!existsSync(join(repoRoot, dir))) continue;
    const reviewId = `founder-review-${n}`;
    if (byId.has(reviewId) && byId.get(reviewId)!.status === "waiting_founder") {
      continue;
    }
    const media = ownMediaForReview(repoRoot, reviewId);
    const decided = decisions.find((d) => d.review_id === reviewId && !d.fixture);
    const status: FounderReviewProjectionStatus =
      decided?.decision === "APPROVED"
        ? "approved"
        : decided?.decision === "REJECTED"
          ? "rejected"
          : decided?.decision === "CHANGES_REQUESTED"
            ? "changes_requested"
            : n === "004"
              ? "waiting_founder"
              : "approved";
    upsert({
      review_id: reviewId,
      candidate_id: `fr-cand-${n}`,
      task_id: `fr-task-${n}`,
      cycle_id: `fr-cycle-${n}`,
      title: `Founder Review #${n}`,
      template: `FR#${n}`,
      department: "resume",
      provider: "Mock",
      status,
      ready: true,
      badge: status === "waiting_founder" ? "waiting" : "ready",
      created_at: `2026-07-0${Math.min(9, Number(n) + 5)}T10:00:00.000Z`,
      ...media,
      critic: null,
      decision_id: decided?.decision_id,
      learning_impact: "Historical founder review package.",
      source: dir,
    });
  }

  const latestByReview = new Map<string, (typeof decisions)[number]>();
  for (const d of decisions.filter((x) => !x.fixture)) {
    const prev = latestByReview.get(d.review_id);
    if (!prev || String(d.created_at) >= String(prev.created_at)) {
      latestByReview.set(d.review_id, d);
    }
  }
  for (const d of latestByReview.values()) {
    const status: FounderReviewProjectionStatus =
      d.decision === "APPROVED"
        ? "approved"
        : d.decision === "REJECTED"
          ? "rejected"
          : "changes_requested";
    const existing = byId.get(d.review_id);
    if (existing) {
      byId.set(d.review_id, {
        ...existing,
        status,
        decision_id: d.decision_id,
        badge: status === "rejected" ? "blocked" : "ready",
        learning_impact:
          d.decision === "APPROVED"
            ? "Approved · Stage for StudiosisLab available · publication_allowed=false"
            : `Decision ${d.decision} recorded · publication_allowed remains false.`,
      });
      continue;
    }
    upsert({
      review_id: d.review_id,
      candidate_id: d.review_id,
      task_id: d.task_id,
      cycle_id: d.cycle_id,
      title: d.review_id,
      template: d.review_id,
      department: "resume",
      provider: "Mock",
      status,
      ready: true,
      badge: status === "rejected" ? "blocked" : "ready",
      created_at: d.created_at,
      ...EMPTY_MEDIA,
      critic: null,
      decision_id: d.decision_id,
      learning_impact: "Decision recorded; publication_allowed remains false.",
      source: "SOS/07_LOGS/saios/founder-decisions",
    });
  }

  void readJson(`${CYCLE_LOG_REL}/latest-candidate.json`);

  return [...byId.values()].sort(
    (a, b) => parseIso(b.created_at) - parseIso(a.created_at),
  );
}

/** Summarize the canonical Founder Review projection. */
export function summarizeFounderReviewProjection(
  repoRoot: string,
): FounderReviewProjectionSummary {
  const items = loadFounderReviewProjection(repoRoot);
  let waiting = 0;
  let approved = 0;
  let rejected = 0;
  let changes_requested = 0;
  const waiting_by_category: Record<string, number> = {};

  for (const item of items) {
    if (item.status === "waiting_founder") {
      waiting += 1;
      const cat = item.production_target?.category;
      if (cat) {
        waiting_by_category[cat] = (waiting_by_category[cat] ?? 0) + 1;
      }
    } else if (item.status === "approved") {
      approved += 1;
    } else if (item.status === "rejected") {
      rejected += 1;
    } else if (item.status === "changes_requested") {
      changes_requested += 1;
    }
  }

  return {
    waiting,
    approved,
    rejected,
    changes_requested,
    total_visible: items.length,
    waiting_by_category,
    items,
  };
}

/**
 * Canonical actionable Ready-for-Review count for production backpressure.
 * Fail-closed consumers: deny when waiting >= queue_max.
 */
export function countFounderReviewWaiting(repoRoot: string): number {
  return summarizeFounderReviewProjection(repoRoot).waiting;
}

/**
 * Waiting-by-category from the canonical projection (category saturation).
 */
export function countFounderReviewWaitingByCategory(
  repoRoot: string,
): Record<string, number> {
  return summarizeFounderReviewProjection(repoRoot).waiting_by_category;
}
