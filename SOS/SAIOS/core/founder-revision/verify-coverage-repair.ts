/**
 * Focused verify: one-shot coverage repair for missing MUTATION_REQUIRED items.
 * Production-shaped fixture from revtask-05667cbb-641 item[3] omission.
 * No OpenAI. No production task/evidence mutation.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ReasoningRequest } from "../ai-brain/ReasoningRequest.js";
import {
  detectRepairMergeConflicts,
  detectRepairPrimaryAxisOccupiedConflicts,
  mergePrimaryAndRepairPlans,
} from "./CoveragePlanRepair.js";
import {
  planFounderCanvasRevision,
  REVISION_COVERAGE_REPAIR_MAX_OUTPUT_TOKENS,
} from "./RevisionPlanner.js";
import {
  buildRevisionCoverageRepairPrompt,
  buildRevisionPlannerPrompt,
  findUncoveredRequestedChanges,
  opTouchesRepairRelevantPrimaryTopics,
  validatePlanCoversRequestedChanges,
  validateRevisionPlan,
  validateRevisionPlanShapeAndOperations,
} from "./RevisionPromptBuilder.js";
import {
  CANONICAL_COLLISION_BOUNDS_QA,
  CANONICAL_CONTENT_PRESERVATION,
  CANONICAL_VISUAL_CONSISTENCY_QA,
  classifyRequestedChange,
} from "./RequestedChangeClassification.js";
import { REVISION_COVERAGE_REPAIR_JSON_SCHEMA } from "../providers/openai/OpenAIResponseFactory.js";
import { textFormatForRequest } from "../providers/openai/OpenAIResponseFactory.js";
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
  "SOS/07_LOGS/saios/founder-revision/verify-coverage-repair.json",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: cond, detail };
}

/** Exact production form (revtask-05667cbb-641 requested_changes[3]). */
const FB3 =
  "Correct all element collisions and displaced objects in the Education, Skills, and Certifications area. No dark-blue section-header rectangle or heading text may overlap, cover, or sit inside body text.";

const PRODUCTION_REQUESTED: string[] = [
  'Vertically center "Elena Voss" inside the light-blue header rectangle so the visible top and bottom padding are equal, while keeping the name horizontally aligned with the resume content.',
  'Rework the contact block below the name so "Senior Software Engineer", the contact details, and "Austin, TX" form a clean compact header group, then add a clear and consistent vertical gap before the Summary section begins.',
  "Standardize the vertical spacing system throughout the resume: keep consistent spacing from each section heading to its body content and consistent spacing between the end of one section and the beginning of the next section.",
  FB3,
  "Restore the Skills and Certifications section headings to their correct positions directly above their own content. Keep the Education entries fully visible and unobstructed.",
  "Make every dark-blue section heading — SUMMARY, EXPERIENCE, EDUCATION, SKILLS, CERTIFICATIONS, and LANGUAGES — use the same rectangle height, width system, fill color, text color, font family, font weight, font size, internal padding, and vertical text centering.",
  "Align all section heading rectangles to the same left edge and keep the body content beneath them aligned to a consistent content grid.",
  "Normalize the spacing inside the Experience section so job titles, employment dates, bullet groups, and the transitions between different employers follow one consistent vertical rhythm without unusually large or compressed gaps.",
  "Keep the expanded Education content, but align all education entries consistently and use even line spacing between the bachelor's, higher-secondary, and secondary-school entries.",
  "Improve the Skills section for scanability while preserving the current skill content. Keep category labels and their skills consistently aligned and spaced, with no text touching or being covered by section-header shapes.",
  "Check the Certifications section after repositioning its heading and ensure both certification bullets sit beneath the heading with consistent indentation and vertical spacing.",
  CANONICAL_COLLISION_BOUNDS_QA,
  CANONICAL_VISUAL_CONSISTENCY_QA,
];

const FB_GROUPING =
  "Keep each section's heading, blue accent marker, and associated content visually grouped as one unit with consistent internal spacing.";

const REV3_VERIFICATION_ITEMS = [
  "Preserve the improved Summary → Experience spacing and the current Experience layout; do not undo the spacing corrections that are already visually satisfactory.",
  "Preserve the current dark header, two-column architecture, typography hierarchy, colors, sidebar background, and overall visual identity; fix the layout defects without redesigning the template.",
  "After all reflow and repositioning, verify the complete final canvas for zero text-to-text overlap, zero heading-to-content collision, zero section intrusion, zero clipping, and zero out-of-bounds content.",
  "Keep the entire resume on one page and do not remove, shorten, invent, or alter factual resume content merely to make the layout fit.",
] as const;

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
    before_summary: `object ${targetId} prior geometry from inventory`,
    intended_change: intended,
    values,
    founder_feedback_item: fb,
    confidence: 0.93,
  };
}

