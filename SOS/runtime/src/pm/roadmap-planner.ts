/**
 * Autonomous Roadmap Planner — decomposes epics, maintains queue, unlocks dependencies.
 */
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { RuntimeConfig } from "../config.js";
import { loadConfig } from "../config.js";
import { getDeveloperPaths } from "../developer/paths.js";
import { loadDeveloperState } from "../developer/state.js";
import { getQaPaths } from "../qa/paths.js";
import { loadQaState } from "../qa/state.js";
import type { PmPaths } from "./paths.js";
import { readMasterBacklog, readFullBacklogProgress } from "./readers.js";
import { assessLaunchReadiness } from "./founder-priority.js";
import {
  backlogIdForSlice,
  buildSliceId,
  decomposeBacklogItem,
  findDecomposeTemplate,
  isLargeRoadmapItem,
} from "./roadmap-decompose.js";
import { appendJsonl } from "./state.js";
import type {
  BacklogItem,
  DeveloperReport,
  PmState,
  QaReport,
  RoadmapEpic,
  RoadmapSlice,
  RoadmapState,
  RoadmapStatusSnapshot,
  Task,
} from "./types.js";
import { backlogItemToTask } from "./tasks.js";
import { detectHardGates, loadCdeConfig } from "./cde.js";

const COMPLEXITY_DAYS: Record<RoadmapSlice["estimated_complexity"], number> = {
  small: 0.5,
  medium: 1,
  large: 2,
};

const LAUNCH_CRITERIA = [
  "L1_hub_template_open",
  "L2_save_auth",
  "L3_desktop_pdf",
  "L4_mobile_hub_edit",
  "L5_mobile_pdf",
  "L6_seo_pages",
  "L7_auth_flow",
  "L8_resume_security",
];

export function createInitialRoadmapState(): RoadmapState {
  return {
    version: "1.0.0",
    updated_at: new Date().toISOString(),
    epics: [],
    slices: [],
    known_slice_ids: [],
  };
}

export function ensureRoadmapState(state: PmState): RoadmapState {
  if (!state.roadmap) {
    state.roadmap = createInitialRoadmapState();
  }
  state.roadmap.known_slice_ids ??= [];
  state.roadmap.epics ??= [];
  state.roadmap.slices ??= [];
  return state.roadmap;
}

function sliceKnown(roadmap: RoadmapState, sliceId: string): boolean {
  return roadmap.known_slice_ids.includes(sliceId);
}

function registerSlice(roadmap: RoadmapState, slice: RoadmapSlice): boolean {
  if (sliceKnown(roadmap, slice.slice_id)) return false;
  roadmap.slices.push(slice);
  roadmap.known_slice_ids.push(slice.slice_id);
  return true;
}

function isSliceCompleted(roadmap: RoadmapState, sliceId: string, state: PmState): boolean {
  const slice = roadmap.slices.find((s) => s.slice_id === sliceId);
  if (slice?.status === "completed") return true;
  const backlogId = backlogIdForSlice(sliceId);
  return state.completed_task_ids.some((id) => id.includes(backlogId));
}

export function areSliceDependenciesSatisfied(
  slice: RoadmapSlice,
  roadmap: RoadmapState,
  state: PmState,
): boolean {
  if (slice.dependency.length === 0) return true;
  return slice.dependency.every((dep) => isSliceCompleted(roadmap, dep, state));
}

export function roadmapSliceToBacklogItem(slice: RoadmapSlice): BacklogItem {
  return {
    id: backlogIdForSlice(slice.slice_id),
    section: slice.parent_task.startsWith("BL-3") ? "blocked" : "planned",
    sectionRef: slice.parent_task.replace(/^BL-/, "").replace("-", "."),
    title: slice.title,
    description: slice.description,
    priority: slice.priority,
    completionPct: 0,
    evidence: [...slice.evidence_paths, ...slice.suggested_files],
    needsVerification: false,
    dependencies: slice.dependency.map(backlogIdForSlice),
    blockers: slice.dependency.length ? [`Waiting on: ${slice.dependency.join(", ")}`] : [],
    status: "actionable",
  };
}

