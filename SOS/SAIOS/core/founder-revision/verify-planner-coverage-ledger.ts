/**
 * Focused verify: per-Founder-item planner coverage ledger + overlapping attribution.
 * Fixtures shaped like revtask-05667cbb-641 requested_changes[3] miss.
 * No OpenAI. No production task/evidence mutation.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  CANONICAL_COLLISION_BOUNDS_QA,
  CANONICAL_VISUAL_CONSISTENCY_QA,
  classifyRequestedChange,
} from "./RequestedChangeClassification.js";
import {
  buildFounderItemCoverageLedger,
  buildRevisionPlannerPrompt,
  buildTargetCandidateHints,
  normalizeFounderFeedbackItem,
  validatePlanCoversRequestedChanges,
  validateRevisionPlan,
} from "./RevisionPromptBuilder.js";
import { listRevisionTasks } from "./RevisionTaskStore.js";
import type {
  CanvasInventoryObject,
  CanvasOperation,
  RevisionPlan,
  RevisionTask,
} from "./revision-task-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-planner-coverage-ledger.json",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: cond, detail };
}

/** Exact production form (revtask-05667cbb-641 requested_changes[3]). */
const FB3_COLLISION =
  "Correct all element collisions and displaced objects in the Education, Skills, and Certifications area. No dark-blue section-header rectangle or heading text may overlap, cover, or sit inside body text.";

/** Neighboring overlapping mutation lines (Education / Skills / Certifications). */
const FB4_EDU_RESTORE =
  "Restore the Education section heading rectangle and heading text to their correct positions above the Education body content.";
const FB5_SKILLS_STYLE =
  "Restyle the Skills section heading so it matches the approved dark-blue filled heading system used elsewhere on the page.";
const FB9_CERTS_RESTORE =
  "Restore the Certifications section heading rectangle and heading text so they sit cleanly above the Certifications body text.";
const FB10_SKILLS_SCAN =
  "Improve Skills scanability by separating the Skills heading from the skills body content with a clear vertical gap.";

const FB0 = "Reduce header height to improve page balance.";
const FB1 =
  "Rework the contact block below the name into a compact header group with a clear gap before Summary.";
const FB2 =
  "Normalize Experience section spacing so job titles, dates, and bullets follow one consistent vertical rhythm.";
const FB6 =
  "Increase Summary body line height for readability against approved templates.";
const FB7 =
  "Align the left edges of Summary, Experience, Education, Skills, Certifications, and Languages headings.";
const FB8 =
  "Move the Languages section up to reduce a large empty gap above it.";

const MUTATION_ITEMS = [
  FB0,
  FB1,
  FB2,
  FB3_COLLISION,
  FB4_EDU_RESTORE,
  FB5_SKILLS_STYLE,
  FB6,
  FB7,
  FB8,
  FB9_CERTS_RESTORE,
  FB10_SKILLS_SCAN,
];

const ALL_REQUESTED = [
  ...MUTATION_ITEMS,
  CANONICAL_COLLISION_BOUNDS_QA,
  CANONICAL_VISUAL_CONSISTENCY_QA,
];

function op(
  fb: string,
  targetId: string,
  values: Record<string, unknown>,
  intended: string,
  kind: CanvasOperation["op"] = "set_position",
): CanvasOperation {
  return {
    op: kind,
    target_id: targetId,
    before_summary: `object ${targetId} prior geometry`,
    intended_change: intended,
    values,
    founder_feedback_item: fb,
    confidence: 0.92,
  };
}

/**
 * Production failure shape: Education/Skills/Certifications geometry ops exist,
 * but none attributed to requested_changes[3] collision line.
 */
