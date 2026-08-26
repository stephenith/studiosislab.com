/**
 * Read-only scoring verification — no PM/Developer state mutation.
 * Run: npm run pm:score-verify
 */
import { loadConfig } from "../config.js";
import { getPmPaths } from "./paths.js";
import { loadState } from "./state.js";
import { readMasterBacklog, filterActionableBacklogItems } from "./readers.js";
import { assessLaunchReadiness } from "./founder-priority.js";
import {
  classifyTier,
  scoreBacklogItem,
  scoreTechnicalBacklogItem,
  buildSelectionReport,
  selectHighestPriorityTask,
  selectHighestTechnicalTask,
  hasActivePipelineTask,
} from "./scoring.js";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERT: ${message}`);
}

async function main(): Promise<void> {
  const config = loadConfig();
  const paths = getPmPaths(config);
  const state = await loadState(paths);
  const allItems = await readMasterBacklog(paths);
  const actionable = filterActionableBacklogItems(allItems, state);
  const readiness = assessLaunchReadiness(state, allItems);

  const oldSelected = selectHighestTechnicalTask(actionable);
  const report = buildSelectionReport(actionable, allItems, state, readiness);
  const { item: newSelected } = selectHighestPriorityTask(actionable, allItems, state, readiness);

  const constitution = allItems.find((i) => i.id === "BL-4-4");
  const readme = allItems.find((i) => i.id === "BL-4-5");
  const seo = allItems.find((i) => i.id === "BL-4-2");

  assert(Boolean(constitution), "BL-4-4 constitution exists in backlog");
  assert(Boolean(readme), "BL-4-5 README exists in backlog");
  assert(Boolean(seo), "BL-4-2 SEO exists in backlog");

  assert(classifyTier(constitution!) === 5, "Constitution is Tier 5");
  assert(classifyTier(readme!) === 5, "README is Tier 5");
  assert(classifyTier(seo!) === 1, "SEO templates is Tier 1");

  assert(newSelected !== null, "A next task is selectable with founder engine");
  assert(newSelected!.id !== "BL-4-4", "Constitution must not be selected while product work exists");
  assert(newSelected!.id !== "BL-4-5", "README must not be selected while product work exists");
  assert(
    classifyTier(newSelected!) <= 4,
    `Selected task must be Tier 1–4, got T${classifyTier(newSelected!)}`,
  );

  const skippedConstitution = report.skipped.find((s) => s.backlog_id === "BL-4-4");
  const skippedReadme = report.skipped.find((s) => s.backlog_id === "BL-4-5");
  if (actionable.some((i) => i.id === "BL-4-4")) {
    assert(Boolean(skippedConstitution), "Constitution appears in skipped list when actionable");
  }
  if (actionable.some((i) => i.id === "BL-4-5")) {
    assert(Boolean(skippedReadme), "README appears in skipped list when actionable");
    assert(
      skippedReadme!.why_skipped.includes("documentation") || skippedReadme!.why_skipped.includes("Refused"),
      "README skip reason cites documentation deferral or refusal",
    );
  }

  const scored = actionable.map((item) => scoreBacklogItem(item, readiness));
  const docScores = scored.filter((s) => s.founder_category === "documentation").map((s) => s.combined_score);
  const productScores = scored
    .filter((s) => s.founder_category !== "documentation" && s.founder_category !== "deferred")
    .map((s) => s.combined_score);
  if (productScores.length > 0 && docScores.length > 0) {
    assert(
      Math.max(...productScores) > Math.max(...docScores),
      "Product tasks outscore documentation tasks (combined)",
    );
  }

  const activeBacklogIds = state.task_queue
    .filter((t) => !["completed", "cancelled", "blocked"].includes(t.status))
    .map((t) => t.backlog_id);
  assert(
    new Set(activeBacklogIds).size === activeBacklogIds.length,
    "No duplicate backlog assignments in active queue",
  );

  assert(
    report.selected_reason?.includes("highest launch-value") ?? false,
    "Selection reason cites highest launch-value task",
  );

  const oldTechnical = oldSelected
    ? scoreTechnicalBacklogItem(oldSelected).technical_score
    : null;
  const newFounder = report.selected?.founder_score ?? null;
  const newTechnical = report.selected?.technical_score ?? null;
  const newCombined = report.selected?.combined_score ?? null;

  console.log(
    JSON.stringify(
      {
        ok: true,
        pipeline_busy: hasActivePipelineTask(state),
        active_task_id: state.current_task_id,
        launch_stage: readiness.launch_stage,
        launch_blockers_open: readiness.launch_blockers_open,
        old_selection: oldSelected
          ? {
              backlog_id: oldSelected.id,
              title: oldSelected.title,
              tier: classifyTier(oldSelected),
              technical_score: oldTechnical,
            }
          : null,
        new_selection: newSelected
          ? {
              backlog_id: newSelected.id,
              title: newSelected.title,
              tier: classifyTier(newSelected),
              founder_score: newFounder,
              technical_score: newTechnical,
              combined_score: newCombined,
              founder_category: report.selected?.founder_category,
              reason: report.selected_reason,
            }
          : null,
        selection_changed: oldSelected?.id !== newSelected?.id,
        example_ranking: report.ranking,
        combined_scores_sample: scored
          .sort((a, b) => b.combined_score - a.combined_score)
          .slice(0, 8)
          .map((s) => ({
            backlog_id: s.item.id,
            title: s.item.title,
            founder_category: s.founder_category,
            founder_score: s.founder_score,
            technical_score: s.technical_score,
            combined_score: s.combined_score,
            refused_while_blockers: s.refused_while_blockers,
          })),
        skipped_documentation: report.skipped
          .filter((s) => s.founder_category === "documentation" || s.tier === 5)
          .slice(0, 5)
          .map((s) => ({
            backlog_id: s.backlog_id,
            title: s.title,
            combined_score: s.combined_score,
            why_skipped: s.why_skipped,
          })),
        remaining_by_tier: report.remaining_by_tier,
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