/** Primary plan covering all mutation items except [3]. */
function primaryMissingItem3(): RevisionPlan {
  const r = PRODUCTION_REQUESTED;
  return {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "primary missing item 3",
    notes: [],
    operations: [
      op(r[0]!, "block-header-0-t1", { top: 54 }, "Center name vertically"),
      op(r[1]!, "block-header-0-t2", { top: 78 }, "Compact contact group"),
      op(r[2]!, "block-summary-1-r0", { top: 160 }, "Standardize section spacing start"),
      // Collision work attributed to neighbors — NOT item[3]
      op(
        r[4]!,
        "block-skills-4-r0",
        { top: 862 },
        "Restore Skills heading rect above skills body",
      ),
      op(
        r[4]!,
        "block-certifications-5-r0",
        { top: 980 },
        "Restore Certifications heading rect above certs body",
      ),
      op(
        r[5]!,
        "block-education-3-r0",
        { top: 728 },
        "Normalize Education heading rect height/placement in heading system",
      ),
      // Single left-axis mutation for r[6] (align_objects); no separate set_position left.
      {
        op: "align_objects" as const,
        target_ids: [
          "block-summary-1-r0",
          "block-experience-2-r0",
          "block-education-3-r0",
          "block-skills-4-r0",
          "block-certifications-5-r0",
          "block-languages-6-r0",
        ],
        before_summary: "section heading rects at mixed lefts",
        intended_change: "Align section heading rectangles to left=48",
        values: { align_left: 48 },
        founder_feedback_item: r[6]!,
        confidence: 0.9,
      },
      op(r[7]!, "block-experience-2-t5", { top: 420 }, "Normalize Experience rhythm"),
      op(r[8]!, "block-education-3-t2", { top: 760 }, "Align Education entries"),
      op(r[9]!, "block-skills-4-t2", { top: 892 }, "Improve Skills scanability gap"),
      op(
        r[10]!,
        "block-certifications-5-t2",
        { top: 1005 },
        "Place first certification bullet under heading",
      ),
    ],
  };
}

/** Legitimate repair op — different target/values than primary (no conflict). */
function repairOpForItem3(): CanvasOperation {
  return op(
    FB3,
    "block-skills-4-t1",
    { top: 867 },
    "Reposition Skills heading text to remove collision with body content",
  );
}

function asProviderPlan(plan: RevisionPlan): Record<string, unknown> {
  return { ...plan };
}