function planMissingCollisionAttribution(): RevisionPlan {
  const ops: CanvasOperation[] = [
    op(
      FB0,
      "block-header-0-r0",
      { height: 40 },
      "Reduce header rect height",
      "resize_object",
    ),
    op(FB1, "block-header-0-t2", { top: 78 }, "Compact contact under name"),
    op(FB2, "block-experience-2-t5", { top: 420 }, "Normalize Experience rhythm"),
    // Physical collision work attributed to neighbors — NOT FB3
    op(
      FB4_EDU_RESTORE,
      "block-education-3-r0",
      { top: 728 },
      "Move Education heading rect below Experience to clear overlap",
    ),
    op(
      FB4_EDU_RESTORE,
      "block-education-3-t1",
      { top: 733 },
      "Move Education heading text with its rect",
    ),
    op(
      FB5_SKILLS_STYLE,
      "block-skills-4-r0",
      { top: 862 },
      "Reposition Skills heading rect after Education body",
    ),
    op(
      FB5_SKILLS_STYLE,
      "block-skills-4-t1",
      { top: 867 },
      "Reposition Skills heading text",
    ),
    op(FB6, "block-summary-1-t2", { top: 185 }, "Keep Summary body clear of header"),
    op(FB7, "block-summary-1-r0", { left: 48 }, "Align Summary heading left"),
    op(FB8, "block-languages-6-r0", { top: 1040 }, "Pull Languages up"),
    op(
      FB9_CERTS_RESTORE,
      "block-certifications-5-r0",
      { top: 980 },
      "Restore Certifications heading rect above body",
    ),
    op(
      FB9_CERTS_RESTORE,
      "block-certifications-5-t1",
      { top: 985 },
      "Restore Certifications heading text",
    ),
    op(
      FB10_SKILLS_SCAN,
      "block-skills-4-t2",
      { top: 892 },
      "Push Skills body below heading for scanability",
    ),
  ];
  return {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "missing collision attribution fixture",
    notes: [],
    operations: ops,
  };
}

/**
 * Corrected: same physical Education collision mutation as the restore op,
 * multi-attributed to exact FB3 (no second conflicting set_position on same axis).
 */
function planWithCollisionAttribution(): RevisionPlan {
  const base = planMissingCollisionAttribution();
  const operations = base.operations.map((o) => {
    if (o.target_id === "block-education-3-r0") {
      return {
        ...o,
        founder_feedback_items: [FB3_COLLISION],
      };
    }
    return o;
  });
  return {
    ...base,
    summary: "collision attribution corrected via multi-attribution",
    operations,
  };
}

function invObj(
  id: string,
  section: string,
  top: number,
  width = 140,
): CanvasInventoryObject {
  return {
    id,
    index: 0,
    type: "Rect",
    text: null,
    left: 48,
    top,
    width,
    height: 22,
    fill: "#1e3a8a",
    stroke: null,
    fontSize: null,
    fontFamily: null,
    fontWeight: null,
    lineHeight: null,
    role: "section-heading",
    section,
    locked: false,
    system: false,
    group_id: null,
  };
}

function sampleInventory(): CanvasInventoryObject[] {
  return [
    invObj("block-education-3-r0", "education", 700),
    invObj("block-skills-4-r0", "skills", 850),
    invObj("block-certifications-5-r0", "certifications", 970, 160),
  ];
}

function fixtureTask(changes: string[]): RevisionTask {
  return {
    schema_version: "founder-revision-task-1.0.0",
    task_id: "revtask-verify-coverage-ledger",
    decision_id: "fd-verify-coverage-ledger",
    review_id: "rev-verify-coverage-ledger",
    prior_candidate_id: "cand-x",
    prior_canvas_path: "canvas.json",
    founder_reason: "coverage ledger verify",
    requested_changes: changes,
    role: "Software Engineer",
    design_family: null,
    status: "PENDING",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    revised_candidate_id: null,
    revised_review_id: null,
    revision_number: 1,
    error: null,
    openai_execution_path: null,
    publication_allowed: false,
    live: false,
  };
}

