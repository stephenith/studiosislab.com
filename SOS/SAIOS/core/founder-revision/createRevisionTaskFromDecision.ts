/**
 * Create a durable revision task from a CHANGES_REQUESTED Founder decision.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  createRevisionTask,
  findTaskByDecisionId,
} from "./RevisionTaskStore.js";
import type { RevisionTask } from "./revision-task-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const CAND_ROOT = join(
  REPO,
  "SOS/07_LOGS/saios/first-production-cycle/candidates",
);

export type DecisionLike = {
  decision_id: string;
  review_id: string;
  decision: string;
  reason: string;
  requested_changes?: string[];
  structured_feedback?: { candidate_id?: string };
  task_id?: string;
  cycle_id?: string;
};

function inferCandidateId(decision: DecisionLike): string | null {
  const fromSf = decision.structured_feedback?.candidate_id;
  if (typeof fromSf === "string" && fromSf.trim()) return fromSf.trim();
  // founder-review-cycle-<cand...> or founder-review-<cand...>
  const rid = decision.review_id ?? "";
  const m =
    rid.match(/^founder-review-(?:cycle-)?(.+)$/) ??
    rid.match(/^founder-review-(.+)$/);
  if (m?.[1]) {
    const cand = m[1].startsWith("cand-") ? m[1] : `cand-${m[1]}`;
    // strip leading "cycle-" if doubled
    const cleaned = cand.replace(/^cand-cycle-/, "cand-");
    if (existsSync(join(CAND_ROOT, cleaned, "canvas.json"))) return cleaned;
    if (existsSync(join(CAND_ROOT, m[1], "canvas.json"))) return m[1];
  }
  return null;
}

function inferRole(candidateId: string, candidateJson: Record<string, unknown> | null): string {
  const target = (candidateJson?.target as Record<string, unknown>) ?? {};
  const title = String(target.title ?? "");
  if (/software engineer/i.test(title) || /engineering/i.test(candidateId)) {
    return "Software Engineer";
  }
  if (/graphic designer/i.test(title) || /creative/i.test(candidateId)) {
    return "Graphic Designer";
  }
  if (/hr manager/i.test(title) || /hr-manager/i.test(candidateId)) {
    return "HR Manager";
  }
  if (/marketing/i.test(title) || /marketing/i.test(candidateId)) {
    return "Marketing Manager";
  }
  if (/accountant/i.test(title) || /finance/i.test(candidateId)) {
    return "Accountant";
  }
  return title.split(/\s+/).slice(0, 3).join(" ") || "Resume";
}

function inferFamily(candidateId: string, candidateJson: Record<string, unknown> | null): string | null {
  const target = (candidateJson?.target as Record<string, unknown>) ?? {};
  const title = String(target.title ?? candidateId);
  const m = title.match(
    /\b(modern|executive|editorial|technical|contemporary_accent|classic)\b/i,
  );
  if (m) return m[1]!.toLowerCase();
  if (/modern/i.test(candidateId)) return "modern";
  if (/editorial/i.test(candidateId)) return "editorial";
  if (/contemporary/i.test(candidateId)) return "contemporary_accent";
  return null;
}

export function createRevisionTaskFromDecision(decision: DecisionLike): {
  ok: boolean;
  created: boolean;
  task: RevisionTask | null;
  error: string | null;
} {
  if (decision.decision !== "CHANGES_REQUESTED") {
    return {
      ok: false,
      created: false,
      task: null,
      error: "only CHANGES_REQUESTED creates revision tasks",
    };
  }
  const existing = findTaskByDecisionId(decision.decision_id);
  if (existing) {
    return { ok: true, created: false, task: existing, error: null };
  }

  const prior_candidate_id = inferCandidateId(decision);
  if (!prior_candidate_id) {
    return {
      ok: false,
      created: false,
      task: null,
      error: "could not resolve prior candidate_id",
    };
  }
  const canvasPath = join(CAND_ROOT, prior_candidate_id, "canvas.json");
  if (!existsSync(canvasPath)) {
    return {
      ok: false,
      created: false,
      task: null,
      error: `prior canvas missing: ${canvasPath}`,
    };
  }

  let candidateJson: Record<string, unknown> | null = null;
  try {
    candidateJson = JSON.parse(
      readFileSync(join(CAND_ROOT, prior_candidate_id, "candidate.json"), "utf8"),
    ) as Record<string, unknown>;
  } catch {
    candidateJson = null;
  }

  const changes =
    Array.isArray(decision.requested_changes) && decision.requested_changes.length
      ? decision.requested_changes.map(String)
      : [decision.reason];

  const { task, created } = createRevisionTask({
    decision_id: decision.decision_id,
    review_id: decision.review_id,
    prior_candidate_id,
    prior_canvas_path: `SOS/07_LOGS/saios/first-production-cycle/candidates/${prior_candidate_id}/canvas.json`,
    founder_reason: decision.reason,
    requested_changes: changes,
    role: inferRole(prior_candidate_id, candidateJson),
    design_family: inferFamily(prior_candidate_id, candidateJson),
    revision_number: 1,
  });

  return { ok: true, created, task, error: null };
}
