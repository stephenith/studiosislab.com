/**
 * Discover all publication-eligible staged resume templates — legacy candidate_id fields still used.
 * Authoritative sources only (decisions, lifecycle, staging packages, reservations).
 * Non-production (fixture/debug/test) Resume Templates are never eligible.
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  computeHighestUsedCatalogueNumber,
} from "../export/CatalogueReservation.js";
import type { CatalogueReservation } from "../export/types.js";
import { isNonProductionResumeTemplate } from "../staging/ApprovalStagingHandoff.js";
import type { CandidateLifecycleRecord } from "../staging/types.js";
import {
  expectedGeneratedFilesForCatalogue,
  type PublicationRoots,
  defaultPublicationRoots,
  QUARANTINED_TEMPLATE_IDS,
} from "./paths.js";
import type {
  EligibleCandidate,
  ExcludedCandidate,
  ExclusionReasonCode,
  PublicationStatusLabel,
} from "./types.js";

type DecisionRow = {
  decision_id: string;
  decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
  created_at: string;
  review_id: string;
  candidate_id: string | null;
};

type CandidateJson = {
  candidate_id: string;
  review_id?: string;
  status?: string;
  superseded_by_revision?: string;
  target?: { title?: string; role_family?: string; category?: string };
  title?: string;
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function decisionMatchesCandidate(
  d: {
    review_id?: string;
    structured_feedback?: { candidate_id?: string };
  },
  candidateId: string,
  reviewIdFromCandidate: string | null,
): boolean {
  const reviewId = String(d.review_id ?? "");
  const fbCand = d.structured_feedback?.candidate_id;
  if (fbCand === candidateId) return true;
  if (reviewId.includes(candidateId) || reviewId.endsWith(candidateId)) {
    return true;
  }
  return Boolean(reviewIdFromCandidate && reviewId === reviewIdFromCandidate);
}

function loadLatestDecisionsByCandidate(
  roots: PublicationRoots,
): Map<string, DecisionRow> {
  const map = new Map<string, DecisionRow>();
  if (!existsSync(roots.decisionsJsonl)) return map;

  const candidateReviewIds = new Map<string, string>();
  if (existsSync(roots.candidatesRoot)) {
    for (const name of readdirSync(roots.candidatesRoot)) {
      const p = join(roots.candidatesRoot, name, "candidate.json");
      if (!existsSync(p)) continue;
      try {
        const c = readJson<CandidateJson>(p);
        if (c.review_id) candidateReviewIds.set(name, c.review_id);
      } catch {
        /* skip */
      }
    }
  }

  const lines = readFileSync(roots.decisionsJsonl, "utf8")
    .split("\n")
    .filter(Boolean);
  for (const line of lines) {
    try {
      const d = JSON.parse(line) as {
        decision_id?: string;
        decision?: string;
        created_at?: string;
        review_id?: string;
        fixture?: boolean;
        structured_feedback?: { candidate_id?: string };
      };
      if (
        !d.decision_id ||
        (d.decision !== "APPROVED" &&
          d.decision !== "REJECTED" &&
          d.decision !== "CHANGES_REQUESTED")
      ) {
        continue;
      }
      // Map decision onto every candidate it matches
      for (const [candId, reviewId] of candidateReviewIds) {
        if (!decisionMatchesCandidate(d, candId, reviewId)) continue;
        const row: DecisionRow = {
          decision_id: d.decision_id,
          decision: d.decision,
          created_at: String(d.created_at ?? ""),
          review_id: String(d.review_id ?? ""),
          candidate_id: candId,
        };
        const prev = map.get(candId);
        if (!prev || row.created_at > prev.created_at) {
          map.set(candId, row);
        }
      }
      // Also match structured_feedback.candidate_id even if no candidate.json
      const fb = d.structured_feedback?.candidate_id;
      if (fb) {
        const row: DecisionRow = {
          decision_id: d.decision_id,
          decision: d.decision as DecisionRow["decision"],
          created_at: String(d.created_at ?? ""),
          review_id: String(d.review_id ?? ""),
          candidate_id: fb,
        };
        const prev = map.get(fb);
        if (!prev || row.created_at > prev.created_at) {
          map.set(fb, row);
        }
      }
    } catch {
      /* skip */
    }
  }
  return map;
}

