/**
 * Immutable multi-eligible publication plans.
 * No website writes. No catalogue reservations.
 */
import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { discoverEligibleCandidates } from "./EligibilityCollector.js";
import { buildPlanGitAllowlist } from "./GitPathAllowlist.js";
import {
  defaultPublicationRoots,
  QUARANTINED_TEMPLATE_IDS,
  type PublicationRoots,
} from "./paths.js";
import type {
  PublicationPlan,
  PublicationPlanEntry,
  PublicationPlanStatus,
} from "./types.js";
import { PUBLICATION_WORKFLOW_VERSION } from "./types.js";

const ACTIVE: PublicationPlanStatus[] = [
  "DRAFT",
  "VERIFIED",
  "LOCKED",
  "PUBLISHING",
];

function atomicWriteJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function planPath(roots: PublicationRoots, planId: string): string {
  return join(roots.plansRoot, `${planId}.json`);
}

export function listPlans(
  roots: PublicationRoots = defaultPublicationRoots(),
): PublicationPlan[] {
  if (!existsSync(roots.plansRoot)) return [];
  return readdirSync(roots.plansRoot)
    .filter(
      (f) =>
        f.endsWith(".json") &&
        f.startsWith("plan-") &&
        !f.includes(".verification."),
    )
    .map((f) => {
      try {
        return readJson<PublicationPlan>(join(roots.plansRoot, f));
      } catch {
        return null;
      }
    })
    .filter((p): p is PublicationPlan => Boolean(p?.plan_id && p?.created_at))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function readPlan(
  planId: string,
  roots: PublicationRoots = defaultPublicationRoots(),
): PublicationPlan | null {
  const p = planPath(roots, planId);
  if (!existsSync(p)) return null;
  return readJson<PublicationPlan>(p);
}

export function writePlan(
  plan: PublicationPlan,
  roots: PublicationRoots = defaultPublicationRoots(),
): void {
  atomicWriteJson(planPath(roots, plan.plan_id), plan);
}

export function listActivePlans(
  roots: PublicationRoots = defaultPublicationRoots(),
): PublicationPlan[] {
  return listPlans(roots).filter((p) => ACTIVE.includes(p.status));
}

export function findActivePlanForCandidate(
  candidateId: string,
  roots: PublicationRoots = defaultPublicationRoots(),
): PublicationPlan | null {
  return (
    listActivePlans(roots).find((p) =>
      p.entries.some((e) => e.candidate_id === candidateId),
    ) ?? null
  );
}

function newPlanId(): string {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `plan-${day}-${randomUUID().slice(0, 8)}`;
}

/**
 * Discover all eligible resume templates and write an immutable plan.
 * Idempotent when an active plan already matches the eligibility fingerprint.
 */
export function createPublicationPlan(
  roots: PublicationRoots = defaultPublicationRoots(),
): {
  plan: PublicationPlan;
  idempotent: boolean;
  omitted_eligible: string[];
} {
  const discovery = discoverEligibleCandidates(roots);

  // Idempotent: same fingerprint active plan
  const existing = listActivePlans(roots).find(
    (p) => p.eligibility_fingerprint === discovery.eligibility_fingerprint,
  );
  if (existing) {
    return { plan: existing, idempotent: true, omitted_eligible: [] };
  }

  // Block overlapping active plans
  const active = listActivePlans(roots);
  const conflicts: string[] = [];
  for (const e of discovery.eligible) {
    for (const p of active) {
      if (p.entries.some((x) => x.candidate_id === e.candidate_id)) {
        conflicts.push(
          `${e.candidate_id} already in active plan ${p.plan_id}`,
        );
      }
    }
  }
  if (conflicts.length > 0) {
    throw new Error(
      `Cannot create plan — active plan candidate conflicts:\n${conflicts.join("\n")}`,
    );
  }

  // Duplicate proposed catalogue IDs within plan
  const ids = discovery.eligible.map((e) => e.proposed_catalogue_id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Duplicate proposed catalogue IDs in discovery");
  }
  for (const id of ids) {
    if ((QUARANTINED_TEMPLATE_IDS as readonly string[]).includes(id)) {
      throw new Error(`Proposed catalogue ID ${id} is quarantined`);
    }
  }

  const warnings: string[] = [];
  for (const ex of discovery.excluded) {
    if (
      ex.status_label === "APPROVED_NOT_STAGED" ||
      ex.reason_code === "MISSING_STAGING_PACKAGE"
    ) {
      warnings.push(
        `Approved but not staged (excluded from plan): ${ex.candidate_id} — ${ex.reason}`,
      );
    }
    if (ex.reason_code === "RELEASE_COMPLETED") {
      warnings.push(
        `Already published (excluded): ${ex.candidate_id} (${ex.catalogue_id})`,
      );
    }
  }

  const now = new Date().toISOString();
  const plan_id = newPlanId();
  const entries: PublicationPlanEntry[] = discovery.eligible.map((e) => ({
    candidate_id: e.candidate_id,
    title: e.title,
    decision_id: e.decision_id,
    review_id: e.review_id,
    generation_id: e.generation_id,
    staging_package_id: e.staging_package_id,
    proposed_catalogue_id: e.proposed_catalogue_id,
    expected_generated_files: e.expected_generated_files,
    sort_key: e.sort_key,
    founder_approved_at: e.founder_approved_at,
    staged_at: e.staged_at,
    eligibility_proof: e.eligibility_proof,
    evidence: e.evidence,
    current_state: {
      lifecycle_status: "VALIDATED",
      reservation_status: null,
      existing_catalogue_id: null,
    },
  }));

  // Fail closed: re-discover and ensure every eligible ID is in entries
  const rediscovery = discoverEligibleCandidates(roots);
  const omitted_eligible = rediscovery.eligible
    .map((e) => e.candidate_id)
    .filter((id) => !entries.some((x) => x.candidate_id === id));
  if (omitted_eligible.length > 0) {
    throw new Error(
      `Silent omission detected — eligible resume templates missing from plan: ${omitted_eligible.join(", ")}`,
    );
  }

  const plan: PublicationPlan = {
    schema_version: "publication-plan-1.0.0",
    workflow_version: PUBLICATION_WORKFLOW_VERSION,
    plan_id,
    status: "DRAFT",
    created_at: now,
    updated_at: now,
    eligibility_fingerprint: discovery.eligibility_fingerprint,
    confirm_phrase: `PUBLISH_PLAN_${plan_id}`,
    entries,
    excluded: discovery.excluded,
    warnings,
    proposed_catalogue_ids: entries.map((e) => e.proposed_catalogue_id),
    git_path_allowlist: buildPlanGitAllowlist(
      entries.map((e) => e.proposed_catalogue_id),
    ),
    quarantined_template_ids: [...QUARANTINED_TEMPLATE_IDS],
    website_writes: false,
    reservations_created: false,
    publication_allowed: false,
    live: false,
    verification: null,
    apply: null,
  };

  writePlan(plan, roots);
  return { plan, idempotent: false, omitted_eligible: [] };
}
