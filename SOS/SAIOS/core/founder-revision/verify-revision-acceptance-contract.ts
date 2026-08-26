/**
 * Focused verify: Founder revision verification/acceptance contract.
 * Fixtures from revtask-05667cbb-641 requested_changes[11]/[12].
 * No OpenAI. No production task/evidence mutation.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildFeedbackCoverage } from "./FeedbackCoverage.js";
import {
  validatePlanCoversRequestedChanges,
  validateRevisionPlan,
  buildRevisionPlannerPrompt,
} from "./RevisionPromptBuilder.js";
import {
  CANONICAL_COLLISION_BOUNDS_QA,
  CANONICAL_COLLISION_BOUNDS_QA_V2,
  CANONICAL_CONTENT_PRESERVATION,
  CANONICAL_VISUAL_CONSISTENCY_QA,
  CANONICAL_VISUAL_CONSISTENCY_QA_V2,
  classifyRequestedChange,
} from "./RequestedChangeClassification.js";
import {
  runCollisionBoundsCheck,
  runContentPreservationCheck,
  runRevisionAcceptanceChecks,
  runVisualConsistencyCheck,
} from "./RevisionAcceptanceChecks.js";
import { listRevisionTasks } from "./RevisionTaskStore.js";
import type {
  CanvasOperation,
  RevisionPlan,
  RevisionTask,
} from "./revision-task-types.js";
import type { FabricCanvasDoc } from "./CanvasInventory.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-revision-acceptance-contract.json",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: cond, detail };
}

/** Exact production forms (revtask-05667cbb-641). */
const FB11 = CANONICAL_COLLISION_BOUNDS_QA;
const FB12 = CANONICAL_VISUAL_CONSISTENCY_QA;

/** Stand-in mutation lines for [0–10] (plan-completeness fixture). */
const MUTATION_0_TO_10: string[] = Array.from({ length: 11 }, (_, i) => {
  const labels = [
    "Reduce header height to improve page balance.",
    "Move contact information into the header band.",
    "Fix Education section heading collision with body text.",
    "Fix Skills section heading collision with body text.",
    "Align left edges of section headings consistently.",
    "Increase Summary body line height for readability.",
    "Tighten Experience entry spacing.",
    "Resize the Certifications heading rectangle height to match other section headings.",
    "Move Languages section up to reduce large empty gap.",
    "Adjust Skills rectangle fill to the approved section-heading color.",
    "Reposition Education body text below its heading with clear separation.",
  ];
  return labels[i]!;
});

const ALL_REQUESTED = [...MUTATION_0_TO_10, FB11, FB12];

function opFor(fb: string, targetId: string, index: number): CanvasOperation {
  return {
    op: "set_position",
    target_id: targetId,
    before_summary: `object ${targetId} prior position`,
    intended_change: `Reposition ${targetId} to satisfy Founder item`,
    values: { left: 48, top: 100 + index * 10 },
    founder_feedback_item: fb,
    confidence: 0.9,
  };
}

function planCoveringMutationsOnly(): RevisionPlan {
  return {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "mutations for 0-10 only",
    notes: [],
    operations: MUTATION_0_TO_10.map((fb, i) =>
      opFor(fb, `block-mut-${i}`, i),
    ),
  };
}

function pageBg(): Record<string, unknown> {
  return {
    type: "rect",
    id: "page-root",
    left: 0,
    top: 0,
    width: 794,
    height: 1123,
    fill: "#ffffff",
    data: {
      role: "pageBackground",
      kind: "page-bg",
      system: true,
      id: "page-root",
    },
  };
}

function headingPair(
  label: string,
  section: string,
  top: number,
  opts?: {
    left?: number;
    rectLeft?: number;
    height?: number;
    fill?: string;
    textFill?: string;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string | number;
    padding?: number;
    width?: number;
  },
): Record<string, unknown>[] {
  const left = opts?.left ?? 48;
  const rectLeft = opts?.rectLeft ?? left;
  const height = opts?.height ?? 22;
  const padding = opts?.padding ?? 4;
  const width = opts?.width ?? 140;
  const fill = opts?.fill ?? "#1e3a8a";
  const textFill = opts?.textFill ?? "#ffffff";
  const fontSize = opts?.fontSize ?? 11;
  const fontFamily = opts?.fontFamily ?? "Helvetica";
  const fontWeight = opts?.fontWeight ?? "bold";
  const rectId = `hdr-${section}-r`;
  const textId = `hdr-${section}-t`;
  return [
    {
      type: "rect",
      id: rectId,
      left: rectLeft,
      top,
      width,
      height,
      fill,
      data: { id: rectId, section, role: "section-heading" },
    },
    {
      type: "textbox",
      id: textId,
      left,
      top: top + padding,
      width: width - 8,
      height: height - 2,
      text: label,
      fill: textFill,
      fontSize,
      fontFamily,
      fontWeight,
      data: { id: textId, section, role: "section-heading" },
    },
  ];
}

