import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { RuntimeConfig } from "../config.js";
import { getPmPaths } from "../pm/paths.js";
import { getDeveloperPaths } from "../developer/paths.js";
import { getQaPaths } from "../qa/paths.js";

export type PipelineAgentState = {
  state: string;
  current_task_id: string | null;
  current_task_title?: string | null;
};

export type PipelineStatus = {
  current_task: {
    task_id: string | null;
    backlog_id: string | null;
    title: string | null;
    status: string | null;
    stage: string | null;
  };
  pm: PipelineAgentState & { loop_status: string; queue_size: number };
  developer: PipelineAgentState & { execution_submitted: boolean };
  qa: PipelineAgentState & { completed_count: number; failed_count: number };
  completed_today: number;
  failed_today: number;
  queue_size: number;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function readJson<T>(path: string): Promise<T | null> {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return null;
  }
}

function countTodayFromHistory(
  historyPath: string,
  status: "completed" | "blocked",
): Promise<number> {
  return readFile(historyPath, "utf8")
    .then((raw) => {
      const today = todayIso();
      return raw
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as { timestamp?: string; status?: string })
        .filter((e) => e.timestamp?.startsWith(today) && e.status === status).length;
    })
    .catch(() => 0);
}

export async function loadPipelineStatus(config: RuntimeConfig): Promise<PipelineStatus> {
  const pmPaths = getPmPaths(config);
  const devPaths = getDeveloperPaths(config);
  const qaPaths = getQaPaths(config);

  const pmState = await readJson<{
    loop_status: string;
    current_task_id: string | null;
    task_queue: Array<{ task_id: string; backlog_id: string; title: string; status: string }>;
    completed_task_ids: string[];
  }>(pmPaths.state);

  const devState = await readJson<{
    state: string;
    current_task_id: string | null;
    execution_submitted: boolean;
  }>(devPaths.state);

  const qaState = await readJson<{
    state: string;
    current_task_id: string | null;
    completed_task_ids: string[];
    failed_task_ids: string[];
  }>(qaPaths.state);

  const activeTask = pmState?.current_task_id
    ? pmState.task_queue.find((t) => t.task_id === pmState.current_task_id)
    : pmState?.task_queue.find((t) =>
        ["developer_working", "qa_working", "assigned_developer", "assigned_qa", "reviewing_qa", "reviewing_dev"].includes(
          t.status,
        ),
      );

  const stage =
    activeTask?.status === "developer_working" ? "developer"
    : activeTask?.status === "qa_working" ? "qa"
    : activeTask?.status === "reviewing_qa" ? "pm_review_qa"
    : activeTask?.status === "reviewing_dev" ? "pm_review_dev"
    : activeTask?.status ?? null;

  const completedToday = await countTodayFromHistory(pmPaths.taskHistory, "completed");
  const failedToday = await countTodayFromHistory(pmPaths.taskHistory, "blocked");

  return {
    current_task: {
      task_id: activeTask?.task_id ?? pmState?.current_task_id ?? null,
      backlog_id: activeTask?.backlog_id ?? null,
      title: activeTask?.title ?? null,
      status: activeTask?.status ?? null,
      stage,
    },
    pm: {
      state: pmState?.loop_status ?? "unknown",
      loop_status: pmState?.loop_status ?? "unknown",
      current_task_id: pmState?.current_task_id ?? null,
      current_task_title: activeTask?.title ?? null,
      queue_size: pmState?.task_queue.length ?? 0,
    },
    developer: {
      state: devState?.state ?? "unknown",
      current_task_id: devState?.current_task_id ?? null,
      execution_submitted: devState?.execution_submitted ?? false,
    },
    qa: {
      state: qaState?.state ?? "unknown",
      current_task_id: qaState?.current_task_id ?? null,
      completed_count: qaState?.completed_task_ids.length ?? 0,
      failed_count: qaState?.failed_task_ids.length ?? 0,
    },
    completed_today: completedToday,
    failed_today: failedToday,
    queue_size: pmState?.task_queue.filter((t) => t.status === "queued").length ?? 0,
  };
}