function createTaskFromSlice(slice: RoadmapSlice): Task {
  const item = roadmapSliceToBacklogItem(slice);
  const task = backlogItemToTask(item);
  task.metadata = {
    ...task.metadata,
    roadmap_slice_id: slice.slice_id,
    parent_task: slice.parent_task,
    parent_title: slice.parent_title,
    milestone: slice.milestone,
    feature: slice.feature,
    estimated_complexity: slice.estimated_complexity,
    acceptance_criteria: slice.acceptance_criteria,
    suggested_files: slice.suggested_files,
    qa_checklist: slice.qa_checklist,
    slice_kind: slice.kind,
    generated_by: "roadmap_planner",
  };
  if (slice.kind === "qa" || slice.kind === "regression") {
    task.qa_required = true;
  }
  return task;
}

function taskExistsForSlice(state: PmState, slice: RoadmapSlice): boolean {
  const backlogId = backlogIdForSlice(slice.slice_id);
  return state.task_queue.some(
    (t) =>
      t.backlog_id === backlogId
      || t.metadata?.roadmap_slice_id === slice.slice_id,
  );
}

export function insertSliceIntoQueue(state: PmState, slice: RoadmapSlice): Task | null {
  if (taskExistsForSlice(state, slice)) return null;

  const task = createTaskFromSlice(slice);
  state.task_queue.push(task);
  slice.task_id = task.task_id;
  slice.status = "queued";
  return task;
}

function decomposeEpicIfNeeded(
  roadmap: RoadmapState,
  item: BacklogItem,
): RoadmapEpic | null {
  const existing = roadmap.epics.find((e) => e.epic_id === item.id);
  if (existing?.decomposed) return existing;

  const tpl = findDecomposeTemplate(item);
  if (!tpl && !isLargeRoadmapItem(item)) return null;
  if (!tpl) return null;

  const slices = decomposeBacklogItem(item, tpl);
  const addedIds: string[] = [];

  for (const slice of slices) {
    if (registerSlice(roadmap, slice)) {
      addedIds.push(slice.slice_id);
    }
  }

  const epic: RoadmapEpic = {
    epic_id: item.id,
    title: item.title,
    milestone: tpl.milestone,
    feature: tpl.feature,
    decomposed: true,
    slice_ids: roadmap.slices.filter((s) => s.parent_task === item.id).map((s) => s.slice_id),
    decomposed_at: new Date().toISOString(),
  };

  const epicIdx = roadmap.epics.findIndex((e) => e.epic_id === item.id);
  if (epicIdx >= 0) roadmap.epics[epicIdx] = epic;
  else roadmap.epics.push(epic);

  return epic;
}

export function unlockReadySlices(state: PmState, roadmap: RoadmapState): Task[] {
  const inserted: Task[] = [];

  for (const slice of roadmap.slices) {
    if (slice.status === "completed" || slice.status === "cancelled") continue;
    if (slice.status === "queued" || slice.status === "in_progress") continue;

    if (!areSliceDependenciesSatisfied(slice, roadmap, state)) {
      slice.status = "blocked_deps";
      continue;
    }

    if (taskExistsForSlice(state, slice)) {
      slice.status = "queued";
      continue;
    }

    const task = insertSliceIntoQueue(state, slice);
    if (task) inserted.push(task);
  }

  return inserted;
}

async function readDevReport(paths: PmPaths, taskId: string): Promise<DeveloperReport | null> {
  const path = join(paths.devReports, `${taskId}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(await readFile(path, "utf8")) as DeveloperReport;
  } catch {
    return null;
  }
}

async function readQaReportFile(paths: PmPaths, taskId: string): Promise<QaReport | null> {
  const path = join(paths.qaReports, `${taskId}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(await readFile(path, "utf8")) as QaReport;
  } catch {
    return null;
  }
}