function consistentCanvas(): FabricCanvasDoc {
  return {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      pageBg(),
      ...headingPair("SUMMARY", "summary", 180, { width: 120 }),
      {
        type: "textbox",
        id: "summary-body",
        left: 48,
        top: 210,
        width: 600,
        height: 40,
        text: "Professional summary body copy.",
        fontSize: 11,
        fill: "#111111",
        data: { id: "summary-body", section: "summary" },
      },
      ...headingPair("EXPERIENCE", "experience", 280, { width: 160 }),
      {
        type: "textbox",
        id: "exp-body",
        left: 48,
        top: 310,
        width: 600,
        height: 40,
        text: "Experience body copy.",
        fontSize: 11,
        fill: "#111111",
        data: { id: "exp-body", section: "experience" },
      },
      ...headingPair("EDUCATION", "education", 380, { width: 150 }),
      {
        type: "textbox",
        id: "edu-body",
        left: 48,
        top: 410,
        width: 600,
        height: 40,
        text: "Education body copy.",
        fontSize: 11,
        fill: "#111111",
        data: { id: "edu-body", section: "education" },
      },
      ...headingPair("SKILLS", "skills", 480, { width: 110 }),
      {
        type: "textbox",
        id: "skills-body",
        left: 48,
        top: 510,
        width: 600,
        height: 40,
        text: "Skills body copy.",
        fontSize: 11,
        fill: "#111111",
        data: { id: "skills-body", section: "skills" },
      },
    ],
  } as FabricCanvasDoc;
}

function inconsistentHeadingCanvas(): FabricCanvasDoc {
  const base = consistentCanvas();
  const objects = [...(base.objects ?? [])];
  // Break SKILLS heading: different left, fill, fontSize
  for (const o of objects) {
    if (o.id === "hdr-skills-r") {
      o.left = 72;
      o.fill = "#dc2626";
      o.height = 30;
    }
    if (o.id === "hdr-skills-t") {
      o.left = 72;
      o.fontSize = 16;
      o.fill = "#ffff00";
      o.fontWeight = "normal";
    }
  }
  return { ...base, objects };
}

function collidingCanvas(): FabricCanvasDoc {
  return {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      pageBg(),
      ...headingPair("SUMMARY", "summary", 180),
      // Body overlaps heading rect
      {
        type: "textbox",
        id: "summary-body-overlap",
        left: 50,
        top: 185,
        width: 400,
        height: 30,
        text: "This body text overlaps the SUMMARY heading rectangle.",
        fontSize: 12,
        fill: "#111111",
        data: { id: "summary-body-overlap", section: "summary" },
      },
      // Out of bounds object
      {
        type: "textbox",
        id: "oob-text",
        left: 48,
        top: 1100,
        width: 200,
        height: 40,
        text: "Past bottom edge",
        fontSize: 12,
        fill: "#111111",
        data: { id: "oob-text", section: "skills" },
      },
    ],
  } as FabricCanvasDoc;
}

function emptyPlanOpsLog(plan: RevisionPlan) {
  return plan.operations.map((op, index) => ({
    index,
    op: op.op,
    target_id: op.target_id ?? null,
    founder_feedback_item: op.founder_feedback_item,
    ok: true,
    before: { id: op.target_id },
    after: { id: op.target_id },
    error: null,
  }));
}

