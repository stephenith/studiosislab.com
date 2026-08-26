/**
 * Artifact tracker — master index of all stage outputs.
 */
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { StageArtifact, UnifiedRunState } from "./types.js";

export function stageDir(run_dir: string, stage: string): string {
  return join(run_dir, stage.replace(/_/g, "-"));
}

export function recordArtifact(
  state: UnifiedRunState,
  artifact: StageArtifact,
): UnifiedRunState {
  const filtered = state.artifacts.filter((a) => a.stage !== artifact.stage);
  return { ...state, artifacts: [...filtered, artifact] };
}

export function listFilesRecursive(dir: string, maxDepth = 2): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  const walk = (current: string, depth: number) => {
    if (depth > maxDepth) return;
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      const st = statSync(full);
      if (st.isDirectory()) walk(full, depth + 1);
      else files.push(full);
    }
  };
  walk(dir, 0);
  return files;
}

export function buildArtifactIndex(state: UnifiedRunState): Record<string, string[]> {
  const index: Record<string, string[]> = {
    research: [],
    benchmark: [],
    design: [],
    composition: [],
    generation: [],
    qa: [],
    render: [],
    critic: [],
    publication: [],
    learning: [],
    reports: [],
  };

  for (const artifact of state.artifacts) {
    const key = stageToIndexKey(artifact.stage);
    index[key] = [...(index[key] ?? []), ...artifact.files];
  }

  const reportFiles = [
    join(state.run_dir, "master-production-report.json"),
    join(state.run_dir, "timeline.json"),
    join(state.run_dir, "quality-summary.json"),
    join(state.run_dir, "artifact-index.json"),
  ].filter((f) => existsSync(f));
  index.reports = reportFiles;

  return index;
}

function stageToIndexKey(stage: string): string {
  const map: Record<string, string> = {
    queued: "reports",
    researching: "research",
    benchmarking: "benchmark",
    designing: "design",
    composing: "composition",
    generating: "generation",
    qa: "qa",
    render_review: "render",
    founder_critic: "critic",
    publication_ready: "publication",
    waiting_founder: "reports",
  };
  return map[stage] ?? "reports";
}

export function persistArtifactIndex(state: UnifiedRunState): string {
  const index = buildArtifactIndex(state);
  const path = join(state.run_dir, "artifact-index.json");
  mkdirSync(state.run_dir, { recursive: true });
  writeFileSync(path, JSON.stringify({ run_id: state.run_id, artifacts: index }, null, 2));
  return path;
}