function createDiscoverySlice(
  parentTask: Task,
  kind: RoadmapSlice["kind"],
  title: string,
  description: string,
  evidence: string[],
  roadmap: RoadmapState,
): RoadmapSlice | null {
  const slug = `${kind}-${randomUUID().slice(0, 8)}`;
  const parentId = (parentTask.metadata?.parent_task as string) ?? parentTask.backlog_id;
  const slice_id = buildSliceId(parentId.replace(/^BL-/, "RP-"), slug);

  if (sliceKnown(roadmap, slice_id)) return null;

  const slice: RoadmapSlice = {
    slice_id,
    task_id: null,
    parent_task: parentId,
    parent_title: (parentTask.metadata?.parent_title as string) ?? parentTask.title,
    title,
    description,
    dependency: parentTask.metadata?.roadmap_slice_id
      ? [parentTask.metadata.roadmap_slice_id as string]
      : [],
    estimated_complexity: "small",
    acceptance_criteria: [
      "Addresses discovery from prior task",
      "Build and lint pass",
      "PM acceptance in completion report",
    ],
    evidence_paths: evidence.length ? evidence : parentTask.evidence,
    suggested_files: parentTask.metadata?.suggested_files
      ? (parentTask.metadata.suggested_files as string[])
      : parentTask.evidence.filter((e) => e.startsWith("src/")),
    qa_checklist: [
      "Verify fix addresses reported issue",
      "No regression on launch path",
      "Build passes",
    ],
    status: "blocked_deps",
    kind,
    priority: parentTask.backlog_priority,
    milestone: (parentTask.metadata?.milestone as string) ?? "Continuous maintenance",
    feature: (parentTask.metadata?.feature as string) ?? parentTask.title,
    created_at: new Date().toISOString(),
  };

  registerSlice(roadmap, slice);
  return slice;
}

export async function processDiscoveryFromCompletedTask(
  paths: PmPaths,
  state: PmState,
  task: Task,
): Promise<RoadmapSlice[]> {
  const roadmap = ensureRoadmapState(state);
  const created: RoadmapSlice[] = [];
  const devReport = await readDevReport(paths, task.task_id);
  const qaReport = await readQaReportFile(paths, task.task_id);
  const readiness = assessLaunchReadiness(state, []);

  if (devReport?.blocker && devReport.blocker_reason) {
    const slice = createDiscoverySlice(
      task,
      "follow_up",
      `Follow-up: ${task.title}`,
      devReport.blocker_reason,
      devReport.files_changed ?? devReport.evidence,
      roadmap,
    );
    if (slice) created.push(slice);
  }

  if (qaReport?.recommended_fixes?.length) {
    for (const fix of qaReport.recommended_fixes.slice(0, 2)) {
      const slice = createDiscoverySlice(
        task,
        "follow_up",
        `Follow-up: ${fix.slice(0, 80)}`,
        fix,
        qaReport.evidence,
        roadmap,
      );
      if (slice) created.push(slice);
    }
  }

  if (qaReport?.verdict === "fail") {
    const slice = createDiscoverySlice(
      task,
      "regression",
      `Regression: ${task.title}`,
      qaReport.summary,
      qaReport.evidence,
      roadmap,
    );
    if (slice) created.push(slice);
  }

  const text = `${devReport?.summary ?? ""} ${qaReport?.summary ?? ""} ${task.description}`;
  if (
    readiness.launch_blockers_open.length === 0
    && /cleanup|orphan|normalize|hygiene|categoryid/i.test(text)
  ) {
    const config = loadCdeConfig();
    const gates = detectHardGates(text, config);
    if (gates.length === 0) {
      const slice = createDiscoverySlice(
        task,
        "cleanup",
        `Cleanup: ${task.title}`,
        "Post-launch cleanup discovered during implementation",
        task.evidence,
        roadmap,
      );
      if (slice) created.push(slice);
    }
  }

  return created;
}

