/**
 * Artifact viewer — resolve paths without manual folder browsing.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PATHS, getArtifactPaths, listDirs } from "./DataAggregator.js";

const STAGE_MAP: Record<string, string> = {
  research: "researching",
  benchmark: "benchmarking",
  design: "designing",
  composition: "composing",
  generation: "generating",
  qa: "qa",
  render: "render_review",
  critic: "founder_critic",
  publication: "publication_ready",
  learning: "learning",
  reports: "reports",
};

export function listArtifactStages(runId?: string): Record<string, { paths: string[]; exists: boolean }> {
  const result: Record<string, { paths: string[]; exists: boolean }> = {};

  if (runId) {
    const artifacts = getArtifactPaths(runId);
    for (const [key, paths] of Object.entries(artifacts)) {
      result[key] = {
        paths,
        exists: paths.some((p) => existsSync(p)),
      };
    }
    return result;
  }

  result.research = dirSummary(join(PATHS.scheduler.replace("scheduler", "research/sessions")));
  result.benchmark = dirSummary(join(PATHS.scheduler.replace("scheduler", "benchmark")));
  result.design = dirSummary(join(PATHS.scheduler.replace("scheduler", "design-brain/sessions")));
  result.composition = dirSummary(join(PATHS.scheduler.replace("scheduler", "adaptive-composer/compositions")));
  result.generation = dirSummary(PATHS.generated);
  result.qa = dirSummary(PATHS.qa);
  result.render = dirSummary(join(PATHS.render, "evaluations"));
  result.critic = dirSummary(join(PATHS.critic, "reviews"));
  result.publication = dirSummary(join(PATHS.publication, "packages"));
  result.learning = { paths: [PATHS.learning], exists: existsSync(PATHS.learning) };
  result.reports = {
    paths: [
      join(PATHS.scheduler.replace("scheduler", "unified-production")),
      PATHS.scheduler,
    ],
    exists: true,
  };

  return result;
}

function dirSummary(root: string): { paths: string[]; exists: boolean } {
  const dirs = listDirs(root).slice(0, 10).map((d) => join(root, d));
  return { paths: dirs, exists: existsSync(root) };
}

export function openArtifact(stage: string, runId: string): { stage: string; files: string[] } {
  const artifacts = getArtifactPaths(runId);
  const key = STAGE_MAP[stage] ?? stage;
  const files = artifacts[key] ?? artifacts[stage] ?? [];
  return { stage, files: files.filter((f) => existsSync(f)) };
}
