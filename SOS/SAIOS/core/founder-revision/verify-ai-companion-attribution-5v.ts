/**
 * Phase 5V — AI companion-op founder_feedback_item attribution repair.
 * Offline. No OpenAI. Never retries revtask-afd3f4b0-fae.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildCanvasInventory } from "./CanvasInventory.js";
import {
  REVISION_OPERATION_PROVENANCE_INVARIANT,
  repairAiPlanFounderAttribution,
} from "./RevisionPlanProvenanceRepair.js";
import { prepareExtractedPlanForValidation } from "./RevisionPlanner.js";
import {
  normalizeFounderFeedbackItem,
  validateRevisionPlanShapeAndOperations,
} from "./RevisionPromptBuilder.js";
import type { FabricCanvasDoc } from "./CanvasInventory.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-ai-companion-attribution-5v.json",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: !!cond, detail };
}

const FB_SKILLS =
  "Increase or recalculate the effective height of the Skills content so all skill lines are fully readable with consistent line spacing and no text-on-text overlap.";
const FB_PROJECTS_MOVE =
  "Move the Projects section downward as required after the corrected Skills section, while preserving a clear and consistent gap between the Skills content and the Projects heading.";
const FB_PROJECTS_REFLOW =
  "Reflow every project entry sequentially so each project title and its complete description finish before the next project begins; no project text may share or overlap the vertical space of another project.";
const FB_BELOW =
  "Move all sections below Projects downward according to the final rendered height of the Projects content so the Certifications and Languages sections remain completely separate and readable.";
const FB_GAP =
  "Maintain a consistent positive vertical gap between each sidebar section and ensure there are zero text overlaps anywhere in the left column.";
const FB_REFLOW_SIDEBAR =
  "Reflow the entire left sidebar vertically so every text object is positioned below the actual rendered bottom of the previous object, including any additional height created by text wrapping.";
const FB_PRESERVE =
  "Preserve the current top header, right-side Summary, Experience, Education layout, typography, colors, and overall visual style because those areas are already correctly structured.";
const FB_VALIDATE =
  "Before considering the revision complete, validate the final rendered layout for zero text overlaps, zero section collisions, and zero out-of-bounds content in the entire left sidebar.";

const COS_RCS = [
  FB_REFLOW_SIDEBAR,
  FB_SKILLS,
  FB_PROJECTS_MOVE,
  FB_PROJECTS_REFLOW,
  FB_BELOW,
  FB_GAP,
  FB_VALIDATE,
  FB_PRESERVE,
];

/** Generalized CoS AI shape: primary ops attributed; companions omit FBI but keep items. */
function cosPartialProvenancePlan(): Record<string, unknown> {
  return {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "Phase 5V CoS-shaped partial provenance fixture",
    operations: [
      {
        op: "set_dimensions",
        target_id: "block-skills-4-t2",
        before_summary: "Skills body under-height",
        intended_change: "Increase Skills body to effective wrapped height",
        values: { height: 120 },
        founder_feedback_item: FB_SKILLS,
        confidence: 0.9,
      },
      {
        op: "set_position",
        target_id: "block-projects-5-r0",
        before_summary: "Projects marker",
        intended_change: "Move Projects marker down after Skills",
        values: { top: 320 },
        founder_feedback_item: FB_PROJECTS_MOVE,
        confidence: 0.88,
      },
      {
        op: "set_position",
        target_id: "block-projects-5-t1",
        before_summary: "Projects heading",
        intended_change:
          "Move the Projects heading down to preserve gap with Skills content and avoid overlap.",
        values: { top: 322 },
        founder_feedback_items: [FB_PROJECTS_MOVE, FB_GAP],
        confidence: 0.87,
      },
      {
        op: "set_dimensions",
        target_id: "block-projects-5-t3",
        before_summary: "First project description",
        intended_change: "Grow first project description to effective height",
        values: { height: 56 },
        founder_feedback_item: FB_PROJECTS_REFLOW,
        confidence: 0.86,
      },
      {
        op: "set_dimensions",
        target_id: "block-projects-5-t5",
        before_summary: "Second project description",
        intended_change:
          "Increase height of second project description to its effective height to prevent text overlap",
        values: { height: 56 },
        founder_feedback_items: [FB_PROJECTS_REFLOW, FB_GAP],
        confidence: 0.85,
      },
      {
        op: "set_position",
        target_id: "block-certifications-6-r0",
        before_summary: "Certifications marker",
        intended_change: "Move Certifications marker below Projects",
        values: { top: 520 },
        founder_feedback_item: FB_BELOW,
        confidence: 0.84,
      },
      {
        op: "set_position",
        target_id: "block-certifications-6-t1",
        before_summary: "Certifications heading",
        intended_change:
          "Move Certifications heading downward in line with marker",
        values: { top: 522 },
        founder_feedback_items: [FB_BELOW, FB_GAP],
        confidence: 0.83,
      },
      {
        op: "set_position",
        target_id: "block-languages-7-r0",
        before_summary: "Languages marker",
        intended_change: "Move Languages marker below Certifications",
        values: { top: 600 },
        founder_feedback_item: FB_BELOW,
        confidence: 0.82,
      },
      {
        op: "set_position",
        target_id: "block-languages-7-t1",
        before_summary: "Languages heading",
        intended_change: "Move Languages heading down with marker",
        values: { top: 602 },
        founder_feedback_items: [FB_BELOW, FB_GAP],
        confidence: 0.81,
      },
    ],
  };
}