function fixtureTask(changes = PRODUCTION_REQUESTED): RevisionTask {
  return {
    schema_version: "founder-revision-task-1.0.0",
    task_id: "revtask-verify-coverage-repair",
    decision_id: "fd-verify-coverage-repair",
    review_id: "rev-verify-coverage-repair",
    prior_candidate_id: "cand-x",
    prior_canvas_path: "canvas.json",
    founder_reason: "coverage repair verify",
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

function inventory(): CanvasInventoryObject[] {
  const mk = (
    id: string,
    section: string,
    top: number,
  ): CanvasInventoryObject => ({
    id,
    index: 0,
    type: "Rect",
    text: null,
    left: 48,
    top,
    width: 140,
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
  });
  return [
    mk("block-education-3-r0", "education", 700),
    mk("block-skills-4-r0", "skills", 850),
    mk("block-skills-4-t1", "skills", 855),
    mk("block-certifications-5-r0", "certifications", 970),
  ];
}

function makeExecute(sequence: Array<Record<string, unknown> | "fail">) {
  let calls = 0;
  const requests: ReasoningRequest[] = [];
  const execute = async (req: ReasoningRequest) => {
    calls += 1;
    requests.push(req);
    const next = sequence[calls - 1];
    if (next === undefined) {
      throw new Error(`unexpected planner call #${calls}`);
    }
    if (next === "fail") {
      return {
        status: "FAILED",
        structured_output: null,
        error_details: { message: "injected provider failure" },
      };
    }
    return {
      status: "COMPLETED",
      structured_output: next,
      provider_request_id: `req-test-${calls}`,
      model_identifier_internal: "test-model",
      input_tokens: 100,
      output_tokens: 50,
    };
  };
  return { execute, getCalls: () => calls, getRequests: () => requests };
}

async function main(): Promise<void> {
  const checks: Check[] = [];
  const beforeFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
  const openaiCalls = 0;
  const task = fixtureTask();
  const inv = inventory();

  const primary = primaryMissingItem3();
  const shapeOk = validateRevisionPlanShapeAndOperations(primary);
  const uncovered = findUncoveredRequestedChanges(
    primary,
    PRODUCTION_REQUESTED,
  );
  checks.push(
    assert(
      shapeOk.ok === true &&
        uncovered.length === 1 &&
        uncovered[0]?.index === 3,
      "completeness_only_detects_item3",
      JSON.stringify(uncovered),
    ),
  );

  // A — structural invalid + missing coverage → no repair
  const badPrimary = {
    ...primary,
    operations: [
      ...primary.operations,
      {
        op: "not_a_real_op",
        target_id: "x",
        before_summary: "x",
        intended_change: "x",
        values: { top: 1 },
        founder_feedback_item: FB3,
        confidence: 0.9,
      },
    ],
  };
  const a = makeExecute([asProviderPlan(badPrimary as never)]);
  const aResult = await planFounderCanvasRevision({
    task,
    inventory: inv,
    page_width: 794,
    page_height: 1123,
    execute: a.execute,
  });
  checks.push(
    assert(
      aResult.ok === false &&
        aResult.status === "FAILED_PLAN" &&
        a.getCalls() === 1 &&
        !aResult.coverage_repair?.summary.attempted,
      "A_no_repair_on_non_completeness_error",
      `calls=${a.getCalls()} err=${aResult.ok ? "" : aResult.error}`,
    ),
  );

  // B / G — repair called once; merge passes
  const repairPlan: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "repair item 3",
    notes: [],
    operations: [repairOpForItem3()],
  };
  const b = makeExecute([asProviderPlan(primary), asProviderPlan(repairPlan)]);
  const bResult = await planFounderCanvasRevision({
    task,
    inventory: inv,
    page_width: 794,
    page_height: 1123,
    execute: b.execute,
  });
  checks.push(
    assert(
      b.getCalls() === 2 &&
        b.getRequests()[1]?.maximum_output_tokens ===
          REVISION_COVERAGE_REPAIR_MAX_OUTPUT_TOKENS,
      "B_repair_called_exactly_once",
      `calls=${b.getCalls()} tokens=${b.getRequests()[1]?.maximum_output_tokens}`,
    ),
  );
  checks.push(
    assert(
      bResult.ok === true &&
        bResult.coverage_repair?.summary.merged_validation_pass === true &&
        bResult.coverage_repair.summary.missing_before[0]?.index === 3 &&
        bResult.coverage_repair.summary.repair_operation_count === 1 &&
        bResult.plan.operations.length === primary.operations.length + 1,
      "G_repair_covers_missing_item_merged_pass",
      bResult.ok
        ? `ops=${bResult.plan.operations.length}`
        : bResult.error,
    ),
  );

  // C — repair malformed
  const c = makeExecute([
    asProviderPlan(primary),
    {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "bad",
      operations: [
        {
          op: "set_position",
          target_id: "block-skills-4-t1",
          values: { top: 867 },
          founder_feedback_item: FB3,
          confidence: 0.9,
          // missing intended_change / before_summary
        },
      ],
    },
  ]);
  const cResult = await planFounderCanvasRevision({
    task,
    inventory: inv,
    page_width: 794,
    page_height: 1123,
    execute: c.execute,
  });
  checks.push(
    assert(
      cResult.ok === false &&
        cResult.status === "FAILED_PLAN" &&
        c.getCalls() === 2 &&
        (cResult.error ?? "").includes("coverage repair failed"),
      "C_repair_malformed_fails",
      cResult.ok ? "ok" : cResult.error,
    ),
  );

  // D — empty repair
  const d = makeExecute([
    asProviderPlan(primary),
    {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "empty",
      operations: [],
      notes: [],
    },
  ]);
  const dResult = await planFounderCanvasRevision({
    task,
    inventory: inv,
    page_width: 794,
    page_height: 1123,
    execute: d.execute,
  });
  checks.push(
    assert(
      dResult.ok === false &&
        ((dResult.error ?? "").includes("operations must be a non-empty array") ||
          (dResult.error ?? "").includes("coverage repair failed")) &&
        dResult.coverage_repair?.summary.failure_kind === "repair_plan_invalid",
      "D_empty_repair_fails_shape_nonempty_required",
      dResult.ok ? "ok" : `${dResult.error} kind=${dResult.coverage_repair?.summary.failure_kind}`,
    ),
  );

  // E — duplicate identical primary mutation
  const dup = primary.operations.find((o) => o.target_id === "block-skills-4-r0")!;
  const eConflict = detectRepairMergeConflicts(primary.operations, [
    { ...dup, founder_feedback_item: FB3 },
  ]);
  checks.push(
    assert(
      !eConflict.ok &&
        eConflict.errors.some((e) => e.includes("exact duplicate")),
      "E_duplicate_identical_mutation_rejected",
      eConflict.errors.join("; "),
    ),
  );
  const e = makeExecute([
    asProviderPlan(primary),
    {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "dup",
      operations: [{ ...dup, founder_feedback_item: FB3 }],
    },
  ]);
  const eResult = await planFounderCanvasRevision({
    task,
    inventory: inv,
    page_width: 794,
    page_height: 1123,
    execute: e.execute,
  });
  checks.push(
    assert(
      eResult.ok === false &&
        ((eResult.error ?? "").includes("coverage repair merge conflict") ||
          (eResult.error ?? "").includes("COVERAGE_REPAIR_PRIMARY_AXIS_CONFLICT")),
      "E_planner_rejects_duplicate_repair",
      eResult.ok ? "ok" : eResult.error,
    ),
  );

  // F — contradictory absolute set_position same target
  const fConflict = detectRepairMergeConflicts(primary.operations, [
    op(FB3, "block-skills-4-r0", { top: 828 }, "Conflicting top"),
  ]);
  checks.push(
    assert(
      !fConflict.ok && fConflict.errors.some((e) => e.includes("conflicts")),
      "F_contradictory_absolute_position_rejected",
      fConflict.errors.join("; "),
    ),
  );

  // H — two missing items, one repair call covers both
  const twoMissing: RevisionPlan = {
    ...primary,
    operations: primary.operations.filter(
      (o) => o.founder_feedback_item !== PRODUCTION_REQUESTED[9],
    ),
  };
  const twoUncovered = findUncoveredRequestedChanges(
    twoMissing,
    PRODUCTION_REQUESTED,
  );
  const dualRepair: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "repair 3 and 9",
    notes: [],
    operations: [
      repairOpForItem3(),
      op(
        PRODUCTION_REQUESTED[9]!,
        "block-skills-4-t3",
        { top: 910 },
        "Separate skills category label from header shape",
      ),
    ],
  };
  const h = makeExecute([asProviderPlan(twoMissing), asProviderPlan(dualRepair)]);
  const hResult = await planFounderCanvasRevision({
    task,
    inventory: inv,
    page_width: 794,
    page_height: 1123,
    execute: h.execute,
  });
  checks.push(
    assert(
      twoUncovered.map((u) => u.index).sort().join(",") === "3,9" &&
        h.getCalls() === 2 &&
        hResult.ok === true &&
        findUncoveredRequestedChanges(
          hResult.ok ? hResult.plan : primary,
          PRODUCTION_REQUESTED,
        ).length === 0,
      "H_two_missing_items_one_repair_call",
      `uncovered=${JSON.stringify(twoUncovered.map((u) => u.index))} calls=${h.getCalls()} ok=${hResult.ok}`,
    ),
  );

  // I — verification excluded from repair missing set
  checks.push(
    assert(
      !uncovered.some((u) => u.index === 11 || u.index === 12) &&
        validatePlanCoversRequestedChanges(primary, PRODUCTION_REQUESTED)
          .errors.every((e) => !e.includes("requested_changes[11]")),
      "I_verification_items_excluded",
      JSON.stringify(uncovered.map((u) => u.index)),
    ),
  );

  // J — no third call even if somehow still incomplete (empty repair already 2 calls)
  checks.push(
    assert(
      d.getCalls() === 2 && b.getCalls() === 2 && h.getCalls() === 2,
      "J_no_third_planner_call",
      `d=${d.getCalls()} b=${b.getCalls()} h=${h.getCalls()}`,
    ),
  );

  // Evidence metadata populated on success
  checks.push(
    assert(
      bResult.ok === true &&
        bResult.coverage_repair != null &&
        bResult.coverage_repair.summary.attempted === true &&
        bResult.coverage_repair.repair_prompt != null &&
        bResult.coverage_repair.primary_plan != null &&
        bResult.coverage_repair.repair_plan != null &&
        bResult.coverage_repair.provider_request_id != null,
      "evidence_metadata_populated",
      bResult.ok ? "ok" : "missing",
    ),
  );

  // Prompt contract
  const repairPrompt = buildRevisionCoverageRepairPrompt({
    task,
    inventory: inv,
    page_width: 794,
    page_height: 1123,
    missing: uncovered,
    primaryOperations: primary.operations,
  });
  checks.push(
    assert(
      repairPrompt.instructions.includes(
        "repairing ONLY missing Founder-item attribution",
      ) &&
        repairPrompt.instructions.includes("MISSING MUTATION ITEMS") &&
        repairPrompt.instructions.includes(FB3) &&
        repairPrompt.instructions.includes("Do not rewrite or relabel") &&
        repairPrompt.instructions.includes("BEFORE any execution") &&
        repairPrompt.instructions.includes(
          "MANDATORY FIELDS FOR EVERY REPAIR OPERATION",
        ) &&
        repairPrompt.instructions.includes("PRIMARY OCCUPIED GEOMETRY") &&
        repairPrompt.instructions.includes("FROZEN for repair purposes") &&
        !repairPrompt.instructions.includes(
          "return operations: [] (merged plan will fail closed)",
        ) &&
        repairPrompt.instructions.includes("HORIZONTAL ALIGNMENT COHORTS") &&
        repairPrompt.instructions.includes(
          "one-element target_ids array is invalid",
        ) &&
        repairPrompt.instructions.includes(
          "HEADING-MARKER VISUAL REFERENCE (coverage repair",
        ) &&
        repairPrompt.instructions.includes("OPERATION CAPABILITY GRAMMAR") &&
        repairPrompt.instructions.includes("POSITION-ONLY") &&
        repairPrompt.instructions.includes(
          "never attach width/height to set_position or move_object",
        ) &&
        !repairPrompt.instructions.includes("width/height on body text"),
      "repair_prompt_narrow_contract",
      "ok",
    ),
  );

  // M/N — mandatory fields + complete JSON example
  checks.push(
    assert(
      repairPrompt.instructions.includes("founder_feedback_item (REQUIRED") &&
        repairPrompt.instructions.includes("confidence (required number") &&
        repairPrompt.instructions.includes('"founder_feedback_item"') &&
        repairPrompt.instructions.includes('"confidence"') &&
        repairPrompt.instructions.includes('"before_summary"') &&
        repairPrompt.instructions.includes('"intended_change"') &&
        repairPrompt.instructions.includes('"values"'),
      "M_N_prompt_mandatory_fields_and_complete_example",
      "ok",
    ),
  );

  // O — missing founder_feedback_item → FAILED_PLAN
  const oRepair = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "missing ffi",
    operations: [
      {
        op: "set_position",
        target_id: "block-education-3-t2",
        before_summary: "prior",
        intended_change: "move",
        values: { top: 760 },
        confidence: 0.9,
      },
    ],
  };
  const oExec = makeExecute([asProviderPlan(primary), oRepair]);
  const oResult = await planFounderCanvasRevision({
    task,
    inventory: inv,
    page_width: 794,
    page_height: 1123,
    execute: oExec.execute,
  });
  checks.push(
    assert(
      oResult.ok === false &&
        (oResult.error ?? "").includes("founder_feedback_item required") &&
        oResult.status === "FAILED_PLAN",
      "O_missing_founder_feedback_item_fails",
      oResult.ok ? "ok" : oResult.error,
    ),
  );

  // P — missing confidence → FAILED_PLAN
  const pRepair = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "missing confidence",
    operations: [
      {
        op: "set_position",
        target_id: "block-education-3-t2",
        before_summary: "prior",
        intended_change: "move",
        values: { top: 760 },
        founder_feedback_item: FB3,
      },
    ],
  };
  const pExec = makeExecute([asProviderPlan(primary), pRepair]);
  const pResult = await planFounderCanvasRevision({
    task,
    inventory: inv,
    page_width: 794,
    page_height: 1123,
    execute: pExec.execute,
  });
  checks.push(
    assert(
      pResult.ok === false &&
        ((pResult.error ?? "").includes("confidence required") ||
          (pResult.error ?? "").includes("confidence must be")) &&
        pResult.status === "FAILED_PLAN",
      "P_missing_confidence_fails",
      pResult.ok ? "ok" : pResult.error,
    ),
  );

  // Q — optional founder_feedback_items survives
  const qRepair: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "multi",
    notes: [],
    operations: [
      {
        ...repairOpForItem3(),
        founder_feedback_items: [PRODUCTION_REQUESTED[9]!],
      },
    ],
  };
  const qPrimary: RevisionPlan = {
    ...primary,
    operations: primary.operations.filter(
      (o) => o.founder_feedback_item !== PRODUCTION_REQUESTED[9],
    ),
  };
  const qExec = makeExecute([asProviderPlan(qPrimary), asProviderPlan(qRepair)]);
  const qResult = await planFounderCanvasRevision({
    task,
    inventory: inv,
    page_width: 794,
    page_height: 1123,
    execute: qExec.execute,
  });
  checks.push(
    assert(
      qResult.ok === true &&
        qResult.plan.operations.some(
          (o) =>
            Array.isArray(o.founder_feedback_items) &&
            o.founder_feedback_items.includes(PRODUCTION_REQUESTED[9]!),
        ),
      "Q_optional_founder_feedback_items_survives",
      qResult.ok ? "ok" : qResult.error,
    ),
  );

  // R — unknown attribution fails
  const rRepair = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "unknown attr",
    operations: [
      {
        ...repairOpForItem3(),
        founder_feedback_item: "Not a real Founder requested change line.",
      },
    ],
  };
  const rShape = validateRevisionPlanShapeAndOperations(rRepair, {
    requested_changes: PRODUCTION_REQUESTED,
  });
  checks.push(
    assert(
      rShape.ok === false &&
        rShape.errors.some(
          (e) =>
            e.includes("does not match any requested_changes") ||
            e.includes("not an exact requested_changes match"),
        ),
      "R_unknown_attribution_fails",
      rShape.errors.join("; "),
    ),
  );

  // S — VERIFICATION_ACCEPTANCE attribution fails
  const sShape = validateRevisionPlanShapeAndOperations(
    {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "verif attr",
      operations: [
        {
          ...repairOpForItem3(),
          founder_feedback_item: CANONICAL_COLLISION_BOUNDS_QA,
        },
      ],
    },
    { requested_changes: PRODUCTION_REQUESTED },
  );
  checks.push(
    assert(
      sShape.ok === false &&
        sShape.errors.some((e) =>
          e.includes("must not claim VERIFICATION_ACCEPTANCE"),
        ),
      "S_verification_attribution_fails",
      sShape.errors.join("; "),
    ),
  );

  // T — truthful-preservation not in missing_before
  const withTruth = [...PRODUCTION_REQUESTED, CANONICAL_CONTENT_PRESERVATION];
  const uncoveredTruth = findUncoveredRequestedChanges(primary, withTruth);
  checks.push(
    assert(
      classifyRequestedChange(CANONICAL_CONTENT_PRESERVATION).classification ===
        "VERIFICATION_ACCEPTANCE" &&
        !uncoveredTruth.some((u) => u.text === CANONICAL_CONTENT_PRESERVATION),
      "T_truthful_preservation_not_in_missing_before",
      JSON.stringify(uncoveredTruth.map((u) => u.index)),
    ),
  );

  // U — visual-balance still can appear in missing_before
  const balance =
    "Improve the overall visual balance between the left and right columns so the page feels intentionally composed rather than heavily populated on the right and visually empty on the lower left.";
  const withBalance = [...PRODUCTION_REQUESTED, balance];
  const uncoveredBal = findUncoveredRequestedChanges(primary, withBalance);
  checks.push(
    assert(
      classifyRequestedChange(balance).classification === "MUTATION_REQUIRED" &&
        uncoveredBal.some((u) => u.text === balance),
      "U_visual_balance_can_appear_in_missing_before",
      JSON.stringify(uncoveredBal.map((u) => u.text.slice(0, 40))),
    ),
  );

  // V — repair conflicts with primary same target+axis
  checks.push(
    assert(
      !fConflict.ok,
      "V_repair_primary_same_axis_conflict_fail_closed",
      fConflict.errors.join("; "),
    ),
  );

  // W — prompt warns against occupied target+axis
  checks.push(
    assert(
      repairPrompt.instructions.includes("PRIMARY OCCUPIED GEOMETRY") &&
        repairPrompt.instructions.includes("binding constraint") &&
        repairPrompt.instructions.includes("INVALID repair example") &&
        repairPrompt.instructions.includes("::"),
      "W_prompt_warns_occupied_target_axis",
      "ok",
    ),
  );

  // SU-A — primary planner section-unit coherence contract
  const suPrompt = buildRevisionPlannerPrompt({
    task: {
      ...task,
      requested_changes: [FB_GROUPING, PRODUCTION_REQUESTED[0]!],
    },
    inventory: inv,
    page_width: 794,
    page_height: 1123,
    preview_width: 794,
    preview_height: 1123,
  });
  checks.push(
    assert(
      suPrompt.instructions.includes("SECTION UNIT COHERENCE") &&
        suPrompt.instructions.includes("FORBID a marker-only vertical move") &&
        suPrompt.instructions.includes("content remains below its heading") &&
        suPrompt.instructions.includes("SECTION UNIT SELF-CONSISTENCY") &&
        suPrompt.instructions.includes("HORIZONTAL ALIGNMENT COHORTS") &&
        suPrompt.instructions.includes(
          "It does NOT mean assign marker and heading the same align_left",
        ),
      "SU_A_section_unit_coherence_in_primary_prompt",
      "ok",
    ),
  );
  checks.push(
    assert(
      suPrompt.instructions.includes(
        "content-bottom >= next-section heading/marker top",
      ) &&
        suPrompt.instructions.includes("VERTICAL SECTION STACK") &&
        suPrompt.instructions.includes("Education body-only") &&
        suPrompt.instructions.includes(
          "Keep each section's heading, blue accent marker, and associated content visually grouped as one unit with consistent internal spacing.",
        ),
      "SU_K_section_stack_and_item10_semantic_prompt",
      "ok",
    ),
  );

  // SU-B — legitimate multi-attribution satisfies grouping item
  const spacingLine = PRODUCTION_REQUESTED[2]!;
  const multiAttrPlan: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "multi",
    notes: [],
    operations: [
      {
        op: "set_position",
        target_id: "block-skills-4-r0",
        before_summary: "marker",
        intended_change: "Move skills section marker with heading band as one unit",
        values: { top: 160 },
        founder_feedback_item: spacingLine,
        founder_feedback_items: [FB_GROUPING],
        confidence: 0.92,
      },
    ],
  };
  checks.push(
    assert(
      findUncoveredRequestedChanges(multiAttrPlan, [spacingLine, FB_GROUPING])
        .length === 0,
      "SU_B_multi_attribution_covers_grouping",
      "missing",
    ),
  );

  // SU-C — unrelated attribution does not satisfy grouping
  const fakeGroupPlan: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "fake",
    notes: [],
    operations: [
      op(
        PRODUCTION_REQUESTED[0]!,
        "block-header-0-t1",
        { top: 50 },
        "Header move unrelated to sidebar grouping",
      ),
    ],
  };
  checks.push(
    assert(
      findUncoveredRequestedChanges(fakeGroupPlan, [
        PRODUCTION_REQUESTED[0]!,
        FB_GROUPING,
      ]).some((u) => u.text === FB_GROUPING),
      "SU_C_unrelated_op_does_not_cover_grouping",
      "ok",
    ),
  );

  // SU-D — primary occupied top axis rejected early
  const primaryTop = op(
    PRODUCTION_REQUESTED[6]!,
    "object-a",
    { top: 380 },
    "Primary owns top",
  );
  const repairTopConflict = detectRepairPrimaryAxisOccupiedConflicts(
    [primaryTop],
    [op(FB_GROUPING, "object-a", { top: 507 }, "Repair contradicts primary top")],
  );
  checks.push(
    assert(
      !repairTopConflict.ok &&
        repairTopConflict.errors.some((e) =>
          e.includes("COVERAGE_REPAIR_PRIMARY_AXIS_CONFLICT"),
        ),
      "SU_D_primary_occupied_top_axis_rejected",
      repairTopConflict.errors.join("; "),
    ),
  );

  // SU-E — different axis on same target permitted by primary-axis check
  const primaryLeft = op(
    PRODUCTION_REQUESTED[7]!,
    "object-a",
    { left: 60 },
    "Primary owns left",
  );
  const repairTopOk = detectRepairPrimaryAxisOccupiedConflicts(
    [primaryLeft],
    [op(FB_GROUPING, "object-a", { top: 420 }, "Repair top only")],
  );
  checks.push(
    assert(repairTopOk.ok, "SU_E_different_axis_not_primary_axis_conflict", repairTopOk.errors.join("; ")),
  );

  // SU-F — different object repair may proceed to axis check
  const markerPrimary = op(
    PRODUCTION_REQUESTED[6]!,
    "section-b-marker",
    { top: 380 },
    "Primary marker top",
  );
  const headingRepair = detectRepairPrimaryAxisOccupiedConflicts(
    [markerPrimary],
    [
      op(
        FB_GROUPING,
        "section-b-heading",
        { top: 390 },
        "Repair heading top — different object",
      ),
    ],
  );
  checks.push(
    assert(
      headingRepair.ok,
      "SU_F_different_object_repair_not_blocked_by_marker_occupancy",
      headingRepair.errors.join("; "),
    ),
  );

  // SU-G — rev3 production-shaped primary/repair axis conflict (read-only replay logic)
  const rev3PrimaryMarker = op(
    PRODUCTION_REQUESTED[6]!,
    "block-certifications-6-r0",
    { top: 380 },
    "Cert marker section gap",
  );
  const rev3RepairMarker = op(
    FB_GROUPING,
    "block-certifications-6-r0",
    { top: 507 },
    "Repair marker at prior inventory top",
  );
  checks.push(
    assert(
      !detectRepairPrimaryAxisOccupiedConflicts(
        [rev3PrimaryMarker],
        [rev3RepairMarker],
      ).ok,
      "SU_G_rev3_cert_marker_top_380_vs_507_rejected",
      "ok",
    ),
  );

  // SU-H — items 12–15 remain verification-only (Rev3 text)
  for (let i = 0; i < REV3_VERIFICATION_ITEMS.length; i++) {
    const item = REV3_VERIFICATION_ITEMS[i]!;
    const cl = classifyRequestedChange(item);
    checks.push(
      assert(
        cl.classification === "VERIFICATION_ACCEPTANCE" &&
          !findUncoveredRequestedChanges(
            { schema_version: "founder-canvas-revision-plan-1.0.0", summary: "e", notes: [], operations: [] },
            [item],
          ).some((u) => u.text === item),
        `SU_I_rev3_verification_item_${i + 12}_excluded_from_repair`,
        JSON.stringify(cl),
      ),
    );
  }

  // SU-J — repair relevance includes projects
  const projectsOp: CanvasOperation = {
    op: "set_position",
    target_id: "block-projects-5-t2",
    before_summary: "projects title",
    intended_change: "Reflow projects section content",
    values: { top: 280 },
    founder_feedback_item: "Reflow the Projects section",
    confidence: 0.9,
  };
  checks.push(
    assert(
      opTouchesRepairRelevantPrimaryTopics(projectsOp),
      "SU_J_projects_included_in_repair_relevance_filter",
      "false",
    ),
  );

  // X — no auto-fill/inference language that would authorize inventing attribution
  checks.push(
    assert(
      repairPrompt.instructions.includes("Do NOT invent, paraphrase, or auto-fill") &&
        !repairPrompt.instructions.includes("auto-fill missing founder_feedback_item"),
      "X_no_autofill_inference",
      "ok",
    ),
  );

  // Y — provider-call ceiling primary + coverage = max 2 (capability check)
  const yReqs = b.getRequests();
  checks.push(
    assert(
      b.getCalls() === 2 &&
        yReqs[0]?.capability === "revision_planning" &&
        yReqs[1]?.capability === "revision_coverage_repair",
      "Y_provider_ceiling_primary_plus_coverage_max_2",
      `calls=${b.getCalls()} caps=${yReqs.map((r) => r.capability).join(",")}`,
    ),
  );

  // Z — no ConflictPlanRepair on coverage-only branch
  checks.push(
    assert(
      bResult.ok === true &&
        bResult.conflict_repair == null &&
        bResult.coverage_repair != null,
      "Z_no_conflict_repair_on_coverage_branch",
      `conflict=${bResult.conflict_repair != null} coverage=${bResult.coverage_repair != null}`,
    ),
  );

  // Repair-specific schema contract
  const repairFmt = textFormatForRequest({
    request_id: "t",
    task_id: "t",
    department: "resume",
    capability: "revision_coverage_repair",
    objective: "o",
    instructions: "i",
    context_references: [],
    memory_references: [],
    expected_response_schema: {},
    quality_tier: "strong",
    priority: "normal",
    maximum_input_tokens: 1000,
    maximum_output_tokens: 1000,
    estimated_cost_ceiling_usd: null,
    timeout_ms: 1000,
    retry_policy: { max_retries: 0, backoff_ms: 0, retry_on: [] },
    fallback_policy: {
      enabled: false,
      allow_provider_fallback: false,
      allow_local_to_api: false,
      respect_privacy: true,
      respect_budget: true,
      respect_founder_gates: true,
      respect_live_gates: true,
    },
    privacy_classification: "internal",
    created_at: new Date().toISOString(),
    deadline: null,
    dry_run: true,
    founder_approval_requirement: false,
  });
  const repairSchema = REVISION_COVERAGE_REPAIR_JSON_SCHEMA as {
    properties: { operations: { minItems: number; items: { required: string[] } } };
  };
  checks.push(
    assert(
      repairFmt.type === "json_schema" &&
        repairFmt.strict === false &&
        repairFmt.name === "founder_canvas_coverage_repair_plan" &&
        repairSchema.properties.operations.minItems >= 1 &&
        repairSchema.properties.operations.items.required.includes(
          "founder_feedback_item",
        ) &&
        repairSchema.properties.operations.items.required.includes("confidence"),
      "repair_schema_contract_advisory_strict_false",
      JSON.stringify({
        type: repairFmt.type,
        strict: repairFmt.strict,
        name: repairFmt.name,
      }),
    ),
  );

  // Merge helper preserves primary order
  const merged = mergePrimaryAndRepairPlans(primary, repairPlan);
  checks.push(
    assert(
      merged.operations[0]?.founder_feedback_item ===
        primary.operations[0]?.founder_feedback_item &&
        merged.operations[merged.operations.length - 1]?.founder_feedback_item ===
          FB3 &&
        validateRevisionPlan(merged, {
          requested_changes: PRODUCTION_REQUESTED,
        }).ok === true,
      "merge_preserves_primary_order_full_validate_pass",
      `len=${merged.operations.length}`,
    ),
  );

  checks.push(assert(openaiCalls === 0, "no_openai_calls", `n=${openaiCalls}`));
  const afterFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
  checks.push(
    assert(
      JSON.stringify(beforeFp) === JSON.stringify(afterFp),
      "production_tasks_untouched",
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
    repair_max_output_tokens: REVISION_COVERAGE_REPAIR_MAX_OUTPUT_TOKENS,
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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
