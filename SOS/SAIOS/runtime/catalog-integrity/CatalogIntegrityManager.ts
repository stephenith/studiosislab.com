/**
 * Catalog Integrity Manager — orchestration entry point.
 * AGENT #097 — validate and plan only; no publication or overwrites.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { annotateConflictsWithResolutions, resolveCatalogConflicts } from "./CatalogConflictResolver.js";
import { buildCatalogHistory } from "./CatalogHistoryTracker.js";
import { persistCatalogIntegrityArtifacts } from "./PublicationAuditReporter.js";
import {
  collectUsedCatalogIds,
  nextAvailableCatalogId,
  validatePublicationSafety,
} from "./PublicationSafetyValidator.js";
import type { CatalogIntegrityResult, PublicationSafetyReport } from "./types.js";

export const CATALOG_INTEGRITY = {
  module: "catalog-integrity",
  version: "1.0.0",
  agent: "097",
  role: "validation_and_resolution_planning",
  prohibitions: [
    "no_resume_generation",
    "no_publication_execution",
    "no_ai_system_mutation",
    "no_overwrite",
    "no_release_manager_mutation",
  ],
} as const;

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const SOS_ROOT = join(REPO_ROOT, "SOS");
const STATE_PATH = join(SOS_ROOT, "project-state.json");
const LOGS_ROOT = join(SOS_ROOT, "07_LOGS/saios");

type ProjectState = {
  generated_at: string;
  latest_agent: string;
  next_agent: string;
  history?: Array<{ at: string; type: string; summary: string; ref: string }>;
  operations?: Record<string, unknown>;
  discovery?: { publication_queue?: Array<{ catalog_id: string; prototype_id: string; state: string }> };
};

function loadProjectState(): ProjectState {
  if (!existsSync(STATE_PATH)) {
    throw new Error("SOS/project-state.json missing");
  }
  return JSON.parse(readFileSync(STATE_PATH, "utf8")) as ProjectState;
}

function buildPendingQueue(
  conflicts: ReturnType<typeof annotateConflictsWithResolutions>,
): Array<{ catalog_id: string; prototype_id: string; safe: boolean; state: string }> {
  const catalog = JSON.parse(
    readFileSync(join(LOGS_ROOT, "publication/catalog.json"), "utf8"),
  ) as {
    templates?: Array<{ catalog_id: string; prototype_id: string; publication_state?: string }>;
  };

  const assignmentConflicts = conflicts.filter(
    (c) => c.type === "duplicate_batch_catalog_assignment",
  );
  const blockedPrototypes = new Set<string>();
  for (const c of assignmentConflicts) {
    const owner = (catalog.templates ?? []).find((t) => t.catalog_id === c.value)?.prototype_id;
    const keeperRef =
      owner ??
      c.occurrences.find((o) =>
        existsSync(join(LOGS_ROOT, "publication/packages", c.value)),
      )?.ref;
    for (const o of c.occurrences) {
      if (keeperRef && o.ref !== keeperRef) blockedPrototypes.add(o.ref);
    }
  }

  return (catalog.templates ?? [])
    .filter((t) => t.publication_state === "ready_to_publish" && t.catalog_id !== "t094")
    .map((t) => ({
      catalog_id: t.catalog_id,
      prototype_id: t.prototype_id,
      state: t.publication_state ?? "unknown",
      safe: !blockedPrototypes.has(t.prototype_id),
    }))
    .sort((a, b) => a.catalog_id.localeCompare(b.catalog_id));
}

export function runCatalogIntegrity(): {
  result: CatalogIntegrityResult;
  artifacts: ReturnType<typeof persistCatalogIntegrityArtifacts>;
  pendingQueue: ReturnType<typeof buildPendingQueue>;
  state_path: string;
} {
  const state = loadProjectState();
  if (state.next_agent !== "097" && state.latest_agent !== "097") {
    throw new Error(`Expected next agent #097, found #${state.next_agent}`);
  }

  const { conflicts: rawConflicts, checks } = validatePublicationSafety();
  const resolutions = resolveCatalogConflicts(rawConflicts);
  const conflicts = annotateConflictsWithResolutions(rawConflicts, resolutions);
  const history = buildCatalogHistory();
  const usedIds = [...collectUsedCatalogIds()];
  const nextId = nextAvailableCatalogId(collectUsedCatalogIds());

  const pipelineConflicts = conflicts.filter((c) => c.severity === "warning").length;
  const safety: PublicationSafetyReport = {
    generated_at: new Date().toISOString(),
    safe_to_publish: checks.live_layer_no_critical_conflicts && checks.publication_consistency,
    live_layer_unique: checks.live_layer_no_critical_conflicts,
    pipeline_conflicts: pipelineConflicts,
    checks: {
      ...checks,
      pipeline_conflicts_documented:
        pipelineConflicts === 0 ||
        resolutions.length >= pipelineConflicts,
    },
  };

  const result: CatalogIntegrityResult = {
    generated_at: safety.generated_at,
    conflicts,
    resolutions,
    history,
    safety,
    next_available_catalog_id: nextId,
    used_catalog_ids: usedIds.sort(),
  };

  const pendingQueue = buildPendingQueue(conflicts);
  const artifacts = persistCatalogIntegrityArtifacts({
    result,
    conflicts,
    resolutions,
    history,
    safety,
    pendingQueue,
  });

  const now = new Date().toISOString();
  const updated: ProjectState = {
    ...state,
    latest_agent: "097",
    next_agent: "098",
    generated_at: now,
    operations: {
      ...(state.operations ?? {}),
      catalog_integrity: {
        last_run: now,
        safe_to_publish: safety.safe_to_publish,
        conflicts_detected: conflicts.length,
        pipeline_conflicts: pipelineConflicts,
        next_available_catalog_id: nextId,
        output_dir: "SOS/07_LOGS/saios/catalog-integrity",
      },
    },
    history: [
      ...(state.history ?? []),
      {
        at: now,
        type: "catalog_integrity",
        summary: `Agent #097: ${conflicts.length} conflict(s), next ID ${nextId}`,
        ref: "SOS/07_LOGS/saios/catalog-integrity/catalog-integrity.json",
      },
    ],
  };
  writeFileSync(STATE_PATH, JSON.stringify(updated, null, 2));

  return { result, artifacts, pendingQueue, state_path: STATE_PATH };
}

export function nextSafePublicationCandidate(
  pendingQueue: ReturnType<typeof buildPendingQueue>,
): { catalog_id: string; prototype_id: string } | null {
  const safe = pendingQueue.filter((p) => p.safe && p.catalog_id !== "t094");
  return safe[0] ?? null;
}

export { STATE_PATH };