function cosCanvas(): FabricCanvasDoc {
  return {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      {
        type: "rect",
        id: "page-root",
        left: 0,
        top: 0,
        width: 794,
        height: 1123,
        fill: "#ffffff",
        data: { role: "pageBackground", system: true },
      },
      {
        type: "rect",
        id: "block-skills-4-r0",
        left: 40,
        top: 140,
        width: 8,
        height: 14,
        fill: "#333",
        data: { section: "skills", role: "marker" },
      },
      {
        type: "textbox",
        id: "block-skills-4-t1",
        left: 56,
        top: 140,
        width: 200,
        height: 14,
        text: "SKILLS",
        fontSize: 12,
        data: { section: "skills", role: "heading" },
      },
      {
        type: "textbox",
        id: "block-skills-4-t2",
        left: 48,
        top: 160,
        width: 220,
        height: 84,
        text: "Strategic Operational Leadership · P&L Management · Digital Transformation · Lean Six Sigma · Supply Chain Optimization · Cross-Functional Team Leadership · Budgeting & Forecasting",
        fontSize: 10.5,
        lineHeight: 1.45,
        data: { section: "skills", role: "body" },
      },
      {
        type: "rect",
        id: "block-projects-5-r0",
        left: 40,
        top: 250,
        width: 8,
        height: 14,
        fill: "#333",
        data: { section: "projects", role: "marker" },
      },
      {
        type: "textbox",
        id: "block-projects-5-t1",
        left: 56,
        top: 250,
        width: 200,
        height: 14,
        text: "PROJECTS",
        fontSize: 12,
        data: { section: "projects", role: "heading" },
      },
      {
        type: "textbox",
        id: "block-projects-5-t2",
        left: 48,
        top: 272,
        width: 220,
        height: 16,
        text: "Ops Excellence Program",
        data: { section: "projects" },
      },
      {
        type: "textbox",
        id: "block-projects-5-t3",
        left: 48,
        top: 292,
        width: 220,
        height: 28,
        text: "Led multi-site process redesign improving throughput and reducing cycle time across regional hubs.",
        fontSize: 10.5,
        lineHeight: 1.45,
        data: { section: "projects" },
      },
      {
        type: "textbox",
        id: "block-projects-5-t4",
        left: 48,
        top: 330,
        width: 220,
        height: 16,
        text: "Vendor Consolidation",
        data: { section: "projects" },
      },
      {
        type: "textbox",
        id: "block-projects-5-t5",
        left: 48,
        top: 350,
        width: 220,
        height: 28,
        text: "Consolidated suppliers and renegotiated service levels while protecting delivery reliability.",
        fontSize: 10.5,
        lineHeight: 1.45,
        data: { section: "projects" },
      },
      {
        type: "rect",
        id: "block-certifications-6-r0",
        left: 40,
        top: 400,
        width: 8,
        height: 14,
        fill: "#333",
        data: { section: "certifications", role: "marker" },
      },
      {
        type: "textbox",
        id: "block-certifications-6-t1",
        left: 56,
        top: 400,
        width: 200,
        height: 14,
        text: "CERTIFICATIONS",
        data: { section: "certifications", role: "heading" },
      },
      {
        type: "textbox",
        id: "block-certifications-6-t2",
        left: 48,
        top: 422,
        width: 220,
        height: 16,
        text: "Lean Six Sigma Black Belt",
        data: { section: "certifications" },
      },
      {
        type: "rect",
        id: "block-languages-7-r0",
        left: 40,
        top: 460,
        width: 8,
        height: 14,
        fill: "#333",
        data: { section: "languages", role: "marker" },
      },
      {
        type: "textbox",
        id: "block-languages-7-t1",
        left: 56,
        top: 460,
        width: 200,
        height: 14,
        text: "LANGUAGES",
        data: { section: "languages", role: "heading" },
      },
      {
        type: "textbox",
        id: "block-languages-7-t2",
        left: 48,
        top: 482,
        width: 220,
        height: 16,
        text: "English · Spanish",
        data: { section: "languages" },
      },
      {
        type: "textbox",
        id: "block-summary-1-t1",
        left: 300,
        top: 140,
        width: 440,
        height: 14,
        text: "SUMMARY",
        data: { section: "summary", role: "heading" },
      },
      {
        type: "textbox",
        id: "block-summary-1-t2",
        left: 292,
        top: 160,
        width: 450,
        height: 60,
        text: "Operations executive focused on throughput, cost, and reliable delivery.",
        data: { section: "summary" },
      },
    ],
  };
}

