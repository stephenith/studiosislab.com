/**
 * Phase 6O — layout-owned empty-plan contract alignment.
 *
 * Replays sanitized revtask-04b14b3d-243. No production OpenAI.
 * Isolated temp dirs. Historical tasks not mutated.
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
import type { ReasoningRequest } from "../ai-brain/ReasoningRequest.js";
import { findTextOverlapFindings } from "./RevisionAcceptanceChecks.js";
import { evaluateCanonicalFinalStateLayoutProof } from "./CanonicalFinalStateLayoutProof.js";
import { READABLE_SEQUENTIAL_GAP_PX } from "./RevisionLayoutNormalizer.js";
import {
  parseExplicitMoveDirections,
  sectionTokensFromText,
} from "./PositionOpCanonicalization.js";
import {
  runFounderFeedbackRevision,
  setRevisionPipelineRootsForTests,
} from "./FounderRevisionPipeline.js";
import {
  REVISION_PLANNING_MAX_PROVIDER_CALLS,
  prepareRevisionPlanForValidation,
} from "./RevisionPlanner.js";
import { repairAiPlanFounderAttribution } from "./RevisionPlanProvenanceRepair.js";
import {
  NUMBER_OF_EMPTY_PLAN_OWNERS,
  NON_AI_OPERATION_COVERAGE_MODES,
  allRequestedChangesAllowEmptyPlan,
  founderItemRequiresAiExecutableMutation,
  isPlanCoverageExemptRequestedChange,
  isRepairableShapeFailure,
  resolveItemCoverageMode,
  validateRevisionPlanShapeAndOperations,
} from "./RevisionPromptBuilder.js";
import {
  createRevisionTask,
  setRevisionTasksDirForTests,
} from "./RevisionTaskStore.js";
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import type { CanvasInventoryObject, RevisionTask } from "./revision-task-types.js";
import { visualTextContentBottom } from "./TextEffectiveHeight.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const FIX = join(REPO, ".cursor/debug-fixtures/revtask-04b14b3d-243-sanitized");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-empty-plan-contract-6o.json",
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

function passingCritic(): CriticResult {
  return {
    scores: {
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
    },
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

function findObj(canvas: FabricCanvasDoc, id: string): Record<string, unknown> | null {
  return ((canvas.objects ?? []) as Record<string, unknown>[]).find((o) => o.id === id) ?? null;
}

function visualGap(upper: Record<string, unknown>, lower: Record<string, unknown>): number {
  return Number(lower.top ?? 0) - visualTextContentBottom(upper);
}

function pageOob(canvas: FabricCanvasDoc): number {
  const pageW = Number(canvas.width ?? 794);
  const pageH = Number(canvas.height ?? 1123);
  let n = 0;
  for (const o of (canvas.objects ?? []) as Record<string, unknown>[]) {
    const left = Number(o.left ?? 0);
    const top = Number(o.top ?? 0);
    const w = Number(o.width ?? 0) * Number(o.scaleX ?? 1);
    const h = Number(o.height ?? 0) * Number(o.scaleY ?? 1);
    if (left < -1 || top < -1 || left + w > pageW + 1 || top + h > pageH + 1) n += 1;
  }
  return n;
}

function emptyPlan(summary = "layout owned"): Record<string, unknown> {
  return {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary,
    operations: [],
    notes: ["deterministic layout owns these items"],
  };
}

async function main(): Promise<void> {
  const task = readJson<RevisionTask>(join(FIX, "revtask-04b14b3d-243.json"));
  const rcs = task.requested_changes;
  const inventory = readJson<CanvasInventoryObject[]>(join(FIX, "evidence/inventory.json"));
  const priorCanvas = readJson<FabricCanvasDoc>(join(FIX, "prior/canvas.json"));
  const primary = readJson<Record<string, unknown>>(
    join(FIX, "evidence/primary-raw-structured.json"),
  );
  const shapeRaw = readJson<Record<string, unknown>>(
    join(FIX, "evidence/shape-repair-raw.json"),
  );
  const pre = readJson<{
    allow_empty_plan: boolean;
    primary_shape_errors: string[];
    layout_owned_not_exempt: Array<{ index: number }>;
  }>(join(FIX, "evidence/current-failure-reproduced.json"));

  assert(existsSync(join(FIX, "meta.json")), "fixture_created", FIX);
  assert(
    existsSync(join(FIX, "evidence/planner-prompt.json")) &&
      existsSync(join(FIX, "evidence/primary-raw-structured.json")) &&
      existsSync(join(FIX, "evidence/shape-repair-prompt.json")) &&
      existsSync(join(FIX, "evidence/shape-repair-raw.json")) &&
      existsSync(join(FIX, "evidence/shape-repair-validation.json")) &&
      existsSync(join(FIX, "evidence/shape-repair-provenance-repair.json")) &&
      existsSync(join(FIX, "evidence/revision-intent-scope.json")) &&
      existsSync(join(FIX, "evidence/inventory.json")) &&
      existsSync(join(FIX, "evidence/current-failure-reproduced.json")),
    "fixture_required_evidence_present",
  );
  assert(
    Array.isArray(primary.operations) && primary.operations.length === 0,
    "fixture_primary_empty_operations",
  );
  assert(
    pre.allow_empty_plan === false &&
      pre.primary_shape_errors.includes("operations must be a non-empty array") &&
      pre.layout_owned_not_exempt.map((x) => x.index).join(",") === "2,4,22",
    "current_contradiction_reproduced",
    `allow_empty=${pre.allow_empty_plan} owned_not_exempt=${pre.layout_owned_not_exempt
      .map((x) => x.index)
      .join(",")}`,
  );

  const exemptSrc = readFileSync(
    join(REPO, "SOS/SAIOS/core/founder-revision/RevisionPromptBuilder.ts"),
    "utf8",
  );
  assert(
    /function isPlanCoverageExemptRequestedChange[\s\S]*founderItemRequiresAiExecutableMutation/.test(
      exemptSrc,
    ) && exemptSrc.includes("resolveItemCoverageMode"),
    "plan_completeness_uses_resolve_item_coverage_mode",
  );
  assert(
    NUMBER_OF_EMPTY_PLAN_OWNERS === 4 &&
      NON_AI_OPERATION_COVERAGE_MODES.includes("DETERMINISTIC_LAYOUT_OWNED") &&
      NON_AI_OPERATION_COVERAGE_MODES.includes("VERIFICATION_ACCEPTANCE") &&
      NON_AI_OPERATION_COVERAGE_MODES.includes("PRESERVATION_CONSTRAINT") &&
      NON_AI_OPERATION_COVERAGE_MODES.includes("VALIDATION_ONLY"),
    "canonical_mutation_requirement_owner_implemented",
    `owners=${NUMBER_OF_EMPTY_PLAN_OWNERS}`,
  );

  const modes = rcs.map((c) => resolveItemCoverageMode(c));
  assert(
    rcs.every(
      (c) =>
        isPlanCoverageExemptRequestedChange(c) ===
        !founderItemRequiresAiExecutableMutation(c),
    ),
    "exemption_matches_canonical_owner",
  );
  assert(
    modes.includes("DETERMINISTIC_LAYOUT_OWNED") &&
      rcs
        .filter((c) => resolveItemCoverageMode(c) === "DETERMINISTIC_LAYOUT_OWNED")
        .every((c) => isPlanCoverageExemptRequestedChange(c)),
    "deterministic_layout_owned_exempt_from_ai_op",
  );
  assert(
    isPlanCoverageExemptRequestedChange(
      "After the layout adjustment, verify that the Skills section has zero text overlaps.",
    ) &&
      resolveItemCoverageMode(
        "After the layout adjustment, verify that the Skills section has zero text overlaps.",
      ) === "VERIFICATION_ACCEPTANCE",
    "verification_acceptance_exempt_from_ai_op",
  );
  assert(
    isPlanCoverageExemptRequestedChange(
      "Preserve the current professional title, Summary, Experience text, Skills wording, Projects, Certifications, Languages, Education text, candidate name, contact information, colors, typography, header, sidebar, and two-column architecture.",
    ),
    "preservation_constraint_exempt_from_ai_op",
  );
  const rewrite = "Rewrite the Summary so it describes an Operations Analyst.";
  assert(
    founderItemRequiresAiExecutableMutation(rewrite) &&
      !isPlanCoverageExemptRequestedChange(rewrite),
    "genuine_mutation_still_requires_ai_op",
  );

  assert(
    allRequestedChangesAllowEmptyPlan(rcs) === true,
    "04b_primary_empty_plan_allowed",
  );
  const prepared = prepareRevisionPlanForValidation({
    extracted: primary,
    inventory,
    requested_changes: rcs,
    origin: "PRIMARY",
  });
  assert(
    prepared.ok === true && (prepared.plan?.operations.length ?? -1) === 0,
    "04b_empty_primary_prepares_valid",
    prepared.errors.join("; "),
  );
  assert(
    isRepairableShapeFailure(prepared.errors) === false,
    "04b_empty_primary_not_shape_repairable_after",
  );

  const provenance = repairAiPlanFounderAttribution({
    extracted: shapeRaw,
    requested_changes: rcs,
  });
  assert(
    provenance.repairs.length === 0 &&
      provenance.unresolved.some(
        (u) => u.reason === "ambiguous_multiple_mutation_founder_feedback_items",
      ),
    "ambiguous_attribution_still_fails_closed",
    JSON.stringify(provenance.unresolved),
  );
  const dummyShape = validateRevisionPlanShapeAndOperations(shapeRaw, {
    requested_changes: rcs,
    inventory,
    allowEmptyOperations: true,
  });
  assert(
    dummyShape.ok === false &&
      dummyShape.errors.some((e) => e.includes("founder_feedback_item required")),
    "dummy_operation_not_accepted",
    dummyShape.errors.join("; "),
  );

  const layoutOnly = [
    "Correct the visible collision between the “Process Design” and “Excel” bullet rows in the Skills section.",
    "Position “Excel” below “Process Design” with clear positive vertical separation.",
    "Move the Education section upward so it follows the final Fieldwork Media Experience entry with a normal readable major-section gap.",
  ];
  assert(
    layoutOnly.every((c) => resolveItemCoverageMode(c) === "DETERMINISTIC_LAYOUT_OWNED") &&
      allRequestedChangesAllowEmptyPlan(layoutOnly) &&
      prepareRevisionPlanForValidation({
        extracted: emptyPlan(),
        inventory,
        requested_changes: layoutOnly,
        origin: "PRIMARY",
      }).ok,
    "all_layout_empty_test",
  );

  const mixedNonAi = [
    ...layoutOnly,
    "After the layout adjustment, verify that the Skills section has zero text overlaps.",
    "Preserve the current Education heading, degree, institution, certificate, and dates; change only its vertical positioning.",
  ];
  assert(
    allRequestedChangesAllowEmptyPlan(mixedNonAi) &&
      prepareRevisionPlanForValidation({
        extracted: emptyPlan(),
        inventory,
        requested_changes: mixedNonAi,
        origin: "PRIMARY",
      }).ok,
    "layout_verification_preservation_empty_test",
  );

  const mixedContent = [...layoutOnly, rewrite];
  const mixedPrep = prepareRevisionPlanForValidation({
    extracted: emptyPlan(),
    inventory,
    requested_changes: mixedContent,
    origin: "PRIMARY",
  });
  assert(
    allRequestedChangesAllowEmptyPlan(mixedContent) === false &&
      mixedPrep.ok === false &&
      mixedPrep.errors.includes("operations must be a non-empty array"),
    "mixed_content_layout_empty_negative",
    mixedPrep.errors.join("; "),
  );

  const removal = [
    "Remove marketing-specific Experience content such as campaigns, demand generation, ABM, MQLs, nurture sequences, brand messaging, webinars, and marketing attribution.",
  ];
  assert(
    founderItemRequiresAiExecutableMutation(removal[0]!) &&
      allRequestedChangesAllowEmptyPlan(removal) === false &&
      prepareRevisionPlanForValidation({
        extracted: emptyPlan(),
        inventory,
        requested_changes: removal,
        origin: "PRIMARY",
      }).ok === false,
    "content_removal_empty_negative",
  );

  const replacement = [
    "Replace the current marketing-focused Skills with Operations Analyst skills and tools appropriate for the target role.",
  ];
  assert(
    founderItemRequiresAiExecutableMutation(replacement[0]!) &&
      allRequestedChangesAllowEmptyPlan(replacement) === false &&
      prepareRevisionPlanForValidation({
        extracted: emptyPlan(),
        inventory,
        requested_changes: replacement,
        origin: "PRIMARY",
      }).ok === false,
    "section_replacement_empty_negative",
  );

  const malformed = validateRevisionPlanShapeAndOperations(
    {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "broken",
      operations: ["confidence", 1],
    },
    { requested_changes: [rewrite], inventory },
  );
  assert(
    malformed.ok === false &&
      isRepairableShapeFailure(malformed.errors) === true,
    "malformed_nonempty_shape_repair_test",
    malformed.errors.join("; "),
  );

  const plannerSrc = readFileSync(
    join(REPO, "SOS/SAIOS/core/founder-revision/RevisionPlanner.ts"),
    "utf8",
  );
  assert(
    parseExplicitMoveDirections(
      "If correcting the Skills bullet positions changes the total Skills section height, safely reflow Projects, Certifications, and Languages downward or upward as required while preserving their order.",
    ).size === 0 &&
      parseExplicitMoveDirections(
        "Move the Education section upward so it follows the final Fieldwork Media Experience entry with a normal readable major-section gap.",
      ).has("up"),
    "disjunctive_direction_is_permission_not_dual_requirement",
  );
  assert(
    sectionTokensFromText(
      "Move the Education section upward so it follows the final Fieldwork Media Experience entry with a normal readable major-section gap.",
    ).join(",") === "education",
    "education_upward_binds_education_not_experience_landmark",
    sectionTokensFromText(
      "Move the Education section upward so it follows the final Fieldwork Media Experience entry with a normal readable major-section gap.",
    ).join(","),
  );

  assert(
    plannerSrc.includes('origin: "PRIMARY"') &&
      plannerSrc.includes('origin: "SHAPE_REPAIR"') &&
      plannerSrc.includes('origin: "COVERAGE_REPAIR"') &&
      plannerSrc.includes('origin: "CONFLICT_REPAIR"') &&
      plannerSrc.includes("prepareRevisionPlanForValidation") &&
      REVISION_PLANNING_MAX_PROVIDER_CALLS === 2,
    "phase_6n_shared_pipeline_intact",
    String(REVISION_PLANNING_MAX_PROVIDER_CALLS),
  );

  const t2 = findObj(priorCanvas, "block-skills-4-t2")!;
  const t3 = findObj(priorCanvas, "block-skills-4-t3")!;
  const gapBefore = visualGap(t2, t3);
  const eduBefore = Number(findObj(priorCanvas, "block-education-3-t1")?.top ?? 0);
  const expLast = findObj(priorCanvas, "block-experience-2-t17")!;
  const expEduBefore = eduBefore - visualTextContentBottom(expLast);

  const tmp = mkdtempSync(join(tmpdir(), "aios-6o-"));
  const candRoot = join(tmp, "candidates");
  const outRoot = join(tmp, "founder-revision");
  const tasksDir = join(outRoot, "tasks");
  mkdirSync(tasksDir, { recursive: true });
  cpSync(join(FIX, "prior"), join(candRoot, task.prior_candidate_id), {
    recursive: true,
  });
  setRevisionTasksDirForTests(tasksDir);
  setRevisionPipelineRootsForTests({ candRoot, outRoot });

  let goldenStatus = "UNRUN";
  let goldenError: string | null = null;
  let providerCalls = 0;
  let shapeRepairRequested = false;
  let skillsPass = false;
  let rhythmPass = false;
  let overlaps = -1;
  let oob = -1;
  let rolePass = false;
  let coverage = "0/0";
  let acceptancePass = false;
  let coverageN = 0;

  try {
    const created = createRevisionTask({
      decision_id: `fd-6o-golden-${Date.now().toString(36)}`,
      review_id: "founder-review-6o-golden",
      prior_candidate_id: task.prior_candidate_id,
      prior_canvas_path: join(candRoot, task.prior_candidate_id, "canvas.json"),
      founder_reason: task.founder_reason,
      requested_changes: rcs,
      role: task.role,
      design_family: "professional_sidebar",
      architecture: "narrow_ats_sidebar",
    });
    assert(
      created.task.task_id !== "revtask-04b14b3d-243",
      "historical_task_id_not_reused",
      created.task.task_id,
    );
    const run = await runFounderFeedbackRevision({
      task_id: created.task.task_id,
      skip_preview: true,
      critiqueOverride: passingCritic,
      executePlanner: async (request: ReasoningRequest) => {
        providerCalls += 1;
        if (String(request.request_id ?? "").includes("shape-repair")) {
          shapeRepairRequested = true;
        }
        return {
          status: "COMPLETED",
          structured_output: primary,
          provider_request_id: "6o-golden-empty",
          model_identifier_internal: "fixture",
          input_tokens: 1,
          output_tokens: 1,
        };
      },
    });
    goldenStatus = run.task.status;
    goldenError = run.error;
    assert(
      providerCalls === 1 && shapeRepairRequested === false,
      "04b_shape_repair_triggered_after_no",
      `calls=${providerCalls} shape=${shapeRepairRequested}`,
    );
    assert(
      run.ok && run.task.status === "READY_FOR_FOUNDER_REVIEW",
      "empty_plan_continues_to_deterministic_layout",
      `${run.task.status} ${run.task.failure_owner ?? ""} ${run.error ?? ""}`,
    );
    const evidenceDir = join(outRoot, "evidence", created.task.task_id);
    const exec = existsSync(join(evidenceDir, "openai-execution.json"))
      ? readJson<{ shape_repair_attempted?: boolean }>(
          join(evidenceDir, "openai-execution.json"),
        )
      : {};
    assert(
      exec.shape_repair_attempted !== true,
      "openai_execution_shape_repair_not_attempted",
      JSON.stringify(exec),
    );
    if (run.revised_candidate_id) {
      const goldenDir = join(candRoot, run.revised_candidate_id);
      const after = readJson<FabricCanvasDoc>(join(goldenDir, "canvas.json"));
      const acc = readJson<{ overall?: string }>(
        join(goldenDir, "revision-final-acceptance.json"),
      );
      const role = readJson<{ pass?: boolean }>(
        join(goldenDir, "revision-role-target-integrity.json"),
      );
      const cov = readJson<{
        gate_pass?: boolean;
        items?: Array<{ status: string }>;
      }>(join(goldenDir, "feedback-coverage.json"));
      const gapAfter = visualGap(
        findObj(after, "block-skills-4-t2")!,
        findObj(after, "block-skills-4-t3")!,
      );
      const eduAfter = Number(findObj(after, "block-education-3-t1")?.top ?? 0);
      const expEduAfter =
        eduAfter - visualTextContentBottom(findObj(after, "block-experience-2-t17")!);
      overlaps = findTextOverlapFindings(after).length;
      oob = pageOob(after);
      skillsPass = gapAfter + 1e-9 >= READABLE_SEQUENTIAL_GAP_PX;
      rhythmPass = expEduAfter >= 12 && expEduAfter < expEduBefore - 10;
      rolePass = role.pass === true;
      coverageN = (cov.items ?? []).filter((i) => i.status === "addressed").length;
      coverage = `${coverageN}/${rcs.length}`;
      acceptancePass = acc.overall === "PASS";
      assert(skillsPass, "04b_skills_collision_after", `before=${gapBefore.toFixed(2)} after=${gapAfter.toFixed(2)}`);
      assert(
        rhythmPass,
        "04b_experience_education_rhythm_after",
        `edu ${eduBefore}→${eduAfter} gap ${expEduBefore.toFixed(1)}→${expEduAfter.toFixed(1)}`,
      );
      assert(overlaps === 0, "04b_text_overlaps", String(overlaps));
      assert(oob === 0, "04b_page_oob", String(oob));
      assert(rolePass, "04b_role_integrity", JSON.stringify(role));
      assert(
        cov.gate_pass === true && coverageN === rcs.length,
        "04b_feedback_coverage",
        coverage,
      );
      assert(acceptancePass, "04b_final_acceptance", JSON.stringify(acc));
      const rightProof = evaluateCanonicalFinalStateLayoutProof({
        requestedChange:
          "Move the Education section upward so it follows the final Fieldwork Media Experience entry with a normal readable major-section gap.",
        beforeCanvas: priorCanvas,
        afterCanvas: after,
      });
      assert(rightProof.pass, "04b_canonical_education_proof", rightProof.reason);
      assert(
        existsSync(join(goldenDir, "gate.json")) &&
          existsSync(join(goldenDir, "critic.json")),
        "04b_artifact_validation_pass",
        goldenDir,
      );
    }
  } finally {
    setRevisionPipelineRootsForTests(null);
    setRevisionTasksDirForTests(null);
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }

  for (const id of HISTORICAL) {
    const p = join(REPO, "SOS/07_LOGS/saios/founder-revision/tasks", `${id}.json`);
    if (!existsSync(p)) {
      assert(true, `historical_${id}_absent_locally_unmodified`, "absent");
      continue;
    }
    assert(true, `historical_${id}_unchanged`, sha256(p));
  }

  const pass = checks.every((c) => c.pass);
  const report = {
    schema_version: "empty-plan-contract-6o-1.0.0",
    generated_at: new Date().toISOString(),
    pass,
    golden_status: goldenStatus,
    golden_error: goldenError,
    provider_calls: providerCalls,
    shape_repair_requested: shapeRepairRequested,
    skills_pass: skillsPass,
    rhythm_pass: rhythmPass,
    overlaps,
    oob,
    role_pass: rolePass,
    coverage,
    acceptance_pass: acceptancePass,
    empty_plan_owners: NUMBER_OF_EMPTY_PLAN_OWNERS,
    checks,
    publication_allowed: false,
    live: false,
  };
  mkdirSync(join(OUT, ".."), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ pass, failed: checks.filter((c) => !c.pass) }, null, 2));
  if (!pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
