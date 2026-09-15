/**
 * Phase 6H — post-content reflow + mixed revision geometry.
 *
 * Production origin: revtask-b9a65ad0-eb0 FAILED_GATE after Phase 6G.
 * No OpenAI. No production task mutation.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { executeCanvasOperations } from "./CanvasOperationExecutor.js";
import {
  applyPostContentReflow,
  dropUnsafeGeometryOps,
  pairGap,
} from "./PostContentReflow.js";
import { buildPlanWithDeterministicSpacingOwnership } from "./DeterministicSpacingPlan.js";
import {
  classifyRequestedChange,
  isVerificationAcceptance,
} from "./RequestedChangeClassification.js";
import {
  findIncompleteRequestedSectionReplacements,
  findIntraBoxTextOverflowFindings,
  findTextOverlapFindings,
  founderIdentityObjectIds,
  runRevisionAcceptanceChecks,
} from "./RevisionAcceptanceChecks.js";
import { MIN_SECTION_GAP_PX } from "./RevisionLayoutNormalizer.js";
import { resolveItemCoverageMode } from "./RevisionPromptBuilder.js";
import { listRevisionTasks } from "./RevisionTaskStore.js";
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import type { RevisionPlan } from "./revision-task-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const FIX = resolve(REPO, ".cursor/debug-fixtures/revtask-b9a65ad0-eb0-sanitized");
const OLD_FIX = resolve(REPO, ".cursor/debug-fixtures/revtask-b5339d03-b67-sanitized");
const NEW_FIX = resolve(REPO, ".cursor/debug-fixtures/revtask-9441fe34-4ba-sanitized");
const OUT = join(REPO, "SOS/07_LOGS/saios/founder-revision/verify-post-content-reflow-6h.json");

function loadJson<T>(dir: string, name: string): T {
  return JSON.parse(readFileSync(join(dir, name), "utf8")) as T;
}

const results: Array<{ name: string; ok: boolean; detail: string }> = [];
function assert(ok: boolean, name: string, detail = ""): void {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
}

function oobCount(canvas: FabricCanvasDoc): number {
  const pageW = Number(canvas.width ?? 794);
  const pageH = Number(canvas.height ?? 1123);
  let n = 0;
  for (const o of (canvas.objects ?? []) as Array<Record<string, unknown>>) {
    const left = Number(o.left ?? 0);
    const top = Number(o.top ?? 0);
    const w = Number(o.width ?? 0) * Number(o.scaleX ?? 1);
    const h = Number(o.height ?? 0) * Number(o.scaleY ?? 1);
    if (left < -1 || top < -1 || left + w > pageW + 1 || top + h > pageH + 1) n += 1;
  }
  return n;
}

function overlapGap(canvas: FabricCanvasDoc, a: string, b: string): number | null {
  const hits = findTextOverlapFindings(canvas);
  const hit = hits.find(
    (f) => f.object_ids.includes(a) && f.object_ids.includes(b),
  );
  if (hit && typeof hit.metrics?.gap === "number") return hit.metrics.gap;
  return pairGap(canvas, a, b);
}

const canvas = loadJson<FabricCanvasDoc>(FIX, "prior-canvas.json");
const plan = loadJson<RevisionPlan>(FIX, "revision-plan.json");
const meta = loadJson<{
  requested_changes: string[];
  expected_error: string;
  task_status: string;
  unreplaced_experience_ids: string[];
}>(FIX, "meta.json");

const rawExec = executeCanvasOperations({ canvas, operations: plan.operations });
assert(rawExec.ok, "reproduce_execute_ok", rawExec.error ?? "");
const raw = rawExec.canvas;
const rawOverlaps = findTextOverlapFindings(raw);
assert(rawOverlaps.length === 3, "reproduce_text_overlaps_3", `n=${rawOverlaps.length}`);
assert(oobCount(raw) === 0, "reproduce_page_oob_0");
const projRaw = overlapGap(raw, "block-projects-5-t2", "block-projects-5-t3");
const certRaw = overlapGap(raw, "block-certifications-6-t1", "block-certifications-6-t2");
const eduRaw = overlapGap(raw, "block-education-3-t2", "block-education-3-t3");
assert(
  projRaw != null && Math.abs(projRaw + 14.45) < 0.6,
  "reproduce_projects_overlap",
  `gap=${projRaw}`,
);
assert(
  certRaw != null && Math.abs(certRaw + 3) < 1.0,
  "reproduce_certs_heading_overlap",
  `gap=${certRaw}`,
);
assert(
  eduRaw != null && Math.abs(eduRaw + 11.95) < 0.6,
  "reproduce_education_overlap",
  `gap=${eduRaw}`,
);

const contentOps = plan.operations.filter((o) => o.op !== "set_position");
const contentExec = executeCanvasOperations({ canvas, operations: contentOps });
assert(contentExec.ok, "content_sandbox_ok", contentExec.error ?? "");
const reflowed = applyPostContentReflow({ canvas: contentExec.canvas });
const after = reflowed.canvas;
const afterOverlaps = findTextOverlapFindings(after);
const projAfter = pairGap(after, "block-projects-5-t2", "block-projects-5-t3") ?? 0;
const certAfter = pairGap(after, "block-certifications-6-t1", "block-certifications-6-t2") ?? 0;
const eduAfter = pairGap(after, "block-education-3-t2", "block-education-3-t3") ?? 0;
const certLang = pairGap(after, "block-certifications-6-t4", "block-languages-7-t1") ??
  pairGap(after, "block-certifications-6-t4", "block-languages-7-r0") ?? 0;

assert(afterOverlaps.length === 0, "reflow_text_overlaps_0", `n=${afterOverlaps.length}`);
assert(oobCount(after) === 0, "reflow_page_oob_0", `n=${oobCount(after)}`);
assert(projAfter + 1e-6 >= 2, "reflow_projects_positive", `gap=${projAfter.toFixed(2)}`);
assert(certAfter + 1e-6 >= 2, "reflow_certs_heading_positive", `gap=${certAfter.toFixed(2)}`);
assert(eduAfter + 1e-6 >= 2, "reflow_education_positive", `gap=${eduAfter.toFixed(2)}`);
assert(
  certLang >= MIN_SECTION_GAP_PX - 0.5,
  "certs_languages_positive_separation",
  `gap=${certLang.toFixed(2)} min=${MIN_SECTION_GAP_PX}`,
);
assert(reflowed.report.grown_object_ids.length > 0, "visual_heights_grown", reflowed.report.grown_object_ids.join(","));

const srcIntra = findIntraBoxTextOverflowFindings(canvas);
assert(
  srcIntra.some((f) => f.object_ids.includes("block-certifications-6-t4")),
  "intra_box_overflow_detected_on_source",
  srcIntra.map((f) => f.object_ids.join(",")).join("|"),
);
const afterIntra = findIntraBoxTextOverflowFindings(after);
assert(afterIntra.length === 0, "intra_box_overflow_resolved_after_reflow", String(afterIntra.length));

const dropped = dropUnsafeGeometryOps({ canvas, plan });
assert(
  dropped.dropped.some((o) => o.target_id === "block-certifications-6-t2"),
  "unsafe_coverage_repair_geometry_blocked",
  dropped.dropped.map((o) => String(o.target_id)).join(","),
);

const item17 = meta.requested_changes[16]!;
const item28 = meta.requested_changes[27]!;
assert(
  classifyRequestedChange(item17).classification === "VERIFICATION_ACCEPTANCE" ||
    isVerificationAcceptance(item17),
  "item_17_verification",
  classifyRequestedChange(item17).classification,
);
assert(
  resolveItemCoverageMode(item17) !== "MUTATION_REQUIRED" ||
    classifyRequestedChange(item17).classification !== "MUTATION_REQUIRED",
  "item_17_no_dummy_op_required",
  resolveItemCoverageMode(item17),
);
assert(
  classifyRequestedChange(item28).classification !== "MUTATION_REQUIRED",
  "item_28_not_mutation",
  classifyRequestedChange(item28).classification,
);

const incomplete = findIncompleteRequestedSectionReplacements({
  canvas,
  plan,
  requested_changes: meta.requested_changes,
});
assert(
  meta.unreplaced_experience_ids.every((id) =>
    incomplete.some((f) => f.object_ids.includes(id)),
  ),
  "experience_completeness_detects_t16_t17",
  incomplete.map((f) => f.object_ids.join(",")).join("|"),
);

const completePlan: RevisionPlan = {
  ...plan,
  operations: [
    ...plan.operations,
    {
      op: "update_text",
      target_id: "block-experience-2-t16",
      before_summary: "unreplaced marketing bullet",
      intended_change: "Replace remaining Experience bullet",
      values: { text: "• Documented operational calendars and asset QA across process and reporting channels." },
      founder_feedback_item: meta.requested_changes[2]!,
      confidence: 1,
    },
    {
      op: "update_text",
      target_id: "block-experience-2-t17",
      before_summary: "unreplaced marketing bullet",
      intended_change: "Replace remaining Experience bullet",
      values: { text: "• Supported operations-process rollout across internal documentation." },
      founder_feedback_item: meta.requested_changes[2]!,
      confidence: 1,
    },
  ],
};
const completeMissing = findIncompleteRequestedSectionReplacements({
  canvas,
  plan: completePlan,
  requested_changes: meta.requested_changes,
});
assert(completeMissing.length === 0, "experience_completeness_passes_when_all_rewritten");

const identity = founderIdentityObjectIds(canvas);
assert(
  !plan.operations.some(
    (o) => o.op === "update_text" && o.target_id && identity.has(o.target_id),
  ),
  "name_contact_not_mutated",
);

const titleOp = plan.operations.find((o) => o.target_id === "block-header-0-t2");
assert(
  titleOp?.op === "update_text" &&
    typeof titleOp.values === "object" &&
    titleOp.values &&
    (titleOp.values as { text?: string }).text === "Operations Analyst",
  "header_role_operations_analyst",
);

const owned = buildPlanWithDeterministicSpacingOwnership({
  priorCanvas: canvas,
  requested_changes: meta.requested_changes,
  aiPlan: completePlan,
});
assert(
  owned.ok === true && owned.fail_closed !== true,
  "ownership_complete_plan_ok",
  `${owned.failure_kind ?? owned.ownership_mode} ${owned.error ?? ""}`.slice(0, 180),
);
if (owned.ok && owned.plan) {
  const ownedExec = executeCanvasOperations({
    canvas,
    operations: owned.plan.operations,
  });
  assert(ownedExec.ok, "owned_plan_executes", ownedExec.error ?? "");
  if (ownedExec.ok) {
    assert(
      findTextOverlapFindings(ownedExec.canvas).length === 0,
      "owned_plan_overlaps_0",
    );
    assert(oobCount(ownedExec.canvas) === 0, "owned_plan_oob_0");
    const roleChecks = runRevisionAcceptanceChecks({
      requested_changes: [
        "Before returning this revision to Founder Review, verify that the rendered professional title, Summary, Experience, Skills, Projects, Certifications, and Education all match the target role Operations Analyst.",
      ],
      afterCanvas: ownedExec.canvas,
      beforeCanvas: canvas,
      target_role: "Operations Analyst",
    });
    const role = roleChecks.checks.find((c) => c.check_type === "ROLE_TARGET_INTEGRITY");
    const renderedRole = String(role?.metrics?.rendered_role ?? "");
    assert(
      /operations analyst/i.test(renderedRole) ||
        role?.pass === true,
      "role_integrity_rendered_operations_analyst",
      role ? `${role.pass} rendered=${renderedRole} ${role.reason}` : "no-check",
    );
  }
}

const rawOwned = buildPlanWithDeterministicSpacingOwnership({
  priorCanvas: canvas,
  requested_changes: meta.requested_changes,
  aiPlan: plan,
});
assert(
  rawOwned.fail_closed === true &&
    rawOwned.failure_kind === "CONTENT_REPLACEMENT_INCOMPLETE",
  "raw_27_op_plan_fails_completeness_not_overlap",
  `${rawOwned.failure_kind} ${rawOwned.error ?? ""}`.slice(0, 160),
);

assert(
  /spacing intent unsatisfied/.test(meta.expected_error),
  "historical_task_error_string_unchanged",
);
const oldMeta = loadJson<{ requested_changes?: unknown[] }>(OLD_FIX, "meta.json");
const newMeta = loadJson<{ total_operations: number; requested_changes: string[] }>(
  NEW_FIX,
  "meta.json",
);
assert(
  Array.isArray(oldMeta.requested_changes) && oldMeta.requested_changes.length === 21,
  "historical_b5339d03_unchanged",
);
assert(
  newMeta.total_operations === 29 && newMeta.requested_changes.length === 28,
  "historical_9441fe34_unchanged",
);
const live = listRevisionTasks().find((t) => t.task_id === "revtask-b9a65ad0-eb0");
assert(
  !live || live.status === "FAILED_GATE",
  "historical_b9a65ad0_unchanged",
  live?.status ?? "not-in-local-store",
);

const growCanvas: FabricCanvasDoc = {
  version: "6.0.0",
  width: 794,
  height: 1123,
  objects: [
    {
      type: "textbox",
      id: "a",
      left: 48,
      top: 100,
      width: 80,
      height: 16,
      fontSize: 12,
      text: "Short",
      data: { section: "skills" },
    },
    {
      type: "textbox",
      id: "b",
      left: 48,
      top: 118,
      width: 80,
      height: 16,
      fontSize: 12,
      text: "Also short",
      data: { section: "skills" },
    },
  ],
};
const grown = executeCanvasOperations({
  canvas: growCanvas,
  operations: [
    {
      op: "update_text",
      target_id: "a",
      before_summary: "short",
      intended_change: "wrap taller",
      values: {
        text: "Operational Analysis Process Improvement KPI Reporting Workflow Optimization Documentation",
      },
      founder_feedback_item: "Rewrite Skills",
      confidence: 1,
    },
  ],
});
const grownReflow = applyPostContentReflow({ canvas: grown.canvas });
const gapGrow = pairGap(grownReflow.canvas, "a", "b") ?? -99;
assert(gapGrow + 1e-6 >= 2, "content_grows_downstream_reflows", `gap=${gapGrow.toFixed(2)}`);
const bTopAfterGrow = Number(
  ((grownReflow.canvas.objects ?? []) as Array<Record<string, unknown>>).find(
    (o) => o.id === "b",
  )?.top ?? 0,
);

const shrinkOps = executeCanvasOperations({
  canvas: grownReflow.canvas,
  operations: [
    {
      op: "update_text",
      target_id: "a",
      before_summary: "tall",
      intended_change: "shrink",
      values: { text: "KPI" },
      founder_feedback_item: "Rewrite Skills",
      confidence: 1,
    },
  ],
});
const shrinkReflow = applyPostContentReflow({ canvas: shrinkOps.canvas });
const bTop = Number(
  ((shrinkReflow.canvas.objects ?? []) as Array<Record<string, unknown>>).find(
    (o) => o.id === "b",
  )?.top ?? 0,
);
assert(
  bTop <= bTopAfterGrow + 0.5,
  "content_shrink_does_not_invent_large_gap",
  `b.top=${bTop} after_grow=${bTopAfterGrow}`,
);

const leftBefore = new Map<string, number>();
for (const o of (canvas.objects ?? []) as Array<Record<string, unknown>>) {
  const id = typeof o.id === "string" ? o.id : "";
  if (id) leftBefore.set(id, Number(o.left ?? 0));
}
let leftChanged = 0;
for (const o of (after.objects ?? []) as Array<Record<string, unknown>>) {
  const id = typeof o.id === "string" ? o.id : "";
  if (!id || !leftBefore.has(id)) continue;
  if (Math.abs(Number(o.left ?? 0) - leftBefore.get(id)!) > 0.05) leftChanged += 1;
}
assert(leftChanged === 0, "no_unrelated_horizontal_redesign", `changed=${leftChanged}`);

const headingBodyCanvas: FabricCanvasDoc = {
  version: "6.0.0",
  width: 794,
  height: 1123,
  objects: [
    {
      type: "textbox",
      id: "h",
      left: 48,
      top: 200,
      width: 200,
      height: 14,
      fontSize: 11,
      text: "CERTIFICATIONS",
      data: { section: "certifications", role: "section-heading" },
    },
    {
      type: "textbox",
      id: "body",
      left: 48,
      top: 214,
      width: 80,
      height: 16,
      fontSize: 12,
      text: "Short cert",
      data: { section: "certifications" },
    },
  ],
};
const headingGrown = executeCanvasOperations({
  canvas: headingBodyCanvas,
  operations: [
    {
      op: "update_text",
      target_id: "h",
      before_summary: "heading",
      intended_change: "wrap heading",
      values: { text: "CERTIFICATIONS AND PROFESSIONAL OPERATIONS TRAINING" },
      founder_feedback_item: "Fix Certifications heading wrapping",
      confidence: 1,
    },
  ],
});
const headingReflow = applyPostContentReflow({ canvas: headingGrown.canvas });
const headingGap = pairGap(headingReflow.canvas, "h", "body") ?? -99;
assert(headingGap + 1e-6 >= 2, "rewritten_heading_body_reflows", `gap=${headingGap.toFixed(2)}`);

const multiCanvas: FabricCanvasDoc = {
  version: "6.0.0",
  width: 794,
  height: 1123,
  objects: [
    {
      type: "textbox",
      id: "m1",
      left: 48,
      top: 100,
      width: 80,
      height: 16,
      fontSize: 12,
      text: "One",
      data: { section: "skills" },
    },
    {
      type: "textbox",
      id: "m2",
      left: 48,
      top: 120,
      width: 80,
      height: 16,
      fontSize: 12,
      text: "Two",
      data: { section: "skills" },
    },
    {
      type: "textbox",
      id: "m3",
      left: 48,
      top: 140,
      width: 80,
      height: 16,
      fontSize: 12,
      text: "Three",
      data: { section: "skills" },
    },
  ],
};
const multiGrown = executeCanvasOperations({
  canvas: multiCanvas,
  operations: [
    {
      op: "update_text",
      target_id: "m1",
      before_summary: "one",
      intended_change: "wrap",
      values: {
        text: "Operational Analysis Process Improvement KPI Reporting Workflow",
      },
      founder_feedback_item: "Rewrite Skills",
      confidence: 1,
    },
    {
      op: "update_text",
      target_id: "m2",
      before_summary: "two",
      intended_change: "wrap",
      values: {
        text: "Documentation Stakeholder Coordination Root Cause Analysis",
      },
      founder_feedback_item: "Rewrite Skills",
      confidence: 1,
    },
  ],
});
const multiReflow = applyPostContentReflow({ canvas: multiGrown.canvas });
const g12 = pairGap(multiReflow.canvas, "m1", "m2") ?? -99;
const g23 = pairGap(multiReflow.canvas, "m2", "m3") ?? -99;
assert(
  g12 + 1e-6 >= 2 && g23 + 1e-6 >= 2,
  "multiple_rewritten_objects_same_section",
  `g12=${g12.toFixed(2)} g23=${g23.toFixed(2)}`,
);

const unsafeIntoHeading = dropUnsafeGeometryOps({
  canvas: headingBodyCanvas,
  plan: {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    operations: [
      {
        op: "set_position",
        target_id: "body",
        before_summary: "body below heading",
        intended_change: "move into heading",
        values: { top: 201 },
        founder_feedback_item: "Fix Certifications overlap",
        confidence: 1,
      },
    ],
  },
});
assert(
  unsafeIntoHeading.dropped.some((o) => o.target_id === "body"),
  "unsafe_ai_geometry_rejected",
  unsafeIntoHeading.dropped.map((o) => String(o.target_id)).join(","),
);

const safeDown = dropUnsafeGeometryOps({
  canvas: headingBodyCanvas,
  plan: {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    operations: [
      {
        op: "set_position",
        target_id: "body",
        before_summary: "body below heading",
        intended_change: "move slightly down",
        values: { top: 230 },
        founder_feedback_item: "Increase Certifications heading to content gap",
        confidence: 1,
      },
    ],
  },
});
assert(
  safeDown.dropped.length === 0,
  "safe_ai_geometry_preserved",
  String(safeDown.dropped.length),
);

const overflowBox: FabricCanvasDoc = {
  version: "6.0.0",
  width: 794,
  height: 1123,
  objects: [
    {
      type: "textbox",
      id: "tiny",
      left: 48,
      top: 400,
      width: 60,
      height: 16,
      fontSize: 14,
      text: "Certified Professional in Operations Process Control And Workflow Analytics",
      data: { section: "certifications" },
    },
  ],
};
const overflowHits = findIntraBoxTextOverflowFindings(overflowBox);
assert(
  overflowHits.some((f) => f.object_ids.includes("tiny")),
  "visual_height_exceeds_stored_box",
  overflowHits.map((f) => f.object_ids.join(",")).join("|"),
);
const overflowFixed = applyPostContentReflow({ canvas: overflowBox });
assert(
  findIntraBoxTextOverflowFindings(overflowFixed.canvas).length === 0,
  "visual_height_synced_into_stored_box",
);

const failed = results.filter((r) => !r.ok).length;
mkdirSync(join(REPO, "SOS/07_LOGS/saios/founder-revision"), { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify(
    {
      schema_version: "verify-post-content-reflow-6h-1.0.0",
      ok: failed === 0,
      passed: results.length - failed,
      failed,
      fixture_projects_overlap_after: Number(projAfter.toFixed(2)),
      fixture_cert_heading_overlap_after: Number(certAfter.toFixed(2)),
      fixture_education_overlap_after: Number(eduAfter.toFixed(2)),
      fixture_text_overlaps_after: afterOverlaps.length,
      fixture_page_oob_after: oobCount(after),
      results,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  failed === 0
    ? `POST_CONTENT_REFLOW_6H=PASS (${results.length}/${results.length})`
    : `POST_CONTENT_REFLOW_6H=FAIL (${results.length - failed}/${results.length})`,
);
process.exit(failed === 0 ? 0 : 1);
