import type { RuntimeConfig } from "../../config.js";
import { getPmStatus } from "../../pm/loop.js";
import { getDeveloperStatus } from "../../developer/loop.js";
import { getQaStatus } from "../../qa/loop.js";
import { loadConfig } from "../../config.js";
import { getPmPaths } from "../../pm/paths.js";
import { loadState } from "../../pm/state.js";
import { readMasterBacklog } from "../../pm/readers.js";
import { buildRoadmapStatus } from "../../pm/roadmap-planner.js";
import { reloadPlanningContext } from "../../pm/reprioritize.js";

export type PlatformStatus = {
  pm: Record<string, unknown>;
  developer: Record<string, unknown>;
  qa: Record<string, unknown>;
  roadmap: Record<string, unknown>;
  queue_count: number;
  paused_count: number;
  eta_hours: number | null;
};

export async function loadPlatformStatus(config?: RuntimeConfig): Promise<PlatformStatus> {
  const cfg = config ?? loadConfig();
  const paths = getPmPaths(cfg);
  const state = await loadState(paths);
  const [pm, developer, qa, roadmap] = await Promise.all([
    getPmStatus(),
    getDeveloperStatus(),
    getQaStatus(),
    buildRoadmapStatus(paths, state),
  ]);

  const queued = state.task_queue.filter((t) =>
    ["queued", "assigned_developer", "developer_working"].includes(t.status),
  );

  const etaHours = estimateEtaHours(roadmap, queued.length);

  return {
    pm,
    developer,
    qa,
    roadmap: roadmap as unknown as Record<string, unknown>,
    queue_count: queued.length,
    paused_count: state.paused_tasks?.length ?? 0,
    eta_hours: etaHours,
  };
}

function estimateEtaHours(roadmap: Awaited<ReturnType<typeof buildRoadmapStatus>>, queueLen: number): number | null {
  const completion = typeof roadmap.completion_pct === "number" ? roadmap.completion_pct : null;
  if (completion === null) return queueLen > 0 ? queueLen * 2 : null;
  const remaining = Math.max(0, 100 - completion);
  return Math.round((remaining / 10 + queueLen) * 1.5);
}

export async function loadNextTaskRecommendation(config?: RuntimeConfig): Promise<{
  title: string | null;
  backlog_id: string | null;
  reason: string | null;
  combined_score: number | null;
}> {
  const cfg = config ?? loadConfig();
  const paths = getPmPaths(cfg);
  const state = await loadState(paths);
  const ctx = await reloadPlanningContext(paths, state);
  const selected = ctx.report.selected;
  return {
    title: selected?.item.title ?? null,
    backlog_id: selected?.item.id ?? null,
    reason: ctx.report.selected_reason,
    combined_score: selected?.combined_score ?? null,
  };
}

export async function loadQueueSummary(config?: RuntimeConfig): Promise<
  Array<{ backlog_id: string; title: string; status: string; priority: string }>
> {
  const cfg = config ?? loadConfig();
  const paths = getPmPaths(cfg);
  const state = await loadState(paths);
  const backlog = await readMasterBacklog(paths);
  const backlogMap = new Map(backlog.map((b) => [b.id, b]));

  const fromTasks = state.task_queue
    .filter((t) => !["completed", "cancelled"].includes(t.status))
    .map((t) => ({
      backlog_id: t.backlog_id,
      title: t.title,
      status: t.status,
      priority: t.priority,
    }));

  const seen = new Set(fromTasks.map((t) => t.backlog_id));
  for (const item of backlog) {
    if (item.section !== "planned" && item.section !== "blocked") continue;
    if (seen.has(item.id)) continue;
    fromTasks.push({
      backlog_id: item.id,
      title: item.title,
      status: item.status,
      priority: item.priority === "Critical" ? "P0" : item.priority === "High" ? "P1" : "P2",
    });
  }

  return fromTasks.slice(0, 15);
}