function loadReservations(roots: PublicationRoots): CatalogueReservation[] {
  if (!existsSync(roots.reservationsPath)) return [];
  const doc = readJson<{ reservations?: CatalogueReservation[] }>(
    roots.reservationsPath,
  );
  return doc.reservations ?? [];
}

function activeReservationForCandidate(
  reservations: CatalogueReservation[],
  candidateId: string,
): CatalogueReservation | null {
  const list = reservations.filter((r) => r.candidate_id === candidateId);
  if (list.length === 0) return null;
  const active = list.find((r) =>
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
    ].includes(r.status),
  );
  return active ?? list[list.length - 1] ?? null;
}

function loadCandidateJson(
  roots: PublicationRoots,
  candidateId: string,
): CandidateJson | null {
  const p = join(roots.candidatesRoot, candidateId, "candidate.json");
  if (!existsSync(p)) return null;
  return readJson<CandidateJson>(p);
}

function candidateTitle(
  cand: CandidateJson | null,
  lifecycle: CandidateLifecycleRecord | null,
): string {
  return (
    cand?.target?.title ??
    cand?.title ??
    lifecycle?.candidate_id ??
    "Unknown"
  );
}

function listLifecycleRecords(
  roots: PublicationRoots,
): CandidateLifecycleRecord[] {
  if (!existsSync(roots.lifecycleRoot)) return [];
  return readdirSync(roots.lifecycleRoot)
    .filter((f) => f.endsWith(".json"))
    .map((f) =>
      readJson<CandidateLifecycleRecord>(join(roots.lifecycleRoot, f)),
    );
}

function exclude(
  candidate_id: string,
  title: string | null,
  status_label: PublicationStatusLabel,
  reason_code: ExclusionReasonCode,
  reason: string,
  extra: Partial<ExcludedCandidate> = {},
): ExcludedCandidate {
  return {
    candidate_id,
    title,
    status_label,
    reason_code,
    reason,
    lifecycle_status: extra.lifecycle_status ?? null,
    staging_package_id: extra.staging_package_id ?? null,
    catalogue_id: extra.catalogue_id ?? null,
    decision: extra.decision ?? null,
  };
}

function formatCatalogueId(n: number): string {
  return `t${String(n).padStart(3, "0")}`;
}

function parseCatalogueNum(id: string): number | null {
  const m = String(id)
    .toLowerCase()
    .match(/^t(\d+)$/);
  return m ? Number(m[1]) : null;
}

/**
 * Collect every occupied catalogue number from authoritative publication sources.
 * Never reallocates gaps below the max occupied ID (monotonic).
 */