function main(): void {
  const checks: Check[] = [];

  checks.push(
    assert(
      REVISION_OPERATION_PROVENANCE_INVARIANT.includes(
        "founder_feedback_item",
      ) && REVISION_OPERATION_PROVENANCE_INVARIANT.includes("fail closed"),
      "provenance_invariant_defined",
      REVISION_OPERATION_PROVENANCE_INVARIANT.slice(0, 120),
    ),
  );

  // Raw shape WITHOUT repair must fail on companion indices (production class).
  const raw = cosPartialProvenancePlan();
  const before = validateRevisionPlanShapeAndOperations(raw, {
    requested_changes: COS_RCS,
  });
  checks.push(
    assert(
      before.ok === false &&
        before.errors.some((e) => e.includes("operations[2].founder_feedback_item")) &&
        before.errors.some((e) => e.includes("operations[4].founder_feedback_item")) &&
        before.errors.some((e) => e.includes("operations[6].founder_feedback_item")) &&
        before.errors.some((e) => e.includes("operations[8].founder_feedback_item")),
      "cos_raw_shape_fails_missing_fbi",
      before.errors.join(" | "),
    ),
  );

  const repaired = repairAiPlanFounderAttribution({
    extracted: raw,
    requested_changes: COS_RCS,
  });
  checks.push(
    assert(
      repaired.repairs.length === 4 && repaired.unresolved.length === 0,
      "cos_companion_repairs_four",
      `repairs=${repaired.repairs.length} unresolved=${repaired.unresolved.length} reasons=${repaired.repairs.map((r) => r.reason).join(",")}`,
    ),
  );

  const afterShape = validateRevisionPlanShapeAndOperations(repaired.repaired, {
    requested_changes: COS_RCS,
  });
  checks.push(
    assert(
      afterShape.ok === true && afterShape.plan != null,
      "cos_repaired_shape_pass",
      afterShape.errors.join("; ") || "ok",
    ),
  );

  if (afterShape.plan) {
    for (const idx of [2, 4, 6, 8]) {
      const op = afterShape.plan.operations[idx]!;
      const fbi = String(op.founder_feedback_item ?? "");
      const ok =
        fbi.length > 0 &&
        COS_RCS.some(
          (rc) =>
            normalizeFounderFeedbackItem(rc) ===
            normalizeFounderFeedbackItem(fbi),
        );
      checks.push(
        assert(
          ok,
          `cos_op_${idx}_fbi_exact_rc`,
          fbi.slice(0, 80) || "MISSING",
        ),
      );
    }
    checks.push(
      assert(
        normalizeFounderFeedbackItem(
          afterShape.plan.operations[2]!.founder_feedback_item,
        ) === normalizeFounderFeedbackItem(FB_PROJECTS_MOVE),
        "cos_op2_projects_move_not_gap",
        afterShape.plan.operations[2]!.founder_feedback_item.slice(0, 60),
      ),
    );
  }

  // prepareExtractedPlanForValidation integrates repair.
  const inventory = buildCanvasInventory(cosCanvas());
  const prepared = prepareExtractedPlanForValidation({
    extracted: cosPartialProvenancePlan(),
    inventory,
    requested_changes: COS_RCS,
  });
  checks.push(
    assert(
      prepared.ok === true &&
        (prepared.provenance_repairs?.length ?? 0) === 4 &&
        prepared.plan?.operations.every(
          (o) => String(o.founder_feedback_item ?? "").trim().length > 0,
        ) === true,
      "prepare_extracted_integrates_repair",
      `ok=${prepared.ok} repairs=${prepared.provenance_repairs?.length} errors=${prepared.errors.join("; ")}`,
    ),
  );

  // Fail-closed: unrelated fabricated text in items.
  const fabricated = repairAiPlanFounderAttribution({
    extracted: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "bad",
      operations: [
        {
          op: "set_position",
          target_id: "block-orphan-9-t1",
          before_summary: "orphan",
          intended_change: "Move orphan",
          values: { top: 10 },
          founder_feedback_items: ["layout fix", "move section"],
          confidence: 0.5,
        },
      ],
    },
    requested_changes: COS_RCS,
  });
  checks.push(
    assert(
      fabricated.repairs.length === 0 &&
        fabricated.unresolved.length === 1 &&
        !String(
          (fabricated.repaired as { operations: Array<Record<string, unknown>> })
            .operations[0]?.founder_feedback_item ?? "",
        ).trim(),
      "fabricated_feedback_fail_closed",
      JSON.stringify(fabricated.unresolved),
    ),
  );

  // Fail-closed: ambiguous two unrelated mutation items, no sibling, weak intended.
  const ambiguous = repairAiPlanFounderAttribution({
    extracted: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "amb",
      operations: [
        {
          op: "set_position",
          target_id: "block-orphan-9-t1",
          before_summary: "orphan",
          intended_change: "Adjust layout element",
          values: { top: 10 },
          founder_feedback_items: [FB_SKILLS, FB_BELOW],
          confidence: 0.5,
        },
      ],
    },
    requested_changes: COS_RCS,
  });
  checks.push(
    assert(
      ambiguous.repairs.length === 0 &&
        ambiguous.unresolved.some((u) =>
          u.reason.includes("ambiguous"),
        ),
      "ambiguous_multiple_items_fail_closed",
      JSON.stringify(ambiguous.unresolved),
    ),
  );

  // Fail-closed: preserve-only must not be promoted.
  const preserveOnly = repairAiPlanFounderAttribution({
    extracted: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "preserve",
      operations: [
        {
          op: "set_position",
          target_id: "block-orphan-9-t1",
          before_summary: "orphan",
          intended_change: "Preserve styling",
          values: { top: 10 },
          founder_feedback_items: [FB_PRESERVE],
          confidence: 0.5,
        },
      ],
    },
    requested_changes: COS_RCS,
  });
  checks.push(
    assert(
      preserveOnly.repairs.length === 0 &&
        preserveOnly.unresolved.length === 1,
      "preserve_only_not_promoted",
      JSON.stringify(preserveOnly.unresolved),
    ),
  );

  const failed = checks.filter((c) => !c.pass);
  const report = {
    schema_version: "verify-ai-companion-attribution-5v-1.0.0",
    ok: failed.length === 0,
    provenance_invariant: REVISION_OPERATION_PROVENANCE_INVARIANT,
    checks,
    failed: failed.map((c) => c.name),
    historical_task_retried: false,
    note: "Does not retry revtask-afd3f4b0-fae; generalized CoS-shaped fixture only.",
  };
  mkdirSync(join(REPO, "SOS/07_LOGS/saios/founder-revision"), {
    recursive: true,
  });
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  if (!report.ok) {
    console.error("FAIL verify-ai-companion-attribution-5v", failed);
    process.exit(1);
  }
  console.log("PASS verify-ai-companion-attribution-5v", {
    checks: checks.length,
  });
}

main();
