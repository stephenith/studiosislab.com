/**
 * Run manager — allocate unique run folders under SOS/07_LOGS/saios/runs/.
 * No existing run may be overwritten.
 */
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
export const RUNS_ROOT = join(SOS_ROOT, "07_LOGS/saios/runs");

export type RunFolderLayout = {
  run_id: string;
  run_dir: string;
  objective: string;
  batch_plan: string;
  research: string;
  cursor_output: string;
  generated: string;
  qa: string;
  localhost: string;
  learning: string;
  summary: string;
  pipeline_state: string;
  pipeline_report: string;
};

export function allocateRunId(date = new Date()): string {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
  mkdirSync(RUNS_ROOT, { recursive: true });
  const prefix = `run-${ymd}-`;
  const existing = readdirSync(RUNS_ROOT).filter((n) => n.startsWith(prefix));
  const seq = existing.length + 1;
  return `${prefix}${String(seq).padStart(3, "0")}`;
}

export function runDirForId(run_id: string): string {
  return join(RUNS_ROOT, run_id);
}

/**
 * Create a new run directory with required subfolders.
 * Throws if run_dir already exists (no overwrite).
 */
export function createRunFolder(run_id: string): RunFolderLayout {
  const run_dir = runDirForId(run_id);
  if (existsSync(run_dir)) {
    throw new Error(`Run folder already exists — will not overwrite: ${run_dir}`);
  }

  const layout: RunFolderLayout = {
    run_id,
    run_dir,
    objective: join(run_dir, "objective.md"),
    batch_plan: join(run_dir, "batch-plan.json"),
    research: join(run_dir, "research.md"),
    cursor_output: join(run_dir, "cursor-output.md"),
    generated: join(run_dir, "generated"),
    qa: join(run_dir, "qa"),
    localhost: join(run_dir, "localhost"),
    learning: join(run_dir, "learning"),
    summary: join(run_dir, "summary.md"),
    pipeline_state: join(run_dir, "pipeline-state.json"),
    pipeline_report: join(run_dir, "pipeline-report.md"),
  };

  mkdirSync(layout.generated, { recursive: true });
  mkdirSync(layout.qa, { recursive: true });
  mkdirSync(layout.localhost, { recursive: true });
  mkdirSync(layout.learning, { recursive: true });

  return layout;
}

export function findRunById(run_id: string): RunFolderLayout | null {
  const run_dir = runDirForId(run_id);
  if (!existsSync(run_dir)) return null;
  return {
    run_id,
    run_dir,
    objective: join(run_dir, "objective.md"),
    batch_plan: join(run_dir, "batch-plan.json"),
    research: join(run_dir, "research.md"),
    cursor_output: join(run_dir, "cursor-output.md"),
    generated: join(run_dir, "generated"),
    qa: join(run_dir, "qa"),
    localhost: join(run_dir, "localhost"),
    learning: join(run_dir, "learning"),
    summary: join(run_dir, "summary.md"),
    pipeline_state: join(run_dir, "pipeline-state.json"),
    pipeline_report: join(run_dir, "pipeline-report.md"),
  };
}