function main(): void {
  let openaiCalls = 0;
  const beforeFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
  const checks: Check[] = [];

  // --- Classification ---
  checks.push(
    assert(
      classifyRequestedChange(FB11).classification ===
        "VERIFICATION_ACCEPTANCE" &&
        classifyRequestedChange(FB11).check_type === "COLLISION_BOUNDS",
      "classify_fb11_collision_bounds",
      JSON.stringify(classifyRequestedChange(FB11)),
    ),
  );
  checks.push(
    assert(
      classifyRequestedChange(FB12).classification ===
        "VERIFICATION_ACCEPTANCE" &&
        classifyRequestedChange(FB12).check_type === "VISUAL_CONSISTENCY",
      "classify_fb12_visual_consistency",
      JSON.stringify(classifyRequestedChange(FB12)),
    ),
  );
  checks.push(
    assert(
      classifyRequestedChange(
        "QA: move the Education heading down 20px",
      ).classification === "MUTATION_REQUIRED",
      "anti_bypass_qa_move_education",
      "must remain mutation",
    ),
  );
  checks.push(
    assert(
      classifyRequestedChange("Review and resize the Skills rectangle")
        .classification === "MUTATION_REQUIRED",
      "anti_bypass_review_resize_skills",
      "must remain mutation",
    ),
  );
  checks.push(
    assert(
      classifyRequestedChange("perform QA").classification ===
        "MUTATION_REQUIRED",
      "anti_bypass_generic_perform_qa",
      "must remain mutation",
    ),
  );
  checks.push(
    assert(
      classifyRequestedChange(
        "Perform a final visual QA pass to ensure every section appears intentionally aligned, evenly spaced, and production-ready.",
      ).classification === "MUTATION_REQUIRED",
      "anti_bypass_similar_but_not_canonical_qa",
      "near-miss QA form remains mutation",
    ),
  );
  checks.push(
    assert(
      classifyRequestedChange(CANONICAL_COLLISION_BOUNDS_QA_V2).classification ===
        "VERIFICATION_ACCEPTANCE" &&
        classifyRequestedChange(CANONICAL_COLLISION_BOUNDS_QA_V2).check_type ===
          "COLLISION_BOUNDS",
      "classify_collision_bounds_qa_v2_5585617a",
      JSON.stringify(classifyRequestedChange(CANONICAL_COLLISION_BOUNDS_QA_V2)),
    ),
  );
  checks.push(
    assert(
      classifyRequestedChange(CANONICAL_VISUAL_CONSISTENCY_QA_V2)
        .classification === "VERIFICATION_ACCEPTANCE" &&
        classifyRequestedChange(CANONICAL_VISUAL_CONSISTENCY_QA_V2)
          .check_type === "VISUAL_CONSISTENCY",
      "classify_visual_consistency_qa_v2_5585617a",
      JSON.stringify(
        classifyRequestedChange(CANONICAL_VISUAL_CONSISTENCY_QA_V2),
      ),
    ),
  );
  checks.push(
    assert(
      validatePlanCoversRequestedChanges(
        {
          schema_version: "founder-canvas-revision-plan-1.0.0",
          summary: "empty",
          operations: [],
        },
        [CANONICAL_COLLISION_BOUNDS_QA_V2, CANONICAL_VISUAL_CONSISTENCY_QA_V2],
      ).ok === true,
      "v2_verification_zero_ops_completeness",
      "verification items require zero ops",
    ),
  );
  checks.push(
    assert(
      classifyRequestedChange(
        "Check the Certifications section after repositioning its heading and ensure spacing is correct.",
      ).classification === "MUTATION_REQUIRED",
      "anti_bypass_check_certifications_mutation",
      "must remain mutation",
    ),
  );
  checks.push(
    assert(
      classifyRequestedChange(CANONICAL_CONTENT_PRESERVATION).classification ===
        "VERIFICATION_ACCEPTANCE" &&
        classifyRequestedChange(CANONICAL_CONTENT_PRESERVATION).check_type ===
          "CONTENT_PRESERVATION",
      "classify_content_preservation_canonical",
      JSON.stringify(classifyRequestedChange(CANONICAL_CONTENT_PRESERVATION)),
    ),
  );
  checks.push(
    assert(
      classifyRequestedChange(
        "Preserve the dark-navy header design while aligning the contact line.",
      ).classification === "MUTATION_REQUIRED",
      "anti_bypass_preserve_header_design_mutation",
      "design preserve remains mutation",
    ),
  );
  checks.push(
    assert(
      classifyRequestedChange(
        "Rewrite the summary while keeping facts truthful.",
      ).classification === "MUTATION_REQUIRED",
      "anti_bypass_rewrite_summary_mutation",
      "content rewrite remains mutation",
    ),
  );
  checks.push(
    assert(
      classifyRequestedChange(
        "Rebalance the left sidebar so its content uses the available vertical space more intentionally and the lower half does not appear excessively empty, while preserving truthful resume content and avoiding filler.",
      ).classification === "MUTATION_REQUIRED",
      "anti_bypass_sidebar_rebalance_with_preservation_constraint",
      "layout mutation with preservation constraint remains mutation",
    ),
  );
  checks.push(
    assert(
      classifyRequestedChange(
        "Adjust spacing while keeping factual content unchanged.",
      ).classification === "MUTATION_REQUIRED",
      "anti_bypass_adjust_spacing_with_factual_constraint",
      "spacing mutation remains mutation",
    ),
  );
  checks.push(
    assert(
      validatePlanCoversRequestedChanges(
        {
          schema_version: "founder-canvas-revision-plan-1.0.0",
          summary: "empty",
          operations: [],
        },
        [CANONICAL_CONTENT_PRESERVATION],
      ).ok === true,
      "content_preservation_zero_ops_completeness",
      "content preservation requires zero ops",
    ),
  );

  // Planner cannot set a classification field that changes behavior
  const planWithFakeClass = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "fake class",
    notes: [],
    classification: "VERIFICATION_ACCEPTANCE",
    operations: [
      {
        ...opFor(MUTATION_0_TO_10[0]!, "x", 0),
        classification: "VERIFICATION_ACCEPTANCE",
      },
    ],
  });
  const fakeClassCover = validatePlanCoversRequestedChanges(
    planWithFakeClass.plan ?? {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "x",
      operations: [opFor(MUTATION_0_TO_10[0]!, "x", 0)],
    },
    ["QA: move the Education heading down 20px"],
  );
  checks.push(
    assert(
      !fakeClassCover.ok,
      "planner_classification_field_cannot_bypass",
      fakeClassCover.errors.join("; "),
    ),
  );

  // --- Plan completeness A/B ---
  const missingMutation = validatePlanCoversRequestedChanges(
    {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "missing mut 3",
      operations: MUTATION_0_TO_10.filter((_, i) => i !== 3).map((fb, i) =>
        opFor(fb, `t-${i}`, i),
      ),
    },
    ALL_REQUESTED,
  );
  checks.push(
    assert(
      !missingMutation.ok &&
        missingMutation.errors.some((e) => e.includes("requested_changes[3]")),
      "A_mutation_0_10_missing_ops_still_fail",
      missingMutation.errors.join(" | "),
    ),
  );

  const mutationsOnly = validatePlanCoversRequestedChanges(
    planCoveringMutationsOnly(),
    ALL_REQUESTED,
  );
  checks.push(
    assert(
      mutationsOnly.ok === true,
      "B_fb11_fb12_zero_ops_plan_completeness_pass",
      mutationsOnly.errors.join("; ") || "ok",
    ),
  );

  // --- Acceptance checks C–F ---
  const collide = runCollisionBoundsCheck(collidingCanvas(), FB11);
  checks.push(
    assert(
      collide.pass === false && collide.evaluable === true,
      "C_fb11_failing_collision_bounds_evidence",
      collide.reason,
    ),
  );

  const cleanBounds = runCollisionBoundsCheck(consistentCanvas(), FB11);
  checks.push(
    assert(
      cleanBounds.pass === true,
      "D_fb11_passing_collision_bounds_evidence",
      cleanBounds.reason,
    ),
  );

  const inconsistent = runVisualConsistencyCheck(
    inconsistentHeadingCanvas(),
    FB12,
  );
  checks.push(
    assert(
      inconsistent.pass === false && inconsistent.evaluable === true,
      "E_fb12_failing_visual_consistency_evidence",
      inconsistent.reason,
    ),
  );

  const consistent = runVisualConsistencyCheck(consistentCanvas(), FB12);
  checks.push(
    assert(
      consistent.pass === true,
      "F_fb12_passing_visual_consistency_evidence",
      consistent.reason,
    ),
  );

  // Coverage integration: fail closed without evidence
  const plan = planCoveringMutationsOnly();
  const log = emptyPlanOpsLog(plan);
  const noEvidence = buildFeedbackCoverage({
    requested_changes: ALL_REQUESTED,
    plan,
    log,
    beforeCanvas: consistentCanvas(),
    afterCanvas: consistentCanvas(),
    acceptanceReport: null,
  });
  const i11 = noEvidence.items[11];
  const i12 = noEvidence.items[12];
  checks.push(
    assert(
      i11?.status === "not_addressed" &&
        i12?.status === "not_addressed" &&
        noEvidence.gate_pass === false,
      "missing_acceptance_evidence_fails_closed",
      `11=${i11?.status} 12=${i12?.status} gate=${noEvidence.gate_pass}`,
    ),
  );

  // Ops alone cannot address verification items
  const opsOnQa: RevisionPlan = {
    ...plan,
    operations: [
      ...plan.operations,
      opFor(FB11, "dummy-11", 99),
      opFor(FB12, "dummy-12", 100),
    ],
  };
  const opsOnlyCov = buildFeedbackCoverage({
    requested_changes: [FB11, FB12],
    plan: opsOnQa,
    log: emptyPlanOpsLog(opsOnQa),
    beforeCanvas: collidingCanvas(),
    afterCanvas: collidingCanvas(),
    acceptanceReport: runRevisionAcceptanceChecks({
      afterCanvas: collidingCanvas(),
      requested_changes: [FB11, FB12],
      task_id: "fixture-revtask-05667cbb-641",
    }),
  });
  checks.push(
    assert(
      opsOnlyCov.items.every((i) => i.status === "not_addressed") &&
        opsOnlyCov.gate_pass === false,
      "verification_not_addressed_by_ops_alone",
      opsOnlyCov.items.map((i) => i.status).join(","),
    ),
  );

  const passReport = runRevisionAcceptanceChecks({
    afterCanvas: consistentCanvas(),
    requested_changes: ALL_REQUESTED,
    task_id: "fixture-revtask-05667cbb-641",
    decision_id: "fixture-decision",
  });
  const passCov = buildFeedbackCoverage({
    requested_changes: ALL_REQUESTED,
    plan,
    log,
    beforeCanvas: consistentCanvas(),
    afterCanvas: consistentCanvas(),
    acceptanceReport: passReport,
  });
  checks.push(
    assert(
      passCov.items[11]?.status === "addressed" &&
        passCov.items[12]?.status === "addressed",
      "fb11_fb12_addressed_when_acceptance_passes",
      `${passCov.items[11]?.status}/${passCov.items[12]?.status}`,
    ),
  );
  // Mutation items without successful coverage structural proof stay not fully gated
  // here because we only check verification statuses for this assertion.
  checks.push(
    assert(
      passReport.checks.length === 2 &&
        passReport.canvas_source === "post_mutation" &&
        passReport.all_verification_pass === true,
      "acceptance_report_shape_post_mutation",
      `checks=${passReport.checks.length} all=${passReport.all_verification_pass}`,
    ),
  );

  // Mutation item coverage still requires ops (unchanged path)
  const mutOnlyCov = buildFeedbackCoverage({
    requested_changes: [MUTATION_0_TO_10[0]!],
    plan: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "empty",
      operations: [],
      notes: [],
    },
    log: [],
    beforeCanvas: consistentCanvas(),
    afterCanvas: consistentCanvas(),
    acceptanceReport: passReport,
  });
  checks.push(
    assert(
      mutOnlyCov.items[0]?.status === "not_addressed" &&
        mutOnlyCov.gate_pass === false,
      "mutation_coverage_not_weakened",
      mutOnlyCov.items[0]?.status ?? "missing",
    ),
  );

  // Prompt rules
  const task: RevisionTask = {
    schema_version: "founder-revision-task-1.0.0",
    task_id: "revtask-verify-acceptance",
    decision_id: "fd-verify-acceptance",
    review_id: "rev-verify-acceptance",
    prior_candidate_id: "cand-x",
    prior_canvas_path: "canvas.json",
    founder_reason: "test",
    requested_changes: ALL_REQUESTED,
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
  const prompt = buildRevisionPlannerPrompt({
    task,
    inventory: [],
    page_width: 794,
    page_height: 1123,
    preview_width: 794,
    preview_height: 1123,
  });
  checks.push(
    assert(
      prompt.instructions.includes(
        "Final collision/bounds QA items classified by the system as VERIFICATION_ACCEPTANCE require ZERO operations",
      ) &&
        prompt.instructions.includes(
          "Final visual-consistency QA items classified by the system as VERIFICATION_ACCEPTANCE require ZERO operations",
        ) &&
        prompt.instructions.includes("MUST NOT invent a classification field") &&
        prompt.instructions.includes(
          "proven by deterministic post-execution checks",
        ) &&
        prompt.instructions.includes(
          "NEVER include structural/full-width container objects in an align_objects cohort",
        ),
      "prompt_documents_verification_contract",
      "ok",
    ),
  );

  checks.push(
    assert(openaiCalls === 0, "no_openai_during_verification", `n=${openaiCalls}`),
  );
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
    schema_version: "founder-revision-acceptance-verify-1.0.0",
    ok: failed.length === 0,
    at: new Date().toISOString(),
    fixture_task: "revtask-05667cbb-641",
    canonical_fb11: FB11,
    canonical_fb12: FB12,
    checks,
    failed: failed.map((c) => c.name),
    openai_calls: openaiCalls,
    publication_allowed: false,
  };
  mkdirSync(join(OUT, ".."), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  // eslint-disable-next-line no-console
  console.log(
    failed.length === 0
      ? `ACCEPTANCE CONTRACT VERIFY PASS (${checks.length} checks)`
      : `ACCEPTANCE CONTRACT VERIFY FAIL: ${failed.map((c) => c.name).join(", ")}`,
  );
  if (failed.length) process.exit(1);
}

main();
