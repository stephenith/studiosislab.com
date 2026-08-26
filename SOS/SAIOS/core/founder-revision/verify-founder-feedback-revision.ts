/**
 * Focused verify for Founder-feedback OpenAI canvas revision pipeline.
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { buildRevisionPlannerPrompt, validateRevisionPlan } from "./RevisionPromptBuilder.js";
import { executeCanvasOperations } from "./CanvasOperationExecutor.js";
import { buildFeedbackCoverage } from "./FeedbackCoverage.js";
import { createRevisionTaskFromDecision } from "./createRevisionTaskFromDecision.js";
import {
  findTaskByDecisionId,
  REVISION_TASKS_DIR,
} from "./RevisionTaskStore.js";
import { runFounderFeedbackRevision } from "./FounderRevisionPipeline.js";
import { ensureObjectIds, type FabricCanvasDoc } from "./CanvasInventory.js";
import {
  validateCandidateArtifactsForStaging,
  sha256File,
} from "./CandidateStagingArtifacts.js";
import {
  auditRevfbCandidates,
  repairRevfbCriticArtifacts,
} from "./repair-revfb-critic-artifacts.js";
import type { CriticResult } from "../resume-critic/types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(REPO, "SOS/07_LOGS/saios/founder-revision/verify-feedback-revision.json");

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: cond, detail };
}

async function main(): Promise<void> {
  const checks: Check[] = [];
  const fixtureDecision = `fd-verify-revfb-${Date.now().toString(36)}`;
  const fixtureCand = `cand-verify-revfb-${Date.now().toString(36)}`;
  const candDir = join(
    REPO,
    "SOS/07_LOGS/saios/first-production-cycle/candidates",
    fixtureCand,
  );

  const canvas: FabricCanvasDoc = {
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
        data: { role: "pageBackground", kind: "page-bg", system: true, id: "page-root" },
      },
      {
        type: "rect",
        id: "block-header-0-r0",
        left: 0,
        top: 0,
        width: 794,
        height: 100,
        fill: "#1e3a8a",
        data: { id: "block-header-0-r0", role: "header-band", section: "header" },
      },
      {
        type: "textbox",
        id: "block-header-0-t1",
        left: 48,
        top: 40,
        width: 400,
        height: 30,
        text: "Ada Example",
        fontSize: 28,
        fill: "#ffffff",
        data: { id: "block-header-0-t1", section: "header" },
      },
      {
        type: "textbox",
        id: "block-header-0-t2",
        left: 48,
        top: 72,
        width: 400,
        height: 18,
        text: "Software Engineer",
        fontSize: 14,
        fill: "#ffffff",
        data: { id: "block-header-0-t2", section: "header" },
      },
      {
        type: "textbox",
        id: "block-header-0-t3",
        left: 48,
        top: 140,
        width: 600,
        height: 16,
        text: "ada@example.com · 555-0100",
        fontSize: 11,
        fill: "#0a0a0a",
        data: { id: "block-header-0-t3", section: "header" },
      },
      {
        type: "textbox",
        id: "summary-h",
        left: 80,
        top: 200,
        width: 200,
        height: 16,
        text: "SUMMARY",
        data: { id: "summary-h", section: "summary" },
      },
    ],
  };

  mkdirSync(candDir, { recursive: true });
  writeFileSync(join(candDir, "canvas.json"), `${JSON.stringify(canvas, null, 2)}\n`);
  writeFileSync(
    join(candDir, "resume-template.json"),
    `${JSON.stringify({ id: "fixture", schema_version: 1 }, null, 2)}\n`,
  );
  writeFileSync(
    join(candDir, "candidate.json"),
    `${JSON.stringify(
      {
        candidate_id: fixtureCand,
        review_id: `founder-review-${fixtureCand}`,
        status: "READY_FOR_FOUNDER_REVIEW",
        target: { title: "Software Engineer modern v0", category: "engineering" },
      },
      null,
      2,
    )}\n`,
  );

  const priorHash = createHash("sha256")
    .update(readFileSync(join(candDir, "canvas.json")))
    .digest("hex");

  // 1. decision → revision task
  const created = createRevisionTaskFromDecision({
    decision_id: fixtureDecision,
    review_id: `founder-review-${fixtureCand}`,
    decision: "CHANGES_REQUESTED",
    reason: "Unify header",
    requested_changes: [
      "Move contact inside the blue header by extending the blue background.",
      "Improve header visual hierarchy so contact feels included.",
    ],
    structured_feedback: { candidate_id: fixtureCand },
  });
  checks.push(
    assert(
      created.ok && created.created && !!created.task,
      "decision_to_revision_task",
      created.error ?? created.task?.task_id ?? "missing",
    ),
  );

  // 2. duplicate prevention
  const dup = createRevisionTaskFromDecision({
    decision_id: fixtureDecision,
    review_id: `founder-review-${fixtureCand}`,
    decision: "CHANGES_REQUESTED",
    reason: "Unify header",
    requested_changes: ["Move contact inside the blue header by extending the blue background."],
    structured_feedback: { candidate_id: fixtureCand },
  });
  checks.push(
    assert(
      dup.ok && dup.created === false && dup.task?.task_id === created.task?.task_id,
      "duplicate_task_prevention",
      `created=${dup.created} id=${dup.task?.task_id}`,
    ),
  );
  checks.push(
    assert(
      findTaskByDecisionId(fixtureDecision)?.task_id === created.task?.task_id,
      "find_by_decision_id",
      "ok",
    ),
  );

  // 3. feedback verbatim in prompt + previous canvas inventory
  const prompt = buildRevisionPlannerPrompt({
    task: created.task!,
    inventory: [
      {
        id: "block-header-0-t3",
        index: 4,
        type: "textbox",
        text: "ada@example.com · 555-0100",
        left: 48,
        top: 140,
        width: 600,
        height: 16,
        fill: "#0a0a0a",
        stroke: null,
        fontSize: 11,
        fontWeight: null,
        lineHeight: null,
        role: null,
        section: "header",
        locked: false,
        system: false,
        group_id: null,
      },
    ],
    page_width: 794,
    page_height: 1123,
    preview_width: 794,
    preview_height: 1123,
  });
  checks.push(
    assert(
      prompt.instructions.includes(
        "Move contact inside the blue header by extending the blue background.",
      ) &&
        prompt.instructions.includes("FOUNDER REASON (verbatim):") &&
        prompt.objective.includes("Do NOT generate a new unrelated resume"),
      "feedback_verbatim_in_prompt",
      "prompt contains founder text",
    ),
  );
  checks.push(
    assert(
      prompt.instructions.includes("block-header-0-t3") &&
        prompt.instructions.includes("CANVAS OBJECT INVENTORY"),
      "previous_canvas_supplied",
      "inventory present",
    ),
  );

  // 4. schema validation
  const bad = validateRevisionPlan({ operations: [{ op: "hack_system" }] });
  checks.push(
    assert(!bad.ok, "schema_rejects_unknown_op", bad.errors.join("; ")),
  );
  const goodPlan = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "unify header",
    operations: [
      {
        op: "extend_shape",
        target_id: "block-header-0-r0",
        before_summary: "Header band rect height below contact",
        intended_change: "extend blue header",
        values: { height: 170 },
        founder_feedback_item:
          "Move contact inside the blue header by extending the blue background.",
        confidence: 0.9,
      },
      {
        op: "set_position",
        target_id: "block-header-0-t3",
        before_summary: "Contact textbox below header band",
        intended_change: "move contact into header",
        values: { top: 110, fill: "#ffffff" },
        founder_feedback_item:
          "Move contact inside the blue header by extending the blue background.",
        confidence: 0.9,
      },
      {
        op: "set_fill",
        target_id: "block-header-0-t3",
        before_summary: "Contact textbox dark fill",
        intended_change: "light text on blue",
        values: { fill: "#ffffff" },
        founder_feedback_item:
          "Improve header visual hierarchy so contact feels included.",
        confidence: 0.85,
      },
      {
        op: "adjust_font_size",
        target_id: "block-header-0-t2",
        before_summary: "Title textbox current font size",
        intended_change: "title weight",
        values: { fontSize: 15 },
        founder_feedback_item:
          "Improve header visual hierarchy so contact feels included.",
        confidence: 0.8,
      },
    ],
  });
  checks.push(
    assert(goodPlan.ok && !!goodPlan.plan, "schema_accepts_valid_plan", "ok"),
  );

  // 5. bounds + locked background + unresolved selector
  const lockedTry = executeCanvasOperations({
    canvas,
    operations: [
      {
        op: "move_object",
        target_id: "page-root",
        intended_change: "move bg",
        values: { top: 10 },
        founder_feedback_item: "x",
        confidence: 1,
      },
    ],
  });
  checks.push(
    assert(
      !lockedTry.ok && /locked page background/i.test(lockedTry.error ?? ""),
      "locked_background_protection",
      lockedTry.error ?? "",
    ),
  );

  const unresolved = executeCanvasOperations({
    canvas,
    operations: [
      {
        op: "move_object",
        target_id: "does-not-exist",
        intended_change: "x",
        values: { top: 10 },
        founder_feedback_item: "x",
        confidence: 1,
      },
    ],
  });
  checks.push(
    assert(
      !unresolved.ok && /unresolved/i.test(unresolved.error ?? ""),
      "unresolved_selector_fail_closed",
      unresolved.error ?? "",
    ),
  );

  const applied = executeCanvasOperations({
    canvas: ensureObjectIds(canvas),
    operations: goodPlan.plan!.operations,
  });
  checks.push(assert(applied.ok, "executor_applies_allowlisted_ops", applied.error ?? "ok"));
  const header = (applied.canvas.objects ?? []).find(
    (o) => o.id === "block-header-0-r0",
  ) as { height?: number };
  const contact = (applied.canvas.objects ?? []).find(
    (o) => o.id === "block-header-0-t3",
  ) as { top?: number };
  checks.push(
    assert(
      (header?.height ?? 0) >= 170 && (contact?.top ?? 999) < 170,
      "bounds_safety_header_unify",
      `h=${header?.height} contactTop=${contact?.top}`,
    ),
  );

  // 6. coverage gate
  const coverageFail = buildFeedbackCoverage({
    requested_changes: [
      "Move contact inside the blue header by extending the blue background.",
      "Totally unrelated request that was ignored.",
    ],
    plan: goodPlan.plan!,
    log: applied.log,
    beforeCanvas: canvas,
    afterCanvas: applied.canvas,
  });
  checks.push(
    assert(
      coverageFail.gate_pass === false,
      "feedback_coverage_gate_blocks_incomplete",
      JSON.stringify(coverageFail.items.map((i) => i.status)),
    ),
  );

  const coverageOk = buildFeedbackCoverage({
    requested_changes: created.task!.requested_changes,
    plan: goodPlan.plan!,
    log: applied.log,
    beforeCanvas: canvas,
    afterCanvas: applied.canvas,
  });
  checks.push(
    assert(
      coverageOk.gate_pass === true,
      "feedback_coverage_gate_passes_complete",
      JSON.stringify(coverageOk.items.map((i) => i.status)),
    ),
  );

  // 7. full pipeline with injected planner + passing critic (no live OpenAI)
  function passingCritic(): CriticResult {
    const scores = {
      overall: 100,
      ats: 100,
      visual: 99,
      typography: 100,
      layout: 100,
      technical: 100,
      consistency: 100,
      sections: 100,
      thumbnail_appeal: 98,
      contrast: 100,
    };
    return {
      scores,
      reports: {
        overall: { category: "overall", score: 100, findings: [], notes: [] },
        ats: { category: "ats", score: 100, findings: [], notes: [] },
        visual: { category: "visual", score: 99, findings: [], notes: [] },
        typography: { category: "typography", score: 100, findings: [], notes: [] },
        layout: { category: "layout", score: 100, findings: [], notes: [] },
        technical: { category: "technical", score: 100, findings: [], notes: [] },
        consistency: { category: "consistency", score: 100, findings: [], notes: [] },
        sections: { category: "sections", score: 100, findings: [], notes: [] },
        thumbnail_appeal: {
          category: "thumbnail_appeal",
          score: 98,
          findings: [],
          notes: [],
        },
        contrast: { category: "contrast", score: 100, findings: [], notes: [] },
      } as CriticResult["reports"],
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
    };
  }

  const priorCriticPath = join(candDir, "critic.json");
  writeFileSync(
    priorCriticPath,
    `${JSON.stringify({ scores: { overall: 1, ats: 1 }, marker: "PRIOR_CRITIC_MUST_NOT_COPY" }, null, 2)}\n`,
  );

  const run = await runFounderFeedbackRevision({
    task_id: created.task!.task_id,
    skip_preview: true,
    executePlanner: async () => ({
      status: "COMPLETED",
      structured_output: goodPlan.plan as unknown as Record<string, unknown>,
      provider_request_id: "verify-mock",
      model_identifier_internal: "verify",
      input_tokens: 10,
      output_tokens: 10,
    }),
    critiqueOverride: passingCritic,
  });
  checks.push(
    assert(run.ok && !!run.revised_candidate_id, "pipeline_creates_revised_candidate", run.error ?? run.revised_candidate_id ?? ""),
  );

  const afterPriorHash = createHash("sha256")
    .update(readFileSync(join(candDir, "canvas.json")))
    .digest("hex");
  checks.push(
    assert(
      afterPriorHash === priorHash,
      "original_candidate_immutability",
      afterPriorHash,
    ),
  );

  let revisedDir: string | null = null;
  if (run.revised_candidate_id) {
    revisedDir = join(
      REPO,
      "SOS/07_LOGS/saios/first-production-cycle/candidates",
      run.revised_candidate_id,
    );
    const summary = JSON.parse(
      readFileSync(join(revisedDir, "revision-summary.json"), "utf8"),
    ) as {
      status?: string;
      revision_number?: number;
      validation?: {
        critic_overall?: number | null;
        critic_ats?: number | null;
        layout_pass?: boolean;
        ats_pass?: boolean;
      };
    };
    const waiting = JSON.parse(
      readFileSync(join(revisedDir, "waiting-founder.json"), "utf8"),
    ) as { revised?: boolean; prior_status?: string };
    const candManifest = JSON.parse(
      readFileSync(join(revisedDir, "candidate.json"), "utf8"),
    ) as { artifacts?: Record<string, string> };
    const critic = JSON.parse(
      readFileSync(join(revisedDir, "critic.json"), "utf8"),
    ) as { scores?: { overall?: number }; marker?: string };
    const gate = JSON.parse(
      readFileSync(join(revisedDir, "gate.json"), "utf8"),
    ) as { ready?: boolean };

    checks.push(
      assert(
        summary.status === "READY_FOR_FOUNDER_REVIEW" &&
          waiting.revised === true &&
          waiting.prior_status === "CHANGES_REQUESTED",
        "revised_candidate_dashboard_state",
        `status=${summary.status} revised=${waiting.revised}`,
      ),
    );
    checks.push(
      assert(
        existsSync(join(revisedDir, "critic.json")),
        "critic_json_generated",
        "ok",
      ),
    );
    checks.push(
      assert(
        existsSync(join(revisedDir, "gate.json")) && gate.ready === true,
        "gate_json_generated",
        JSON.stringify(gate),
      ),
    );
    checks.push(
      assert(
        critic.marker !== "PRIOR_CRITIC_MUST_NOT_COPY" &&
          critic.scores?.overall === 100,
        "prior_critic_not_copied",
        JSON.stringify(critic).slice(0, 120),
      ),
    );
    checks.push(
      assert(
        summary.validation?.critic_overall === 100 &&
          summary.validation?.critic_ats === 100 &&
          summary.validation?.ats_pass === true &&
          summary.validation?.layout_pass === true,
        "real_scores_in_revision_summary",
        JSON.stringify(summary.validation),
      ),
    );
    checks.push(
      assert(
        candManifest.artifacts?.critic === "critic.json" &&
          candManifest.artifacts?.gate === "gate.json" &&
          candManifest.artifacts?.editor_compatibility ===
            "editor-compatibility.json",
        "candidate_artifact_manifest_includes_critic_gate",
        JSON.stringify(candManifest.artifacts),
      ),
    );
    const invent = validateCandidateArtifactsForStaging(revisedDir, {
      requireGate: true,
    });
    checks.push(
      assert(
        invent.ok,
        "revision_artifact_inventory_complete",
        invent.missing.join(","),
      ),
    );
    const stagingPre = validateCandidateArtifactsForStaging(revisedDir, {
      requireGate: false,
    });
    checks.push(
      assert(
        stagingPre.ok,
        "staging_preflight_passes_for_revised",
        stagingPre.missing.join(","),
      ),
    );
  }

  // 8. critic failure → FAILED_CRITIC
  const failCriticDecision = `fd-verify-critfail-${Date.now().toString(36)}`;
  const failCriticCand = `cand-verify-critfail-${Date.now().toString(36)}`;
  const failCriticDir = join(
    REPO,
    "SOS/07_LOGS/saios/first-production-cycle/candidates",
    failCriticCand,
  );
  mkdirSync(failCriticDir, { recursive: true });
  writeFileSync(
    join(failCriticDir, "canvas.json"),
    `${JSON.stringify(canvas, null, 2)}\n`,
  );
  writeFileSync(
    join(failCriticDir, "resume-template.json"),
    `${JSON.stringify({ id: "x" }, null, 2)}\n`,
  );
  writeFileSync(
    join(failCriticDir, "candidate.json"),
    `${JSON.stringify(
      {
        candidate_id: failCriticCand,
        review_id: `founder-review-${failCriticCand}`,
        status: "READY_FOR_FOUNDER_REVIEW",
        target: { title: "X", category: "engineering" },
      },
      null,
      2,
    )}\n`,
  );
  const failCriticTask = createRevisionTaskFromDecision({
    decision_id: failCriticDecision,
    review_id: `founder-review-${failCriticCand}`,
    decision: "CHANGES_REQUESTED",
    reason: "test",
    requested_changes: [
      "Move contact inside the blue header by extending the blue background.",
      "Improve header visual hierarchy so contact feels included.",
    ],
    structured_feedback: { candidate_id: failCriticCand },
  });
  const failCriticRun = await runFounderFeedbackRevision({
    task_id: failCriticTask.task!.task_id,
    skip_preview: true,
    executePlanner: async () => ({
      status: "COMPLETED",
      structured_output: goodPlan.plan as unknown as Record<string, unknown>,
      provider_request_id: "verify-mock",
      model_identifier_internal: "verify",
      input_tokens: 1,
      output_tokens: 1,
    }),
    critiqueOverride: () => {
      throw new Error("injected critic failure");
    },
  });
  checks.push(
    assert(
      !failCriticRun.ok &&
        failCriticRun.task.status === "FAILED_CRITIC" &&
        !failCriticRun.revised_candidate_id,
      "critic_failure_produces_FAILED_CRITIC",
      `${failCriticRun.task.status} ${failCriticRun.error}`,
    ),
  );

  // 9. gate failure → FAILED_GATE
  const failGateDecision = `fd-verify-gatefail-${Date.now().toString(36)}`;
  const failGateCand = `cand-verify-gatefail-${Date.now().toString(36)}`;
  const failGateDir = join(
    REPO,
    "SOS/07_LOGS/saios/first-production-cycle/candidates",
    failGateCand,
  );
  mkdirSync(failGateDir, { recursive: true });
  writeFileSync(
    join(failGateDir, "canvas.json"),
    `${JSON.stringify(canvas, null, 2)}\n`,
  );
  writeFileSync(
    join(failGateDir, "resume-template.json"),
    `${JSON.stringify({ id: "x" }, null, 2)}\n`,
  );
  writeFileSync(
    join(failGateDir, "candidate.json"),
    `${JSON.stringify(
      {
        candidate_id: failGateCand,
        review_id: `founder-review-${failGateCand}`,
        status: "READY_FOR_FOUNDER_REVIEW",
        target: { title: "X", category: "engineering" },
      },
      null,
      2,
    )}\n`,
  );
  const failGateTask = createRevisionTaskFromDecision({
    decision_id: failGateDecision,
    review_id: `founder-review-${failGateCand}`,
    decision: "CHANGES_REQUESTED",
    reason: "test",
    requested_changes: [
      "Move contact inside the blue header by extending the blue background.",
      "Improve header visual hierarchy so contact feels included.",
    ],
    structured_feedback: { candidate_id: failGateCand },
  });
  const failingCritic = (): CriticResult => {
    const base = passingCritic();
    return {
      ...base,
      scores: {
        ...base.scores,
        overall: 40,
        ats: 40,
        technical: 50,
      },
      readiness: {
        ...base.readiness,
        ready: false,
        founder_review_allowed: false,
        blocked_reasons: ["Overall too low"],
      },
    };
  };
  const failGateRun = await runFounderFeedbackRevision({
    task_id: failGateTask.task!.task_id,
    skip_preview: true,
    executePlanner: async () => ({
      status: "COMPLETED",
      structured_output: goodPlan.plan as unknown as Record<string, unknown>,
      provider_request_id: "verify-mock",
      model_identifier_internal: "verify",
      input_tokens: 1,
      output_tokens: 1,
    }),
    critiqueOverride: failingCritic,
  });
  checks.push(
    assert(
      !failGateRun.ok &&
        failGateRun.task.status === "FAILED_GATE" &&
        !failGateRun.revised_candidate_id,
      "gate_failure_produces_FAILED_GATE",
      `${failGateRun.task.status} ${failGateRun.error}`,
    ),
  );

  // 10. StagingService still rejects missing critic (helper)
  const missingCriticDir = join(
    REPO,
    "SOS/07_LOGS/saios/founder-revision/fixtures-tmp",
    `missing-critic-${Date.now().toString(36)}`,
  );
  mkdirSync(missingCriticDir, { recursive: true });
  for (const f of [
    "canvas.json",
    "resume-template.json",
    "preview.png",
    "thumbnail.png",
    "editor-compatibility.json",
  ]) {
    writeFileSync(
      join(missingCriticDir, f),
      f.endsWith(".png") ? Buffer.from([137, 80, 78, 71]) : "{}\n",
    );
  }
  const missing = validateCandidateArtifactsForStaging(missingCriticDir, {
    requireGate: false,
  });
  checks.push(
    assert(
      !missing.ok && missing.missing.includes("critic.json"),
      "staging_still_rejects_missing_critic",
      missing.missing.join(","),
    ),
  );
  rmSync(missingCriticDir, { recursive: true, force: true });

  // 11. Repair Graphic Designer revfb (real candidate) — canvas immutable
  const GD =
    "cand-creative-graphic-designer-editorial-v0-o-20260727T045842Z-b8946b-revfb-9b4b42";
  const gdDir = join(
    REPO,
    "SOS/07_LOGS/saios/first-production-cycle/candidates",
    GD,
  );
  if (existsSync(gdDir)) {
    const canvasBefore = sha256File(join(gdDir, "canvas.json"));
    const repair = repairRevfbCriticArtifacts(GD);
    const canvasAfter = sha256File(join(gdDir, "canvas.json"));
    checks.push(
      assert(
        canvasBefore === canvasAfter,
        "revised_canvas_unchanged_during_artifact_repair",
        canvasBefore,
      ),
    );
    checks.push(
      assert(
        repair.ok &&
          existsSync(join(gdDir, "critic.json")) &&
          existsSync(join(gdDir, "gate.json")),
        "staging_preflight_passes_for_repaired_graphic_designer",
        JSON.stringify(repair.report.staging_preflight_pass),
      ),
    );
    const gdLife = join(
      REPO,
      "SOS/07_LOGS/saios/staging/lifecycle",
      `${GD}.json`,
    );
    if (existsSync(gdLife)) {
      const life = JSON.parse(readFileSync(gdLife, "utf8")) as {
        lifecycle_status?: string;
        approval_decision_id?: string;
      };
      checks.push(
        assert(
          life.approval_decision_id === "fd-66afab30-89f" &&
            (life.lifecycle_status === "APPROVED" ||
              life.lifecycle_status === "STAGING_FAILED"),
          "founder_approval_unchanged_after_repair",
          JSON.stringify({
            approval_decision_id: life.approval_decision_id,
            lifecycle_status: life.lifecycle_status,
          }),
        ),
      );
    }
  } else {
    checks.push(
      assert(false, "staging_preflight_passes_for_repaired_graphic_designer", "GD missing"),
    );
  }

  // cleanup revised fixture from pipeline success path BEFORE audit
  if (revisedDir && existsSync(revisedDir)) {
    rmSync(revisedDir, { recursive: true, force: true });
  }
  rmSync(candDir, { recursive: true, force: true });
  rmSync(failCriticDir, { recursive: true, force: true });
  rmSync(failGateDir, { recursive: true, force: true });
  for (const t of [failCriticTask.task, failGateTask.task, created.task]) {
    if (!t) continue;
    const tp = join(REVISION_TASKS_DIR, `${t.task_id}.json`);
    if (existsSync(tp)) rmSync(tp, { force: true });
    const ev = join(
      REPO,
      "SOS/07_LOGS/saios/founder-revision/evidence",
      t.task_id,
    );
    if (existsSync(ev)) rmSync(ev, { recursive: true, force: true });
  }
  try {
    const { readdirSync } = await import("node:fs");
    const root = join(
      REPO,
      "SOS/07_LOGS/saios/first-production-cycle/candidates",
    );
    for (const name of readdirSync(root)) {
      if (name.startsWith("cand-verify-")) {
        rmSync(join(root, name), { recursive: true, force: true });
      }
    }
  } catch {
    /* ignore */
  }

  const audit = auditRevfbCandidates().filter(
    (a) => !a.candidate_id.startsWith("cand-verify-"),
  );
  checks.push(
    assert(
      audit.some((a) => a.candidate_id.includes("revfb")),
      "revfb_audit_lists_candidates",
      String(audit.length),
    ),
  );

  const ok = checks.every((c) => c.pass);
  const report = {
    ok,
    at: new Date().toISOString(),
    checks,
    revfb_audit: audit,
    live: false,
    publication_allowed: false,
    website_files_changed: false,
    export_release: false,
  };
  mkdirSync(join(OUT, ".."), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