export function markSliceCompleted(state: PmState, task: Task): void {
  const roadmap = ensureRoadmapState(state);
  const sliceId = task.metadata?.roadmap_slice_id as string | undefined;
  if (!sliceId) return;

  const slice = roadmap.slices.find((s) => s.slice_id === sliceId);
  if (!slice) return;

  slice.status = "completed";
  slice.completed_at = new Date().toISOString();
  slice.task_id = task.task_id;
}

export type MaintainRoadmapResult = {
  epics_decomposed: number;
  slices_added: number;
  tasks_inserted: Task[];
  discovery_slices: number;
};

export async function maintainRoadmap(
  paths: PmPaths,
  state: PmState,
  backlogItems?: BacklogItem[],
): Promise<MaintainRoadmapResult> {
  const roadmap = ensureRoadmapState(state);
  const items = backlogItems ?? (await readMasterBacklog(paths));
  let epicsDecomposed = 0;
  let slicesAdded = 0;

  for (const item of items) {
    if (!isLargeRoadmapItem(item) && !findDecomposeTemplate(item)) continue;
    const before = roadmap.known_slice_ids.length;
    const epic = decomposeEpicIfNeeded(roadmap, item);
    if (epic) {
      epicsDecomposed += 1;
      slicesAdded += roadmap.known_slice_ids.length - before;
    }
  }

  const inserted = unlockReadySlices(state, roadmap);
  roadmap.updated_at = new Date().toISOString();

  if (inserted.length > 0) {
    await appendJsonl(paths.executionLog, {
      timestamp: new Date().toISOString(),
      message: "roadmap_tasks_inserted",
      count: inserted.length,
      task_ids: inserted.map((t) => t.task_id),
      slice_ids: inserted.map((t) => t.metadata?.roadmap_slice_id),
    });
  }

  return {
    epics_decomposed: epicsDecomposed,
    slices_added: slicesAdded,
    tasks_inserted: inserted,
    discovery_slices: 0,
  };
}

export function getRoadmapActionableItems(state: PmState): BacklogItem[] {
  const roadmap = ensureRoadmapState(state);
  return roadmap.slices
    .filter((s) => s.status === "queued" && !taskExistsForSlice(state, s))
    .map(roadmapSliceToBacklogItem);
}

function countLaunchCriteriaMet(state: PmState, roadmap: RoadmapState): number {
  let met = 0;
  const mobileRoutingDone = roadmap.slices.some(
    (s) => s.slice_id.endsWith("-mobile-routing") && s.status === "completed",
  );
  const mobileDownloadDone = roadmap.slices.some(
    (s) => s.slice_id.endsWith("-mobile-download") && s.status === "completed",
  );
  const seoDone = roadmap.slices.some(
    (s) => s.slice_id.endsWith("-seo-batch-3") && s.status === "completed",
  );

  if (state.completed_task_ids.length > 0) met += 3;
  if (mobileRoutingDone) met += 1;
  if (mobileDownloadDone) met += 1;
  if (seoDone) met += 1;

  return Math.min(met, LAUNCH_CRITERIA.length);
}

async function readAgentUtilization(config: RuntimeConfig): Promise<{
  developer: RoadmapStatusSnapshot["developer_utilization"];
  qa: RoadmapStatusSnapshot["qa_utilization"];
}> {
  let developer: RoadmapStatusSnapshot["developer_utilization"] = "idle";
  let qa: RoadmapStatusSnapshot["qa_utilization"] = "idle";

  try {
    const devPaths = getDeveloperPaths(config);
    if (existsSync(devPaths.state)) {
      const dev = await loadDeveloperState(devPaths);
      if (dev.current_task_id) {
        developer = dev.state === "working" ? "working" : "assigned";
      }
    }
  } catch {
    /* optional */
  }

  try {
    const qaPaths = getQaPaths(config);
    if (existsSync(qaPaths.state)) {
      const qaState = await loadQaState(qaPaths);
      if (qaState.current_task_id) {
        qa = qaState.state === "working" ? "working" : "assigned";
      }
    }
  } catch {
    /* optional */
  }

  return { developer, qa };
}

