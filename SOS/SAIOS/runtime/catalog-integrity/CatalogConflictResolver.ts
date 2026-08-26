/**
 * Generates non-destructive resolution plans for catalog conflicts.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { collectUsedCatalogIds, nextAvailableCatalogId } from "./PublicationSafetyValidator.js";
import type { CatalogConflict, ResolutionEntry } from "./types.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const SOS_ROOT = join(REPO_ROOT, "SOS");
const LOGS_ROOT = join(SOS_ROOT, "07_LOGS/saios");

function prototypeFromRef(ref: string): string {
  return ref;
}

function catalogOwnerFor(catalogId: string): string | null {
  const catalogPath = join(LOGS_ROOT, "publication/catalog.json");
  if (!existsSync(catalogPath)) return null;
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as {
    templates?: Array<{ catalog_id: string; prototype_id: string }>;
  };
  return catalog.templates?.find((t) => t.catalog_id === catalogId)?.prototype_id ?? null;
}

export function resolveCatalogConflicts(conflicts: CatalogConflict[]): ResolutionEntry[] {
  const resolutions: ResolutionEntry[] = [];
  const used = collectUsedCatalogIds();

  for (const conflict of conflicts) {
    if (conflict.type !== "duplicate_batch_catalog_assignment") continue;

    const catalogId = conflict.value;
    const occurrences = conflict.occurrences;
    const owner = catalogOwnerFor(catalogId);
    const withPackage = existsSync(join(LOGS_ROOT, "publication/packages", catalogId));
    const keepOcc =
      (owner ? occurrences.find((o) => o.prototype_id === owner) : undefined) ??
      occurrences.find((o) => o.prototype_id?.includes("data-analyst")) ??
      occurrences[0];
    const reassignCandidates = occurrences.filter((o) => o.ref !== keepOcc.ref);

    for (const candidate of reassignCandidates) {
      const nextId = nextAvailableCatalogId(used);
      used.add(nextId);

      resolutions.push({
        conflict_type: conflict.type,
        conflict_value: catalogId,
        keep: {
          prototype_id: prototypeFromRef(keepOcc.ref),
          catalog_id: catalogId,
          reason: owner
            ? `Canonical owner in publication/catalog.json`
            : withPackage
              ? `Publication package ${catalogId}/ exists — retain canonical ownership`
              : "First claimant in batch order",
        },
        reassign: {
          prototype_id: prototypeFromRef(candidate.ref),
          from_catalog_id: catalogId,
          to_catalog_id: nextId,
          reason: `Duplicate provisional assignment — allocate unused ID ${nextId} before publication`,
        },
        backward_compatible: true,
        requires_manual_approval: true,
      });
    }
  }

  for (const conflict of conflicts) {
    if (conflict.severity !== "critical") continue;
    if (conflict.type === "duplicate_batch_catalog_assignment") continue;
    if (resolutions.some((r) => r.conflict_value === conflict.value)) continue;

    resolutions.push({
      conflict_type: conflict.type,
      conflict_value: conflict.value,
      keep: {
        prototype_id: conflict.occurrences[0]?.ref ?? "unknown",
        catalog_id: conflict.value,
        reason: "Manual founder review required for live-layer conflict",
      },
      backward_compatible: false,
      requires_manual_approval: true,
    });
  }

  return resolutions;
}

export function annotateConflictsWithResolutions(
  conflicts: CatalogConflict[],
  resolutions: ResolutionEntry[],
): CatalogConflict[] {
  return conflicts.map((c) => {
    const resolution = resolutions.find((r) => r.conflict_value === c.value);
    if (!resolution) {
      return {
        ...c,
        recommended_action: c.severity === "critical"
          ? "Manual founder review required — do not publish until resolved"
          : "Monitor — no live impact",
      };
    }
    if (resolution.reassign) {
      return {
        ...c,
        recommended_action: `Keep ${resolution.keep.catalog_id} for ${resolution.keep.prototype_id}; reassign ${resolution.reassign.prototype_id} to ${resolution.reassign.to_catalog_id}`,
        suggested_catalog_id: resolution.reassign.to_catalog_id,
      };
    }
    return {
      ...c,
      recommended_action: resolution.keep.reason,
    };
  });
}
