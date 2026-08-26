/**
 * Safe lifecycle reconciliation for already-released candidates (e.g. t101).
 * Never republishes. Never writes website files.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  readLifecycle,
  upsertLifecycle,
} from "../staging/CandidateLifecycleStore.js";
import { assertTransition, canTransition } from "../staging/TemplateLifecycle.js";
import type { CatalogueReservation } from "../export/types.js";
import {
  defaultPublicationRoots,
  type PublicationRoots,
} from "./paths.js";
import type { ReconciliationProposal } from "./types.js";

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

function manifestHasId(roots: PublicationRoots, catalogueId: string): boolean {
  if (!existsSync(roots.manifestPath)) return false;
  const manifest = readJson<{ templates?: Array<{ id?: string }> }>(
    roots.manifestPath,
  );
  return (manifest.templates ?? []).some(
    (t) => String(t.id ?? "").toLowerCase() === catalogueId.toLowerCase(),
  );
}

function findReleaseId(
  roots: PublicationRoots,
  catalogueId: string,
): string | null {
  if (!existsSync(roots.releaseHistoryPath)) return null;
  try {
    const raw = readJson<unknown>(roots.releaseHistoryPath);
    const list = Array.isArray(raw)
      ? raw
      : ((raw as { releases?: unknown[] }).releases ?? []);
    for (const item of list) {
      const r = item as {
        release_id?: string;
        catalogue_id?: string;
        catalog_id?: string;
        template_id?: string;
      };
      const ids = [
        r.catalogue_id,
        r.catalog_id,
        r.template_id,
      ].map((x) => String(x ?? "").toLowerCase());
      if (ids.includes(catalogueId.toLowerCase()) && r.release_id) {
        return r.release_id;
      }
    }
    // Also check release-manager releases dirs
    const releasesDir = join(roots.releaseManagerRoot, "releases");
    if (existsSync(releasesDir)) {
      const hit = readdirSync(releasesDir).find(
        (name) =>
          name.includes(`-${catalogueId}-`) ||
          name.startsWith(`release-${catalogueId}-`),
      );
      if (hit) return hit;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Propose (or apply) lifecycle PUBLISHED for RELEASE_COMPLETED + live manifest.
 */
export function reconcilePublishedLifecycle(input: {
  candidate_id: string;
  apply?: boolean;
  git_commit_sha?: string | null;
  roots?: PublicationRoots;
}): ReconciliationProposal {
  const roots = input.roots ?? defaultPublicationRoots();
  const life = readLifecycle(input.candidate_id);
  const reservations = loadReservations(roots);
  const reservation = reservations.find(
    (r) =>
      r.candidate_id === input.candidate_id &&
      r.status === "RELEASE_COMPLETED",
  );

  if (!life) {
    throw new Error(`No lifecycle for ${input.candidate_id}`);
  }
  if (!reservation) {
    throw new Error(
      `No RELEASE_COMPLETED reservation for ${input.candidate_id}`,
    );
  }

  const catalogue_id = reservation.reserved_catalogue_id;
  const manifest_present = manifestHasId(roots, catalogue_id);
  const release_id = findReleaseId(roots, catalogue_id);

  const proposal: ReconciliationProposal = {
    candidate_id: input.candidate_id,
    catalogue_id,
    current_lifecycle_status: life.lifecycle_status,
    proposed_lifecycle_status: "PUBLISHED",
    evidence: {
      reservation_status: reservation.status,
      release_id,
      manifest_present,
      git_commit_sha: input.git_commit_sha ?? null,
    },
    republish: false,
    website_writes: false,
    applied: false,
  };

  if (!manifest_present) {
    throw new Error(
      `Cannot reconcile — ${catalogue_id} missing from templates.manifest.json`,
    );
  }

  if (life.lifecycle_status === "PUBLISHED") {
    proposal.applied = false;
    return proposal;
  }

  if (input.apply !== true) {
    return proposal;
  }

  if (!canTransition(life.lifecycle_status, "PUBLISHED")) {
    // Allow VALIDATED → PUBLISHED; if stuck elsewhere, still attempt via assert
  }
  assertTransition(life.lifecycle_status, "PUBLISHED");
  upsertLifecycle({
    ...life,
    lifecycle_status: "PUBLISHED",
  });
  proposal.applied = true;
  proposal.current_lifecycle_status = "PUBLISHED";
  return proposal;
}

/**
 * Discover all RELEASE_COMPLETED + VALIDATED candidates that need reconciliation.
 */
export function listReconciliationProposals(
  roots: PublicationRoots = defaultPublicationRoots(),
): ReconciliationProposal[] {
  const out: ReconciliationProposal[] = [];
  for (const r of loadReservations(roots)) {
    if (r.status !== "RELEASE_COMPLETED") continue;
    const life = readLifecycle(r.candidate_id);
    if (!life) continue;
    if (life.lifecycle_status === "PUBLISHED") continue;
    if (!manifestHasId(roots, r.reserved_catalogue_id)) continue;
    try {
      out.push(
        reconcilePublishedLifecycle({
          candidate_id: r.candidate_id,
          apply: false,
          roots,
        }),
      );
    } catch {
      /* skip incomplete evidence */
    }
  }
  return out;
}

/** Convenience path for Marketing Manager t101. */
export function proposeMarketingT101Reconciliation(
  roots: PublicationRoots = defaultPublicationRoots(),
): ReconciliationProposal {
  return reconcilePublishedLifecycle({
    candidate_id:
      "cand-marketing-marketing-manager-executive-v0-20260727T045928Z-ffc853",
    apply: false,
    git_commit_sha: "3383016",
    roots,
  });
}