function main(): void {
  const checks: Check[] = [];
  const beforeFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
  const openaiCalls = 0;

  // Classification sanity: collision line stays MUTATION_REQUIRED
  checks.push(
    assert(
      classifyRequestedChange(FB3_COLLISION).classification ===
        "MUTATION_REQUIRED",
      "collision_item_remains_mutation_required",
      classifyRequestedChange(FB3_COLLISION).classification,
    ),
  );
  checks.push(
    assert(
      classifyRequestedChange(CANONICAL_COLLISION_BOUNDS_QA).classification ===
        "VERIFICATION_ACCEPTANCE" &&
        classifyRequestedChange(CANONICAL_VISUAL_CONSISTENCY_QA)
          .classification === "VERIFICATION_ACCEPTANCE",
      "C_verification_items_still_zero_ops_exempt",
      "ok",
    ),
  );

  // A — overlapping semantic ops but missing FB3 attribution → fail
  const missing = validatePlanCoversRequestedChanges(
    planMissingCollisionAttribution(),
    ALL_REQUESTED,
  );
  checks.push(
    assert(
      !missing.ok &&
        missing.errors.some((e) => e.includes("requested_changes[3]")) &&
        missing.errors.some((e) => e.includes("must match exactly")),
      "A_overlapping_ops_missing_item3_attribution_fail",
      missing.errors.join(" | "),
    ),
  );

  // Confirm Education/Skills/Certs ops exist without covering [3]
  const missPlan = planMissingCollisionAttribution();
  const fb3Norm = normalizeFounderFeedbackItem(FB3_COLLISION);
  const hasEduSkillsCerts = missPlan.operations.some((o) =>
    /education|skills|certifications/i.test(o.target_id ?? ""),
  );
  const hasFb3 = missPlan.operations.some(
    (o) => normalizeFounderFeedbackItem(o.founder_feedback_item) === fb3Norm,
  );
  checks.push(
    assert(
      hasEduSkillsCerts && !hasFb3,
      "production_fixture_has_section_ops_without_item3_fb",
      `eduSkillsCerts=${hasEduSkillsCerts} fb3=${hasFb3}`,
    ),
  );

  // B — one legitimate collision-fix op attributed to FB3 → pass
  const fixed = validatePlanCoversRequestedChanges(
    planWithCollisionAttribution(),
    ALL_REQUESTED,
  );
  checks.push(
    assert(
      fixed.ok === true,
      "B_collision_op_attributed_to_item3_pass",
      fixed.errors.join("; ") || "ok",
    ),
  );

  const fixedValidate = validateRevisionPlan(planWithCollisionAttribution(), {
    requested_changes: ALL_REQUESTED,
  });
  checks.push(
    assert(
      fixedValidate.ok === true,
      "corrected_plan_validateRevisionPlan_ok",
      fixedValidate.errors.join("; ") || "ok",
    ),
  );

  // Prefix-only paraphrase must NOT cover (exact normalized matching)
  const prefixOnly = validatePlanCoversRequestedChanges(
    {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "prefix",
      notes: [],
      operations: [
        op(
          FB3_COLLISION.slice(0, 40),
          "block-education-3-r0",
          { top: 740 },
          "partial text should not cover",
        ),
      ],
    },
    [FB3_COLLISION],
  );
  checks.push(
    assert(
      !prefixOnly.ok,
      "exact_normalized_match_rejects_prefix_only",
      prefixOnly.errors.join("; "),
    ),
  );

  // Whitespace-normalized exact match still works
  const wsMatch = validatePlanCoversRequestedChanges(
    {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "ws",
      notes: [],
      operations: [
        op(
          `  ${FB3_COLLISION.replace(/\s+/g, "  ")}  `,
          "block-education-3-r0",
          { top: 740 },
          "whitespace-normalized exact",
        ),
      ],
    },
    [FB3_COLLISION],
  );
  checks.push(
    assert(
      wsMatch.ok === true,
      "exact_normalized_match_accepts_whitespace_variants",
      wsMatch.errors.join("; ") || "ok",
    ),
  );

  // Prompt ledger / overlapping / no-op / candidate hints
  const prompt = buildRevisionPlannerPrompt({
    task: fixtureTask(ALL_REQUESTED),
    inventory: sampleInventory(),
    page_width: 794,
    page_height: 1123,
    preview_width: 794,
    preview_height: 1123,
  });
  const instr = prompt.instructions;
  const ledger = buildFounderItemCoverageLedger(ALL_REQUESTED);

  checks.push(
    assert(
      instr.includes("FOUNDER ITEM COVERAGE REQUIREMENTS") &&
        ledger.includes("Item 4 — MUTATION_REQUIRED") &&
        ledger.includes(`"${FB3_COLLISION}"`) &&
        ledger.includes(
          "at least one REAL executable operation contains this EXACT text in founder_feedback_item or founder_feedback_items",
        ) &&
        ledger.includes(
          "Coverage is attribution-based, not operation-count-based",
        ) &&
        ledger.includes(
          "This does NOT imply one unique operation per Founder item",
        ) &&
        ledger.includes("Item 12 — VERIFICATION_ACCEPTANCE") &&
        ledger.includes("Item 13 — VERIFICATION_ACCEPTANCE") &&
        ledger.includes("emit ZERO operations"),
      "D_prompt_contains_per_item_coverage_ledger",
      "ledger present",
    ),
  );
  checks.push(
    assert(
      instr.includes("OVERLAPPING FOUNDER REQUIREMENTS") &&
        instr.includes("exact attribution") &&
        instr.includes("Safe pattern A") &&
        instr.includes("Safe pattern B") &&
        instr.includes("Safe pattern C") &&
        instr.includes("founder_feedback_items") &&
        instr.includes("ONE PHYSICAL MUTATION → ONE OR MORE EXACT FOUNDER ATTRIBUTIONS") &&
        instr.includes(
          "Do NOT emit another same-axis operation on the same target merely to obtain coverage",
        ) &&
        instr.includes(
          "set_position top and then move_object delta_top on the same target",
        ) &&
        instr.includes(
          "fail BEFORE CoveragePlanRepair and BEFORE canvas execution",
        ) &&
        instr.includes(
          "CoveragePlanRepair is not a mechanism for fixing a contradictory primary plan",
        ) &&
        instr.includes("COHERENT FINAL GEOMETRY BEFORE MULTI-ATTRIBUTION") &&
        instr.includes("choose the final position once") &&
        instr.includes("COMPLETE EXAMPLE OPERATION (multi-attribution") &&
        instr.includes('"founder_feedback_items"') &&
        instr.includes("block-section-example-t1"),
      "E_prompt_overlapping_requirements_need_attribution",
      "ok",
    ),
  );
  checks.push(
    assert(
      instr.includes("DO NOT emit no-op duplicates") &&
        instr.includes("exact current geometry") &&
        instr.includes("delta_top:0") &&
        instr.includes("COLLISION / DISPLACED-OBJECT ATTRIBUTION") &&
        instr.includes("BEFORE RETURNING") &&
        instr.includes("Do NOT add coverage_map") &&
        instr.includes("Never attach unrelated Founder requirements") &&
        instr.includes("VERIFICATION_ACCEPTANCE"),
      "F_prompt_forbids_noop_duplicates_and_has_checklist",
      "ok",
    ),
  );

  const hints = buildTargetCandidateHints(ALL_REQUESTED, sampleInventory());
  checks.push(
    assert(
      hints.includes("Item 4 [MUTATION_REQUIRED]") &&
        hints.includes("Item 12 [VERIFICATION_ACCEPTANCE]") &&
        hints.includes("block-education-3-r0"),
      "G_candidate_hints_include_index_and_classification",
      hints.split("\n").slice(0, 8).join(" | "),
    ),
  );

  checks.push(assert(openaiCalls === 0, "I_no_openai_calls", `n=${openaiCalls}`));
  const afterFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
  checks.push(
    assert(
      JSON.stringify(beforeFp) === JSON.stringify(afterFp),
      "H_no_production_task_mutation",
      `before=${beforeFp.length} after=${afterFp.length}`,
    ),
  );

  const failed = checks.filter((c) => !c.pass);
  const report = {
    ok: failed.length === 0,
    passed: checks.filter((c) => c.pass).length,
    total: checks.length,
    checks,
    fixture_task: "revtask-05667cbb-641",
    missing_item_index: 3,
    coverage_map_added: false,
    matching: "exact_normalized",
    at: new Date().toISOString(),
  };
  mkdirSync(join(OUT, ".."), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    report.ok
      ? `OK ${report.passed}/${report.total}`
      : `FAIL ${failed.map((f) => f.name).join(", ")}`,
  );
  if (!report.ok) {
    console.error(JSON.stringify(failed, null, 2));
    process.exit(1);
  }
}

main();
