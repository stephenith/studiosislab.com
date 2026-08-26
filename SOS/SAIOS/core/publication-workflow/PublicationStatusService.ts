/**
 * Publication status projection across lifecycle, plans, and reservations.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CatalogueReservation } from "../export/types.js";
import type { CandidateLifecycleRecord } from "../staging/types.js";
import { discoverEligibleCandidates } from "./EligibilityCollector.js";
import {
  defaultPublicationRoots,
  type PublicationRoots,
} from "./paths.js";
import {
  findActivePlanForCandidate,
  listPlans,
} from "./PublicationPlanService.js";
import type {
  CandidatePublicationStatus,
  PublicationStatusLabel,
} from "./types.js";

type CandidateJson = {
  candidate_id: string;
  superseded_by_revision?: string;
  target?: { title?: string };
  title?: string;
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function loadReservations(roots: PublicationRoots): CatalogueReservation[] {
  if (!existsSync(roots.reservationsPath)) return [];
  return (
    readJson<{ reservations?: CatalogueReservation[] }>(roots.reservationsPath)
      .reservations ?? []
  );
}

function titleOf(roots: PublicationRoots, id: string): string | null {
  const p = join(roots.candidatesRoot, id, "candidate.json");
  if (!existsSync(p)) return null;
  const c = readJson<CandidateJson>(p);
  return c.target?.title ?? c.title ?? null;
}

export function getCandidatePublicationStatus(
  candidateId: string,
  roots: PublicationRoots = defaultPublicationRoots(),
): CandidatePublicationStatus {
  const lifePath = join(roots.lifecycleRoot, `${candidateId}.json`);
  const life = existsSync(lifePath)
    ? readJson<CandidateLifecycleRecord>(lifePath)
    : null;
  const candPath = join(roots.candidatesRoot, candidateId, "candidate.json");
  const cand = existsSync(candPath) ? readJson<CandidateJson>(candPath) : null;
  const reservations = loadReservations(roots);
  const reservation =
    reservations.find(
      (r) =>
        r.candidate_id === candidateId &&
        [
          "RESERVED",
          "EXPORT_BUILT",
          "ASSETS_READY",
          "READY_FOR_RELEASE",
          "RELEASE_REQUESTED",
          "FOUNDER_RELEASE_APPROVED",
          "RELEASE_EXECUTING",
          "RELEASE_COMPLETED",
          "COMMITTED",
          "RELEASE_FAILED",
          "PUBLICATION_VALIDATION_FAILED",
          "FAILED",
        ].includes(r.status),
    ) ??
    reservations.filter((r) => r.candidate_id === candidateId).at(-1) ??
    null;

  const activePlan = findActivePlanForCandidate(candidateId, roots);
  const completedPlan = listPlans(roots)
    .filter((p) => p.status === "COMPLETED")
    .find((p) => p.entries.some((e) => e.candidate_id === candidateId));

  let status_label: PublicationStatusLabel = "EXCLUDED_OTHER";
  let reason: string | null = null;

  if (cand?.superseded_by_revision) {
    status_label = "EXCLUDED_SUPERSEDED";
    reason = `Superseded by ${cand.superseded_by_revision}`;
  } else if (
    life?.lifecycle_status === "PUBLISHED" ||
    reservation?.status === "RELEASE_COMPLETED"
  ) {
    status_label = "PUBLISHED";
    reason =
      life?.lifecycle_status === "PUBLISHED"
        ? "Lifecycle PUBLISHED"
        : `RELEASE_COMPLETED as ${reservation?.reserved_catalogue_id}`;
  } else if (
    life?.lifecycle_status === "PUBLICATION_FAILED" ||
    reservation?.status === "RELEASE_FAILED"
  ) {
    status_label = "PUBLICATION_FAILED";
    reason = "Publication failed — inspect evidence";
  } else if (activePlan?.status === "PUBLISHING" || activePlan?.status === "LOCKED") {
    status_label = "PUBLISHING";
    reason = `Active plan ${activePlan.plan_id}`;
  } else if (activePlan?.status === "VERIFIED") {
    status_label = "VERIFIED";
    reason = `Verified in plan ${activePlan.plan_id}`;
  } else if (activePlan?.status === "DRAFT") {
    status_label = "PLANNED";
    reason = `Planned in ${activePlan.plan_id}`;
  } else if (life?.lifecycle_status === "VALIDATED" && life.staging_package_id) {
    status_label = "VALIDATED_ELIGIBLE";
    reason = "VALIDATED staging package — eligible for discovery";
  } else if (life?.lifecycle_status === "APPROVED") {
    status_label = "APPROVED_NOT_STAGED";
    reason = "Approved — Stage for StudiosisLab required";
  } else {
    // Fall back to discovery exclusion labels
    const discovery = discoverEligibleCandidates(roots);
    const ex = discovery.excluded.find((e) => e.candidate_id === candidateId);
    if (ex) {
      status_label = ex.status_label;
      reason = ex.reason;
    } else if (
      discovery.eligible.some((e) => e.candidate_id === candidateId)
    ) {
      status_label = "VALIDATED_ELIGIBLE";
    }
  }

  const applyResult =
    activePlan?.apply?.results.find((r) => r.candidate_id === candidateId) ??
    completedPlan?.apply?.results.find((r) => r.candidate_id === candidateId);

  return {
    candidate_id: candidateId,
    title: titleOf(roots, candidateId),
    status_label,
    lifecycle_status: life?.lifecycle_status ?? null,
    staging_package_id: life?.staging_package_id ?? null,
    catalogue_id:
      applyResult?.catalogue_id ??
      reservation?.reserved_catalogue_id ??
      activePlan?.entries.find((e) => e.candidate_id === candidateId)
        ?.proposed_catalogue_id ??
      null,
    plan_id: activePlan?.plan_id ?? completedPlan?.plan_id ?? null,
    release_id: applyResult?.release_id ?? null,
    git_commit_sha: applyResult?.git_commit_sha ?? null,
    live_url: applyResult?.live_url ?? null,
    decision: null,
    reason,
  };
}

export function getPublicationStatusOverview(
  roots: PublicationRoots = defaultPublicationRoots(),
): {
  generated_at: string;
  eligible: CandidatePublicationStatus[];
  all: CandidatePublicationStatus[];
  active_plans: string[];
  publication_allowed: false;
  live: false;
} {
  const discovery = discoverEligibleCandidates(roots);
  const ids = new Set<string>();
  if (existsSync(roots.lifecycleRoot)) {
    for (const f of readdirSync(roots.lifecycleRoot)) {
      if (f.endsWith(".json")) ids.add(f.replace(/\.json$/, ""));
    }
  }
  for (const e of discovery.eligible) ids.add(e.candidate_id);
  for (const e of discovery.excluded) ids.add(e.candidate_id);

  const all = [...ids]
    .sort()
    .map((id) => getCandidatePublicationStatus(id, roots));
  const eligible = all.filter((s) => s.status_label === "VALIDATED_ELIGIBLE");
  const active_plans = listPlans(roots)
    .filter((p) =>
      ["DRAFT", "VERIFIED", "LOCKED", "PUBLISHING"].includes(p.status),
    )
    .map((p) => p.plan_id);

  return {
    generated_at: new Date().toISOString(),
    eligible,
    all,
    active_plans,
    publication_allowed: false,
    live: false,
  };
}
