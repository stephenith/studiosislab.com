/**
 * Founder-feedback-driven OpenAI canvas revision pipeline.
 * Creates immutable revised resume templates. Never mutates prior canvas.
 * Note: storage still uses legacy candidate_id / candidates/ paths for compatibility.
 * LIVE OFF · publication_allowed=false · no auto-approve.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { writePreviewAndThumbnailGuaranteed } from "../first-production-cycle/ResumeTemplateRuntime.js";
import {
  buildCanvasInventory,
  ensureObjectIds,
  type FabricCanvasDoc,
} from "./CanvasInventory.js";
import { executeCanvasOperations } from "./CanvasOperationExecutor.js";
import { buildFeedbackCoverage } from "./FeedbackCoverage.js";
import { runRevisionAcceptanceChecks } from "./RevisionAcceptanceChecks.js";
import { normalizeRevisionLayout } from "./RevisionLayoutNormalizer.js";
import { planFounderCanvasRevision } from "./RevisionPlanner.js";
import {
  buildPlanWithDeterministicSpacingOwnership,
  isVerticalSpacingRhythmHeavyFeedback,
} from "./DeterministicSpacingPlan.js";
import { isHeaderIdentityLayoutFeedback } from "./HeaderIdentityLayout.js";
import { validatePlanVerticalDirections } from "./PositionOpCanonicalization.js";
import {
  allRequestedChangesAllowEmptyPlan,
  validateRevisionPlan,
} from "./RevisionPromptBuilder.js";
import { validateRevisionPlanSelectors } from "./SelectorResolution.js";
import { validateRevisionPlanAgainstInventory } from "./StructuralAlignmentSafety.js";
import { validatePlanGeometrySafety } from "./PlanGeometrySafety.js";
import { applySectionUnitVerticalSafety } from "./SectionUnitVerticalSafety.js";
import {
  loadRevisionTask,
  updateRevisionTask,
} from "./RevisionTaskStore.js";
import { REVISION_TAG_FB } from "./revision-task-types.js";
import type { ReasoningRequest } from "../ai-brain/ReasoningRequest.js";
import type { RevisionPlan, RevisionTask } from "./revision-task-types.js";
import type { CriticResult } from "../resume-critic/types.js";
import {
  materializeCriticAndGateArtifacts,
  validateCandidateArtifactsForStaging,
  writeEditorCompatibilityFromCanvas,
} from "./CandidateStagingArtifacts.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const CAND_ROOT = join(
  REPO,
  "SOS/07_LOGS/saios/first-production-cycle/candidates",
);
const OUT_ROOT = join(REPO, "SOS/07_LOGS/saios/founder-revision");

const COPY_FILES = [
  "designbrief.json",
  "resume-json-instructions.json",
  "resume-template.json",
  "production-target.json",
  "research-context.json",
  "research-handoff.json",
  "brain.json",
  "knowledge.json",
  "skills.json",
  // editor-compatibility.json is regenerated from revised canvas — never copied
  "renderer.json",
  "pipeline.json",
  "canvas-meta.json",
];

function writeJson(path: string, data: unknown): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function newCandidateIds(priorId: string, decisionId: string): {
  candidate_id: string;
  review_id: string;
  revision_id: string;
} {
  const short = createHash("sha256")
    .update(decisionId)
    .digest("hex")
    .slice(0, 6);
  const candidate_id = `${priorId}-${REVISION_TAG_FB}-${short}`;
  return {
    candidate_id,
    review_id: `founder-review-${candidate_id}`,
    revision_id: `revision-${REVISION_TAG_FB}-${short}`,
  };
}

export type RunRevisionOptions = {
  task_id: string;
  /** Test injection */
  executePlanner?: (request: ReasoningRequest) => Promise<{
    status: string;
    structured_output: Record<string, unknown> | null;
    provider_request_id?: string | null;
    model_identifier_internal?: string | null;
    input_tokens?: number | null;
    output_tokens?: number | null;
    error_details?: { message?: string } | null;
  }>;
  /** Skip preview generation in unit tests */
  skip_preview?: boolean;
  /** Test injection for ResumeCritic */
  critiqueOverride?: () => CriticResult;
};

