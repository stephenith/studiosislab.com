/**
 * Canonical Duplicate Prevention — Agent #210.
 * Deterministic preflight: ALLOW | SKIP_DUPLICATE. No LLM. No embeddings.
 */
import { createHash } from "node:crypto";
import type { ProductionTarget } from "./ProductionTarget.js";
import type { CandidateManifest, CandidateStatus } from "./CandidateStore.js";
import {
  listCandidateManifests,
  type CandidateRegistryKind,
} from "./CandidateStore.js";

export const NORMALIZATION_VERSION = 1 as const;

/** Statuses that reserve a target fingerprint (FAILED does not). */
export const RESERVING_STATUSES: ReadonlySet<CandidateStatus | string> = new Set([
  "RUNNING",
  "WAITING_FOUNDER",
  "CRITIC_BLOCKED",
  "APPROVED",
  "COMPLETED",
]);

export type DuplicateType =
  | "EXACT_TARGET"
  | "NEAR_TARGET"
  | "BATCH_REPEAT"
  | null;

export type DuplicateDecisionKind = "ALLOW" | "SKIP_DUPLICATE";

export type DuplicateDecision = {
  decision: DuplicateDecisionKind;
  duplicate_type: DuplicateType;
  target_fingerprint: string;
  matched_candidate_id: string | null;
  matched_batch_sequence: number | null;
  score: number | null;
  threshold: number | null;
  reason: string;
  checked_at: string;
  normalization_version: typeof NORMALIZATION_VERSION;
  comparison_registry_size: number;
};

export type DuplicateControlMeta = {
  target_fingerprint: string;
  normalization_version: typeof NORMALIZATION_VERSION;
  duplicate_status: "UNIQUE";
  decision: "ALLOW";
  checked_at: string;
  comparison_registry_size: number;
  batch_local_check: boolean;
};

export type NormalizedTarget = {
  category: string;
  title: string;
  industry: string;
  seniority: string;
  objective: string;
};

export type BatchLocalDuplicateState = {
  accepted_fingerprints: Set<string>;
  skipped_fingerprints: Set<string>;
  attempted_fingerprints: Set<string>;
  /** category|normalizedTitle clusters rejected as EXACT/NEAR this batch. */
  excluded_clusters: Set<string>;
};

/**
 * Title/profile cluster key (seniority-invariant). Used for batch-local
 * exclusion of COO mid/senior/executive style repeats without weakening
 * registry near-duplicate thresholds.
 */
export function targetClusterKey(
  target: Pick<ProductionTarget, "category" | "title">,
): string {
  const category = normalizeText(target.category);
  const title = applyTitleSynonyms(normalizeText(target.title));
  return `${category}|${title}`;
}

/** Title near-duplicate threshold (Jaccard on tokens). Conservative. */
export const NEAR_TITLE_JACCARD = 0.85;
/** Objective near-duplicate threshold (mandatory for NEAR_TARGET). */
export const NEAR_OBJECTIVE_JACCARD = 0.7;
/**
 * Near-duplicate requires:
 * - category equality
 * - title Jaccard ≥ NEAR_TITLE_JACCARD
 * - objective Jaccard ≥ NEAR_OBJECTIVE_JACCARD (mandatory — avoids collapsing distinct intents)
 * - at least NEAR_FIELD_AGREE_MIN of {industry, seniority} equality
 */
export const NEAR_FIELD_AGREE_MIN = 1;

/** Deterministic title synonym collapses (conservative). */
const TITLE_SYNONYMS: Array<[string, string]> = [
  ["finance analyst", "financial analyst"],
  ["sr marketing manager", "senior marketing manager"],
  ["marketing manager senior level", "senior marketing manager"],
  ["marketing manager senior", "senior marketing manager"],
];