export async function buildRoadmapStatus(
  paths: PmPaths,
  state: PmState,
): Promise<RoadmapStatusSnapshot & { epics: RoadmapEpic[]; next_unlocked: RoadmapSlice[] }> {
  const roadmap = ensureRoadmapState(state);
  const progress = await readFullBacklogProgress(paths);
  const config = loadConfig();
  const utilization = await readAgentUtilization(config);

  const slicesTotal = roadmap.slices.length;
  const slicesCompleted = roadmap.slices.filter((s) => s.status === "completed").length;
  const slicesQueued = roadmap.slices.filter((s) => s.status === "queued" || s.status === "in_progress").length;
  const slicesBlocked = roadmap.slices.filter((s) => s.status === "blocked_deps").length;

  const sliceRemaining = roadmap.slices.filter(
    (s) => s.status !== "completed" && s.status !== "cancelled",
  );
  const estimatedDays = sliceRemaining.reduce(
    (sum, s) => sum + COMPLEXITY_DAYS[s.estimated_complexity],
    0,
  );

  const backlogPct = progress.total_items > 0
    ? Math.round((progress.completed_items / progress.total_items) * 100)
    : 0;
  const slicePct = slicesTotal > 0 ? Math.round((slicesCompleted / slicesTotal) * 100) : backlogPct;
  const roadmap_completion_pct = slicesTotal > 0 ? slicePct : backlogPct;

  const activeEpic = roadmap.epics.find((e) =>
    roadmap.slices.some((s) => s.parent_task === e.epic_id && s.status !== "completed"),
  );
  const activeSlice = roadmap.slices.find((s) => s.status === "queued" || s.status === "in_progress")
    ?? roadmap.slices.find((s) => s.status === "planned" || s.status === "blocked_deps");

  const nextUnlocked = roadmap.slices.filter(
    (s) =>
      (s.status === "planned" || s.status === "blocked_deps")
      && areSliceDependenciesSatisfied(s, roadmap, state),
  );

  const tasksRemaining =
    progress.remaining_items
    + sliceRemaining.length
    + state.task_queue.filter((t) => !["completed", "cancelled"].includes(t.status)).length;

  return {
    roadmap_completion_pct,
    current_milestone: activeEpic?.milestone ?? activeSlice?.milestone ?? "Phase A — Core editor",
    current_feature: activeEpic?.feature ?? activeSlice?.feature ?? "Resume Builder",
    tasks_remaining: tasksRemaining,
    slices_total: slicesTotal,
    slices_completed: slicesCompleted,
    slices_queued: slicesQueued,
    slices_blocked_deps: slicesBlocked,
    estimated_days_to_launch: Math.ceil(estimatedDays * 10) / 10,
    developer_utilization: utilization.developer,
    qa_utilization: utilization.qa,
    epics_decomposed: roadmap.epics.filter((e) => e.decomposed).length,
    launch_criteria_met: countLaunchCriteriaMet(state, roadmap),
    launch_criteria_total: LAUNCH_CRITERIA.length,
    epics: roadmap.epics,
    next_unlocked: nextUnlocked,
  };
}

export async function onTaskCompleted(
  paths: PmPaths,
  state: PmState,
  task: Task,
): Promise<MaintainRoadmapResult> {
  markSliceCompleted(state, task);
  const discovery = await processDiscoveryFromCompletedTask(paths, state, task);
  const result = await maintainRoadmap(paths, state);
  result.discovery_slices = discovery.length;
  return result;
}

/** Read-only clone helper for verification — never persists. */
export function clonePmState(state: PmState): PmState {
  return JSON.parse(JSON.stringify(state)) as PmState;
}