export type RunRevisionResult = {
  ok: boolean;
  task: RevisionTask;
  revised_candidate_id: string | null;
  error: string | null;
  coverage_gate_pass: boolean;
};

export async function runFounderFeedbackRevision(
  opts: RunRevisionOptions,
): Promise<RunRevisionResult> {
  process.env.SOS_AIOS_LIVE = "0";
  let task = loadRevisionTask(opts.task_id);
  const priorDir = join(CAND_ROOT, task.prior_candidate_id);
  const priorCanvasPath = join(priorDir, "canvas.json");
  if (!existsSync(priorCanvasPath)) {
    task = updateRevisionTask(task.task_id, {
      status: "FAILED",
      error: "prior canvas missing",
    });
    return {
      ok: false,
      task,
      revised_candidate_id: null,
      error: task.error,
      coverage_gate_pass: false,
    };
  }

  // Snapshot prior hash to prove immutability
  const priorCanvasRaw = readFileSync(priorCanvasPath);
  const priorHash = createHash("sha256").update(priorCanvasRaw).digest("hex");

  task = updateRevisionTask(task.task_id, { status: "PLANNING", error: null });

  const priorCanvas = ensureObjectIds(
    JSON.parse(priorCanvasRaw.toString("utf8")) as FabricCanvasDoc,
  );
  const inventory = buildCanvasInventory(priorCanvas);
  const page_width = Number(priorCanvas.width ?? 794);
  const page_height = Number(priorCanvas.height ?? 1123);

  const planned = await planFounderCanvasRevision({
    task,
    inventory,
    page_width,
    page_height,
    execute: opts.executePlanner,
  });

  const evidenceDir = join(OUT_ROOT, "evidence", task.task_id);
  mkdirSync(evidenceDir, { recursive: true });
  writeJson(join(evidenceDir, "planner-prompt.json"), planned.prompt);
  writeJson(join(evidenceDir, "inventory.json"), inventory);

  const writeCoverageRepairEvidence = (): void => {
    const cr = planned.coverage_repair;
    if (!cr) return;
    if (cr.primary_plan) {
      writeJson(join(evidenceDir, "primary-revision-plan.json"), cr.primary_plan);
    } else if ("primary_plan" in planned && planned.primary_plan) {
      writeJson(
        join(evidenceDir, "primary-revision-plan.json"),
        planned.primary_plan,
      );
    }
    if (cr.repair_prompt) {
      writeJson(join(evidenceDir, "coverage-repair-prompt.json"), cr.repair_prompt);
    }
    writeJson(join(evidenceDir, "coverage-repair-execution.json"), {
      provider: "openai",
      provider_request_id: cr.provider_request_id,
      model: cr.model,
      input_tokens: cr.input_tokens,
      output_tokens: cr.output_tokens,
      structured_output: cr.repair_raw_structured,
      publication_allowed: false,
      live: false,
    });
    if (cr.repair_plan) {
      writeJson(join(evidenceDir, "coverage-repair-plan.json"), cr.repair_plan);
    }
    writeJson(join(evidenceDir, "coverage-repair-summary.json"), cr.summary);
  };

  const writeConflictRepairEvidence = (): void => {
    const cfr = planned.conflict_repair;
    if (!cfr) return;
    if (cfr.primary_plan) {
      writeJson(join(evidenceDir, "primary-revision-plan.json"), cfr.primary_plan);
    } else if ("primary_plan" in planned && planned.primary_plan) {
      writeJson(
        join(evidenceDir, "primary-revision-plan.json"),
        planned.primary_plan,
      );
    }
    writeJson(
      join(evidenceDir, "primary-conflict-report.json"),
      cfr.conflict_report,
    );
    if (cfr.repair_prompt) {
      writeJson(
        join(evidenceDir, "conflict-repair-prompt.json"),
        cfr.repair_prompt,
      );
    }
    if (cfr.repair_raw_structured) {
      writeJson(
        join(evidenceDir, "conflict-repair-raw.json"),
        cfr.repair_raw_structured,
      );
    }
    if (cfr.repaired_plan) {
      writeJson(
        join(evidenceDir, "conflict-repaired-plan.json"),
        cfr.repaired_plan,
      );
    }
    writeJson(join(evidenceDir, "conflict-repair-validation.json"), {
      summary: cfr.summary,
      preservation: cfr.summary.preservation,
      validation: cfr.summary.validation,
      provider_request_id: cfr.provider_request_id,
      model: cfr.model,
      input_tokens: cfr.input_tokens,
      output_tokens: cfr.output_tokens,
      publication_allowed: false,
      live: false,
    });
  };

  if (!planned.ok) {
    if (planned.primary_plan) {
      writeJson(
        join(evidenceDir, "primary-revision-plan.json"),
        planned.primary_plan,
      );
    }
    writeCoverageRepairEvidence();
    writeConflictRepairEvidence();
    writeJson(join(evidenceDir, "planner-failure.json"), planned);
    const status =
      planned.status === "FAILED_PROVIDER" ? "FAILED_PROVIDER" : "FAILED";
    task = updateRevisionTask(task.task_id, {
      status,
      error: planned.error,
      openai_execution_path: join(
        "SOS/07_LOGS/saios/founder-revision/evidence",
        task.task_id,
        "planner-failure.json",
      ),
    });
    return {
      ok: false,
      task,
      revised_candidate_id: null,
      error: planned.error,
      coverage_gate_pass: false,
    };
  }

  writeCoverageRepairEvidence();
  writeConflictRepairEvidence();
  writeJson(join(evidenceDir, "revision-plan.json"), planned.plan);
  writeJson(join(evidenceDir, "openai-execution.json"), {
    provider: planned.provider,
    provider_request_id: planned.provider_request_id,
    model: planned.model,
    input_tokens: planned.input_tokens,
    output_tokens: planned.output_tokens,
    structured_output: planned.raw_structured,
    publication_allowed: false,
    live: false,
    coverage_repair_attempted: planned.coverage_repair?.summary.attempted === true,
    conflict_repair_attempted: planned.conflict_repair?.summary.attempted === true,
  });

  let activePlan: RevisionPlan = planned.plan;

  // Spacing/rhythm-heavy or header-identity Founder packets: prefer deterministic
  // normalizer geometry over unsafe AI absolute set_position chains.
  if (
    isVerticalSpacingRhythmHeavyFeedback(task.requested_changes) ||
    isHeaderIdentityLayoutFeedback(task.requested_changes)
  ) {
    const det = buildPlanWithDeterministicSpacingOwnership({
      priorCanvas,
      requested_changes: task.requested_changes,
      aiPlan: activePlan,
    });
    writeJson(join(evidenceDir, "deterministic-spacing-ownership.json"), det);
    if (det.ok && det.plan) {
      const revalidated = validateRevisionPlan(det.plan, {
        requested_changes: task.requested_changes,
        allowEmptyOperations: allRequestedChangesAllowEmptyPlan(
          task.requested_changes,
        ),
      });
      if (revalidated.ok && revalidated.plan) {
        activePlan = revalidated.plan;
        writeJson(join(evidenceDir, "revision-plan.json"), activePlan);
        writeJson(join(evidenceDir, "revision-plan-ai-primary.json"), planned.plan);
      } else {
        writeJson(join(evidenceDir, "deterministic-spacing-revalidation.json"), {
          ok: false,
          errors: revalidated.errors,
          note: "deterministic spacing/header plan not activated; retaining AI plan",
        });
      }
    }
  }

  const directionGate = validatePlanVerticalDirections({
    plan: activePlan,
    inventory,
    requested_changes: task.requested_changes,
  });
  writeJson(join(evidenceDir, "plan-direction-validation.json"), directionGate);
  if (!directionGate.ok) {
    const err = `plan direction validation failed: ${directionGate.errors.join("; ")}`;
    writeJson(join(evidenceDir, "plan-direction-validation-failure.json"), {
      error: err,
      errors: directionGate.errors,
    });
    task = updateRevisionTask(task.task_id, {
      status: "FAILED_GATE",
      error: err,
      openai_execution_path: join(
        "SOS/07_LOGS/saios/founder-revision/evidence",
        task.task_id,
        "openai-execution.json",
      ),
    });
    return {
      ok: false,
      task,
      revised_candidate_id: null,
      error: err,
      coverage_gate_pass: false,
    };
  }

  // Selector uniqueness gate — before any canvas mutation.
  const selectorGate = validateRevisionPlanSelectors(
    priorCanvas,
    activePlan,
  );
  writeJson(join(evidenceDir, "selector-validation.json"), selectorGate);
  if (!selectorGate.ok) {
    writeJson(join(evidenceDir, "selector-validation-failure.json"), selectorGate);
    task = updateRevisionTask(task.task_id, {
      status: "FAILED_GATE",
      error: selectorGate.error,
      openai_execution_path: join(
        "SOS/07_LOGS/saios/founder-revision/evidence",
        task.task_id,
        "openai-execution.json",
      ),
    });
    return {
      ok: false,
      task,
      revised_candidate_id: null,
      error: selectorGate.error,
      coverage_gate_pass: false,
    };
  }

  // Inventory-aware structural alignment / bounds safety — before mutation.
  const inventoryGate = validateRevisionPlanAgainstInventory({
    canvas: priorCanvas,
    plan: activePlan,
  });
  writeJson(join(evidenceDir, "inventory-alignment-safety.json"), inventoryGate);
  if (!inventoryGate.ok) {
    const err = `inventory alignment safety: ${inventoryGate.errors.join("; ")}`;
    writeJson(join(evidenceDir, "inventory-alignment-safety-failure.json"), {
      error: err,
      errors: inventoryGate.errors,
    });
    task = updateRevisionTask(task.task_id, {
      status: "FAILED_GATE",
      error: err,
      openai_execution_path: join(
        "SOS/07_LOGS/saios/founder-revision/evidence",
        task.task_id,
        "openai-execution.json",
      ),
    });
    return {
      ok: false,
      task,
      revised_candidate_id: null,
      error: err,
      coverage_gate_pass: false,
    };
  }

  // Wrap-aware pre-execution plan geometry — reject impossible plans before
  // mutating the working canvas (isolated simulation only).
  const planGeometryGate = validatePlanGeometrySafety({
    canvas: priorCanvas,
    plan: activePlan,
  });
  writeJson(join(evidenceDir, "plan-geometry-safety.json"), planGeometryGate);
  if (!planGeometryGate.ok) {
    const err =
      planGeometryGate.error ??
      "plan geometry safety failed — not executing geometrically invalid plan";
    writeJson(join(evidenceDir, "plan-geometry-safety-failure.json"), {
      error: err,
      report: planGeometryGate,
    });
    task = updateRevisionTask(task.task_id, {
      status: "FAILED_GATE",
      error: err,
      openai_execution_path: join(
        "SOS/07_LOGS/saios/founder-revision/evidence",
        task.task_id,
        "openai-execution.json",
      ),
    });
    return {
      ok: false,
      task,
      revised_candidate_id: null,
      error: err,
      coverage_gate_pass: false,
    };
  }

  task = updateRevisionTask(task.task_id, {
    status: "EXECUTING",
    openai_execution_path: join(
      "SOS/07_LOGS/saios/founder-revision/evidence",
      task.task_id,
      "openai-execution.json",
    ),
  });

  const executed = executeCanvasOperations({
    canvas: priorCanvas,
    operations: activePlan.operations,
  });
  writeJson(join(evidenceDir, "operation-log.json"), executed.log);

  if (!executed.ok) {
    writeJson(join(evidenceDir, "execution-failure.json"), {
      error: executed.error,
      log: executed.log,
    });
    task = updateRevisionTask(task.task_id, {
      status: "FAILED_EXECUTION",
      error: executed.error,
    });
    return {
      ok: false,
      task,
      revised_candidate_id: null,
      error: executed.error,
      coverage_gate_pass: false,
    };
  }

  task = updateRevisionTask(task.task_id, { status: "VALIDATING" });

  // Marker↔heading Y coherence AFTER ops, BEFORE layout normalization.
  // Restores prior/reference Y-delta when known; fail closed otherwise.
  const verticalSafety = applySectionUnitVerticalSafety({
    priorCanvas,
    afterCanvas: executed.canvas,
    requested_changes: task.requested_changes,
  });
  writeJson(
    join(evidenceDir, "section-unit-vertical-safety.json"),
    verticalSafety.report,
  );
  if (!verticalSafety.report.ok) {
    const err =
      verticalSafety.report.error ??
      "section-unit vertical safety failed — not returning to Founder Review";
    task = updateRevisionTask(task.task_id, {
      status: "FAILED_GATE",
      error: err,
    });
    return {
      ok: false,
      task,
      revised_candidate_id: null,
      error: err,
      coverage_gate_pass: false,
    };
  }

  // Deterministic layout normalization AFTER OpenAI ops, BEFORE acceptance.
  // Never mutates priorCanvas; works on a clone of the executed canvas.
  const normalized = normalizeRevisionLayout({
    canvas: verticalSafety.canvas,
    requested_changes: task.requested_changes,
    prior_canvas: priorCanvas,
  });
  writeJson(
    join(evidenceDir, "revision-layout-normalization.json"),
    normalized.report,
  );
  writeJson(join(evidenceDir, "post-normalization-canvas.json"), {
    canvas_source:
      "after_openai_operations_deterministic_layout_and_gap_compaction",
    canvas: normalized.canvas,
  });

  if (!normalized.report.ok) {
    task = updateRevisionTask(task.task_id, {
      status: "FAILED_COVERAGE",
      error:
        normalized.report.error ??
        "deterministic layout normalization failed — not returning to Founder Review",
    });
    writeJson(join(evidenceDir, "feedback-coverage.json"), {
      schema_version: "founder-feedback-coverage-1.0.0",
      all_addressed: false,
      items: [],
      gate_pass: false,
      notes: "layout normalization failed before coverage",
      normalization_error: normalized.report.error,
    });
    return {
      ok: false,
      task,
      revised_candidate_id: null,
      error: task.error,
      coverage_gate_pass: false,
    };
  }

  // Deterministic verification/acceptance on NORMALIZED post-mutation canvas.
  const acceptanceReport = runRevisionAcceptanceChecks({
    beforeCanvas: priorCanvas,
    afterCanvas: normalized.canvas,
    plan: activePlan,
    requested_changes: task.requested_changes,
    task_id: task.task_id,
    decision_id: task.decision_id,
    revision_id: null,
    page_fit: normalized.report.page_fit,
  });
  writeJson(
    join(evidenceDir, "revision-acceptance-checks.json"),
    acceptanceReport,
  );

  // Coverage geometry proofs use final post-normalization canvas (not op-log after).
  const coverage = buildFeedbackCoverage({
    requested_changes: task.requested_changes,
    plan: activePlan,
    log: executed.log,
    beforeCanvas: priorCanvas,
    afterCanvas: normalized.canvas,
    acceptanceReport,
  });
  writeJson(join(evidenceDir, "feedback-coverage.json"), coverage);

  if (!coverage.gate_pass) {
    task = updateRevisionTask(task.task_id, {
      status: "FAILED_COVERAGE",
      error: "feedback coverage gate failed — not returning to Founder Review",
    });
    return {
      ok: false,
      task,
      revised_candidate_id: null,
      error: task.error,
      coverage_gate_pass: false,
    };
  }

  // Materialize immutable revised resume template (legacy candidate_id path)
  const ids = newCandidateIds(task.prior_candidate_id, task.decision_id);
  const outDir = join(CAND_ROOT, ids.candidate_id);
  if (existsSync(outDir)) {
    rmSync(outDir, { recursive: true, force: true });
  }
  mkdirSync(outDir, { recursive: true });

  // Preserve prior snapshot under prior/revisions (do not alter prior canvas)
  const snapDir = join(priorDir, "revisions", REVISION_TAG_FB, "pre-revision-snapshot");
  mkdirSync(snapDir, { recursive: true });
  for (const f of ["canvas.json", "preview.png", "thumbnail.png", "candidate.json"]) {
    const src = join(priorDir, f);
    if (existsSync(src)) copyFileSync(src, join(snapDir, f));
  }

  for (const f of COPY_FILES) {
    const src = join(priorDir, f);
    if (existsSync(src)) copyFileSync(src, join(outDir, f));
  }

  writeJson(join(outDir, "canvas.json"), normalized.canvas);
  writeJson(join(outDir, "revision-plan.json"), activePlan);
  writeJson(join(outDir, "operation-log.json"), executed.log);
  writeJson(join(outDir, "revision-layout-normalization.json"), normalized.report);
  writeJson(join(outDir, "revision-acceptance-checks.json"), acceptanceReport);
  writeJson(join(outDir, "feedback-coverage.json"), coverage);
  writeJson(join(outDir, "openai-execution.json"), {
    provider: planned.provider,
    provider_request_id: planned.provider_request_id,
    model: planned.model,
    input_tokens: planned.input_tokens,
    output_tokens: planned.output_tokens,
    publication_allowed: false,
    live: false,
  });
  writeJson(join(outDir, "prior-immutability.json"), {
    prior_candidate_id: task.prior_candidate_id,
    prior_canvas_sha256: priorHash,
    verified_unchanged_at: new Date().toISOString(),
  });

  if (!opts.skip_preview) {
    await writePreviewAndThumbnailGuaranteed({
      canvasJson: normalized.canvas as never,
      outputDir: outDir,
      reviewId: ids.review_id,
    });
  } else {
    // Minimal placeholders for tests that skip rendering
    writeFileSync(join(outDir, "preview.png"), Buffer.from([137, 80, 78, 71]));
    writeFileSync(join(outDir, "thumbnail.png"), Buffer.from([137, 80, 78, 71]));
  }

  // Regenerate editor compatibility from normalized revised canvas (do not copy prior)
  writeEditorCompatibilityFromCanvas(outDir, normalized.canvas as never);

  // Fresh ResumeCritic + gate — never copy prior critic.json / gate.json
  const quality = materializeCriticAndGateArtifacts({
    repoRoot: REPO,
    candidateDir: outDir,
    candidate_id: ids.candidate_id,
    title: task.role,
    critiqueOverride: opts.critiqueOverride,
  });
  writeJson(join(evidenceDir, "critic-materialization.json"), {
    ok: quality.ok,
    failure: quality.failure,
    error: quality.error,
    scores: quality.scores,
    gate_ready: quality.gate_ready,
    at: new Date().toISOString(),
  });

  if (!quality.ok) {
    const status =
      quality.failure === "CRITIC"
        ? "FAILED_CRITIC"
        : quality.failure === "GATE"
          ? "FAILED_GATE"
          : "FAILED_ARTIFACTS";
    task = updateRevisionTask(task.task_id, {
      status,
      error: quality.error,
      revised_candidate_id: null,
      revised_review_id: null,
    });
    writeJson(join(evidenceDir, "run-result.json"), {
      ok: false,
      status,
      error: quality.error,
      revised_candidate_id: null,
      at: new Date().toISOString(),
    });
    // Leave outDir as evidence; do not mark READY_FOR_FOUNDER_REVIEW
    writeJson(join(outDir, "revision-failure.json"), {
      status,
      error: quality.error,
      publication_allowed: false,
      ready_for_founder_review: false,
    });
    return {
      ok: false,
      task,
      revised_candidate_id: null,
      error: quality.error,
      coverage_gate_pass: true,
    };
  }

  const artifactCheck = validateCandidateArtifactsForStaging(outDir, {
    requireGate: true,
  });
  if (!artifactCheck.ok) {
    task = updateRevisionTask(task.task_id, {
      status: "FAILED_ARTIFACTS",
      error: `Incomplete staging artifacts: ${artifactCheck.missing.join(", ")}`,
      revised_candidate_id: null,
    });
    writeJson(join(evidenceDir, "artifact-validation.json"), artifactCheck);
    writeJson(join(outDir, "revision-failure.json"), {
      status: "FAILED_ARTIFACTS",
      missing: artifactCheck.missing,
      ready_for_founder_review: false,
      publication_allowed: false,
    });
    return {
      ok: false,
      task,
      revised_candidate_id: null,
      error: task.error,
      coverage_gate_pass: true,
    };
  }

  const now = new Date().toISOString();
  let priorManifest: Record<string, unknown> = {};
  try {
    priorManifest = readJson(join(priorDir, "candidate.json"));
  } catch {
    priorManifest = {};
  }
  const target = (priorManifest.target as Record<string, unknown>) ?? {};

  const changes_applied = coverage.items
    .filter((i) => i.status === "addressed")
    .map((i) => i.founder_feedback_item);
  const changes_not_applied = coverage.items
    .filter((i) => i.status !== "addressed")
    .map((i) => i.founder_feedback_item);

  const content_pass =
    changes_applied.length > 0 || task.requested_changes.length === 0;

  const summary = {
    schema_version: "founder-revision-summary-1.0.0",
    candidate_id: ids.candidate_id,
    prior_candidate_id: task.prior_candidate_id,
    prior_revision_id: null,
    new_revision_id: ids.revision_id,
    revision_number: task.revision_number,
    role: task.role,
    design_family: task.design_family,
    review_id: ids.review_id,
    prior_review_id: task.review_id,
    prior_decision_id: task.decision_id,
    revision_task_id: task.task_id,
    requested_changes: task.requested_changes,
    changes_applied,
    changes_not_applied,
    feedback_coverage_gate: true,
    engine: "openai_canvas_revision_v1",
    validation: {
      layout_pass: quality.layout_pass,
      ats_pass: quality.ats_pass,
      content_pass,
      asset_pass:
        existsSync(join(outDir, "preview.png")) &&
        existsSync(join(outDir, "thumbnail.png")),
      critic_overall: quality.scores?.overall ?? null,
      critic_ats: quality.scores?.ats ?? null,
      critic_layout: quality.scores?.layout ?? null,
      critic_technical: quality.scores?.technical ?? null,
      overflow: quality.overflow,
      gate_ready: quality.gate_ready,
    },
    preview: "preview.png",
    thumbnail: "thumbnail.png",
    status: "READY_FOR_FOUNDER_REVIEW",
    ready_for_founder_review: true,
    approved: false,
    publication_allowed: false,
    live: false,
    created_at: now,
    changelog_path: "changelog.json",
  };
  writeJson(join(outDir, "revision-summary.json"), summary);
  writeJson(join(outDir, "changelog.json"), {
    schema_version: "founder-revision-changelog-1.0.0",
    revision_id: ids.revision_id,
    prior_candidate_id: task.prior_candidate_id,
    new_candidate_id: ids.candidate_id,
    decision_id: task.decision_id,
    role: task.role,
    requested_changes: task.requested_changes,
    changes_applied,
    changes_not_applied,
    at: now,
  });

  writeJson(join(outDir, "candidate.json"), {
    schema_version: 1,
    candidate_id: ids.candidate_id,
    template_id: ids.candidate_id,
    product_kind: "resume_template",
    task_id: `cycle-${ids.candidate_id}`,
    review_id: ids.review_id,
    cycle_id: `cycle-run-${ids.candidate_id}`,
    run_id: ids.candidate_id,
    created_at: now,
    updated_at: now,
    status: "READY_FOR_FOUNDER_REVIEW",
    publication_allowed: false,
    provider: "openai",
    failure_stage: null,
    failure_detail: null,
    revision: {
      revision_id: ids.revision_id,
      revision_number: task.revision_number,
      prior_candidate_id: task.prior_candidate_id,
      prior_review_id: task.review_id,
      prior_decision_id: task.decision_id,
      revision_task_id: task.task_id,
      tag: REVISION_TAG_FB,
      engine: "openai_canvas_revision_v1",
      ready_for_founder_review: true,
      approved: false,
    },
    target: {
      ...target,
      title: `${task.role} ${task.design_family ?? ""} revised v${task.revision_number}`.trim(),
      objective: `Founder feedback revision of ${task.prior_candidate_id} · decision ${task.decision_id}`,
    },
    artifacts: {
      canvas: "canvas.json",
      preview: "preview.png",
      thumbnail: "thumbnail.png",
      critic: "critic.json",
      gate: "gate.json",
      editor_compatibility: "editor-compatibility.json",
      resume_template: "resume-template.json",
      revision_summary: "revision-summary.json",
      feedback_coverage: "feedback-coverage.json",
      operation_log: "operation-log.json",
      openai_execution: "openai-execution.json",
    },
  });

  // Final inventory gate — must not mark ready with incomplete files
  const finalArtifacts = validateCandidateArtifactsForStaging(outDir, {
    requireGate: true,
  });
  if (!finalArtifacts.ok) {
    task = updateRevisionTask(task.task_id, {
      status: "FAILED_ARTIFACTS",
      error: `Final artifact inventory incomplete: ${finalArtifacts.missing.join(", ")}`,
    });
    return {
      ok: false,
      task,
      revised_candidate_id: null,
      error: task.error,
      coverage_gate_pass: true,
    };
  }

  writeJson(join(outDir, "waiting-founder.json"), {
    state: "READY_FOR_FOUNDER_REVIEW",
    founder_review_status: "ready_for_review",
    revised: true,
    revision_number: task.revision_number,
    prior_candidate_id: task.prior_candidate_id,
    prior_status: "CHANGES_REQUESTED",
    prior_decision_id: task.decision_id,
    message:
      `Revision ${task.revision_number} — Ready for Review. Founder feedback addressed. No auto-decision. No publication.`,
    publication_allowed: false,
    live: false,
    dry_run: true,
    candidate_id: ids.candidate_id,
    review_id: ids.review_id,
  });

  writeJson(join(outDir, "review.json"), {
    review_id: ids.review_id,
    candidate_id: ids.candidate_id,
    status: "READY_FOR_FOUNDER_REVIEW",
    revised: true,
    revision_number: task.revision_number,
    prior_candidate_id: task.prior_candidate_id,
    prior_decision_id: task.decision_id,
    requested_changes: task.requested_changes,
    changes_applied,
    approved: false,
    publication_allowed: false,
  });

  writeJson(join(priorDir, "revisions", REVISION_TAG_FB, "forward-link.json"), {
    new_candidate_id: ids.candidate_id,
    new_review_id: ids.review_id,
    revision_id: ids.revision_id,
    decision_id: task.decision_id,
    revision_task_id: task.task_id,
    at: now,
  });

  // Mark prior superseded for queue (do not touch canvas)
  try {
    const afterPriorRaw = readFileSync(priorCanvasPath);
    const afterHash = createHash("sha256").update(afterPriorRaw).digest("hex");
    if (afterHash !== priorHash) {
      throw new Error("CRITICAL: prior canvas mutated during revision");
    }
    writeJson(join(priorDir, "candidate.json"), {
      ...priorManifest,
      superseded_by_revision: ids.candidate_id,
      revision_forward: {
        tag: REVISION_TAG_FB,
        new_candidate_id: ids.candidate_id,
        new_review_id: ids.review_id,
        decision_id: task.decision_id,
      },
      updated_at: now,
    });
  } catch (e) {
    task = updateRevisionTask(task.task_id, {
      status: "FAILED",
      error: e instanceof Error ? e.message : String(e),
    });
    return {
      ok: false,
      task,
      revised_candidate_id: null,
      error: task.error,
      coverage_gate_pass: true,
    };
  }

  task = updateRevisionTask(task.task_id, {
    status: "READY_FOR_FOUNDER_REVIEW",
    revised_candidate_id: ids.candidate_id,
    revised_review_id: ids.review_id,
    error: null,
  });

  writeJson(join(evidenceDir, "run-result.json"), {
    ok: true,
    revised_candidate_id: ids.candidate_id,
    coverage_gate_pass: true,
    critic_overall: quality.scores?.overall ?? null,
    gate_ready: true,
    at: now,
  });

  return {
    ok: true,
    task,
    revised_candidate_id: ids.candidate_id,
    error: null,
    coverage_gate_pass: true,
  };
}

export type { RevisionPlan };
