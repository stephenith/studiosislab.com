/**
 * Data aggregator — read-only access to all factory log stores.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");

export const PATHS = {
  scheduler: join(SOS_ROOT, "07_LOGS/saios/scheduler"),
  unified: join(SOS_ROOT, "07_LOGS/saios/unified-production"),
  publication: join(SOS_ROOT, "07_LOGS/saios/publication"),
  learning: join(SOS_ROOT, "07_LOGS/saios/learning"),
  qa: join(SOS_ROOT, "07_LOGS/saios/qa"),
  critic: join(SOS_ROOT, "07_LOGS/saios/founder-critic"),
  render: join(SOS_ROOT, "07_LOGS/saios/visual-render"),
  generated: join(SOS_ROOT, "07_LOGS/saios/generated-resumes"),
  queue: join(SOS_ROOT, "07_LOGS/saios/scheduler/queue/jobs"),
};

export function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

export function listDirs(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root).filter((n) => {
    try {
      return statSync(join(root, n)).isDirectory();
    } catch {
      return false;
    }
  });
}

export function listFiles(root: string, ext?: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root).filter((n) => !ext || n.endsWith(ext));
}

export function loadSchedulerDashboard() {
  return readJson<Record<string, unknown>>(join(PATHS.scheduler, "scheduler-dashboard.json"));
}

export function loadSchedulerState() {
  return readJson<Record<string, unknown>>(join(PATHS.scheduler, "scheduler-state.json"));
}

export function loadSchedulerHealth() {
  return readJson<{ overall_health?: string; alerts?: unknown[] }>(
    join(PATHS.scheduler, "scheduler-health.json"),
  );
}

export function loadUnifiedRuns(): Array<Record<string, unknown>> {
  const runsDir = join(PATHS.unified, "runs");
  return listDirs(runsDir)
    .map((id) => readJson<Record<string, unknown>>(join(runsDir, id, "run.json")))
    .filter((r): r is Record<string, unknown> => r !== null);
}

export function loadQueueJobs(): Array<Record<string, unknown>> {
  if (!existsSync(PATHS.queue)) return [];
  return listFiles(PATHS.queue, ".json")
    .map((f) => readJson<Record<string, unknown>>(join(PATHS.queue, f)))
    .filter((j): j is Record<string, unknown> => j !== null);
}

export function loadJobHistory() {
  return readJson<{ entries?: Array<Record<string, unknown>> }>(
    join(PATHS.scheduler, "job-history.json"),
  );
}

export function loadPublicationCatalog() {
  return readJson<{ entries?: Array<Record<string, unknown>> }>(
    join(PATHS.publication, "catalog.json"),
  );
}

export function loadDesignMemory() {
  return readJson<Record<string, unknown>>(join(PATHS.learning, "design-memory.json"));
}

export function loadSchedulerConfig() {
  return readJson<Record<string, unknown>>(join(PATHS.scheduler, "scheduler-config.json"));
}

export function loadCriticReview(prototypeId: string) {
  const base = join(PATHS.critic, "reviews", prototypeId);
  return {
    approval: readJson<Record<string, unknown>>(join(base, "approval-recommendation.json")),
    prediction: readJson<Record<string, unknown>>(join(base, "founder-prediction.json")),
    review: readJson<Record<string, unknown>>(join(base, "founder-review.json")),
  };
}

export function loadRenderScores(prototypeId: string) {
  return readJson<{ overall_render_score?: number; premium_score?: number }>(
    join(PATHS.render, "evaluations", prototypeId, "render-score.json"),
  );
}

export function loadQaValidation(prototypeId: string) {
  return readJson<{ pass?: boolean; stages_passed?: number; stages_total?: number }>(
    join(PATHS.qa, prototypeId, "validation.json"),
  );
}

export function getArtifactPaths(runId: string): Record<string, string[]> {
  const runDir = join(PATHS.unified, "runs", runId);
  const index = readJson<{ artifacts?: Record<string, string[]> }>(
    join(runDir, "artifact-index.json"),
  );
  return index?.artifacts ?? {};
}
