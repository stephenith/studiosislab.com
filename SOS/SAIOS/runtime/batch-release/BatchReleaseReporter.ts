/**
 * Writes batch release reports.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { BatchReleasePlan, BatchReleaseResult, BatchReleaseSimulation } from "./types.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const SOS_ROOT = join(REPO_ROOT, "SOS");
const OUTPUT_DIR = join(SOS_ROOT, "07_LOGS/saios/batch-release");

export function renderReleasePreview(
  plan: BatchReleasePlan,
  simulation: BatchReleaseSimulation,
): string {
  const lines = [
    "# Batch Release Preview",
    "",
    `**Generated:** ${plan.generated_at}`,
    `**Mode:** ${plan.mode}`,
    `**Dry Run:** ${plan.mode !== "real_release"}`,
    "",
    "## Selected For Release",
    "",
    ...(plan.selected_for_release.length
      ? plan.selected_for_release.map((id) => `- \`${id}\``)
      : ["- None"]),
    "",
    "## Simulation — Would Release",
    "",
    ...(simulation.would_release.length
      ? simulation.would_release.map(
          (r) =>
            `- \`${r.catalog_id}\` (${r.prototype_id}) — checksum \`${r.package_checksum.slice(0, 12)}…\``,
        )
      : ["- None (dry run — no live changes)"]),
    "",
    "## Simulation — Would Skip",
    "",
    ...(simulation.would_skip.length
      ? simulation.would_skip.map((s) => `- \`${s.catalog_id}\` — ${s.reason}`)
      : ["- None"]),
    "",
    "## Excluded From Plan",
    "",
    ...(plan.excluded.length
      ? plan.excluded.map((e) => `- \`${e.catalog_id}\` — ${e.reason}`)
      : ["- None"]),
    "",
    "> Founder final publish approval is mandatory for real release. This preview made no live changes.",
    "",
  ];
  return lines.join("\n");
}

export function persistBatchReleaseArtifacts(result: BatchReleaseResult): {
  output_dir: string;
  files: string[];
} {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const files = {
    plan: join(OUTPUT_DIR, "batch-release-plan.json"),
    summary: join(OUTPUT_DIR, "batch-release-summary.json"),
    preview: join(OUTPUT_DIR, "release-preview.md"),
    results: join(OUTPUT_DIR, "release-results.json"),
    simulation: join(OUTPUT_DIR, "release-simulation.json"),
    history: join(OUTPUT_DIR, "batch-publication-history.json"),
  };

  writeFileSync(files.plan, JSON.stringify(result.plan, null, 2));
  writeFileSync(
    files.summary,
    JSON.stringify(
      {
        generated_at: result.generated_at,
        mode: result.mode,
        dry_run: result.dry_run,
        published_count: result.published_count,
        queue_ready: result.plan.queue.filter((p) => p.classification === "ready").length,
        queue_blocked: result.plan.queue.filter((p) => p.classification === "blocked").length,
        queue_published: result.plan.queue.filter((p) => p.classification === "published").length,
        selected_count: result.plan.selected_for_release.length,
        simulation_would_release: result.simulation.would_release.length,
        rollback_summary: result.rollback_summary,
      },
      null,
      2,
    ),
  );
  writeFileSync(files.preview, renderReleasePreview(result.plan, result.simulation));
  writeFileSync(
    files.results,
    JSON.stringify(
      {
        generated_at: result.generated_at,
        mode: result.mode,
        dry_run: result.dry_run,
        releases_executed: result.published_count,
        note: result.dry_run
          ? "No releases executed — dry run / simulation only"
          : "Real releases require per-template founder_final_publish_approval",
      },
      null,
      2,
    ),
  );
  writeFileSync(files.simulation, JSON.stringify(result.simulation, null, 2));
  writeFileSync(
    files.history,
    JSON.stringify(
      {
        generated_at: result.generated_at,
        rollback_summary: result.rollback_summary,
        classifications: result.plan.queue.reduce(
          (acc, p) => {
            acc[p.classification] = (acc[p.classification] ?? 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ),
      },
      null,
      2,
    ),
  );

  return { output_dir: OUTPUT_DIR, files: Object.values(files) };
}

export { OUTPUT_DIR };