export function collectOccupiedCatalogueNumbers(
  roots: PublicationRoots = defaultPublicationRoots(),
): Set<number> {
  const occupied = new Set<number>();
  const mark = (raw: string) => {
    const n = parseCatalogueNum(raw);
    if (n != null) occupied.add(n);
  };

  for (const q of QUARANTINED_TEMPLATE_IDS) mark(q);

  if (existsSync(roots.manifestPath)) {
    const manifest = readJson<{ templates?: Array<{ id?: string }> }>(
      roots.manifestPath,
    );
    for (const t of manifest.templates ?? []) mark(String(t.id ?? ""));
  }

  for (const r of loadReservations(roots)) {
    mark(r.reserved_catalogue_id);
  }

  // Generated / on-disk template assets under website target
  const website = roots.websiteTargetRoot;
  for (const rel of [
    "public/templates",
    "src/data/template-json",
  ]) {
    const dir = join(website, rel);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const m = name.toLowerCase().match(/^(t\d+)\.(json|png|webp)$/);
      if (m) mark(m[1]!);
    }
  }

  const registryPath = join(
    website,
    "src/data/systemTemplates/registry.generated.ts",
  );
  if (existsSync(registryPath)) {
    const raw = readFileSync(registryPath, "utf8");
    for (const m of raw.matchAll(/\bid\s*:\s*["'](t\d+)["']/gi)) {
      mark(m[1]!);
    }
  }

  const packagesDir = join(
    roots.repo,
    "SOS/07_LOGS/saios/publication/packages",
  );
  if (existsSync(packagesDir)) {
    for (const name of readdirSync(packagesDir)) mark(name);
  }

  // Align with production monotonic helper when using default repo roots
  try {
    if (roots.repo === defaultPublicationRoots().repo) {
      const live = computeHighestUsedCatalogueNumber();
      if (live.highest_used > 0) occupied.add(live.highest_used);
      // Include package/reservation highs already reflected in highest_used
      if (live.highest_live > 0) occupied.add(live.highest_live);
      if (live.highest_package > 0) occupied.add(live.highest_package);
      if (live.highest_reservation > 0) occupied.add(live.highest_reservation);
    }
  } catch {
    /* fixture roots may not have full tree */
  }

  return occupied;
}

/**
 * Propose monotonic catalogue IDs for a batch without writing reservations.
 * Skips quarantined and already-occupied IDs from authoritative sources.
 */
export function proposeCatalogueIds(
  count: number,
  roots: PublicationRoots = defaultPublicationRoots(),
): string[] {
  const occupied = collectOccupiedCatalogueNumbers(roots);
  const highest = occupied.size > 0 ? Math.max(...occupied) : 0;
  const ids: string[] = [];
  let next = highest + 1;
  while (ids.length < count) {
    const id = formatCatalogueId(next);
    const n = next;
    const quarantined = (QUARANTINED_TEMPLATE_IDS as readonly string[]).includes(
      id,
    );
    if (!quarantined && !occupied.has(n)) {
      ids.push(id);
      occupied.add(n);
    }
    next += 1;
  }
  return ids;
}

export type DiscoveryOptions = {
  /**
   * When set (non-empty), only these production-eligible Resume Templates may
   * appear in `eligible`. Fingerprint is computed for this scoped set.
   * Missing requested IDs are reported via `missing_requested` — never substituted.
   */
  candidate_ids?: string[] | null;
};

export type DiscoveryResult = {
  eligible: EligibleCandidate[];
  excluded: ExcludedCandidate[];
  eligibility_fingerprint: string;
  /** Explicit scope IDs that were not eligible after filters. */
  missing_requested: string[];
  scope_candidate_ids: string[] | null;
};

export function discoverEligibleCandidates(
  roots: PublicationRoots = defaultPublicationRoots(),
  options: DiscoveryOptions = {},
): DiscoveryResult {
  const decisions = loadLatestDecisionsByCandidate(roots);
  const reservations = loadReservations(roots);
  const lifecycles = listLifecycleRecords(roots);
  const eligible: EligibleCandidate[] = [];
  const excluded: ExcludedCandidate[] = [];
  const seen = new Set<string>();

  // Index supersession from candidate.json
  const supersededIds = new Set<string>();
  if (existsSync(roots.candidatesRoot)) {
    for (const name of readdirSync(roots.candidatesRoot)) {
      const cand = loadCandidateJson(roots, name);
      if (cand?.superseded_by_revision) {
        supersededIds.add(name);
      }
    }
  }

  for (const life of lifecycles) {
    const candidateId = life.candidate_id;
    seen.add(candidateId);
    const cand = loadCandidateJson(roots, candidateId);
    const title = candidateTitle(cand, life);
    const decision = decisions.get(candidateId) ?? null;
    const reservation = activeReservationForCandidate(
      reservations,
      candidateId,
    );

    if (isNonProductionResumeTemplate(candidateId, roots.candidatesRoot)) {
      excluded.push(
        exclude(
          candidateId,
          title,
          "EXCLUDED_NON_PRODUCTION",
          "NON_PRODUCTION",
          "Non-production Resume Template (fixture/debug/test) — not publication eligible",
          {
            lifecycle_status: life.lifecycle_status,
            staging_package_id: life.staging_package_id,
            decision: decision?.decision ?? null,
            catalogue_id: reservation?.reserved_catalogue_id ?? null,
          },
        ),
      );
      continue;
    }

    if (supersededIds.has(candidateId) || cand?.superseded_by_revision) {
      excluded.push(
        exclude(
          candidateId,
          title,
          "EXCLUDED_SUPERSEDED",
          "SUPERSEDED",
          `Superseded by ${cand?.superseded_by_revision ?? "revision"}`,
          {
            lifecycle_status: life.lifecycle_status,
            staging_package_id: life.staging_package_id,
            decision: decision?.decision ?? null,
          },
        ),
      );
      continue;
    }

    if (life.lifecycle_status === "PUBLISHED") {
      excluded.push(
        exclude(
          candidateId,
          title,
          "EXCLUDED_ALREADY_PUBLISHED",
          "LIFECYCLE_PUBLISHED",
          "Lifecycle already PUBLISHED",
          {
            lifecycle_status: life.lifecycle_status,
            staging_package_id: life.staging_package_id,
            catalogue_id: reservation?.reserved_catalogue_id ?? null,
            decision: decision?.decision ?? null,
          },
        ),
      );
      continue;
    }

    if (reservation?.status === "RELEASE_COMPLETED") {
      excluded.push(
        exclude(
          candidateId,
          title,
          "EXCLUDED_ALREADY_PUBLISHED",
          "RELEASE_COMPLETED",
          `Reservation ${reservation.reservation_id} is RELEASE_COMPLETED (${reservation.reserved_catalogue_id})`,
          {
            lifecycle_status: life.lifecycle_status,
            staging_package_id: life.staging_package_id,
            catalogue_id: reservation.reserved_catalogue_id,
            decision: decision?.decision ?? null,
          },
        ),
      );
      continue;
    }

    if (life.lifecycle_status === "PUBLICATION_FAILED") {
      excluded.push(
        exclude(
          candidateId,
          title,
          "PUBLICATION_FAILED",
          "PUBLICATION_FAILURE_MANUAL",
          "Prior publication failure requires manual intervention",
          {
            lifecycle_status: life.lifecycle_status,
            staging_package_id: life.staging_package_id,
            decision: decision?.decision ?? null,
          },
        ),
      );
      continue;
    }

    if (decision?.decision === "CHANGES_REQUESTED") {
      excluded.push(
        exclude(
          candidateId,
          title,
          "EXCLUDED_CHANGES_REQUESTED",
          "CHANGES_REQUESTED",
          `Latest Founder decision ${decision.decision_id} is CHANGES_REQUESTED`,
          {
            lifecycle_status: life.lifecycle_status,
            decision: "CHANGES_REQUESTED",
          },
        ),
      );
      continue;
    }

    if (decision?.decision === "REJECTED") {
      excluded.push(
        exclude(
          candidateId,
          title,
          "EXCLUDED_REJECTED",
          "REJECTED",
          `Latest Founder decision ${decision.decision_id} is REJECTED`,
          {
            lifecycle_status: life.lifecycle_status,
            decision: "REJECTED",
          },
        ),
      );
      continue;
    }

    if (life.lifecycle_status === "APPROVED" && !life.staging_package_id) {
      excluded.push(
        exclude(
          candidateId,
          title,
          "APPROVED_NOT_STAGED",
          "MISSING_STAGING_PACKAGE",
          "Founder APPROVED but not yet staged",
          {
            lifecycle_status: "APPROVED",
            decision: decision?.decision ?? "APPROVED",
          },
        ),
      );
      continue;
    }

    if (life.lifecycle_status !== "VALIDATED") {
      excluded.push(
        exclude(
          candidateId,
          title,
          "EXCLUDED_OTHER",
          "NOT_VALIDATED",
          `Lifecycle is ${life.lifecycle_status}, require VALIDATED`,
          {
            lifecycle_status: life.lifecycle_status,
            staging_package_id: life.staging_package_id,
            decision: decision?.decision ?? null,
          },
        ),
      );
      continue;
    }

    if (!life.staging_package_id) {
      excluded.push(
        exclude(
          candidateId,
          title,
          "EXCLUDED_MISSING_STAGING",
          "MISSING_STAGING_PACKAGE",
          "VALIDATED lifecycle missing staging_package_id",
          { lifecycle_status: "VALIDATED" },
        ),
      );
      continue;
    }

    // Latest decision must be APPROVED (or missing but lifecycle VALIDATED with approval_decision_id)
    const decisionOk =
      decision?.decision === "APPROVED" ||
      (!decision && Boolean(life.approval_decision_id));
    if (!decisionOk) {
      excluded.push(
        exclude(
          candidateId,
          title,
          "EXCLUDED_OTHER",
          "NOT_APPROVED",
          `Latest decision is ${decision?.decision ?? "missing"}`,
          {
            lifecycle_status: life.lifecycle_status,
            staging_package_id: life.staging_package_id,
            decision: decision?.decision ?? null,
          },
        ),
      );
      continue;
    }

    // Conflicting reservation (in-flight but not completed) — still eligible if no export yet;
    // block only FAILED / RELEASE_FAILED requiring manual intervention
    if (
      reservation &&
      ["RELEASE_FAILED", "PUBLICATION_VALIDATION_FAILED", "FAILED"].includes(
        reservation.status,
      )
    ) {
      excluded.push(
        exclude(
          candidateId,
          title,
          "PUBLICATION_FAILED",
          "PUBLICATION_FAILURE_MANUAL",
          `Conflicting reservation status ${reservation.status}`,
          {
            lifecycle_status: life.lifecycle_status,
            staging_package_id: life.staging_package_id,
            catalogue_id: reservation.reserved_catalogue_id,
          },
        ),
      );
      continue;
    }

    const pkgPath = join(roots.stagingPackagesRoot, life.staging_package_id);
    const validationPath = join(pkgPath, "validation-report.json");
    const manifestPath = join(pkgPath, "staging-manifest.json");
    if (!existsSync(pkgPath) || !existsSync(validationPath)) {
      excluded.push(
        exclude(
          candidateId,
          title,
          "EXCLUDED_MISSING_STAGING",
          "MISSING_STAGING_PACKAGE",
          "Staging package or validation-report.json missing",
          {
            lifecycle_status: "VALIDATED",
            staging_package_id: life.staging_package_id,
          },
        ),
      );
      continue;
    }

    const validation = readJson<{ pass?: boolean }>(validationPath);
    if (validation.pass !== true) {
      excluded.push(
        exclude(
          candidateId,
          title,
          "EXCLUDED_VALIDATION_FAILED",
          "VALIDATION_FAILED",
          "Staging validation_report.pass !== true",
          {
            lifecycle_status: "VALIDATED",
            staging_package_id: life.staging_package_id,
          },
        ),
      );
      continue;
    }

    let stagedAt = life.updated_at;
    if (existsSync(manifestPath)) {
      const m = readJson<{ staged_at?: string; founder_approved_at?: string }>(
        manifestPath,
      );
      stagedAt = m.staged_at ?? stagedAt;
    }

    const decisionId =
      decision?.decision_id ?? life.approval_decision_id ?? "unknown";
    const approvedAt =
      decision?.created_at ?? life.founder_approved_at ?? stagedAt;

    eligible.push({
      candidate_id: candidateId,
      title,
      decision_id: decisionId,
      review_id: decision?.review_id ?? cand?.review_id ?? "",
      generation_id: life.generation_id,
      staging_package_id: life.staging_package_id,
      founder_approved_at: approvedAt,
      staged_at: stagedAt,
      sort_key: `${approvedAt}|${stagedAt}|${candidateId}`,
      proposed_catalogue_id: "", // filled after sort
      expected_generated_files: [],
      eligibility_proof: {
        founder_decision_id: decisionId,
        founder_decision: "APPROVED",
        founder_decided_at: approvedAt,
        lifecycle_status: "VALIDATED",
        staging_package_id: life.staging_package_id,
        validation_pass: true,
        not_superseded: true,
        not_release_completed: true,
        not_lifecycle_published: true,
        no_conflicting_reservation: true,
      },
      evidence: {
        lifecycle_path: join(roots.lifecycleRoot, `${candidateId}.json`),
        staging_package_path: pkgPath,
        validation_report_path: validationPath,
        candidate_json_path: join(
          roots.candidatesRoot,
          candidateId,
          "candidate.json",
        ),
      },
    });
  }

  // Also surface APPROVED_NOT_STAGED / CHANGES_REQUESTED from decisions without lifecycle
  for (const [candId, decision] of decisions) {
    if (seen.has(candId)) continue;
    if (isNonProductionResumeTemplate(candId, roots.candidatesRoot)) {
      excluded.push(
        exclude(
          candId,
          candidateTitle(loadCandidateJson(roots, candId), null),
          "EXCLUDED_NON_PRODUCTION",
          "NON_PRODUCTION",
          "Non-production Resume Template (fixture/debug/test) — not publication eligible",
          { decision: decision.decision },
        ),
      );
      continue;
    }
    const cand = loadCandidateJson(roots, candId);
    if (cand?.superseded_by_revision) {
      excluded.push(
        exclude(
          candId,
          candidateTitle(cand, null),
          "EXCLUDED_SUPERSEDED",
          "SUPERSEDED",
          `Superseded by ${cand.superseded_by_revision}`,
          { decision: decision.decision },
        ),
      );
      continue;
    }
    if (decision.decision === "CHANGES_REQUESTED") {
      excluded.push(
        exclude(
          candId,
          candidateTitle(cand, null),
          "EXCLUDED_CHANGES_REQUESTED",
          "CHANGES_REQUESTED",
          `Latest Founder decision is CHANGES_REQUESTED`,
          { decision: "CHANGES_REQUESTED" },
        ),
      );
    } else if (decision.decision === "APPROVED") {
      excluded.push(
        exclude(
          candId,
          candidateTitle(cand, null),
          "APPROVED_NOT_STAGED",
          "MISSING_STAGING_PACKAGE",
          "Founder APPROVED but no VALIDATED lifecycle",
          { decision: "APPROVED" },
        ),
      );
    }
  }

  const requested =
    options.candidate_ids && options.candidate_ids.length > 0
      ? [...new Set(options.candidate_ids.map((id) => id.trim()).filter(Boolean))]
      : null;

  let scopedEligible = eligible;
  const missing_requested: string[] = [];
  if (requested) {
    const eligibleIds = new Set(eligible.map((e) => e.candidate_id));
    for (const id of requested) {
      if (!eligibleIds.has(id)) missing_requested.push(id);
    }
    scopedEligible = eligible.filter((e) => requested.includes(e.candidate_id));
  }

  // Deterministic sort: approval time, then staging time, then candidate_id
  scopedEligible.sort((a, b) => a.sort_key.localeCompare(b.sort_key));

  const proposed = proposeCatalogueIds(scopedEligible.length, roots);
  for (let i = 0; i < scopedEligible.length; i++) {
    const id = proposed[i]!;
    scopedEligible[i]!.proposed_catalogue_id = id;
    scopedEligible[i]!.expected_generated_files =
      expectedGeneratedFilesForCatalogue(id);
  }

  const fingerprint = createHash("sha256")
    .update(
      scopedEligible
        .map(
          (e) =>
            `${e.candidate_id}|${e.staging_package_id}|${e.decision_id}|${e.generation_id}`,
        )
        .join("\n"),
    )
    .digest("hex");

  return {
    eligible: scopedEligible,
    excluded,
    eligibility_fingerprint: fingerprint,
    missing_requested,
    scope_candidate_ids: requested,
  };
}
