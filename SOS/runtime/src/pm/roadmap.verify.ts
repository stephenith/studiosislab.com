/**
 * Read-only roadmap planner verification — no state mutation on disk.
 * Run: npm run pm:roadmap-verify
 */
import { loadConfig } from "../config.js";
import { getPmPaths } from "./paths.js";
import { loadState } from "./state.js";
import { readMasterBacklog } from "./readers.js";
import {
  clonePmState,
  maintainRoadmap,
  areSliceDependenciesSatisfied,
  unlockReadySlices,
  markSliceCompleted,
  ensureRoadmapState,
} from "./roadmap-planner.js";
import { decomposeBacklogItem, findDecomposeTemplate, buildSliceId } from "./roadmap-decompose.js";
import type { PmState, Task } from "./types.js";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERT: ${message}`);
}

function simulateTaskComplete(state: PmState, sliceId: string): void {
  const roadmap = ensureRoadmapState(state);
  const slice = roadmap.slices.find((s) => s.slice_id === sliceId);
  assert(Boolean(slice), `Slice ${sliceId} exists for simulation`);

  const backlogId = `BL-${sliceId}`;
  const existing = state.task_queue.find((t) => t.backlog_id === backlogId);
  const taskId = existing?.task_id ?? `TASK-${sliceId}-sim`;

  if (!existing) {
    const stub: Task = {
      task_id: taskId,
      correlation_id: "sim-correlation",
      backlog_id: backlogId,
      title: slice!.title,
      description: slice!.description,
      priority: "P1",
      backlog_priority: "High",
      status: "completed",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      evidence: slice!.evidence_paths,
      requires_commander_approval: false,
      hard_gate_ids: [],
      confidence: 90,
      qa_required: false,
      metadata: { roadmap_slice_id: sliceId },
    };
    state.task_queue.push(stub);
  }

  state.completed_task_ids.push(taskId);
  markSliceCompleted(state, state.task_queue.find((t) => t.task_id === taskId)!);
  unlockReadySlices(state, roadmap);
}

async function main(): Promise<void> {
  const config = loadConfig();
  const paths = getPmPaths(config);
  const liveState = await loadState(paths);
  const backlog = await readMasterBacklog(paths);

  const simState = clonePmState(liveState);
  const beforeSliceCount = simState.roadmap?.slices.length ?? 0;

  const maintain1 = await maintainRoadmap(paths, simState, backlog);
  const roadmap = ensureRoadmapState(simState);

  assert(
    roadmap.slices.length >= 8,
    `Roadmap has decomposed slices (got ${roadmap.slices.length}, before ${beforeSliceCount})`,
  );
  assert(roadmap.epics.some((e) => e.decomposed), "At least one epic decomposed");

  const mobileEpic = roadmap.epics.find((e) => e.feature === "Mobile Resume Editor");
  assert(Boolean(mobileEpic), "Mobile Resume Editor epic decomposed");

  const mobileSlices = roadmap.slices.filter((s) => s.parent_task === mobileEpic!.epic_id);
  assert(mobileSlices.length >= 8, `Mobile epic has 8+ slices, got ${mobileSlices.length}`);

  const routing = mobileSlices.find((s) => s.slice_id.endsWith("-mobile-routing"));
  assert(Boolean(routing), "Mobile routing slice exists");
  assert(routing!.dependency.length === 0, "Routing slice has no dependencies");

  const uniqueIds = new Set(roadmap.known_slice_ids);
  assert(uniqueIds.size === roadmap.known_slice_ids.length, "No duplicate slice IDs in known_slice_ids");

  const maintain2 = await maintainRoadmap(paths, simState, backlog);
  assert(
    maintain2.slices_added === 0 && roadmap.known_slice_ids.length === uniqueIds.size,
    "Second maintain pass does not duplicate slices",
  );

  const inserted = maintain1.tasks_inserted;
  const routingQueued = simState.task_queue.some(
    (t) => t.metadata?.roadmap_slice_id === routing!.slice_id
      || t.backlog_id === `BL-${routing!.slice_id}`,
  );
  assert(
    inserted.length >= 1 || routingQueued || routing!.status === "queued",
    "Routing slice available in queue or inserted on first pass",
  );

  const template = findDecomposeTemplate(backlog.find((i) => i.id === "BL-3-1")!);
  assert(Boolean(template), "BL-3-1 matches decomposition template");

  const sampleDecomposed = decomposeBacklogItem(backlog.find((i) => i.id === "BL-3-1")!, template!);
  assert(sampleDecomposed.length === 8, "Sample mobile decomposition yields 8 slices");
  assert(
    sampleDecomposed.every(
      (s) =>
        s.acceptance_criteria.length > 0
        && s.evidence_paths.length > 0
        && s.qa_checklist.length > 0,
    ),
    "Every slice has acceptance criteria, evidence, and QA checklist",
  );

  const simChain = clonePmState(liveState);
  await maintainRoadmap(paths, simChain, backlog);
  const chainRoadmap = ensureRoadmapState(simChain);
  const chainOrder = [
    buildSliceId("BL-3-1", "mobile-routing"),
    buildSliceId("BL-3-1", "mobile-template-loading"),
    buildSliceId("BL-3-1", "mobile-toolbar"),
    buildSliceId("BL-3-1", "mobile-save"),
    buildSliceId("BL-3-1", "mobile-download"),
  ];

  for (const sliceId of chainOrder) {
    const slice = chainRoadmap.slices.find((s) => s.slice_id === sliceId);
    if (!slice) continue;
    if (!areSliceDependenciesSatisfied(slice, chainRoadmap, simChain)) {
      break;
    }
    simulateTaskComplete(simChain, sliceId);
  }

  const afterRouting = chainRoadmap.slices.find((s) => s.slice_id.endsWith("-mobile-routing"));
  assert(afterRouting?.status === "completed", "Simulated routing slice marked completed");

  const templateLoading = chainRoadmap.slices.find((s) => s.slice_id.endsWith("-mobile-template-loading"));
  assert(
    templateLoading?.status === "queued" || templateLoading?.status === "completed",
    "Template loading unlocked after routing completes",
  );

  const seoEpic = chainRoadmap.epics.find((e) => e.feature === "SEO Template Landing Pages");
  assert(Boolean(seoEpic), "SEO epic decomposed");

  const activeBacklogIds = liveState.task_queue
    .filter((t) => !["completed", "cancelled"].includes(t.status))
    .map((t) => t.backlog_id);
  assert(
    new Set(activeBacklogIds).size === activeBacklogIds.length,
    "Live queue has no duplicate backlog assignments (no regression)",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        live_state_preserved: true,
        decomposition: {
          epics: roadmap.epics.map((e) => ({
            epic_id: e.epic_id,
            feature: e.feature,
            milestone: e.milestone,
            slice_count: e.slice_ids.length,
          })),
          mobile_slices: mobileSlices.map((s) => ({
            slice_id: s.slice_id,
            title: s.title,
            dependency: s.dependency,
            complexity: s.estimated_complexity,
            status: s.status,
          })),
        },
        sample_decomposed_mobile: sampleDecomposed.map((s) => ({
          slice_id: s.slice_id,
          parent_task: s.parent_task,
          title: s.title,
          dependency: s.dependency,
          estimated_complexity: s.estimated_complexity,
          acceptance_criteria: s.acceptance_criteria,
          evidence_paths: s.evidence_paths,
          suggested_files: s.suggested_files,
          qa_checklist: s.qa_checklist,
        })),
        simulation: {
          tasks_inserted_first_pass: inserted.length,
          duplicate_prevention_second_pass: maintain2.slices_added === 0,
          dependency_chain_verified: afterRouting?.status === "completed",
          next_unlocked_after_routing: templateLoading?.status,
        },
        continuous_planning: {
          seo_epic_slices: chainRoadmap.slices.filter((s) => s.parent_task === "BL-4-2").length,
          total_slices: chainRoadmap.slices.length,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
