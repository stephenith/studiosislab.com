/**
 * Batch Release Manager — orchestration entry point.
 * AGENT #098 — coordinates Release Manager; never auto-publishes.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildReleaseGroups, groupByType, selectForGroup } from "./BatchReleasePlanner.js";
import { buildRollbackSummary, simulateBatchRelease } from "./BatchReleaseExecutor.js";
import { discoverPublicationPackages } from "./PackageDiscoverer.js";
import { persistBatchReleaseArtifacts } from "./BatchReleaseReporter.js";
import type { BatchReleasePlan, BatchReleaseResult, ReleaseGroup, ReleaseMode } from "./types.js";

export const BATCH_RELEASE_MANAGER = {
  module: "batch-release-manager",
  version: "1.0.0",
  agent: "098",
  role: "controlled_batch_coordination",
  prohibitions: [
    "no_resume_generation",
    "no_ai_system_mutation",
    "no_founder_approval_bypass",
    "no_auto_publish",
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
  latest_release: string;
  latest_catalog: string;
  history?: Array<{ at: string; type: string; summary: string; ref: string }>;
  operations?: Record<string, unknown>;
};

export type RunBatchReleaseOptions = {
  mode?: ReleaseMode;
  group?: ReleaseGroup;
  catalog_ids?: string[];
};

function loadProjectState(): ProjectState {
  if (!existsSync(STATE_PATH)) throw new Error("SOS/project-state.json missing");
  return JSON.parse(readFileSync(STATE_PATH, "utf8")) as ProjectState;
}

export function runBatchRelease(options: RunBatchReleaseOptions = {}): BatchReleaseResult {
  const state = loadProjectState();
  if (state.next_agent !== "098" && state.latest_agent !== "098") {
    throw new Error(`Expected agent #098, found latest=${state.latest_agent} next=${state.next_agent}`);
  }

  const mode: ReleaseMode = options.mode ?? "dry_run";
  if (mode === "real_release") {
    throw new Error(
      "Real batch release requires explicit per-template founder_final_publish_approval — use Release Manager directly",
    );
  }

  const packages = discoverPublicationPackages();
  const groups = buildReleaseGroups(packages);
  const activeGroup =
    options.group ??
    groupByType(groups, "production_batch") ??
    groups.find((g) => g.label === "all-ready-safe")!;

  let selected_for_release: string[];
  let excluded: BatchReleasePlan["excluded"];

  if (options.catalog_ids?.length) {
    const customGroup: ReleaseGroup = {
      type: "catalog_ids",
      label: "custom-selection",
      catalog_ids: options.catalog_ids,
    };
    const sel = selectForGroup(packages, customGroup);
    selected_for_release = sel.selected;
    excluded = sel.excluded;
  } else {
    const sel = selectForGroup(packages, activeGroup);
    selected_for_release = sel.selected;
    excluded = sel.excluded;
  }

  const plan: BatchReleasePlan = {
    generated_at: new Date().toISOString(),
    mode,
    groups,
    queue: packages,
    selected_for_release,
    excluded,
  };

  const simulation = simulateBatchRelease({
    mode,
    plan,
    packages,
    target_root: REPO_ROOT,
  });

  const rollback_summary = buildRollbackSummary({
    releaseHistoryPath: join(LOGS_ROOT, "publication/release-manager/release-history.json"),
  });

  const result: BatchReleaseResult = {
    generated_at: plan.generated_at,
    mode,
    plan,
    simulation,
    dry_run: mode !== "real_release",
    published_count: 0,
    rollback_summary,
  };

  persistBatchReleaseArtifacts(result);

  const now = new Date().toISOString();
  const updated: ProjectState = {
    ...state,
    latest_agent: "098",
    next_agent: "099",
    generated_at: now,
    operations: {
      ...(state.operations ?? {}),
      batch_release: {
        last_run: now,
        mode,
        dry_run: true,
        selected_count: selected_for_release.length,
        would_release: simulation.would_release.length,
        output_dir: "SOS/07_LOGS/saios/batch-release",
      },
    },
    history: [
      ...(state.history ?? []),
      {
        at: now,
        type: "batch_release",
        summary: `Agent #098 dry run: ${simulation.would_release.length} would release, 0 published`,
        ref: "SOS/07_LOGS/saios/batch-release/batch-release-summary.json",
      },
    ],
  };
  writeFileSync(STATE_PATH, JSON.stringify(updated, null, 2));

  return result;
}

export { STATE_PATH };