export function normalizeText(raw: string): string {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/[_—–−-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function applyTitleSynonyms(title: string): string {
  let t = title;
  for (const [from, to] of TITLE_SYNONYMS) {
    if (t === from) t = to;
  }
  return t;
}

export function normalizeProductionTarget(
  target: Pick<
    ProductionTarget,
    "category" | "title" | "industry" | "seniority" | "objective"
  >,
): NormalizedTarget {
  return {
    category: normalizeText(target.category),
    title: applyTitleSynonyms(normalizeText(target.title)),
    industry: normalizeText(target.industry),
    seniority: normalizeText(target.seniority),
    objective: normalizeText(target.objective),
  };
}

export function fingerprintNormalizedTarget(n: NormalizedTarget): string {
  const payload = [
    `v${NORMALIZATION_VERSION}`,
    n.category,
    n.title,
    n.industry,
    n.seniority,
    n.objective,
  ].join("|");
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export function fingerprintProductionTarget(
  target: Pick<
    ProductionTarget,
    "category" | "title" | "industry" | "seniority" | "objective"
  >,
): string {
  return fingerprintNormalizedTarget(normalizeProductionTarget(target));
}

export function tokenSet(text: string): Set<string> {
  const STOP = new Set([
    "a",
    "an",
    "the",
    "and",
    "or",
    "of",
    "for",
    "to",
    "in",
    "on",
    "at",
    "level",
    "resume",
    "produce",
    "ats",
    "friendly",
    "construction",
    "cycle",
    "dry",
    "run",
  ]);
  const out = new Set<string>();
  for (const tok of normalizeText(text).split(" ")) {
    if (!tok || STOP.has(tok) || tok.length < 2) continue;
    out.add(tok);
  }
  return out;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function createBatchLocalDuplicateState(): BatchLocalDuplicateState {
  return {
    accepted_fingerprints: new Set(),
    skipped_fingerprints: new Set(),
    attempted_fingerprints: new Set(),
    excluded_clusters: new Set(),
  };
}

export function fingerprintFromManifest(m: CandidateManifest): string {
  const stored = (
    m as CandidateManifest & {
      duplicate_control?: { target_fingerprint?: string };
    }
  ).duplicate_control?.target_fingerprint;
  if (typeof stored === "string" && stored.length >= 16) return stored;
  return fingerprintProductionTarget({
    category: m.target.category as ProductionTarget["category"],
    title: m.target.title,
    industry: m.target.industry,
    seniority: m.target.seniority as ProductionTarget["seniority"],
    objective: m.target.objective,
  });
}

function isReservingStatus(status: string): boolean {
  return RESERVING_STATUSES.has(status);
}

function nearDuplicateScore(
  proposed: NormalizedTarget,
  existing: NormalizedTarget,
): { score: number; agree: number; objJ: number; titleJ: number } {
  const titleJ = jaccard(tokenSet(proposed.title), tokenSet(existing.title));
  const objJ = jaccard(
    tokenSet(proposed.objective),
    tokenSet(existing.objective),
  );
  let agree = 0;
  if (proposed.industry === existing.industry) agree += 1;
  if (proposed.seniority === existing.seniority) agree += 1;

  const score =
    (proposed.category === existing.category ? 0.2 : 0) +
    titleJ * 0.35 +
    (proposed.industry === existing.industry ? 0.1 : 0) +
    (proposed.seniority === existing.seniority ? 0.1 : 0) +
    objJ * 0.25;

  return { score: Number(score.toFixed(4)), agree, objJ, titleJ };
}

function isConservativeNearDuplicate(
  proposed: NormalizedTarget,
  existing: NormalizedTarget,
): { hit: boolean; score: number } {
  if (proposed.category !== existing.category) {
    return { hit: false, score: 0 };
  }
  const { score, agree, objJ, titleJ } = nearDuplicateScore(proposed, existing);
  if (titleJ < NEAR_TITLE_JACCARD) {
    return { hit: false, score };
  }
  if (objJ < NEAR_OBJECTIVE_JACCARD) {
    return { hit: false, score };
  }
  if (agree < NEAR_FIELD_AGREE_MIN) {
    return { hit: false, score };
  }
  return { hit: true, score };
}

export type EvaluateDuplicateInput = {
  target: ProductionTarget;
  cycleLog: string;
  batchLocal?: BatchLocalDuplicateState | null;
  /** Override registry (tests/fixtures). */
  manifests?: CandidateManifest[];
  /** Agent #231 — verification runs compare within candidates-verify. */
  registry_kind?: CandidateRegistryKind;
  now?: Date;
};

/**
 * Evaluate proposed target. ALLOW or SKIP_DUPLICATE.
 * FAILED candidates do not permanently reserve the target.
 */
export function evaluateDuplicate(
  input: EvaluateDuplicateInput,
): DuplicateDecision {
  const checked_at = (input.now ?? new Date()).toISOString();
  const normalized = normalizeProductionTarget(input.target);
  const target_fingerprint = fingerprintNormalizedTarget(normalized);
  const manifests =
    input.manifests ??
    listCandidateManifests(input.cycleLog, input.registry_kind ?? "production");
  const reserving = manifests.filter((m) => isReservingStatus(m.status));

  // Batch-local repeat
  if (input.batchLocal) {
    const bl = input.batchLocal;
    if (
      bl.accepted_fingerprints.has(target_fingerprint) ||
      bl.attempted_fingerprints.has(target_fingerprint) ||
      bl.skipped_fingerprints.has(target_fingerprint)
    ) {
      return {
        decision: "SKIP_DUPLICATE",
        duplicate_type: "BATCH_REPEAT",
        target_fingerprint,
        matched_candidate_id: null,
        matched_batch_sequence: null,
        score: 1,
        threshold: 1,
        reason: "Target fingerprint already attempted in this batch",
        checked_at,
        normalization_version: NORMALIZATION_VERSION,
        comparison_registry_size: reserving.length,
      };
    }
    if (isBatchLocalClusterExcluded(bl, input.target)) {
      return {
        decision: "SKIP_DUPLICATE",
        duplicate_type: "BATCH_REPEAT",
        target_fingerprint,
        matched_candidate_id: null,
        matched_batch_sequence: null,
        score: 1,
        threshold: 1,
        reason: "Target title cluster already excluded in this batch",
        checked_at,
        normalization_version: NORMALIZATION_VERSION,
        comparison_registry_size: reserving.length,
      };
    }
  }

  // Exact against registry
  for (const m of reserving) {
    const fp = fingerprintFromManifest(m);
    if (fp === target_fingerprint) {
      return {
        decision: "SKIP_DUPLICATE",
        duplicate_type: "EXACT_TARGET",
        target_fingerprint,
        matched_candidate_id: m.candidate_id,
        matched_batch_sequence: m.batch_sequence ?? null,
        score: 1,
        threshold: 1,
        reason: `Exact normalized target match against ${m.candidate_id} (${m.status})`,
        checked_at,
        normalization_version: NORMALIZATION_VERSION,
        comparison_registry_size: reserving.length,
      };
    }
  }

  // Near-duplicate (conservative)
  for (const m of reserving) {
    const existing = normalizeProductionTarget({
      category: m.target.category as ProductionTarget["category"],
      title: m.target.title,
      industry: m.target.industry,
      seniority: m.target.seniority as ProductionTarget["seniority"],
      objective: m.target.objective,
    });
    const near = isConservativeNearDuplicate(normalized, existing);
    if (near.hit) {
      return {
        decision: "SKIP_DUPLICATE",
        duplicate_type: "NEAR_TARGET",
        target_fingerprint,
        matched_candidate_id: m.candidate_id,
        matched_batch_sequence: m.batch_sequence ?? null,
        score: near.score,
        threshold: NEAR_TITLE_JACCARD,
        reason: `Near-duplicate of ${m.candidate_id} (title Jaccard ≥ ${NEAR_TITLE_JACCARD}, objective Jaccard ≥ ${NEAR_OBJECTIVE_JACCARD}, field agree ≥ ${NEAR_FIELD_AGREE_MIN})`,
        checked_at,
        normalization_version: NORMALIZATION_VERSION,
        comparison_registry_size: reserving.length,
      };
    }
  }

  return {
    decision: "ALLOW",
    duplicate_type: null,
    target_fingerprint,
    matched_candidate_id: null,
    matched_batch_sequence: null,
    score: null,
    threshold: null,
    reason: "No exact or conservative near-duplicate found",
    checked_at,
    normalization_version: NORMALIZATION_VERSION,
    comparison_registry_size: reserving.length,
  };
}

export function buildDuplicateControlMeta(
  decision: DuplicateDecision,
  batchLocalCheck: boolean,
): DuplicateControlMeta {
  return {
    target_fingerprint: decision.target_fingerprint,
    normalization_version: NORMALIZATION_VERSION,
    duplicate_status: "UNIQUE",
    decision: "ALLOW",
    checked_at: decision.checked_at,
    comparison_registry_size: decision.comparison_registry_size,
    batch_local_check: batchLocalCheck,
  };
}

export function recordBatchLocalAttempt(
  state: BatchLocalDuplicateState,
  fingerprint: string,
  kind: "accepted" | "skipped",
): void {
  state.attempted_fingerprints.add(fingerprint);
  if (kind === "accepted") state.accepted_fingerprints.add(fingerprint);
  else state.skipped_fingerprints.add(fingerprint);
}

export function recordBatchLocalClusterExclusion(
  state: BatchLocalDuplicateState,
  target: Pick<ProductionTarget, "category" | "title">,
): void {
  if (!state.excluded_clusters) state.excluded_clusters = new Set();
  state.excluded_clusters.add(targetClusterKey(target));
}

export function isBatchLocalClusterExcluded(
  state: BatchLocalDuplicateState | null | undefined,
  target: Pick<ProductionTarget, "category" | "title">,
): boolean {
  if (!state?.excluded_clusters) return false;
  return state.excluded_clusters.has(targetClusterKey(target));
}
