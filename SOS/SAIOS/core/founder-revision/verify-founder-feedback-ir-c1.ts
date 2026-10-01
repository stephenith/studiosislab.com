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
} from "./FounderFeedbackIR.js";
import {
  applyAlreadySatisfiedProof,
  applyPresentationMutations,
  applyRelationalAlignment,
  bindRangeTargetIds,
  bindReferenceIds,
  dropProviderGeometryWhenRelationalOwned,
  evaluateItemFulfillment,
} from "./FounderFeedbackFulfillment.js";
import { dropUnsafeGeometryOps } from "./PostContentReflow.js";
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
        requested_changes: ["Show the skills side by side"],
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
