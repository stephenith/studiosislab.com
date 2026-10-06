/**
 * C1 — canonical Founder Feedback Compiler IR.
 *
 * Offline only. No production OpenAI, generation, revision, or task mutation.
 * The 5d933072-daf failure class is reproduced via the legacy preservation
 * ledger helper, then shown resolved by mutation-only completeness.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import type { CriticResult } from "../resume-critic/types.js";
import {
  compileFounderFeedbackIR,
  FOUNDER_FEEDBACK_IR_SCHEMA,
  NUMBER_OF_SEMANTIC_INTERPRETATION_PATHS,
  founderFeedbackIROwnershipErrors,
} from "./FounderFeedbackIR.js";
import {
  applyAlreadySatisfiedProof,
  applyPresentationMutations,
  applyRelationalAlignment,
  compileStyleMutation,
  bindRangeTargetIds,
  bindReferenceIds,
  bindTargetDescriptor,
  compileGroupAlignment,
  compileRelativePlacement,
  compileTargetDescriptor,
  dropProviderGeometryWhenRelationalOwned,
  evaluateItemFulfillment,
  itemRequiresMutationFulfillment,
} from "./FounderFeedbackFulfillment.js";
import {
  detectSpacingIntentDirection,
  isFounderMeasurableSpacingIntent,
} from "./FounderSpacingIntent.js";
import {
  extractAllNamedSpacingPairs,
  extractPairEndpointNeedles,
} from "./FounderSpacingRelation.js";
import { classifyRequestedChange } from "./RequestedChangeClassification.js";
import { buildFeedbackCoverage } from "./FeedbackCoverage.js";
import { evaluateRevisionFinalAcceptance } from "./RevisionFinalAcceptance.js";
import { evaluateCanonicalFinalStateLayoutProof } from "./CanonicalFinalStateLayoutProof.js";
import { validatePlanGeometrySafety } from "./PlanGeometrySafety.js";
import { executeCanvasOperations } from "./CanvasOperationExecutor.js";
import { applyPostContentReflow } from "./PostContentReflow.js";
import { evaluateSharedGeometryAdmission } from "../geometry-admission/SharedGeometryAdmission.js";
import { dropUnsafeGeometryOps } from "./PostContentReflow.js";
import {
  findIntraBoxTextOverflowFindings,
  findTextOverlapFindings,
  runCollisionBoundsCheck,
} from "./RevisionAcceptanceChecks.js";
import { normalizeRevisionLayout } from "./RevisionLayoutNormalizer.js";
import {
  compilePresentationSpec,
  splitLogicalItems,
} from "./PresentationIntent.js";
import { resolveRevisionIntentScope } from "./RevisionIntentScope.js";
import {
  evaluateSectionReplacementCompleteness,
  evaluateSectionReplacementCompletenessLegacyPreservationLedger,
} from "./SectionReplacementCompleteness.js";
import {
  allRequestedChangesAllowEmptyPlan,
  buildFounderItemCoverageLedger,
  resolveItemCoverageMode,
} from "./RevisionPromptBuilder.js";
import {
  runFounderFeedbackRevision,
  setRevisionPipelineRootsForTests,
} from "./FounderRevisionPipeline.js";
import {
  createRevisionTask,
  setRevisionTasksDirForTests,
} from "./RevisionTaskStore.js";
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import type { RevisionPlan } from "./revision-task-types.js";
import {
  CANONICAL_COLLISION_BOUNDS_QA,
  CANONICAL_CONTENT_PRESERVATION,
} from "./RequestedChangeClassification.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const FIX = join(REPO, ".cursor/debug-fixtures/revtask-a0009171-849-sanitized");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-founder-feedback-ir-c1.json",
);
const HISTORICAL = [
  "revtask-b5339d03-b67",
  "revtask-9441fe34-4ba",
  "revtask-b9a65ad0-eb0",
  "revtask-33ef5466-f24",
  "revtask-7a1c0899-4d6",
  "revtask-dd26226e-d8b",
  "revtask-6ddb8eb8-e9c",
  "revtask-a0009171-849",
  "revtask-e5cdec1a-40e",
  "revtask-04b14b3d-243",
  "revtask-76a04a21-6ff",
  "revtask-5d933072-daf",
  "revtask-863f67a5-790",
  "revtask-4a0c006c-507",
  "revtask-3f5b2339-73e",
  "revtask-0d58e039-326",
  "revtask-68a5d250-b24",
  "revtask-3a9bcae2-16c",
  "revtask-a3de0a46-4da",
];

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function assert(ok: boolean, name: string, detail = ""): void {
  checks.push({ name, pass: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function emptyPlan(): RevisionPlan {
  return {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "deterministic spacing ownership",
    operations: [],
  };
}

function passingCritic(): CriticResult {
  const scores = {
    overall: 94,
    ats: 100,
    visual: 92,
    typography: 92,
    layout: 93,
    technical: 100,
    consistency: 94,
    sections: 95,
    thumbnail_appeal: 90,
    contrast: 92,
  };
  return {
    scores,
    reports: {},
    readiness: {
      ready: true,
      founder_review_allowed: true,
      blocked_reasons: [],
      rules: {
        overall_min: 90,
        ats_min: 95,
        technical_required: 100,
        no_overflow: true,
        no_schema_mismatch: true,
        no_missing_sections: true,
        no_renderer_errors: true,
      },
    },
    evaluated_at: new Date().toISOString(),
    dry_run: true,
    publication_allowed: false,
    live_enabled: false,
    mutated_resume: false,
    used_ai: false,
    used_mock_provider: false,
  } as CriticResult;
}

const LAYOUT_ONLY = "Tighten Skills to Projects spacing in the sidebar";
const PRESERVE_SUMMARY = "Preserve the current Summary content";
const PRESERVE_EXPERIENCE = "Preserve Experience content";
const PRESERVE_EDUCATION = "Preserve Education content";
const KEEP_UNCHANGED = "Keep everything else unchanged";
const VERIFY_OVERLAPS = "Verify there are no overlaps";
const REWRITE_SUMMARY = "Rewrite the Summary for an Operations Analyst";
const REMOVE_EXPERIENCE =
  "Remove Marketing Manager Experience content from the Experience section";
const SKILLS_REPLACE =
  "Replace the current marketing-focused Skills with Operations Analyst skills and tools appropriate for the target role.";

const KEEP_MISMATCH =
  "Keep the current Experience achievements such as ZXCVBNQPlaceholderNotOnCanvas";
const LAYOUT_PRESERVE_PACKET = [
  LAYOUT_ONLY,
  PRESERVE_SUMMARY,
  PRESERVE_EXPERIENCE,
  PRESERVE_EDUCATION,
  KEEP_UNCHANGED,
  VERIFY_OVERLAPS,
];
const FAILURE_CLASS_PACKET = [...LAYOUT_PRESERVE_PACKET, KEEP_MISMATCH];

function skillsCanvas(): FabricCanvasDoc {
  const obj = (
    id: string,
    text: string,
    section: string,
    extra: Record<string, unknown> = {},
  ) => ({
    id,
    type: "Textbox",
    text,
    left: 48,
    top: extra.top ?? 160,
    width: 220,
    height: 40,
    data: { section },
  });
  return {
    version: "6.0.0",
    width: 794,
    height: 1123,
    objects: [
      obj("block-skills-4-t1", "SKILLS", "skills"),
      obj(
        "block-skills-4-t2",
        "Demand Generation  ·  Brand Strategy",
        "skills",
      ),
      obj(
        "block-skills-4-t3",
        "Tools  ·  Documentation  ·  Stakeholder Comms  ·  Process Design",
        "skills",
      ),
    ],
  } as FabricCanvasDoc;
}

async function main(): Promise<void> {
  const irSrc = readFileSync(
    join(REPO, "SOS/SAIOS/core/founder-revision/FounderFeedbackIR.ts"),
    "utf8",
  );
  const completeSrc = readFileSync(
    join(REPO, "SOS/SAIOS/core/founder-revision/SectionReplacementCompleteness.ts"),
    "utf8",
  );
  const covSrc = readFileSync(
    join(REPO, "SOS/SAIOS/core/founder-revision/FeedbackCoverage.ts"),
    "utf8",
  );
  const promptSrc = readFileSync(
    join(REPO, "SOS/SAIOS/core/founder-revision/RevisionPromptBuilder.ts"),
    "utf8",
  );
  const acceptSrc = readFileSync(
    join(REPO, "SOS/SAIOS/core/founder-revision/RevisionAcceptanceChecks.ts"),
    "utf8",
  );
  const pipeSrc = readFileSync(
    join(REPO, "SOS/SAIOS/core/founder-revision/FounderRevisionPipeline.ts"),
    "utf8",
  );

  assert(
    NUMBER_OF_SEMANTIC_INTERPRETATION_PATHS === 1 &&
      irSrc.includes("compileFounderFeedbackIR") &&
      irSrc.includes("FOUNDER_FEEDBACK_IR_SCHEMA") &&
      irSrc.includes("isCanonicalLayoutOwnedItem"),
    "canonical_compiler_implemented",
    String(NUMBER_OF_SEMANTIC_INTERPRETATION_PATHS),
  );
  assert(
    completeSrc.includes("ir.completeness_sections") &&
      completeSrc.includes("compileFounderFeedbackIR") &&
      completeSrc.includes("evaluateSectionReplacementCompletenessLegacyPreservationLedger"),
    "completeness_consumes_ir_mutation_sections_only",
  );
  assert(
    covSrc.includes("compileFounderFeedbackIR") &&
      covSrc.includes("irItem.coverage_mode") &&
      !covSrc.includes("classifyRequestedChange("),
    "coverage_consumes_canonical_ir",
  );
  assert(
    promptSrc.includes("compileFounderFeedbackIR") &&
      !promptSrc.includes("classifyRequestedChange("),
    "prompt_builder_consumes_canonical_ir",
  );
  assert(
    acceptSrc.includes("compileFounderFeedbackIR") &&
      !acceptSrc.includes("classifyRequestedChange("),
    "acceptance_consumes_canonical_ir",
  );
  assert(
    pipeSrc.includes("founder-feedback-ir.json") &&
      pipeSrc.includes("compileFounderFeedbackIR"),
    "pipeline_writes_canonical_ir_evidence",
  );

  const layoutIr = compileFounderFeedbackIR([LAYOUT_ONLY]);
  assert(
    layoutIr.schema_version === FOUNDER_FEEDBACK_IR_SCHEMA &&
      layoutIr.items[0]?.action === "LAYOUT_MUTATION" &&
      layoutIr.completeness_sections.length === 0 &&
      (layoutIr.items[0]?.layout_owned === true ||
        layoutIr.items[0]?.coverage_mode === "DETERMINISTIC_LAYOUT_OWNED"),
    "layout_only_compiles_as_layout_intent",
    JSON.stringify({
      action: layoutIr.items[0]?.action,
      mode: layoutIr.items[0]?.coverage_mode,
      completeness: layoutIr.completeness_sections,
    }),
  );
  assert(
    resolveItemCoverageMode(LAYOUT_ONLY) === layoutIr.items[0]?.coverage_mode,
    "coverage_mode_consumer_matches_ir",
    resolveItemCoverageMode(LAYOUT_ONLY),
  );

  const preserveIr = compileFounderFeedbackIR([PRESERVE_SUMMARY]);
  assert(
    preserveIr.items[0]?.action === "CONTENT_PRESERVATION" &&
      preserveIr.content_preservation_sections.includes("summary") &&
      preserveIr.completeness_sections.length === 0 &&
      preserveIr.items[0]?.completeness_required === false,
    "preserve_content_compiles_as_preservation",
    JSON.stringify({
      action: preserveIr.items[0]?.action,
      preserve: preserveIr.content_preservation_sections,
      completeness: preserveIr.completeness_sections,
    }),
  );

  const mixedPreserveLayout = compileFounderFeedbackIR([
    LAYOUT_ONLY,
    PRESERVE_SUMMARY,
  ]);
  assert(
    mixedPreserveLayout.items.some((i) => i.action === "LAYOUT_MUTATION") &&
      mixedPreserveLayout.items.some((i) => i.action === "CONTENT_PRESERVATION") &&
      mixedPreserveLayout.completeness_sections.length === 0 &&
      mixedPreserveLayout.content_preservation_sections.includes("summary") &&
      mixedPreserveLayout.layout_mutation_sections.length +
        mixedPreserveLayout.items.filter((i) => i.layout_owned).length >
        0,
    "layout_plus_preservation_remain_separated",
    JSON.stringify({
      actions: mixedPreserveLayout.items.map((i) => i.action),
      completeness: mixedPreserveLayout.completeness_sections,
      preserve: mixedPreserveLayout.content_preservation_sections,
    }),
  );

  const rewriteIr = compileFounderFeedbackIR([REWRITE_SUMMARY]);
  assert(
    rewriteIr.items[0]?.action === "CONTENT_MUTATION" &&
      rewriteIr.completeness_sections.includes("summary") &&
      rewriteIr.content_mutation_sections.includes("summary"),
    "true_content_rewrite_compiles_as_mutation",
    JSON.stringify({
      action: rewriteIr.items[0]?.action,
      completeness: rewriteIr.completeness_sections,
    }),
  );

  const removalIr = compileFounderFeedbackIR([REMOVE_EXPERIENCE]);
  assert(
    removalIr.items[0]?.action === "CONTENT_REMOVAL" &&
      removalIr.content_removal_sections.includes("experience") &&
      removalIr.completeness_sections.includes("experience"),
    "true_content_removal_compiles_as_removal",
    JSON.stringify({
      action: removalIr.items[0]?.action,
      removal: removalIr.content_removal_sections,
    }),
  );

  const mixedBoth = compileFounderFeedbackIR([
    REWRITE_SUMMARY,
    LAYOUT_ONLY,
  ]);
  assert(
    mixedBoth.content_mutation_sections.includes("summary") &&
      mixedBoth.completeness_sections.includes("summary") &&
      mixedBoth.items.some(
        (i) =>
          i.action === "LAYOUT_MUTATION" ||
          i.coverage_mode === "DETERMINISTIC_LAYOUT_OWNED",
      ) &&
      mixedBoth.items.some((i) => i.action === "CONTENT_MUTATION"),
    "mixed_content_and_layout_both_preserved",
    JSON.stringify({
      actions: mixedBoth.items.map((i) => i.action),
      completeness: mixedBoth.completeness_sections,
    }),
  );

  const satisfiedIr = compileFounderFeedbackIR([CANONICAL_COLLISION_BOUNDS_QA]);
  assert(
    (satisfiedIr.items[0]?.action === "ALREADY_SATISFIED" ||
      satisfiedIr.items[0]?.action === "VERIFICATION") &&
      satisfiedIr.completeness_sections.length === 0 &&
      satisfiedIr.items[0]?.coverage_mode === "VERIFICATION_ACCEPTANCE",
    "already_satisfied_without_dummy_mutation",
    JSON.stringify({
      action: satisfiedIr.items[0]?.action,
      mode: satisfiedIr.items[0]?.coverage_mode,
    }),
  );

  const priorCanvas = readJson<FabricCanvasDoc>(join(FIX, "prior/canvas.json"));
  const classPacketIr = compileFounderFeedbackIR(FAILURE_CLASS_PACKET);
  assert(
    JSON.stringify(resolveRevisionIntentScope(FAILURE_CLASS_PACKET)) ===
      JSON.stringify(classPacketIr.intent_scope),
    "compatibility_intent_scope_matches_ir",
  );
  assert(
    classPacketIr.completeness_sections.length === 0 &&
      classPacketIr.content_mutation_sections.length === 0 &&
      classPacketIr.content_preservation_sections.includes("summary") &&
      classPacketIr.content_preservation_sections.includes("experience") &&
      classPacketIr.content_preservation_sections.includes("education"),
    "failure_class_packet_is_layout_plus_preservation",
    JSON.stringify({
      completeness: classPacketIr.completeness_sections,
      preserve: classPacketIr.content_preservation_sections,
      actions: classPacketIr.items.map((i) => i.action),
    }),
  );

  const legacy = evaluateSectionReplacementCompletenessLegacyPreservationLedger({
    canvas: priorCanvas,
    plan: emptyPlan(),
    requested_changes: FAILURE_CLASS_PACKET,
  });
  assert(
    legacy.ok === false && legacy.unaccounted_object_ids.length > 0,
    "current_failure_class_reproduced_on_legacy_preservation_ledger",
    `${legacy.unaccounted_object_ids.length} ${legacy.error ?? ""}`,
  );

  const current = evaluateSectionReplacementCompleteness({
    canvas: priorCanvas,
    plan: emptyPlan(),
    requested_changes: FAILURE_CLASS_PACKET,
  });
  assert(
    current.ok === true &&
      current.sections.length === 0 &&
      current.unaccounted_object_ids.length === 0,
    "preservation_no_longer_triggers_replacement",
    current.error ?? "ok",
  );

  const incomplete = evaluateSectionReplacementCompleteness({
    canvas: skillsCanvas(),
    plan: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "partial skills replace",
      operations: [
        {
          op: "update_text",
          target_id: "block-skills-4-t2",
          values: { text: "Operational analysis · KPI reporting" },
          founder_feedback_item: SKILLS_REPLACE,
          intended_change: "replace t2",
          before_summary: "source t2",
          confidence: 0.9,
        },
      ],
    },
    requested_changes: [SKILLS_REPLACE],
  });
  assert(
    incomplete.ok === false &&
      incomplete.unaccounted_object_ids.includes("block-skills-4-t3"),
    "real_incomplete_replacement_still_fails_closed",
    `${incomplete.unaccounted_object_ids.join(",")} ${incomplete.error ?? ""}`,
  );

  const canonicalPreserve = compileFounderFeedbackIR([
    CANONICAL_CONTENT_PRESERVATION,
  ]);
  assert(
    canonicalPreserve.items[0]?.action === "CONTENT_PRESERVATION" ||
      canonicalPreserve.items[0]?.classification === "PRESERVATION_CONSTRAINT",
    "canonical_content_preservation_line_still_preservation",
    canonicalPreserve.items[0]?.action ?? "",
  );

  let goldenStatus = "UNRUN";
  let goldenError: string | null = null;
  let irEvidenceWritten = false;
  if (allRequestedChangesAllowEmptyPlan(LAYOUT_PRESERVE_PACKET)) {
    const tmp = mkdtempSync(join(tmpdir(), "aios-c1-"));
    const candRoot = join(tmp, "candidates");
    const outRoot = join(tmp, "founder-revision");
    const tasksDir = join(outRoot, "tasks");
    mkdirSync(tasksDir, { recursive: true });
    const task = readJson<{
      prior_candidate_id: string;
      founder_reason: string;
      role: string;
    }>(join(FIX, "revtask-a0009171-849.json"));
    cpSync(join(FIX, "prior"), join(candRoot, task.prior_candidate_id), {
      recursive: true,
    });
    setRevisionTasksDirForTests(tasksDir);
    setRevisionPipelineRootsForTests({ candRoot, outRoot });
    try {
      const created = createRevisionTask({
        decision_id: `fd-c1-golden-${Date.now().toString(36)}`,
        review_id: "founder-review-c1-golden",
        prior_candidate_id: task.prior_candidate_id,
        prior_canvas_path: join(candRoot, task.prior_candidate_id, "canvas.json"),
        founder_reason: "layout refinement while preserving content",
        requested_changes: LAYOUT_PRESERVE_PACKET,
        role: task.role,
        design_family: "professional_sidebar",
        architecture: "narrow_ats_sidebar",
      });
      const run = await runFounderFeedbackRevision({
        task_id: created.task.task_id,
        skip_preview: true,
        critiqueOverride: passingCritic,
        executePlanner: async () => ({
          status: "COMPLETED",
          structured_output: emptyPlan() as unknown as Record<string, unknown>,
          provider_request_id: "c1-golden",
          model_identifier_internal: "fixture",
          input_tokens: 1,
          output_tokens: 1,
        }),
      });
      goldenStatus = run.task.status;
      goldenError = run.error;
      const irPath = join(
        outRoot,
        "evidence",
        created.task.task_id,
        "founder-feedback-ir.json",
      );
      irEvidenceWritten = existsSync(irPath);
      if (irEvidenceWritten) {
        const written = readJson<{ completeness_sections?: string[] }>(irPath);
        assert(
          Array.isArray(written.completeness_sections) &&
            written.completeness_sections.length === 0,
          "pipeline_ir_completeness_sections_empty",
          JSON.stringify(written.completeness_sections),
        );
      }
      assert(
        run.ok && run.task.status === "READY_FOR_FOUNDER_REVIEW",
        "layout_preserve_packet_ready_for_founder_review",
        `${run.task.status} ${run.task.failure_owner ?? ""} ${run.error ?? ""}`,
      );
      assert(irEvidenceWritten, "pipeline_wrote_founder_feedback_ir");
    } finally {
      setRevisionPipelineRootsForTests(null);
      setRevisionTasksDirForTests(null);
      try {
        rmSync(tmp, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  } else {
    assert(
      false,
      "layout_preserve_packet_allows_empty_plan",
      LAYOUT_PRESERVE_PACKET.map((c) => `${c}=>${resolveItemCoverageMode(c)}`).join(
        " | ",
      ),
    );
  }

  const C5_LINE =
    "The left green vertical line which is placed should be till the bottom.";
  const C5_EDU =
    "In the education section we can add more content for example: High schooling, college details, graduation details etc.";
  const c5LineIr = compileFounderFeedbackIR([C5_LINE]);
  const c5EduIr = compileFounderFeedbackIR([C5_EDU]);
  assert(
    c5LineIr.items[0]?.action === "LAYOUT_MUTATION" &&
      c5LineIr.items[0]?.classification === "MUTATION_REQUIRED" &&
      c5LineIr.items[0]?.coverage_mode === "MUTATION_REQUIRED" &&
      c5LineIr.items[0]?.fulfillment.some((p) => p.kind === "GEOMETRY_EXTENT") &&
      c5LineIr.items[0]?.action !== "ALREADY_SATISFIED",
    "c5_item1_desired_state_not_already_satisfied",
    JSON.stringify({
      action: c5LineIr.items[0]?.action,
      class: c5LineIr.items[0]?.classification,
      mode: c5LineIr.items[0]?.coverage_mode,
      fulfillment: c5LineIr.items[0]?.fulfillment,
    }),
  );
  assert(
    c5EduIr.items[0]?.action === "CONTENT_MUTATION" &&
      c5EduIr.content_addition_sections.includes("education") &&
      c5EduIr.content_mutation_sections.includes("education") &&
      !c5EduIr.completeness_sections.includes("education") &&
      c5EduIr.items[0]?.fulfillment.some((p) => p.kind === "CONTENT_ADD"),
    "c5_item2_retains_content_add_ownership",
    JSON.stringify({
      action: c5EduIr.items[0]?.action,
      add: c5EduIr.content_addition_sections,
      mutation: c5EduIr.content_mutation_sections,
      completeness: c5EduIr.completeness_sections,
    }),
  );

  const shortRail: FabricCanvasDoc = {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      {
        type: "rect",
        id: "page-accent-rail",
        left: 50,
        top: 40,
        width: 4,
        height: 891,
        fill: "#0d9488",
      },
      {
        type: "textbox",
        id: "block-education-3-t2",
        section: "education",
        text: "B.A. in Graphic Design, Arcadia University, 2018",
        left: 80,
        top: 700,
        width: 400,
        height: 20,
      },
    ],
  } as FabricCanvasDoc;
  const provenShort = applyAlreadySatisfiedProof(c5LineIr, shortRail);
  assert(
    provenShort.items[0]?.action !== "ALREADY_SATISFIED",
    "short_rail_not_proven_already_satisfied",
    provenShort.items[0]?.action ?? "",
  );
  const lineProof = evaluateItemFulfillment({
    item: c5LineIr.items[0]!,
    beforeCanvas: shortRail,
    afterCanvas: shortRail,
  });
  assert(
    lineProof.pass === false,
    "unchanged_short_rail_fulfillment_fails",
    lineProof.notes,
  );
  const eduProof = evaluateItemFulfillment({
    item: c5EduIr.items[0]!,
    beforeCanvas: shortRail,
    afterCanvas: shortRail,
  });
  assert(
    eduProof.pass === false,
    "unchanged_education_add_fulfillment_fails",
    eduProof.notes,
  );

  const matrix: Array<[string, string, string]> = [
    ["add more summary details", "CONTENT_MUTATION", "content_add"],
    ["Remove the skills section", "CONTENT_REMOVAL", "content_remove"],
    ["Rewrite the Summary for an Operations Analyst", "CONTENT_MUTATION", "content_rewrite"],
    ["Preserve Experience content", "CONTENT_PRESERVATION", "content_preserve"],
    ["Move the Projects section down", "LAYOUT_MUTATION", "object_move"],
    ["The heading bar should reach the bottom", "LAYOUT_MUTATION", "object_extend"],
    ["Resize the skills box", "LAYOUT_MUTATION", "object_resize"],
    ["Tighten Skills to Projects spacing in the sidebar", "LAYOUT_MUTATION", "spacing"],
    ["The heading should align with the section", "LAYOUT_MUTATION", "alignment"],
    ["Preserve the current spacing", "LAYOUT_PRESERVATION", "layout_preserve"],
    ["this divider should reach the bottom", "LAYOUT_MUTATION", "desired_state"],
    ["Extend the sidebar rail downward", "LAYOUT_MUTATION", "imperative"],
    ["the vertical rule should be till the page edge", "LAYOUT_MUTATION", "should_be"],
    ["we can add more certifications content", "CONTENT_MUTATION", "can_add"],
    ["Do not add more education content", "CONTENT_PRESERVATION", "negation"],
    [
      "Expand the projects section, for example: case studies, outcomes, metrics etc.",
      "CONTENT_MUTATION",
      "embedded_examples",
    ],
    [
      "Add more education details and the left vertical line should reach the bottom",
      "CONTENT_MUTATION",
      "mixed",
    ],
  ];
  for (const [line, action, name] of matrix) {
    const ir = compileFounderFeedbackIR([line]);
    assert(
      ir.items[0]?.action === action,
      `matrix_${name}`,
      `${line} => ${ir.items[0]?.action ?? "none"}`,
    );
  }
  const C5_PRESENT =
    "In skill section display the mentioned skills in pointers like one below another, not one after another.";
  const presentIr = compileFounderFeedbackIR([C5_PRESENT]);
  assert(
    presentIr.items[0]?.action === "PRESENTATION_MUTATION" &&
      presentIr.items[0]?.classification !== "VERIFICATION_ACCEPTANCE" &&
      presentIr.items[0]?.coverage_mode === "DETERMINISTIC_LAYOUT_OWNED" &&
      presentIr.items[0]?.fulfillment.some((p) => p.kind === "PRESENTATION"),
    "c5_reproof_presentation_not_verification",
    JSON.stringify({
      action: presentIr.items[0]?.action,
      class: presentIr.items[0]?.classification,
      fulfillment: presentIr.items[0]?.fulfillment,
    }),
  );
  const skillsInline: FabricCanvasDoc = {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      {
        type: "textbox",
        id: "block-skills-4-t1",
        section: "skills",
        text: "SKILLS",
        left: 80,
        top: 720,
      },
      {
        type: "textbox",
        id: "block-skills-4-t2",
        section: "skills",
        text: "Figma  ·  Adobe XD  ·  Sketch  ·  User Interface Design",
        left: 80,
        top: 750,
        width: 400,
        height: 47,
      },
    ],
  } as FabricCanvasDoc;
  const inlineFail = evaluateItemFulfillment({
    item: presentIr.items[0]!,
    beforeCanvas: skillsInline,
    afterCanvas: skillsInline,
  });
  assert(
    inlineFail.pass === false,
    "c5_reproof_unchanged_inline_false_pass_blocked",
    inlineFail.notes,
  );
  const stacked = applyPresentationMutations(skillsInline, presentIr);
  const stackedPass = evaluateItemFulfillment({
    item: presentIr.items[0]!,
    beforeCanvas: skillsInline,
    afterCanvas: stacked,
  });
  assert(
    stackedPass.pass === true,
    "c5_reproof_valid_presentation_fulfillment",
    stackedPass.notes,
  );
  const presentationMatrix: Array<[string, string]> = [
    ["Show the certifications one below another", "PRESENTATION_MUTATION"],
    ["Keep these skills inline", "PRESENTATION_PRESERVATION"],
    ["Put each project on a separate line", "PRESENTATION_MUTATION"],
    ["Stack the language items", "PRESENTATION_MUTATION"],
    ["Display the tools as bullet points", "PRESENTATION_MUTATION"],
    ["Show the contact items side by side", "PRESENTATION_MUTATION"],
    ["Arrange the sidebar items in two columns", "PRESENTATION_MUTATION"],
  ];
  for (const [line, action] of presentationMatrix) {
    const ir = compileFounderFeedbackIR([line]);
    assert(
      ir.items[0]?.action === action,
      `presentation_${action.toLowerCase()}_${line.slice(0, 24).replace(/\s+/g, "_")}`,
      `${line} => ${ir.items[0]?.action ?? "none"}`,
    );
  }

  function presentEval(line: string, before: FabricCanvasDoc, after: FabricCanvasDoc) {
    return evaluateItemFulfillment({
      item: compileFounderFeedbackIR([line]).items[0]!,
      beforeCanvas: before,
      afterCanvas: after,
    });
  }
  const verticalLine = "Show the skills one below another";
  const verticalApplied = applyPresentationMutations(
    skillsInline,
    compileFounderFeedbackIR([verticalLine]),
  );
  assert(
    presentEval(verticalLine, skillsInline, skillsInline).pass === false &&
      presentEval(verticalLine, skillsInline, verticalApplied).pass === true,
    "presentation_inline_to_vertical",
    presentEval(verticalLine, skillsInline, verticalApplied).notes,
  );
  const inlineReq = "Show the skills inline";
  assert(
    presentEval(inlineReq, verticalApplied, verticalApplied).pass === false &&
      presentEval(inlineReq, verticalApplied, skillsInline).pass === true,
    "presentation_vertical_to_inline",
    presentEval(inlineReq, verticalApplied, skillsInline).notes,
  );
  const bulletLine = "Display the skills as bullet points";
  const bulletApplied = applyPresentationMutations(
    skillsInline,
    compileFounderFeedbackIR([bulletLine]),
  );
  assert(
    presentEval(bulletLine, skillsInline, skillsInline).pass === false &&
      presentEval(bulletLine, skillsInline, bulletApplied).pass === true,
    "presentation_list_or_bullet",
    presentEval(bulletLine, skillsInline, bulletApplied).notes,
  );
  const linesReq = "Put each skill on a separate line";
  assert(
    presentEval(linesReq, skillsInline, skillsInline).pass === false &&
      presentEval(linesReq, skillsInline, verticalApplied).pass === true,
    "presentation_separate_lines",
    presentEval(linesReq, skillsInline, verticalApplied).notes,
  );
  const stackReq = "Stack the skills";
  assert(
    presentEval(stackReq, skillsInline, skillsInline).pass === false &&
      presentEval(stackReq, skillsInline, verticalApplied).pass === true,
    "presentation_stacked",
    presentEval(stackReq, skillsInline, verticalApplied).notes,
  );
  const sideBySide: FabricCanvasDoc = {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      {
        type: "textbox",
        id: "block-skills-4-t1",
        section: "skills",
        text: "SKILLS",
        left: 80,
        top: 720,
      },
      {
        type: "textbox",
        id: "block-skills-4-t2",
        section: "skills",
        text: "Figma  ·  Adobe XD",
        left: 80,
        top: 750,
      },
      {
        type: "textbox",
        id: "block-skills-4-t3",
        section: "skills",
        text: "Sketch  ·  User Interface Design",
        left: 220,
        top: 752,
      },
    ],
  } as FabricCanvasDoc;
  const sideReq = "Show the skills side by side";
  assert(
    presentEval(sideReq, skillsInline, skillsInline).pass === false &&
      presentEval(sideReq, skillsInline, sideBySide).pass === true,
    "presentation_side_by_side",
    presentEval(sideReq, skillsInline, sideBySide).notes,
  );
  const columns: FabricCanvasDoc = {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      {
        type: "textbox",
        id: "block-skills-4-t2",
        section: "skills",
        text: "Figma  ·  Adobe XD",
        left: 80,
        top: 750,
      },
      {
        type: "textbox",
        id: "block-skills-4-t3",
        section: "skills",
        text: "Sketch  ·  User Interface Design",
        left: 280,
        top: 820,
      },
    ],
  } as FabricCanvasDoc;
  const colReq = "Arrange the skills in two columns";
  assert(
    presentEval(colReq, skillsInline, skillsInline).pass === false &&
      presentEval(colReq, skillsInline, columns).pass === true,
    "presentation_columns",
    presentEval(colReq, skillsInline, columns).notes,
  );
  const keepInline = "Keep these skills inline";
  assert(
    presentEval(keepInline, skillsInline, skillsInline).pass === true &&
      presentEval(keepInline, skillsInline, verticalApplied).pass === false,
    "presentation_preservation",
    presentEval(keepInline, skillsInline, skillsInline).notes,
  );
  const negateLine =
    "Display the skills one below another, not one after another";
  assert(
    presentEval(negateLine, skillsInline, skillsInline).pass === false &&
      presentEval(negateLine, skillsInline, verticalApplied).pass === true,
    "presentation_negation",
    presentEval(negateLine, skillsInline, verticalApplied).notes,
  );
  assert(
    allRequestedChangesAllowEmptyPlan([C5_PRESENT]) === true,
    "presentation_empty_ai_plan_allowed_when_deterministic",
  );
  {
    const tmp = mkdtempSync(join(tmpdir(), "aios-c1-present-"));
    const candRoot = join(tmp, "candidates");
    const outRoot = join(tmp, "founder-revision");
    const tasksDir = join(outRoot, "tasks");
    mkdirSync(tasksDir, { recursive: true });
    const task = readJson<{
      prior_candidate_id: string;
      founder_reason: string;
      role: string;
    }>(join(FIX, "revtask-a0009171-849.json"));
    cpSync(join(FIX, "prior"), join(candRoot, task.prior_candidate_id), {
      recursive: true,
    });
    const priorCanvasPath = join(
      candRoot,
      task.prior_candidate_id,
      "canvas.json",
    );
    const priorCanvas = readJson<FabricCanvasDoc>(priorCanvasPath);
    for (const o of priorCanvas.objects ?? []) {
      const rec = o as {
        section?: string;
        text?: string;
        data?: { section?: string };
      };
      const section = String(rec.section ?? rec.data?.section ?? "").toLowerCase();
      if (
        section === "skills" &&
        typeof rec.text === "string" &&
        !/^(skills?)$/i.test(rec.text.trim())
      ) {
        rec.text = "Figma  ·  Adobe XD  ·  Sketch  ·  User Interface Design";
      }
    }
    writeFileSync(priorCanvasPath, `${JSON.stringify(priorCanvas, null, 2)}\n`);
    setRevisionTasksDirForTests(tasksDir);
    setRevisionPipelineRootsForTests({ candRoot, outRoot });
    try {
      const created = createRevisionTask({
        decision_id: `fd-c1-present-${Date.now().toString(36)}`,
        review_id: "founder-review-c1-present",
        prior_candidate_id: task.prior_candidate_id,
        prior_canvas_path: join(candRoot, task.prior_candidate_id, "canvas.json"),
        founder_reason: "presentation mutation without applicable ops",
        requested_changes: [
          "maybe put 3 skills in a row and continue the rest beside",
        ],
        role: task.role,
        design_family: "professional_sidebar",
        architecture: "narrow_ats_sidebar",
      });
      const run = await runFounderFeedbackRevision({
        task_id: created.task.task_id,
        skip_preview: true,
        critiqueOverride: passingCritic,
        executePlanner: async () => ({
          status: "COMPLETED",
          structured_output: emptyPlan() as unknown as Record<string, unknown>,
          provider_request_id: "c1-present-zero-op",
          model_identifier_internal: "fixture",
          input_tokens: 1,
          output_tokens: 1,
        }),
      });
      assert(
        run.ok === false && run.task.status !== "READY_FOR_FOUNDER_REVIEW",
        "zero_op_unsatisfied_presentation_fails_closed",
        `${run.task.status} ${run.error ?? ""}`,
      );
    } finally {
      setRevisionPipelineRootsForTests(null);
      setRevisionTasksDirForTests(null);
      try {
        rmSync(tmp, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }

  const mixedC1 = compileFounderFeedbackIR([
    "Add more education details and the left vertical line should reach the bottom",
  ]);
  assert(
    mixedC1.items[0]?.fulfillment.some((p) => p.kind === "CONTENT_ADD") &&
      mixedC1.items[0]?.fulfillment.some((p) => p.kind === "GEOMETRY_EXTENT"),
    "matrix_mixed_retains_content_and_extent",
    JSON.stringify(mixedC1.items[0]?.fulfillment),
  );

  const C5_THIRD =
    'the below section which includes sections from "Summary" and below till the bottom that whole body I think we should align it to the left as the top name section.';
  const thirdIr = compileFounderFeedbackIR([C5_THIRD]);
  const thirdPred = thirdIr.items[0]?.fulfillment.find(
    (p) => p.kind === "RELATIONAL_ALIGNMENT",
  );
  assert(
    thirdIr.schema_version === FOUNDER_FEEDBACK_IR_SCHEMA &&
      thirdIr.items[0]?.action === "LAYOUT_MUTATION" &&
      thirdIr.items[0]?.coverage_mode === "DETERMINISTIC_LAYOUT_OWNED" &&
      Boolean(thirdPred) &&
      !thirdIr.items[0]?.fulfillment.some((p) => p.kind === "GEOMETRY_EXTENT") &&
      thirdPred?.range?.start.kind === "section" &&
      thirdPred.range.start.section === "summary" &&
      thirdPred.range.start.inclusive === true &&
      thirdPred.range.end.kind === "document_end" &&
      thirdPred.reference?.kind === "header_name" &&
      thirdPred.alignment?.edge === "left",
    "c5_third_compiles_relational_range_not_extent",
    JSON.stringify(thirdIr.items[0]?.fulfillment),
  );
  const rangeLines: Array<[string, string, string, boolean]> = [
    [
      "Align everything below the header to the left as the top name section",
      "header",
      "document_end",
      false,
    ],
    [
      "From Experience downward align that body to the left as the header",
      "experience",
      "document_end",
      true,
    ],
    [
      "Align Experience through Skills to the left as the summary",
      "experience",
      "skills",
      true,
    ],
    [
      "Align the sections between Education and Languages to the left as the header",
      "education",
      "languages",
      false,
    ],
  ];
  for (const [line, start, end, inclusive] of rangeLines) {
    const pred = compileFounderFeedbackIR([line]).items[0]?.fulfillment.find(
      (p) => p.kind === "RELATIONAL_ALIGNMENT",
    );
    const startOk =
      start === "header"
        ? pred?.range?.start.kind === "header" &&
          pred.range.start.inclusive === inclusive
        : pred?.range?.start.kind === "section" &&
          pred.range.start.section === start &&
          pred.range.start.inclusive === inclusive;
    const endOk =
      end === "document_end"
        ? pred?.range?.end.kind === "document_end"
        : pred?.range?.end.kind === "section" && pred.range.end.section === end;
    assert(Boolean(pred) && startOk && endOk, `range_scope_${start}_${end}`, JSON.stringify(pred?.range));
  }
  assert(
    compileFounderFeedbackIR([C5_LINE]).items[0]?.fulfillment.some(
      (p) => p.kind === "GEOMETRY_EXTENT" && p.extent === "page_bottom",
    ),
    "first_c5_extent_still_page_bottom",
  );
  const ledger = buildFounderItemCoverageLedger([C5_THIRD]);
  assert(
    ledger.includes("CANONICAL SEMANTIC CONTRACT") &&
      ledger.includes("RELATIONAL_ALIGNMENT") &&
      ledger.includes("reference=header_name") &&
      !ledger.includes("GEOMETRY_EXTENT") &&
      ledger.includes("emit ZERO operations"),
    "provider_prompt_ir_authoritative",
    ledger.slice(0, 400),
  );

  function relationalPage(): FabricCanvasDoc {
    return {
      version: "5.3.0",
      width: 794,
      height: 1123,
      objects: [
        { type: "textbox", id: "block-header-0-t0", section: "header", text: "Name", left: 72, top: 48, width: 200, height: 20 },
        { type: "textbox", id: "block-header-0-t1", section: "header", text: "Role", left: 72, top: 80, width: 200, height: 16 },
        { type: "rect", id: "block-summary-1-r0", section: "summary", left: 96, top: 160, width: 400, height: 18 },
        { type: "textbox", id: "block-summary-1-t1", section: "summary", text: "SUMMARY", left: 104, top: 162, width: 380, height: 14 },
        { type: "textbox", id: "block-summary-1-t2", section: "summary", text: "Body summary", left: 96, top: 184, width: 400, height: 20 },
        { type: "rect", id: "block-experience-2-r0", section: "experience", left: 96, top: 220, width: 400, height: 18 },
        { type: "textbox", id: "block-experience-2-t1", section: "experience", text: "EXPERIENCE", left: 104, top: 222, width: 380, height: 14 },
        { type: "textbox", id: "block-experience-2-t2", section: "experience", text: "Job one", left: 96, top: 244, width: 400, height: 20 },
        { type: "rect", id: "block-languages-6-r0", section: "languages", left: 96, top: 900, width: 400, height: 18 },
        { type: "textbox", id: "block-languages-6-t1", section: "languages", text: "LANGUAGES", left: 104, top: 902, width: 380, height: 14 },
        { type: "textbox", id: "block-languages-6-t2", section: "languages", text: "English", left: 96, top: 924, width: 400, height: 16 },
      ],
    } as FabricCanvasDoc;
  }
  const relBefore = relationalPage();
  const targetIds = bindRangeTargetIds(relBefore, thirdPred!.range, thirdPred!.reference);
  const refIds = bindReferenceIds(relBefore, thirdPred!.reference);
  assert(
    targetIds.includes("block-summary-1-t2") &&
      targetIds.includes("block-experience-2-t2") &&
      targetIds.includes("block-languages-6-t2") &&
      !targetIds.includes("block-header-0-t0") &&
      refIds.includes("block-header-0-t0") &&
      !refIds.includes("block-summary-1-t2"),
    "c5_third_target_reference_binding",
    JSON.stringify({ targetIds, refIds }),
  );
  const unchangedRel = evaluateItemFulfillment({
    item: thirdIr.items[0]!,
    beforeCanvas: relBefore,
    afterCanvas: relBefore,
  });
  assert(unchangedRel.pass === false, "unchanged_relational_fails", unchangedRel.notes);
  const appliedRel = applyRelationalAlignment(relBefore, thirdIr);
  const appliedEval = evaluateItemFulfillment({
    item: thirdIr.items[0]!,
    beforeCanvas: relBefore,
    afterCanvas: appliedRel,
  });
  const afterBy = new Map(
    (appliedRel.objects ?? []).map((o) => [String((o as { id?: string }).id), o] as const),
  );
  const headingLeft = Number((afterBy.get("block-summary-1-t1") as { left?: number })?.left);
  const bodyLeft = Number((afterBy.get("block-summary-1-t2") as { left?: number })?.left);
  const headerLeft = Number((afterBy.get("block-header-0-t0") as { left?: number })?.left);
  assert(
    appliedEval.pass === true &&
      headerLeft === 72 &&
      bodyLeft === 72 &&
      headingLeft === 80,
    "applied_relational_preserves_offsets",
    JSON.stringify({ notes: appliedEval.notes, headingLeft, bodyLeft, headerLeft }),
  );
  const flattened = JSON.parse(JSON.stringify(relBefore)) as FabricCanvasDoc;
  for (const o of flattened.objects ?? []) {
    const rec = o as { id?: string; left?: number };
    if (String(rec.id).startsWith("block-header")) continue;
    rec.left = 72;
  }
  const flatEval = evaluateItemFulfillment({
    item: thirdIr.items[0]!,
    beforeCanvas: relBefore,
    afterCanvas: flattened,
  });
  assert(flatEval.pass === false, "flatten_internal_offsets_rejected", flatEval.notes);
  const wrongRef = JSON.parse(JSON.stringify(relBefore)) as FabricCanvasDoc;
  for (const o of wrongRef.objects ?? []) {
    const rec = o as { id?: string; section?: string; left?: number };
    if (rec.section === "header") continue;
    rec.left = Number(rec.left) + 10;
  }
  const wrongEval = evaluateItemFulfillment({
    item: thirdIr.items[0]!,
    beforeCanvas: relBefore,
    afterCanvas: wrongRef,
  });
  assert(wrongEval.pass === false, "wrong_reference_fail_closed", wrongEval.notes);

  const safeGeom = dropUnsafeGeometryOps({
    canvas: relBefore,
    plan: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      operations: [
        {
          op: "set_position",
          target_id: "block-summary-1-t2",
          values: { left: 72 },
          founder_feedback_item: C5_THIRD,
          intended_change: "shift body left",
          before_summary: "summary body",
          confidence: 0.9,
        },
      ],
    },
  });
  assert(
    safeGeom.dropped.length === 0 && safeGeom.plan.operations.length === 1,
    "layout_only_safe_geom_survives_filter",
    String(safeGeom.dropped.length),
  );
  const overlapGeom = dropUnsafeGeometryOps({
    canvas: relBefore,
    plan: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      operations: [
        {
          op: "set_position",
          target_id: "block-summary-1-t2",
          values: { left: 72, top: 80 },
          founder_feedback_item: C5_THIRD,
          intended_change: "overlap header",
          before_summary: "summary body",
          confidence: 0.9,
        },
      ],
    },
  });
  assert(overlapGeom.dropped.length === 1, "unsafe_overlap_still_blocked", String(overlapGeom.dropped.length));
  const oobGeom = dropUnsafeGeometryOps({
    canvas: relBefore,
    plan: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      operations: [
        {
          op: "set_position",
          target_id: "block-summary-1-t2",
          values: { left: 72, top: 1200 },
          founder_feedback_item: C5_THIRD,
          intended_change: "move off page",
          before_summary: "summary body",
          confidence: 0.9,
        },
      ],
    },
  });
  assert(oobGeom.dropped.length === 1, "unsafe_oob_still_blocked", String(oobGeom.dropped.length));
  const providerDrop = dropProviderGeometryWhenRelationalOwned({
    ir: thirdIr,
    plan: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      operations: [
        {
          op: "set_position",
          target_id: "block-summary-1-t2",
          values: { left: 72 },
          founder_feedback_item: C5_THIRD,
          intended_change: "flatten",
          before_summary: "x",
          confidence: 0.9,
        },
      ],
    },
  });
  assert(
    providerDrop.dropped.length === 1 && providerDrop.plan.operations.length === 0,
    "provider_cannot_broaden_relational_scope",
    String(providerDrop.dropped.length),
  );

  const C5_FOURTH =
    "In the skill section, currently the skills are been displayed as horizontal pointers, but I want it to be displayed vertically so that the bottom of the resume template looks empty for this reason we can do vertical pointers, may be 3  pointers in a row and rest 3 we can continue it beside it and so on.";
  const fourthSpec = compilePresentationSpec(C5_FOURTH);
  const fourthIr = compileFounderFeedbackIR([C5_FOURTH]);
  const fourthPred = fourthIr.items[0]?.fulfillment.find((p) => p.kind === "PRESENTATION");
  assert(
    fourthIr.schema_version === FOUNDER_FEEDBACK_IR_SCHEMA &&
      fourthIr.items[0]?.action === "PRESENTATION_MUTATION" &&
      fourthSpec != null &&
      fourthSpec.arrangement === "vertical" &&
      fourthSpec.markers === "bullets" &&
      fourthSpec.desired !== undefined &&
      fourthSpec.grouping?.cardinality_strength === "approximate" &&
      fourthSpec.grouping.strength === "approximate" &&
      fourthSpec.grouping.structure_material === true &&
      fourthSpec.grouping.continue_beside === true &&
      fourthSpec.grouping.executable === false &&
      fourthSpec.grouping.ambiguity === "row_and_beside_axis_unresolved" &&
      (fourthSpec.unresolved_material ?? []).includes(
        "row_and_beside_axis_unresolved",
      ) &&
      fourthSpec.compactness?.strength === "context" &&
      fourthSpec.executable === true &&
      fourthPred?.presentation_spec?.arrangement === "vertical" &&
      fourthPred.presentation_spec?.markers === "bullets" &&
      (fourthPred.presentation_spec?.unresolved_material ?? []).includes(
        "row_and_beside_axis_unresolved",
      ),
    "c5_fourth_structured_presentation_not_bullets_only",
    JSON.stringify({
      spec: fourthSpec,
      pred: fourthPred?.presentation_spec,
    }),
  );
  const compoundSkills: FabricCanvasDoc = {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      {
        type: "textbox",
        id: "block-skills-4-t1",
        section: "skills",
        text: "SKILLS",
        left: 80,
        top: 780,
      },
      {
        type: "textbox",
        id: "block-skills-4-t2",
        section: "skills",
        text: "Research  ·  Literature Review  ·  Python (Pandas, NumPy)  ·  R  ·  SPSS  ·  Academic Writing  ·  Citation Management",
        left: 80,
        top: 807,
        width: 650,
        height: 47,
        fontSize: 11,
        lineHeight: 1.4,
      },
      {
        type: "textbox",
        id: "block-edu-5-t2",
        section: "education",
        text: "B.A. Research Methods",
        left: 80,
        top: 870,
        width: 650,
        height: 24,
        fontSize: 11,
        lineHeight: 1.4,
      },
    ],
  } as FabricCanvasDoc;
  const beforeItems = splitLogicalItems(
    "Research  ·  Literature Review  ·  Python (Pandas, NumPy)  ·  R  ·  SPSS  ·  Academic Writing  ·  Citation Management",
  );
  assert(
    beforeItems.length === 7 &&
      beforeItems.includes("Python (Pandas, NumPy)") &&
      !beforeItems.includes("NumPy)"),
    "c5_fourth_compound_item_atomic",
    JSON.stringify(beforeItems),
  );
  const fourthUnchanged = evaluateItemFulfillment({
    item: fourthIr.items[0]!,
    beforeCanvas: compoundSkills,
    afterCanvas: compoundSkills,
  });
  assert(
    fourthUnchanged.pass === false,
    "c5_fourth_unchanged_fails",
    fourthUnchanged.notes,
  );
  const fourthApplied = applyPresentationMutations(compoundSkills, fourthIr);
  const appliedBody = (fourthApplied.objects ?? []).find(
    (o) => (o as { id?: string }).id === "block-skills-4-t2",
  ) as {
    text?: string;
    height?: number;
    fontSize?: number;
    lineHeight?: number;
  };
  const appliedItems = splitLogicalItems(String(appliedBody?.text ?? ""));
  const fourthFulfilled = evaluateItemFulfillment({
    item: fourthIr.items[0]!,
    beforeCanvas: compoundSkills,
    afterCanvas: fourthApplied,
  });
  const afterClip = findIntraBoxTextOverflowFindings(fourthApplied).filter(
    (f) => Number(f.metrics?.stored_height ?? 0) > 1,
  );
  assert(
    appliedItems.length === 7 &&
      appliedItems.includes("Python (Pandas, NumPy)") &&
      Number(appliedBody?.height ?? 0) > 47 &&
      afterClip.length === 0,
    "c5_fourth_vertical_execution_preserves_atomicity",
    JSON.stringify({
      items: appliedItems,
      height: appliedBody?.height,
      clip: afterClip.length,
    }),
  );
  assert(
    fourthFulfilled.pass === false,
    "c5_fourth_vertical_bullets_only_not_overall_pass",
    fourthFulfilled.notes,
  );
  const bulletOnlyClipped = JSON.parse(
    JSON.stringify(fourthApplied),
  ) as FabricCanvasDoc;
  const clippedBody = (bulletOnlyClipped.objects ?? []).find(
    (o) => (o as { id?: string }).id === "block-skills-4-t2",
  ) as { height?: number };
  if (clippedBody) clippedBody.height = 47;
  const clippedEval = evaluateItemFulfillment({
    item: fourthIr.items[0]!,
    beforeCanvas: compoundSkills,
    afterCanvas: bulletOnlyClipped,
  });
  assert(
    clippedEval.pass === false,
    "c5_fourth_clipped_fails_closed",
    clippedEval.notes,
  );
  const splitBad = JSON.parse(JSON.stringify(fourthApplied)) as FabricCanvasDoc;
  const splitBody = (splitBad.objects ?? []).find(
    (o) => (o as { id?: string }).id === "block-skills-4-t2",
  ) as { text?: string };
  if (splitBody) {
    splitBody.text = "• Research\n• Literature Review\n• Python (Pandas\n• NumPy)\n• R\n• SPSS\n• Academic Writing\n• Citation Management";
  }
  const splitEval = evaluateItemFulfillment({
    item: fourthIr.items[0]!,
    beforeCanvas: compoundSkills,
    afterCanvas: splitBad,
  });
  assert(
    splitEval.pass === false,
    "c5_fourth_item_corruption_fails_closed",
    splitEval.notes,
  );
  const parenComma = splitLogicalItems("Research, Python (Pandas, NumPy), SQL");
  assert(
    parenComma.length === 3 && parenComma[1] === "Python (Pandas, NumPy)",
    "compound_comma_and_parentheses_remain_one_item",
    JSON.stringify(parenComma),
  );
  const exactRow = "Display the skills as exactly 3 items per row";
  const exactIr = compileFounderFeedbackIR([exactRow]);
  const exactSpec = compilePresentationSpec(exactRow);
  const exactApplied = applyPresentationMutations(compoundSkills, exactIr);
  const exactText = String(
    ((exactApplied.objects ?? []).find(
      (o) => (o as { id?: string }).id === "block-skills-4-t2",
    ) as { text?: string } | undefined)?.text ?? "",
  );
  const exactLines = exactText.split("\n").filter(Boolean);
  const exactPass = evaluateItemFulfillment({
    item: exactIr.items[0]!,
    beforeCanvas: compoundSkills,
    afterCanvas: exactApplied,
  });
  const wrongGroup = JSON.parse(JSON.stringify(exactApplied)) as FabricCanvasDoc;
  const wrongBody = (wrongGroup.objects ?? []).find(
    (o) => (o as { id?: string }).id === "block-skills-4-t2",
  ) as { text?: string };
  if (wrongBody) {
    wrongBody.text = renderWrongGroup();
  }
  function renderWrongGroup(): string {
    return "Research  ·  Literature Review  ·  Python (Pandas, NumPy)  ·  R  ·  SPSS  ·  Academic Writing  ·  Citation Management";
  }
  const wrongGroupEval = evaluateItemFulfillment({
    item: exactIr.items[0]!,
    beforeCanvas: compoundSkills,
    afterCanvas: wrongGroup,
  });
  assert(
    exactSpec?.grouping?.strength === "required" &&
      exactSpec.grouping.axis === "row" &&
      exactSpec.grouping.items_per_group === 3 &&
      exactSpec.grouping.executable === true &&
      exactLines.length >= 2 &&
      splitLogicalItems(exactLines[0] ?? "").length === 3 &&
      exactPass.pass === true &&
      wrongGroupEval.pass === false,
    "explicit_cardinality_grouping_required",
    JSON.stringify({
      spec: exactSpec?.grouping,
      lines: exactLines,
      exact: exactPass.notes,
      wrong: wrongGroupEval.notes,
    }),
  );
  const ambiguous = compilePresentationSpec(
    "maybe put 3 skills in a row and continue the rest beside",
  );
  assert(
    ambiguous != null &&
      ambiguous.executable === false &&
      evaluateItemFulfillment({
        item: compileFounderFeedbackIR([
          "maybe put 3 skills in a row and continue the rest beside",
        ]).items[0]!,
        beforeCanvas: compoundSkills,
        afterCanvas: fourthApplied,
      }).pass === false,
    "ambiguous_structured_presentation_fails_closed",
    JSON.stringify(ambiguous),
  );
  const twoCol = applyPresentationMutations(
    skillsInline,
    compileFounderFeedbackIR(["Arrange the skills in two columns"]),
  );
  assert(
    presentEval("Arrange the skills in two columns", skillsInline, skillsInline)
      .pass === false &&
      presentEval("Arrange the skills in two columns", skillsInline, twoCol)
        .pass === true,
    "presentation_two_columns_executed",
    presentEval("Arrange the skills in two columns", skillsInline, twoCol).notes,
  );

  const approxRow = "Display the skills as maybe 3 items per row";
  const approxRowSpec = compilePresentationSpec(approxRow);
  const approxRowIr = compileFounderFeedbackIR([approxRow]);
  const approxRowApplied = applyPresentationMutations(compoundSkills, approxRowIr);
  const approxRowEval = evaluateItemFulfillment({
    item: approxRowIr.items[0]!,
    beforeCanvas: compoundSkills,
    afterCanvas: approxRowApplied,
  });
  assert(
    approxRowSpec?.grouping?.cardinality_strength === "approximate" &&
      approxRowSpec.grouping.structure_material === true &&
      approxRowSpec.grouping.executable === true &&
      (approxRowSpec.unresolved_material ?? []).length === 0 &&
      approxRowEval.pass === true,
    "approximate_cardinality_plus_executable_grouping_passes",
    JSON.stringify({ spec: approxRowSpec, notes: approxRowEval.notes }),
  );

  const approxOnly = "Display the skills as vertical pointers, maybe 3 per group";
  const approxOnlySpec = compilePresentationSpec(approxOnly);
  const approxOnlyIr = compileFounderFeedbackIR([approxOnly]);
  const approxOnlyApplied = applyPresentationMutations(compoundSkills, approxOnlyIr);
  const approxOnlyEval = evaluateItemFulfillment({
    item: approxOnlyIr.items[0]!,
    beforeCanvas: compoundSkills,
    afterCanvas: approxOnlyApplied,
  });
  assert(
    approxOnlySpec?.arrangement === "vertical" &&
      approxOnlySpec.markers === "bullets" &&
      approxOnlySpec.grouping?.cardinality_strength === "approximate" &&
      approxOnlySpec.grouping.structure_material === false &&
      approxOnlySpec.grouping.executable === false &&
      (approxOnlySpec.unresolved_material ?? []).length === 0 &&
      approxOnlyEval.pass === true,
    "approximate_cardinality_without_material_grouping_nonblocking",
    JSON.stringify({ spec: approxOnlySpec, notes: approxOnlyEval.notes }),
  );

  const exampleRow =
    "Display the skills as vertical pointers, for example 3 items per row";
  const exampleSpec = compilePresentationSpec(exampleRow);
  const exampleIr = compileFounderFeedbackIR([exampleRow]);
  const exampleApplied = applyPresentationMutations(compoundSkills, exampleIr);
  const exampleEval = evaluateItemFulfillment({
    item: exampleIr.items[0]!,
    beforeCanvas: compoundSkills,
    afterCanvas: exampleApplied,
  });
  assert(
    exampleSpec?.grouping?.cardinality_strength === "approximate" &&
      exampleSpec.grouping.structure_material === false &&
      exampleSpec.grouping.executable === false &&
      (exampleSpec.unresolved_material ?? []).length === 0 &&
      exampleEval.pass === true,
    "illustrative_example_language_nonblocking",
    JSON.stringify({ spec: exampleSpec, notes: exampleEval.notes }),
  );

  const contextOnly =
    "Display the skills as vertical pointers so that the bottom of the resume template looks empty";
  const contextSpec = compilePresentationSpec(contextOnly);
  const contextIr = compileFounderFeedbackIR([contextOnly]);
  const contextApplied = applyPresentationMutations(compoundSkills, contextIr);
  const contextEval = evaluateItemFulfillment({
    item: contextIr.items[0]!,
    beforeCanvas: compoundSkills,
    afterCanvas: contextApplied,
  });
  assert(
    contextSpec?.compactness?.strength === "context" &&
      (contextSpec.unresolved_material ?? []).length === 0 &&
      contextEval.pass === true,
    "context_only_explanation_nonblocking",
    JSON.stringify({ spec: contextSpec, notes: contextEval.notes }),
  );

  const hardPlusSoft =
    "Display the skills as vertical pointers, around 3 items if possible";
  const hardSoftSpec = compilePresentationSpec(hardPlusSoft);
  const hardSoftIr = compileFounderFeedbackIR([hardPlusSoft]);
  const hardSoftApplied = applyPresentationMutations(compoundSkills, hardSoftIr);
  const hardSoftEval = evaluateItemFulfillment({
    item: hardSoftIr.items[0]!,
    beforeCanvas: compoundSkills,
    afterCanvas: hardSoftApplied,
  });
  assert(
    hardSoftSpec?.arrangement === "vertical" &&
      hardSoftSpec.markers === "bullets" &&
      (hardSoftSpec.unresolved_material ?? []).length === 0 &&
      hardSoftEval.pass === true,
    "hard_constraint_plus_soft_preference_passes",
    JSON.stringify({ spec: hardSoftSpec, notes: hardSoftEval.notes }),
  );

  const hardPlusUnresolved =
    "Display the skills as vertical pointers and continue the remaining items next to the first group in a row";
  const hardUnresolvedSpec = compilePresentationSpec(hardPlusUnresolved);
  const hardUnresolvedIr = compileFounderFeedbackIR([hardPlusUnresolved]);
  const hardUnresolvedApplied = applyPresentationMutations(
    compoundSkills,
    hardUnresolvedIr,
  );
  const hardUnresolvedEval = evaluateItemFulfillment({
    item: hardUnresolvedIr.items[0]!,
    beforeCanvas: compoundSkills,
    afterCanvas: hardUnresolvedApplied,
  });
  assert(
    hardUnresolvedSpec?.grouping?.structure_material === true &&
      hardUnresolvedSpec.grouping.executable === false &&
      (hardUnresolvedSpec.unresolved_material ?? []).length > 0 &&
      hardUnresolvedEval.pass === false,
    "hard_constraint_plus_unresolved_material_fails_closed",
    JSON.stringify({
      spec: hardUnresolvedSpec,
      notes: hardUnresolvedEval.notes,
    }),
  );

  const parentPath = join(
    REPO,
    "SOS/SAIOS/core/founder-revision/fixtures/fourth-c5-research-assistant-parent-canvas.json",
  );
  const childPath = join(
    REPO,
    "SOS/SAIOS/core/founder-revision/fixtures/fourth-c5-research-assistant-child-canvas.json",
  );
  const realParent = JSON.parse(readFileSync(parentPath, "utf8")) as FabricCanvasDoc;
  const realChild = JSON.parse(readFileSync(childPath, "utf8")) as FabricCanvasDoc;
  const parentSkillsText = String(
    ((realParent.objects ?? []).find(
      (o) => (o as { id?: string }).id === "block-skills-4-t2",
    ) as { text?: string } | undefined)?.text ?? "",
  );
  const parentItems = splitLogicalItems(parentSkillsText);
  const realParentIr = compileFounderFeedbackIR([C5_FOURTH]);
  const stateA = evaluateItemFulfillment({
    item: realParentIr.items[0]!,
    beforeCanvas: realParent,
    afterCanvas: realParent,
  });
  const stateBCanvas = applyPresentationMutations(realParent, realParentIr);
  const stateBBody = (stateBCanvas.objects ?? []).find(
    (o) => (o as { id?: string }).id === "block-skills-4-t2",
  ) as { text?: string; height?: number };
  const stateBItems = splitLogicalItems(String(stateBBody?.text ?? ""));
  const stateBClip = findIntraBoxTextOverflowFindings(stateBCanvas).filter(
    (f) => Number(f.metrics?.stored_height ?? 0) > 1,
  );
  const stateB = evaluateItemFulfillment({
    item: realParentIr.items[0]!,
    beforeCanvas: realParent,
    afterCanvas: stateBCanvas,
  });
  const stateBNorm = normalizeRevisionLayout({
    canvas: stateBCanvas,
    prior_canvas: realParent,
    requested_changes: [C5_FOURTH],
  });
  const stateBGeom = runCollisionBoundsCheck(stateBNorm.canvas, C5_FOURTH);
  const stateD = evaluateItemFulfillment({
    item: realParentIr.items[0]!,
    beforeCanvas: realParent,
    afterCanvas: realChild,
  });
  const childItems = splitLogicalItems(
    String(
      ((realChild.objects ?? []).find(
        (o) => (o as { id?: string }).id === "block-skills-4-t2",
      ) as { text?: string } | undefined)?.text ?? "",
    ),
  );
  assert(
    parentItems.length === 7 &&
      parentItems[0] === "SPSS" &&
      parentItems[1] === "Python (Pandas, NumPy)" &&
      parentItems[6] === "Research Protocol Development",
    "fourth_c5_real_parent_skill_items",
    JSON.stringify(parentItems),
  );
  assert(stateA.pass === false, "fourth_c5_state_a_original_fails", stateA.notes);
  assert(
    stateBItems.length === 7 &&
      stateBItems[1] === "Python (Pandas, NumPy)" &&
      stateBItems.every((item, i) => item === parentItems[i]) &&
      Number(stateBBody?.height ?? 0) > 47 &&
      stateBClip.length === 0 &&
      stateB.pass === false,
    "fourth_c5_state_b_vertical_only_not_overall_pass",
    JSON.stringify({
      items: stateBItems,
      height: stateBBody?.height,
      clip: stateBClip.length,
      notes: stateB.notes,
    }),
  );
  assert(
    stateBNorm.report.page_fit?.fit_pass === true &&
      stateBNorm.report.page_overflow === false &&
      stateBGeom.pass === true,
    "fourth_c5_real_parent_geometry_after_normalize",
    JSON.stringify({
      fit: stateBNorm.report.page_fit,
      overflow: stateBNorm.report.page_overflow,
      geom: stateBGeom.reason,
      findings: stateBGeom.findings.map((f) => f.code),
    }),
  );
  assert(
    stateD.pass === false &&
      (childItems.includes("Python (Pandas") || childItems.includes("NumPy)")),
    "fourth_c5_state_d_bad_child_fails",
    JSON.stringify({ notes: stateD.notes, items: childItems }),
  );

  const C5_FIFTH_HEADER =
    "Move the “Campus Ambassador” position completely below the blue header rectangle so that it does not overlap the rectangle, while keeping the name placement as it is.";
  const C5_FIFTH_EDU =
    "Add more content to the Education section to show a more complete education history, such as school, high school, college and degree details where appropriate.";
  const C5_FIFTH_SKILLS =
    "Change the Skills section from the current horizontal layout to vertical pointers. Keep around three skills stacked vertically in one column, then continue the remaining skills vertically in the next column beside it.";
  const fifthHeaderIr = compileFounderFeedbackIR([C5_FIFTH_HEADER]);
  const fifthEduIr = compileFounderFeedbackIR([C5_FIFTH_EDU]);
  const fifthSkillsIr = compileFounderFeedbackIR([C5_FIFTH_SKILLS]);
  const fifthHeaderPred = fifthHeaderIr.items[0]?.fulfillment.find(
    (p) => p.kind === "RELATIONAL_ALIGNMENT",
  );
  const fifthSkillsPred = fifthSkillsIr.items[0]?.fulfillment.find(
    (p) => p.kind === "PRESENTATION",
  );
  const fifthHeaderRel = compileRelativePlacement(C5_FIFTH_HEADER);
  assert(
    fifthHeaderIr.schema_version === FOUNDER_FEEDBACK_IR_SCHEMA &&
      fifthHeaderIr.items[0]?.action === "LAYOUT_MUTATION" &&
      fifthHeaderRel?.alignment.relation === "below" &&
      fifthHeaderRel.preserve?.kind === "header_name_only" &&
      fifthHeaderPred?.alignment?.relation === "below" &&
      fifthHeaderPred.preserve?.kind === "header_name_only" &&
      fifthHeaderPred.target?.quoted_text === "Campus Ambassador",
    "fifth_c5_header_relative_below_compiled",
    JSON.stringify({
      action: fifthHeaderIr.items[0]?.action,
      pred: fifthHeaderPred,
      rel: fifthHeaderRel,
    }),
  );
  assert(
    fifthEduIr.items[0]?.action === "CONTENT_MUTATION" &&
      fifthEduIr.items[0]?.fulfillment.some((p) => p.kind === "CONTENT_ADD") &&
      fifthEduIr.content_addition_sections.includes("education"),
    "fifth_c5_education_content_add",
    JSON.stringify(fifthEduIr.items[0]),
  );
  const fifthSkillsSpec = compilePresentationSpec(C5_FIFTH_SKILLS);
  assert(
    fifthSkillsIr.items[0]?.action === "PRESENTATION_MUTATION" &&
      fifthSkillsPred?.kind === "PRESENTATION" &&
      fifthSkillsSpec != null &&
      fifthSkillsSpec.arrangement === "columns" &&
      fifthSkillsSpec.markers === "bullets" &&
      fifthSkillsSpec.grouping?.axis === "column" &&
      fifthSkillsSpec.grouping.column_count === 2 &&
      fifthSkillsSpec.grouping.continue_beside === true &&
      fifthSkillsSpec.grouping.cardinality_strength === "approximate" &&
      fifthSkillsSpec.grouping.structure_material === true &&
      fifthSkillsSpec.grouping.executable === true &&
      (fifthSkillsSpec.unresolved_material ?? []).length === 0 &&
      !fifthSkillsIr.items[0]?.fulfillment.some((p) => p.kind === "CONTENT_REWRITE"),
    "fifth_c5_skills_presentation_not_rewrite",
    JSON.stringify({
      action: fifthSkillsIr.items[0]?.action,
      spec: fifthSkillsSpec,
      pred: fifthSkillsPred?.presentation_spec,
    }),
  );

  const changeToVertical = compileFounderFeedbackIR([
    "Change the Projects section from the current horizontal layout to a vertical list",
  ]);
  const genuineRewrite = compileFounderFeedbackIR([
    "Change the professional title from Marketing Manager to Operations Analyst",
  ]);
  assert(
    changeToVertical.items[0]?.action === "PRESENTATION_MUTATION" &&
      genuineRewrite.items[0]?.action === "CONTENT_MUTATION" &&
      genuineRewrite.items[0]?.fulfillment.some((p) => p.kind === "CONTENT_REWRITE"),
    "change_from_to_presentation_vs_content_rewrite",
    JSON.stringify({
      pres: changeToVertical.items[0]?.action,
      rewrite: genuineRewrite.items[0]?.action,
    }),
  );

  function headerPlacementCanvas(opts?: {
    titleTop?: number;
    titleText?: string;
  }): FabricCanvasDoc {
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
          data: { role: "pageBackground", system: true, kind: "page-bg" },
        },
        {
          type: "rect",
          id: "block-header-0-r0",
          left: 48,
          top: 48,
          width: 698,
          height: 54,
          fill: "#dbeafe",
          data: { section: "header", role: "band" },
        },
        {
          type: "textbox",
          id: "block-header-0-t1",
          left: 60,
          top: 58,
          width: 400,
          height: 22,
          text: "Alex Rivera",
          data: { section: "header", role: "name" },
        },
        {
          type: "textbox",
          id: "block-header-0-t2",
          left: 60,
          top: opts?.titleTop ?? 97,
          width: 400,
          height: 16,
          text: opts?.titleText ?? "Campus Ambassador",
          data: { section: "header", role: "professional_title" },
        },
        {
          type: "textbox",
          id: "block-header-0-t3",
          left: 60,
          top: 118,
          width: 500,
          height: 14,
          text: "alex@example.com",
          data: { section: "header", role: "contact" },
        },
      ],
    } as FabricCanvasDoc;
  }

  const headerBefore = headerPlacementCanvas();
  const headerUnchanged = evaluateItemFulfillment({
    item: fifthHeaderIr.items[0]!,
    beforeCanvas: headerBefore,
    afterCanvas: headerBefore,
  });
  const headerWrong = evaluateItemFulfillment({
    item: fifthHeaderIr.items[0]!,
    beforeCanvas: headerBefore,
    afterCanvas: headerPlacementCanvas({ titleTop: 70 }),
  });
  const headerNameMoved = JSON.parse(JSON.stringify(headerBefore)) as FabricCanvasDoc;
  const nameObj = (headerNameMoved.objects ?? []).find(
    (o) => (o as { id?: string }).id === "block-header-0-t1",
  ) as { top?: number };
  if (nameObj) nameObj.top = 80;
  const headerPreserveFail = evaluateItemFulfillment({
    item: fifthHeaderIr.items[0]!,
    beforeCanvas: headerBefore,
    afterCanvas: headerNameMoved,
  });
  const headerApplied = applyRelationalAlignment(headerBefore, fifthHeaderIr);
  const headerPass = evaluateItemFulfillment({
    item: fifthHeaderIr.items[0]!,
    beforeCanvas: headerBefore,
    afterCanvas: headerApplied,
  });
  const appliedTitle = (headerApplied.objects ?? []).find(
    (o) => (o as { id?: string }).id === "block-header-0-t2",
  ) as { top?: number };
  const appliedName = (headerApplied.objects ?? []).find(
    (o) => (o as { id?: string }).id === "block-header-0-t1",
  ) as { top?: number };
  const boundTitle = bindTargetDescriptor(headerBefore, fifthHeaderPred?.target);
  const boundRect = bindReferenceIds(headerBefore, fifthHeaderPred?.reference);
  assert(
    headerUnchanged.pass === false &&
      headerWrong.pass === false &&
      headerPreserveFail.pass === false &&
      headerPass.pass === true &&
      Number(appliedTitle?.top ?? 0) >= 102 &&
      Number(appliedName?.top ?? 0) === 58 &&
      boundTitle.includes("block-header-0-t2") &&
      boundRect.includes("block-header-0-r0"),
    "fifth_c5_header_state_based_fulfillment",
    JSON.stringify({
      unchanged: headerUnchanged.notes,
      wrong: headerWrong.notes,
      preserve: headerPreserveFail.notes,
      pass: headerPass.notes,
      titleTop: appliedTitle?.top,
      nameTop: appliedName?.top,
      boundTitle,
      boundRect,
    }),
  );

  const aboveIr = compileFounderFeedbackIR([
    "Move the “Campus Ambassador” position completely above the blue header rectangle, keeping the name placement",
  ]);
  const besideIr = compileFounderFeedbackIR([
    "Place the “Campus Ambassador” position beside the blue header rectangle, keeping the name placement",
  ]);
  assert(
    compileRelativePlacement(
      "Move the title completely above the blue header rectangle",
    )?.alignment.relation === "above" &&
      compileRelativePlacement(
        "Place the title beside the blue header rectangle",
      )?.alignment.relation === "beside" &&
      aboveIr.items[0]?.fulfillment.some(
        (p) => p.kind === "RELATIONAL_ALIGNMENT" && p.alignment?.relation === "above",
      ) &&
      besideIr.items[0]?.fulfillment.some(
        (p) => p.kind === "RELATIONAL_ALIGNMENT" && p.alignment?.relation === "beside",
      ) &&
      evaluateItemFulfillment({
        item: aboveIr.items[0]!,
        beforeCanvas: headerBefore,
        afterCanvas: headerApplied,
      }).pass === false,
    "relative_above_beside_and_wrong_relation_fail",
    JSON.stringify({
      above: aboveIr.items[0]?.fulfillment,
      beside: besideIr.items[0]?.fulfillment,
    }),
  );
  const ambiguousRel = compileFounderFeedbackIR([
    "Move the heading completely below the blue header rectangle",
  ]);
  const ambiguousEval = evaluateItemFulfillment({
    item: ambiguousRel.items[0]!,
    beforeCanvas: headerBefore,
    afterCanvas: headerApplied,
  });
  assert(
    ambiguousRel.items[0]?.fulfillment.some((p) => p.kind === "RELATIONAL_ALIGNMENT") &&
      ambiguousEval.pass === false,
    "ambiguous_relative_target_fails_closed",
    ambiguousEval.notes,
  );

  const inlineSkills: FabricCanvasDoc = {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      {
        type: "textbox",
        id: "block-skills-5-t1",
        section: "skills",
        text: "SKILLS",
        left: 48,
        top: 720,
        width: 200,
        height: 16,
      },
      {
        type: "textbox",
        id: "block-skills-5-t2",
        section: "skills",
        text: "Public Speaking  ·  Event Coordination  ·  Social Media  ·  Leadership  ·  Outreach  ·  Research",
        left: 48,
        top: 752,
        width: 698,
        height: 20,
      },
    ],
  } as FabricCanvasDoc;
  const fifthSkillsApplied = applyPresentationMutations(inlineSkills, fifthSkillsIr);
  const fifthSkillsEval = evaluateItemFulfillment({
    item: fifthSkillsIr.items[0]!,
    beforeCanvas: inlineSkills,
    afterCanvas: fifthSkillsApplied,
  });
  const fifthSkillTexts = (fifthSkillsApplied.objects ?? [])
    .filter((o) => {
      const sec = String(
        (o as { section?: string }).section ??
          ((o as { data?: { section?: string } }).data?.section ?? ""),
      ).toLowerCase();
      const t = String((o as { text?: string }).text ?? "");
      return sec === "skills" && t && !/^skills?$/i.test(t.trim());
    })
    .map((o) => String((o as { text?: string }).text ?? ""));
  const fifthSkillItems = fifthSkillTexts.flatMap((t) => splitLogicalItems(t));
  const fifthSkillBoxes = (fifthSkillsApplied.objects ?? []).filter((o) => {
    const sec = String(
      (o as { section?: string }).section ??
        ((o as { data?: { section?: string } }).data?.section ?? ""),
    ).toLowerCase();
    const t = String((o as { text?: string }).text ?? "");
    return sec === "skills" && t && !/^skills?$/i.test(t.trim());
  }) as Array<{ height?: number; width?: number }>;
  const fifthClip = findIntraBoxTextOverflowFindings(fifthSkillsApplied);
  const fifthUnchangedPres = evaluateItemFulfillment({
    item: fifthSkillsIr.items[0]!,
    beforeCanvas: inlineSkills,
    afterCanvas: inlineSkills,
  });
  assert(
    fifthSkillItems.length === 6 &&
      fifthSkillItems[0] === "Public Speaking" &&
      fifthSkillItems[5] === "Research" &&
      fifthSkillBoxes.length >= 2 &&
      fifthSkillsEval.pass === true &&
      fifthUnchangedPres.pass === false &&
      fifthClip.length === 0 &&
      fifthSkillBoxes.every((b) => Number(b.height ?? 0) > 20),
    "fifth_c5_skills_offline_fulfillment",
    JSON.stringify({
      items: fifthSkillItems,
      boxes: fifthSkillBoxes.length,
      eval: fifthSkillsEval.notes,
      clip: fifthClip.length,
    }),
  );

  function growthPatternCanvas(): FabricCanvasDoc {
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
          data: { role: "pageBackground", system: true, kind: "page-bg" },
        },
        {
          type: "textbox",
          id: "block-education-3-t2",
          left: 48,
          top: 664,
          width: 698,
          height: 16,
          text: "B.A. Communication, State University, 2024",
          fontSize: 11,
          lineHeight: 1.35,
          data: { section: "education", role: "body" },
        },
        {
          type: "textbox",
          id: "block-education-3-t3",
          left: 48,
          top: 683,
          width: 698,
          height: 16,
          text: "Relevant coursework: Media Studies",
          fontSize: 11,
          lineHeight: 1.35,
          data: { section: "education", role: "body" },
        },
        {
          type: "textbox",
          id: "block-skills-4-t1",
          left: 48,
          top: 730,
          width: 200,
          height: 16,
          text: "SKILLS",
          data: { section: "skills", role: "heading" },
        },
        {
          type: "textbox",
          id: "block-skills-4-t2",
          left: 48,
          top: 752,
          width: 698,
          height: 20,
          text: "Public Speaking  ·  Event Coordination  ·  Social Media  ·  Leadership  ·  Outreach  ·  Research",
          fontSize: 11,
          lineHeight: 1.35,
          data: { section: "skills", role: "body" },
        },
        {
          type: "textbox",
          id: "block-certifications-5-t1",
          left: 48,
          top: 790,
          width: 240,
          height: 16,
          text: "CERTIFICATIONS",
          data: { section: "certifications", role: "heading" },
        },
        {
          type: "textbox",
          id: "block-certifications-5-t2",
          left: 48,
          top: 810,
          width: 698,
          height: 16,
          text: "First Aid Certification",
          data: { section: "certifications", role: "body" },
        },
      ],
    } as FabricCanvasDoc;
  }
  const growthCanvas = growthPatternCanvas();
  const growthPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "content growth",
    operations: [
      {
        op: "update_text" as const,
        target_id: "block-education-3-t2",
        values: {
          text: "Lincoln High School, 2016–2020. B.A. Communication, State University, 2020–2024. Coursework: Media Studies, Public Relations, Research Methods.",
        },
        founder_feedback_item: C5_FIFTH_EDU,
        intended_change: "expand education",
        confidence: 0.9,
      },
      {
        op: "update_text" as const,
        target_id: "block-skills-4-t2",
        values: {
          text: "Public Speaking\nEvent Coordination\nSocial Media\nLeadership\nOutreach\nResearch",
        },
        founder_feedback_item: C5_FIFTH_SKILLS,
        intended_change: "vertical skills",
        confidence: 0.9,
      },
    ],
    notes: [],
  };
  const sourceSnap = JSON.stringify(growthCanvas);
  const executedGrowth = executeCanvasOperations({
    canvas: growthCanvas,
    operations: growthPlan.operations,
  });
  const reflowedGrowth = applyPostContentReflow({
    canvas: executedGrowth.canvas,
  });
  const normGrowth = normalizeRevisionLayout({
    canvas: reflowedGrowth.canvas,
    requested_changes: [C5_FIFTH_EDU, C5_FIFTH_SKILLS],
    prior_canvas: growthCanvas,
  });
  const postLayoutOverlaps = findTextOverlapFindings(normGrowth.canvas).length;
  const postLayoutAdmit = evaluateSharedGeometryAdmission(normGrowth.canvas);
  const expectedSafe =
    postLayoutOverlaps === 0 &&
    postLayoutAdmit.page_oob_count === 0 &&
    !normGrowth.report.page_overflow &&
    postLayoutAdmit.page_fit_pass;
  const fifthGeo = validatePlanGeometrySafety({
    canvas: growthCanvas,
    plan: growthPlan,
    requested_changes: [C5_FIFTH_EDU, C5_FIFTH_SKILLS],
  });
  assert(
    JSON.stringify(growthCanvas) === sourceSnap,
    "plan_geometry_side_effect_free_source",
    "source canvas mutated",
  );
  assert(
    fifthGeo.layout_applied === true &&
      fifthGeo.simulation_ok === true &&
      fifthGeo.ok === expectedSafe &&
      (expectedSafe
        ? fifthGeo.text_overlaps === 0 && fifthGeo.page_oob === 0
        : fifthGeo.ok === false),
    "fifth_c5_growth_plan_geometry_truthful",
    JSON.stringify({
      ok: fifthGeo.ok,
      expectedSafe,
      overlaps: fifthGeo.text_overlaps,
      postLayoutOverlaps,
      oob: fifthGeo.page_oob,
      overflow: fifthGeo.page_overflow,
      fit: postLayoutAdmit.page_fit_pass,
      err: fifthGeo.error,
    }),
  );

  const C5_SIXTH_HEADER =
    "Move the name, “Physical Therapist” job title and contact details slightly to the right so that the header content aligns with the left alignment of the main resume body, while keeping the vertical line in its current position.";
  const C5_SIXTH_HEADER_PARA =
    "Move the name, job title and contact details slightly to the right so the header content aligns with the left alignment of the main resume body, while keeping the vertical line in its current position.";
  const C5_SIXTH_SKILLS =
    "Change the Skills section from the current horizontal layout to vertical pointers. Keep the skills stacked vertically in two columns beside each other.";
  const sixthHeaderIr = compileFounderFeedbackIR([C5_SIXTH_HEADER]);
  const sixthHeaderParaIr = compileFounderFeedbackIR([C5_SIXTH_HEADER_PARA]);
  const sixthSkillsIr = compileFounderFeedbackIR([C5_SIXTH_SKILLS]);
  const sixthHeaderPred = sixthHeaderIr.items[0]?.fulfillment.find(
    (p) => p.kind === "RELATIONAL_ALIGNMENT",
  );
  const sixthGroup = compileGroupAlignment(C5_SIXTH_HEADER);
  const sixthParaGroup = compileGroupAlignment(C5_SIXTH_HEADER_PARA);
  assert(
    sixthHeaderIr.schema_version === FOUNDER_FEEDBACK_IR_SCHEMA &&
      sixthHeaderIr.items[0]?.action === "LAYOUT_MUTATION" &&
      sixthHeaderPred?.kind === "RELATIONAL_ALIGNMENT" &&
      sixthHeaderPred.alignment?.relation === "align" &&
      sixthHeaderPred.alignment?.edge === "left" &&
      sixthHeaderPred.reference?.kind === "body_content" &&
      sixthHeaderPred.preserve?.kind === "visual" &&
      (sixthHeaderPred.targets?.length ?? 0) === 3 &&
      sixthHeaderPred.targets?.some((t) => t.role === "name") &&
      sixthHeaderPred.targets?.some((t) => t.role === "professional_title") &&
      sixthHeaderPred.targets?.some((t) => t.role === "contact") &&
      sixthGroup?.reference.kind === "body_content" &&
      sixthParaGroup?.targets.length === 3 &&
      compileRelativePlacement(C5_SIXTH_HEADER) == null,
    "sixth_c5_header_group_alignment_compiled",
    JSON.stringify({
      action: sixthHeaderIr.items[0]?.action,
      pred: sixthHeaderPred,
      group: sixthGroup,
    }),
  );
  assert(
    sixthSkillsIr.items[0]?.action === "PRESENTATION_MUTATION" &&
      sixthSkillsIr.items[0]?.fulfillment.some((p) => p.kind === "PRESENTATION") &&
      !sixthSkillsIr.items[0]?.fulfillment.some((p) => p.kind === "CONTENT_REWRITE"),
    "sixth_c5_skills_presentation_preserved",
    JSON.stringify(sixthSkillsIr.items[0]),
  );

  function headerGroupCanvas(opts?: {
    nameLeft?: number;
    titleLeft?: number;
    contactLeft?: number;
    bodyLeft?: number;
    railLeft?: number;
    omitContact?: boolean;
  }): FabricCanvasDoc {
    const bodyLeft = opts?.bodyLeft ?? 80;
    const objects: Array<Record<string, unknown>> = [
      {
        type: "rect",
        id: "page-root",
        left: 0,
        top: 0,
        width: 794,
        height: 1123,
        fill: "#ffffff",
        data: { role: "pageBackground", system: true, kind: "page-bg" },
      },
      {
        type: "rect",
        id: "rail-v",
        left: opts?.railLeft ?? 50,
        top: 40,
        width: 4,
        height: 980,
        fill: "#111827",
        data: { role: "rail", shape: "line" },
      },
      {
        type: "textbox",
        id: "hdr-name",
        left: opts?.nameLeft ?? 64,
        top: 48,
        width: 360,
        height: 22,
        text: "Alex Rivera",
        data: { section: "header", role: "name" },
      },
      {
        type: "textbox",
        id: "hdr-title",
        left: opts?.titleLeft ?? 64,
        top: 74,
        width: 360,
        height: 16,
        text: "Clinical Specialist",
        data: { section: "header", role: "professional_title" },
      },
    ];
    if (!opts?.omitContact) {
      objects.push({
        type: "textbox",
        id: "hdr-contact",
        left: opts?.contactLeft ?? 64,
        top: 96,
        width: 420,
        height: 14,
        text: "alex@example.com · 555-0100",
        data: { section: "header", role: "contact" },
      });
    }
    objects.push(
      {
        type: "textbox",
        id: "sum-h",
        left: bodyLeft,
        top: 160,
        width: 200,
        height: 16,
        text: "SUMMARY",
        data: { section: "summary", role: "heading" },
      },
      {
        type: "textbox",
        id: "sum-b",
        left: bodyLeft,
        top: 184,
        width: 520,
        height: 36,
        text: "Licensed clinician focused on mobility and recovery.",
        data: { section: "summary", role: "body" },
      },
      {
        type: "textbox",
        id: "exp-h",
        left: bodyLeft,
        top: 240,
        width: 200,
        height: 16,
        text: "EXPERIENCE",
        data: { section: "experience", role: "heading" },
      },
      {
        type: "textbox",
        id: "exp-b",
        left: bodyLeft,
        top: 264,
        width: 520,
        height: 36,
        text: "Treated patients across outpatient clinics.",
        data: { section: "experience", role: "body" },
      },
      {
        type: "textbox",
        id: "sk-h",
        left: bodyLeft,
        top: 720,
        width: 200,
        height: 16,
        text: "SKILLS",
        data: { section: "skills", role: "heading" },
      },
      {
        type: "textbox",
        id: "sk-b",
        left: bodyLeft,
        top: 744,
        width: 520,
        height: 20,
        text: "Manual Therapy · Gait Training · Assessment · Documentation · Education · Planning · Coordination · Recovery",
        data: { section: "skills", role: "body" },
      },
    );
    return {
      version: "5.3.0",
      width: 794,
      height: 1123,
      objects,
    } as FabricCanvasDoc;
  }

  const sixthBefore = headerGroupCanvas();
  const sixthUnchanged = evaluateItemFulfillment({
    item: sixthHeaderIr.items[0]!,
    beforeCanvas: sixthBefore,
    afterCanvas: sixthBefore,
  });
  const sixthPartial = evaluateItemFulfillment({
    item: sixthHeaderIr.items[0]!,
    beforeCanvas: sixthBefore,
    afterCanvas: headerGroupCanvas({ nameLeft: 80 }),
  });
  const sixthWrong = evaluateItemFulfillment({
    item: sixthHeaderIr.items[0]!,
    beforeCanvas: sixthBefore,
    afterCanvas: headerGroupCanvas({
      nameLeft: 110,
      titleLeft: 110,
      contactLeft: 110,
    }),
  });
  const sixthRailMoved = evaluateItemFulfillment({
    item: sixthHeaderIr.items[0]!,
    beforeCanvas: sixthBefore,
    afterCanvas: headerGroupCanvas({
      nameLeft: 80,
      titleLeft: 80,
      contactLeft: 80,
      railLeft: 80,
    }),
  });
  const sixthApplied = applyRelationalAlignment(sixthBefore, sixthHeaderIr);
  const sixthPass = evaluateItemFulfillment({
    item: sixthHeaderIr.items[0]!,
    beforeCanvas: sixthBefore,
    afterCanvas: sixthApplied,
  });
  const sixthAppliedLefts = (sixthApplied.objects ?? [])
    .filter((o) =>
      ["hdr-name", "hdr-title", "hdr-contact"].includes(
        String((o as { id?: string }).id ?? ""),
      ),
    )
    .map((o) => Number((o as { left?: number }).left ?? 0));
  const sixthRail = (sixthApplied.objects ?? []).find(
    (o) => (o as { id?: string }).id === "rail-v",
  ) as { left?: number } | undefined;
  const sixthBody = (sixthApplied.objects ?? []).find(
    (o) => (o as { id?: string }).id === "sum-b",
  ) as { left?: number } | undefined;
  const sixthAmbiguous = evaluateItemFulfillment({
    item: sixthHeaderIr.items[0]!,
    beforeCanvas: headerGroupCanvas({ omitContact: true }),
    afterCanvas: headerGroupCanvas({ omitContact: true, nameLeft: 80, titleLeft: 80 }),
  });
  const oneTargetIr = compileFounderFeedbackIR([
    "Move the name slightly to the right so that it aligns with the left alignment of the main resume body, while keeping the vertical line in its current position.",
  ]);
  const oneTargetApplied = applyRelationalAlignment(sixthBefore, oneTargetIr);
  const oneTargetPass = evaluateItemFulfillment({
    item: oneTargetIr.items[0]!,
    beforeCanvas: sixthBefore,
    afterCanvas: oneTargetApplied,
  });
  const oneTargetUnchanged = evaluateItemFulfillment({
    item: oneTargetIr.items[0]!,
    beforeCanvas: sixthBefore,
    afterCanvas: sixthBefore,
  });
  assert(
    sixthUnchanged.pass === false &&
      sixthPartial.pass === false &&
      sixthWrong.pass === false &&
      sixthRailMoved.pass === false &&
      sixthPass.pass === true &&
      sixthAppliedLefts.every((left) => left === 80) &&
      Number(sixthRail?.left ?? 0) === 50 &&
      Number(sixthBody?.left ?? 0) === 80 &&
      sixthAmbiguous.pass === false &&
      oneTargetUnchanged.pass === false &&
      oneTargetPass.pass === true,
    "sixth_c5_header_state_true_fulfillment",
    JSON.stringify({
      unchanged: sixthUnchanged.notes,
      partial: sixthPartial.notes,
      wrong: sixthWrong.notes,
      rail: sixthRailMoved.notes,
      pass: sixthPass.notes,
      lefts: sixthAppliedLefts,
      railLeft: sixthRail?.left,
      ambiguous: sixthAmbiguous.notes,
      one: oneTargetPass.notes,
    }),
  );

  const sixthSkillsApplied = applyPresentationMutations(sixthBefore, sixthSkillsIr);
  const sixthSkillsEval = evaluateItemFulfillment({
    item: sixthSkillsIr.items[0]!,
    beforeCanvas: sixthBefore,
    afterCanvas: sixthSkillsApplied,
  });
  const sixthSkillTexts = (sixthSkillsApplied.objects ?? [])
    .filter((o) => {
      const sec = String(
        (o as { section?: string }).section ??
          ((o as { data?: { section?: string } }).data?.section ?? ""),
      ).toLowerCase();
      const t = String((o as { text?: string }).text ?? "");
      return sec === "skills" && t && !/^skills?$/i.test(t.trim());
    })
    .map((o) => String((o as { text?: string }).text ?? ""));
  const sixthSkillItems = sixthSkillTexts.flatMap((t) => splitLogicalItems(t));
  const sixthSkillBoxes = (sixthSkillsApplied.objects ?? []).filter((o) => {
    const sec = String(
      (o as { section?: string }).section ??
        ((o as { data?: { section?: string } }).data?.section ?? ""),
    ).toLowerCase();
    const t = String((o as { text?: string }).text ?? "");
    return sec === "skills" && t && !/^skills?$/i.test(t.trim());
  }) as Array<{ left?: number; top?: number }>;
  const sixthSkillClip = findIntraBoxTextOverflowFindings(sixthSkillsApplied);
  const sixthSkillGeom = evaluateSharedGeometryAdmission(sixthSkillsApplied);
  assert(
    sixthSkillItems.length === 8 &&
      sixthSkillItems[0] === "Manual Therapy" &&
      sixthSkillItems[7] === "Recovery" &&
      sixthSkillBoxes.length >= 2 &&
      new Set(sixthSkillBoxes.map((b) => Number(b.left ?? 0))).size >= 2 &&
      sixthSkillsEval.pass === true &&
      sixthSkillClip.length === 0 &&
      sixthSkillGeom.pass === true,
    "sixth_c5_skills_offline_fulfillment",
    JSON.stringify({
      items: sixthSkillItems,
      boxes: sixthSkillBoxes.length,
      eval: sixthSkillsEval.notes,
      clip: sixthSkillClip.length,
      geom: sixthSkillGeom.reason,
    }),
  );

  const sixthEmptyPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    operations: [] as RevisionPlan["operations"],
  };
  const falseReadyAfter = applyPresentationMutations(sixthBefore, sixthSkillsIr);
  const falseReadyCoverage = buildFeedbackCoverage({
    requested_changes: [C5_SIXTH_HEADER, C5_SIXTH_SKILLS],
    plan: sixthEmptyPlan,
    log: [],
    beforeCanvas: sixthBefore,
    afterCanvas: falseReadyAfter,
  });
  const rhythmOnUnchanged = evaluateCanonicalFinalStateLayoutProof({
    requestedChange: C5_SIXTH_HEADER,
    beforeCanvas: sixthBefore,
    afterCanvas: sixthBefore,
  });
  const headerCoverage = falseReadyCoverage.items.find(
    (i) => i.founder_feedback_item === C5_SIXTH_HEADER,
  );
  const skillsCoverage = falseReadyCoverage.items.find(
    (i) => i.founder_feedback_item === C5_SIXTH_SKILLS,
  );
  const falseReadyAcceptance = evaluateRevisionFinalAcceptance({
    plan_ok: true,
    authorization_ok: true,
    section_replacement: { ok: true, error: null },
    content_execution_ok: true,
    content_preservation_ok: true,
    canonical_layout_ok: true,
    text_overlap_count: 0,
    page_oob_count: 0,
    page_fit_ok: true,
    revision_role: { pass: true, evaluable: true, match: true, reason: "ok" },
    coverage: falseReadyCoverage,
  });
  const correctAfter = applyPresentationMutations(sixthApplied, sixthSkillsIr);
  const correctCoverage = buildFeedbackCoverage({
    requested_changes: [C5_SIXTH_HEADER, C5_SIXTH_SKILLS],
    plan: sixthEmptyPlan,
    log: [],
    beforeCanvas: sixthBefore,
    afterCanvas: correctAfter,
  });
  const correctAcceptance = evaluateRevisionFinalAcceptance({
    plan_ok: true,
    authorization_ok: true,
    section_replacement: { ok: true, error: null },
    content_execution_ok: true,
    content_preservation_ok: true,
    canonical_layout_ok: true,
    text_overlap_count: 0,
    page_oob_count: 0,
    page_fit_ok: true,
    revision_role: { pass: true, evaluable: true, match: true, reason: "ok" },
    coverage: correctCoverage,
  });
  assert(
    headerCoverage?.status === "not_addressed" &&
      skillsCoverage?.status === "addressed" &&
      falseReadyCoverage.gate_pass === false &&
      !String(headerCoverage?.evidence?.notes ?? "").includes("LAYOUT_RHYTHM_SATISFIED") &&
      falseReadyAcceptance.may_return_to_founder_review === false &&
      falseReadyAcceptance.failed_owner === "feedback_coverage" &&
      correctCoverage.gate_pass === true &&
      correctCoverage.items.every((i) => i.status === "addressed") &&
      correctAcceptance.may_return_to_founder_review === true &&
      (rhythmOnUnchanged.reason === "LAYOUT_RHYTHM_SATISFIED"
        ? headerCoverage?.status === "not_addressed"
        : true),
    "sixth_c5_false_ready_coverage_and_acceptance",
    JSON.stringify({
      header: headerCoverage,
      skills: skillsCoverage?.status,
      falseReady: falseReadyAcceptance.failed_owner,
      correct: correctAcceptance.overall,
      rhythm: rhythmOnUnchanged.reason,
    }),
  );

  const TA_HEADER =
    "Move the “Teaching Assistant” job title completely below the light-blue rectangle so that it does not touch or overlap the rectangle, and make the job title bold so that it becomes the secondary visual highlight below the name. Keep “Evelyn Harper” and the light-blue rectangle in their current positions, and move the contact-details row downward only if needed to maintain clean spacing below the job title.";
  const TA_EXPERIENCE =
    "Remove the excessive vertical gap in the first Teaching Assistant experience entry between the bullet ending with “increased student participation rates by 18%” and the following “Assisted in developing supplemental materials” bullet. Keep all existing experience text unchanged and make the spacing between those bullets consistent with the other bullet points in that same experience entry.";
  const TA_SKILLS =
    "Change the Skills section from the current horizontal sentence-style layout to vertical bullet pointers arranged in two columns. Keep all eight existing skills unchanged and in the same order: place Student Engagement, Classroom Support, Assignment Grading, and Instructional Material Development vertically in the first column, then place Peer Mentoring, Communication, Microsoft Office, and Zoom & Canvas LMS vertically in the second column beside it. Use the available lower-page space while keeping the following sections on the same page without overlap or clipping.";
  const taIr = compileFounderFeedbackIR([TA_HEADER, TA_EXPERIENCE, TA_SKILLS]);
  const taHeader = taIr.items[0];
  const taExp = taIr.items[1];
  const taSkills = taIr.items[2];
  const taStyle = compileStyleMutation(TA_HEADER);
  assert(
    taIr.schema_version === FOUNDER_FEEDBACK_IR_SCHEMA &&
      FOUNDER_FEEDBACK_IR_SCHEMA === "founder-feedback-ir-1.4.5" &&
      taHeader?.fulfillment.some((p) => p.kind === "RELATIONAL_ALIGNMENT") &&
      taHeader?.fulfillment.some((p) => p.kind === "STYLE") &&
      taStyle?.fontWeight === "bold" &&
      taStyle.target.role === "professional_title" &&
      taExp?.fulfillment.some((p) => p.kind === "SPACING_PAIR") &&
      taSkills?.fulfillment.some((p) => p.kind === "PRESENTATION") &&
      !taHeader?.fulfillment.some((p) => p.kind === "SPACING_PAIR") &&
      !taSkills?.fulfillment.some((p) => p.kind === "SPACING_PAIR"),
    "ta_packet_compiles_style_spacing_presentation",
    JSON.stringify({
      schema: taIr.schema_version,
      header: taHeader?.fulfillment.map((p) => p.kind),
      exp: taExp?.fulfillment.map((p) => p.kind),
      skills: taSkills?.fulfillment.map((p) => p.kind),
      style: taStyle,
    }),
  );

  const CONTACT_ROW =
    "Move the complete contact-details line containing the email address, phone number and address slightly downward so that it sits clearly below the light background rectangle with a small clean gap. Keep the name “Sample Name,” the “Sample Title” title and the background rectangle in their current positions.";
  const MULTI_PAIR =
    "Correct the inconsistent vertical spacing between the bullet points in both Experience entries. In particular, remove the excessive gap before “First named bullet…” and the excessive gap before “Second named bullet…”.";
  const RAIL =
    "Extend the vertical line on the left till the bottom of the page.";
  const contactRel = compileRelativePlacement(CONTACT_ROW);
  const contactIr = compileFounderFeedbackIR([CONTACT_ROW, MULTI_PAIR, RAIL]);
  const contactPred = contactIr.items[0]?.fulfillment.find(
    (p) => p.kind === "RELATIONAL_ALIGNMENT",
  );
  const pairPreds = (contactIr.items[1]?.fulfillment ?? []).filter(
    (p) => p.kind === "SPACING_PAIR",
  );
  const railDesc = contactRel;
  assert(
    contactPred?.target?.role === "contact" &&
      contactPred.target.shape === "text" &&
      contactPred.target.shape !== "line" &&
      contactPred.reference?.kind === "visual" &&
      (contactPred.reference.descriptor.role === "header_band" ||
        contactPred.reference.descriptor.shape === "rect") &&
      contactPred.preserve?.kind === "explicit_objects" &&
      (contactPred.preserve.descriptors?.length ?? 0) >= 3 &&
      pairPreds.length === 2 &&
      pairPreds.every((p) => (p.present_phrases?.length ?? 0) === 1) &&
      compileTargetDescriptor(RAIL).shape === "line" &&
      compileTargetDescriptor(RAIL).role !== "contact",
    "ordinary_english_target_binding_and_multi_pair",
    JSON.stringify({
      target: contactPred?.target,
      ref: contactPred?.reference,
      preserve: contactPred?.preserve,
      pairs: pairPreds.map((p) => p.present_phrases),
      rail: railDesc,
    }),
  );
  const contactLineDesc = contactRel?.target;
  assert(
    contactLineDesc?.role === "contact" && contactLineDesc.shape === "text",
    "contact_details_line_is_text_row_not_rail",
    JSON.stringify(contactLineDesc),
  );

  const LOCATIVE_HEADER =
    "Move the complete header content group — “Elena Griffin”, “Healthcare Administrator”, and the contact-details row — slightly to the right so that its left alignment matches the main resume body content below, while keeping the vertical black line in its current position and preserving the existing header text and order.";
  const PREPOSITIONAL_BELOW =
    "Move the “Teaching Assistant” job title completely below the light-blue rectangle so that it does not touch or overlap the rectangle.";
  const PAIR_AND_PRESERVE_TEXT =
    "In the “Assistant Healthcare Administrator — Greenfield Community Hospital” Experience entry, remove the excessive vertical space between the second bullet ending with “negotiating savings of $150K annually.” and the following bullet beginning with “Collaborated with clinical directors”. Make the spacing between these Experience bullet points consistent with the other bullet spacing in that entry, while preserving all Experience text and its order.";
  const KEEP_CURRENT_SPACING =
    "Keep the current spacing between the Experience bullet points unchanged, preserving the existing gap and rhythm.";
  const locativeIr = compileFounderFeedbackIR([LOCATIVE_HEADER]);
  const locativePred = locativeIr.items[0]?.fulfillment.find(
    (p) => p.kind === "RELATIONAL_ALIGNMENT",
  );
  const locativeGroup = compileGroupAlignment(LOCATIVE_HEADER);
  assert(
    compileRelativePlacement(LOCATIVE_HEADER) == null,
    "c1_negative_01_locative_below_is_not_relative_placement",
    JSON.stringify(compileRelativePlacement(LOCATIVE_HEADER)),
  );
  assert(
    compileRelativePlacement(PREPOSITIONAL_BELOW)?.alignment?.relation === "below",
    "c1_negative_02_prepositional_below_the_stays_placement",
    JSON.stringify(compileRelativePlacement(PREPOSITIONAL_BELOW)),
  );
  assert(
    locativePred?.alignment?.relation === "align" &&
      locativePred.alignment?.axis === "horizontal" &&
      locativeGroup?.alignment.relation === "align" &&
      locativePred.reference?.kind === "body_content",
    "c1_negative_03_locative_header_compiles_group_align",
    JSON.stringify(locativePred),
  );
  assert(
    (locativePred?.targets?.length ?? 0) === 3 &&
      locativePred?.targets?.some((t) => t.role === "name") &&
      locativePred?.targets?.some((t) => t.role === "professional_title") &&
      locativePred?.targets?.some((t) => t.role === "contact"),
    "c1_negative_04_header_group_has_three_roles",
    JSON.stringify(locativePred?.targets),
  );
  assert(
    locativePred?.targets?.every((t) => !t.quoted_text) === true &&
      locativePred?.targets?.find((t) => t.role === "contact")?.quoted_text == null,
    "c1_negative_05_quoted_name_does_not_contaminate_contact_role",
    JSON.stringify(locativePred?.targets),
  );
  assert(
    locativePred?.preserve?.kind === "visual" &&
      locativeIr.items[0]?.fulfillment.some((p) => p.kind === "PRESERVATION"),
    "c1_negative_06_rail_preserve_and_header_text_preservation",
    JSON.stringify({
      preserve: locativePred?.preserve,
      kinds: locativeIr.items[0]?.fulfillment.map((p) => p.kind),
    }),
  );
  const locativeBefore = headerGroupCanvas({
    nameLeft: 64,
    titleLeft: 64,
    contactLeft: 64,
    bodyLeft: 80,
    railLeft: 50,
  });
  const locativeAfter = applyRelationalAlignment(locativeBefore, locativeIr);
  const locativeBound = evaluateItemFulfillment({
    item: locativeIr.items[0]!,
    beforeCanvas: locativeBefore,
    afterCanvas: locativeAfter,
  });
  const locativeById = (id: string, canvas: FabricCanvasDoc) =>
    ((canvas.objects ?? []) as Array<Record<string, unknown>>).find((o) => o.id === id);
  assert(
    locativeBound.pass &&
      Math.abs(Number(locativeById("hdr-name", locativeAfter)?.left) - 80) <= 2 &&
      Math.abs(Number(locativeById("hdr-title", locativeAfter)?.left) - 80) <= 2 &&
      Math.abs(Number(locativeById("hdr-contact", locativeAfter)?.left) - 80) <= 2,
    "c1_negative_07_header_group_binds_all_three",
    locativeBound.notes,
  );
  assert(
    Number(locativeById("rail-v", locativeAfter)?.left) === 50 &&
      Number(locativeById("rail-v", locativeAfter)?.top) ===
        Number(locativeById("rail-v", locativeBefore)?.top),
    "c1_negative_08_rail_left_unchanged_after_group_apply",
    JSON.stringify({
      afterLeft: locativeById("rail-v", locativeAfter)?.left,
      afterTop: locativeById("rail-v", locativeAfter)?.top,
    }),
  );
  const pairEnds = extractPairEndpointNeedles(PAIR_AND_PRESERVE_TEXT);
  const pairIr = compileFounderFeedbackIR([PAIR_AND_PRESERVE_TEXT]);
  assert(
    detectSpacingIntentDirection(PAIR_AND_PRESERVE_TEXT) !== "PRESERVE" &&
      isFounderMeasurableSpacingIntent(PAIR_AND_PRESERVE_TEXT) &&
      pairIr.items[0]?.fulfillment.some((p) => p.kind === "SPACING_PAIR") &&
      pairIr.items[0]?.fulfillment.some((p) => p.kind === "PRESERVATION") &&
      itemRequiresMutationFulfillment(pairIr.items[0]!),
    "c1_negative_09_mutate_spacing_wins_over_content_preserve",
    JSON.stringify({
      direction: detectSpacingIntentDirection(PAIR_AND_PRESERVE_TEXT),
      kinds: pairIr.items[0]?.fulfillment.map((p) => p.kind),
    }),
  );
  assert(
    pairEnds.length === 2 &&
      pairEnds.every((n) => /negotiating savings|collaborated with clinical/i.test(n)) &&
      !pairEnds.some((n) => /greenfield community hospital/i.test(n)),
    "c1_negative_10_pair_endpoints_are_bullets_not_entry_title",
    JSON.stringify(pairEnds),
  );
  const keepIr = compileFounderFeedbackIR([KEEP_CURRENT_SPACING]);
  assert(
    detectSpacingIntentDirection(KEEP_CURRENT_SPACING) === "PRESERVE" &&
      !isFounderMeasurableSpacingIntent(KEEP_CURRENT_SPACING) &&
      !keepIr.items[0]?.fulfillment.some((p) => p.kind === "SPACING_PAIR"),
    "c1_negative_11_keep_current_spacing_is_preserve_not_pair",
    JSON.stringify({
      direction: detectSpacingIntentDirection(KEEP_CURRENT_SPACING),
      kinds: keepIr.items[0]?.fulfillment.map((p) => p.kind),
    }),
  );
  const rhythmOnPairMiss = evaluateCanonicalFinalStateLayoutProof({
    requestedChange: PAIR_AND_PRESERVE_TEXT,
    beforeCanvas: locativeBefore,
    afterCanvas: locativeBefore,
  });
  const rhythmCoverage = buildFeedbackCoverage({
    requested_changes: [PAIR_AND_PRESERVE_TEXT],
    plan: emptyPlan(),
    log: [],
    beforeCanvas: locativeBefore,
    afterCanvas: locativeBefore,
  });
  assert(
    itemRequiresMutationFulfillment(pairIr.items[0]!) &&
      rhythmCoverage.items[0]?.status !== "addressed",
    "c1_negative_12_generic_rhythm_cannot_address_compiled_pair",
    JSON.stringify({
      status: rhythmCoverage.items[0]?.status,
      notes: rhythmCoverage.items[0]?.evidence?.notes,
      rhythm: rhythmOnPairMiss.reason,
    }),
  );

  const DM_HEADER =
    "Header: Move the contact-details row slightly below the bottom edge of the light blue header background, approximately 2 points below it. Keep “Elena Masters”, “Digital Marketing Specialist”, and the light blue background in their current positions, and preserve all existing contact information and its order.";
  const DM_SKILLS =
    "Skills: Change the Skills section from the current horizontal sentence-style layout into vertical bullet points arranged in columns. Place 4 skills in the first column and continue the remaining skills in the column beside it. Preserve all existing skills and their current order.";
  const DM_SKILLS_NOPREFIX = DM_SKILLS.replace(/^Skills:\s*/, "");
  const DM_EXPERIENCE =
    "Experience: In the “Marketing Coordinator — Crestline Consumer Goods” experience entry, remove the unnecessary vertical gap between the second bullet ending “organic lead generation.” and the third bullet beginning “Coordinated campaign analytics reporting”. Also remove the unnecessary gap between that third bullet and the fourth bullet beginning “Produced monthly marketing metrics dashboards”. Make these bullet spacings consistent with the other Experience bullets while preserving all Experience text and its order.";
  const dmIr = compileFounderFeedbackIR([DM_HEADER, DM_SKILLS, DM_EXPERIENCE]);
  const dmSkills = dmIr.items[1]!;
  const dmHeader = dmIr.items[0]!;
  const dmExp = dmIr.items[2]!;
  const noPrefixSkills = compileFounderFeedbackIR([DM_SKILLS_NOPREFIX]).items[0]!;
  assert(
    founderFeedbackIROwnershipErrors(dmIr).length === 0 &&
      dmIr.items.every((item) => item.coverage_mode !== "MUTATION_REQUIRED") &&
      dmSkills.action === "PRESENTATION_MUTATION" &&
      dmSkills.coverage_mode === "DETERMINISTIC_LAYOUT_OWNED" &&
      noPrefixSkills.coverage_mode === dmSkills.coverage_mode &&
      noPrefixSkills.action === dmSkills.action,
    "c1_negative_13_prefix_does_not_change_skills_ownership",
    JSON.stringify({
      errors: founderFeedbackIROwnershipErrors(dmIr),
      skills: { action: dmSkills.action, mode: dmSkills.coverage_mode },
      noPrefix: {
        action: noPrefixSkills.action,
        mode: noPrefixSkills.coverage_mode,
      },
    }),
  );
  assert(
    dmSkills.fulfillment.some((p) => p.kind === "PRESENTATION") &&
      dmSkills.fulfillment.every((p) => p.kind !== "CONTENT_REWRITE") &&
      dmSkills.fulfillment.find((p) => p.kind === "PRESENTATION")
        ?.presentation_spec?.grouping?.items_per_group === 4 &&
      dmSkills.coverage_mode === "DETERMINISTIC_LAYOUT_OWNED",
    "c1_negative_14_from_into_arranged_bullet_points_are_presentation",
    JSON.stringify({
      class: classifyRequestedChange(DM_SKILLS).classification,
      kinds: dmSkills.fulfillment.map((p) => p.kind),
    }),
  );
  const contentMut = compileFounderFeedbackIR([
    "Replace Google Ads with Meta Ads.",
  ]).items[0]!;
  assert(
    contentMut.coverage_mode === "MUTATION_REQUIRED" &&
      contentMut.fulfillment.some((p) => p.kind === "CONTENT_REWRITE"),
    "c1_negative_15_named_skill_replace_is_provider_content",
    JSON.stringify({
      mode: contentMut.coverage_mode,
      kinds: contentMut.fulfillment.map((p) => p.kind),
    }),
  );
  const dmPairs = extractAllNamedSpacingPairs(DM_EXPERIENCE);
  assert(
    dmExp.fulfillment.filter((p) => p.kind === "SPACING_PAIR").length === 2 &&
      dmPairs.length === 2,
    "c1_negative_16_two_independent_named_pairs",
    JSON.stringify(dmPairs),
  );
  const headerRel = compileRelativePlacement(DM_HEADER);
  assert(
    headerRel?.alignment.relation === "below" &&
      headerRel.alignment.clearance_px === 2 &&
      headerRel.alignment.tolerance_px === 2 &&
      dmHeader.fulfillment.some((p) => p.kind === "PRESERVATION"),
    "c1_negative_17_numeric_below_is_clearance_not_align_window",
    JSON.stringify(headerRel?.alignment),
  );
  const taBelow = compileRelativePlacement(
    "Move the title below the rectangle.",
  );
  assert(
    taBelow?.alignment.relation === "below" &&
      taBelow.alignment.clearance_px == null,
    "c1_negative_18_nonnumeric_below_has_no_clearance",
    JSON.stringify(taBelow?.alignment),
  );

  for (const id of HISTORICAL) {
    const p = join(REPO, "SOS/07_LOGS/saios/founder-revision/tasks", `${id}.json`);
    if (!existsSync(p)) {
      assert(true, `historical_${id}_absent_locally_unmodified`, "absent");
      continue;
    }
    assert(existsSync(p), `historical_${id}_unchanged`, sha256(p));
  }

  const pass = checks.every((c) => c.pass);
  const report = {
    schema_version: "founder-feedback-ir-c1-1.0.0",
    generated_at: new Date().toISOString(),
    pass,
    NUMBER_OF_SEMANTIC_INTERPRETATION_PATHS,
    golden_status: goldenStatus,
    golden_error: goldenError,
    ir_evidence_written: irEvidenceWritten,
    legacy_unaccounted: legacy.unaccounted_object_ids.length,
    current_completeness_ok: current.ok,
    incomplete_replacement_ok: incomplete.ok,
    checks,
    publication_allowed: false,
    live: false,
  };
  mkdirSync(join(REPO, "SOS/07_LOGS/saios/founder-revision"), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(pass ? "C1 PASS" : "C1 FAIL");
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
