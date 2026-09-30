/**
 * C4 — Resume Template Department production-parity harness.
 *
 * One offline harness that calls the same production functions the department
 * uses after render / on Request Changes / on APPROVE. Provider output is
 * fixture-injected. All writes go to mkdtemp roots.
 *
 * Generation persist/preview is not relocated: runFirstProductionCycle still
 * writes CYCLE_LOG. C4 therefore proves the post-render Founder Review
 * admission spine the cycle actually calls, not a second fake generator.
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
import { CriticGate } from "../critic-gate/CriticGate.js";
import { FounderReviewGatekeeper } from "../critic-gate/FounderReviewGatekeeper.js";
import type { CriticResult } from "../resume-critic/types.js";
import { evaluateCanvasRoleTargetIntegrity } from "../role-integrity/RoleTargetIntegrity.js";
import {
  evaluateGenerationFounderReviewAdmission,
  evaluateSharedGeometryAdmission,
} from "../geometry-admission/SharedGeometryAdmission.js";
import { compileFounderFeedbackIR } from "../founder-revision/FounderFeedbackIR.js";
import { evaluateItemFulfillment } from "../founder-revision/FounderFeedbackFulfillment.js";
import {
  CANONICAL_COLLISION_BOUNDS_QA,
  CANONICAL_CONTENT_PRESERVATION,
} from "../founder-revision/RequestedChangeClassification.js";
import {
  runFounderFeedbackRevision,
  setRevisionPipelineRootsForTests,
} from "../founder-revision/FounderRevisionPipeline.js";
import {
  createRevisionTask,
  setRevisionTasksDirForTests,
} from "../founder-revision/RevisionTaskStore.js";
import { validateCandidateArtifactsForStaging } from "../founder-revision/CandidateStagingArtifacts.js";
import type { FabricCanvasDoc } from "../founder-revision/CanvasInventory.js";
import type { RevisionPlan } from "../founder-revision/revision-task-types.js";
import { FounderPreferenceMemoryStore } from "../founder-memory/FounderPreferenceMemoryStore.js";
import { FounderPreferenceWriter } from "../founder-memory/FounderPreferenceWriter.js";
import { classifyMemoryLearningClass } from "../founder-memory/FounderMemoryLearningClass.js";
import { evaluateMemoryMaturation } from "../founder-memory/FounderMemoryMaturation.js";
import { selectFounderMemory } from "../founder-memory/FounderMemoryConsumption.js";
import { toSelectionContext } from "../founder-memory/FounderMemoryContext.js";
import type { FounderPreferenceMemoryRecord } from "../founder-memory/FounderPreferenceMemoryTypes.js";
import type { FounderDecision } from "../founder-decisions/types.js";
import { autoStageAfterFounderApproval } from "../staging/ApprovalStagingHandoff.js";
import { canTransition } from "../staging/TemplateLifecycle.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/department-parity/verify-department-production-parity-c4.json",
);
const LAYOUT_FIXTURE = join(
  REPO,
  ".cursor/debug-fixtures/revtask-a0009171-849-sanitized",
);
const MM_OA =
  "Change the professional title from Marketing Manager to Operations Analyst while preserving the current header design, candidate name, contact layout, colors, and typography.";
const FAMILY_SPACING =
  "Keep compact Skills-to-Projects sidebar rhythm without large blank gaps.";

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function assert(ok: boolean, name: string, detail = ""): void {
  checks.push({ name, pass: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
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

function page(objects: Record<string, unknown>[]): FabricCanvasDoc {
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
      ...objects,
    ],
  } as FabricCanvasDoc;
}

function text(
  id: string,
  text: string,
  top: number,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const section = extra.section ?? null;
  const role = extra.role ?? null;
  const rest = { ...extra };
  delete rest.section;
  delete rest.role;
  return {
    type: "textbox",
    id,
    left: rest.left ?? 48,
    top,
    width: rest.width ?? 400,
    height: rest.height ?? 18,
    text,
    section,
    role,
    data: { id, section, role },
    fontSize: 12,
    fill: "#111",
    ...rest,
  };
}

function validOaCanvas(): FabricCanvasDoc {
  return page([
    text("block-header-0-t1", "Alex Morgan", 24, {
      section: "header",
      role: "name",
    }),
    text("block-header-0-t2", "Operations Analyst", 48, {
      section: "header",
      role: "professional_title",
    }),
    text(
      "block-summary-1-t2",
      "Operations analyst with process and reporting experience.",
      120,
      { section: "summary", height: 36, width: 700 },
    ),
    text("block-experience-2-t2", "Operations Analyst — Northwind", 200, {
      section: "experience",
    }),
  ]);
}

function overlappingCanvas(): FabricCanvasDoc {
  return page([
    text("block-header-0-t2", "Operations Analyst", 40, {
      section: "header",
      role: "professional_title",
    }),
    text("a", "First wrapped line that is tall", 100, {
      section: "skills",
      width: 220,
      height: 40,
    }),
    text("b", "Overlaps first", 120, {
      section: "skills",
      width: 220,
      height: 20,
    }),
  ]);
}

function emptyPlan(): RevisionPlan {
  return {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "no additional operations",
    operations: [],
  };
}

function op(partial: {
  target_id: string;
  intended_change: string;
  values: Record<string, unknown>;
  founder_feedback_item: string;
}): Record<string, unknown> {
  return {
    op: "update_text",
    before_summary: `update_text ${partial.target_id}`,
    confidence: 0.9,
    ...partial,
  };
}

function writePrior(candRoot: string, id: string, canvas: FabricCanvasDoc): void {
  const dir = join(candRoot, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "canvas.json"), `${JSON.stringify(canvas, null, 2)}\n`);
  writeFileSync(
    join(dir, "candidate.json"),
    `${JSON.stringify({ candidate_id: id, status: "READY_FOR_FOUNDER_REVIEW" }, null, 2)}\n`,
  );
  writeFileSync(
    join(dir, "resume-template.json"),
    `${JSON.stringify({ id: "c4-fixture" }, null, 2)}\n`,
  );
}

async function runRevision(input: {
  priorId: string;
  canvas?: FabricCanvasDoc;
  copyPriorFrom?: string;
  role: string;
  requested_changes: string[];
  plan: RevisionPlan | Record<string, unknown>;
}): Promise<{
  status: string;
  error: string | null;
  owner: string | null;
  ok: boolean;
  revised: string | null;
  tmp: string;
  irPath: string | null;
}> {
  const tmp = mkdtempSync(join(tmpdir(), "aios-c4-"));
  const candRoot = join(tmp, "candidates");
  const outRoot = join(tmp, "founder-revision");
  const tasksDir = join(outRoot, "tasks");
  mkdirSync(tasksDir, { recursive: true });
  if (input.copyPriorFrom) {
    cpSync(input.copyPriorFrom, join(candRoot, input.priorId), {
      recursive: true,
    });
  } else if (input.canvas) {
    writePrior(candRoot, input.priorId, input.canvas);
  }
  setRevisionTasksDirForTests(tasksDir);
  setRevisionPipelineRootsForTests({ candRoot, outRoot });
  try {
    const created = createRevisionTask({
      decision_id: `fd-c4-${Date.now().toString(36)}`,
      review_id: `founder-review-${input.priorId}`,
      prior_candidate_id: input.priorId,
      prior_canvas_path: join(candRoot, input.priorId, "canvas.json"),
      founder_reason: "c4 department harness",
      requested_changes: input.requested_changes,
      role: input.role,
      design_family: "professional_sidebar",
      architecture: "narrow_ats_sidebar",
    });
    const result = await runFounderFeedbackRevision({
      task_id: created.task.task_id,
      skip_preview: true,
      critiqueOverride: passingCritic,
      executePlanner: async () => ({
        status: "COMPLETED",
        structured_output: input.plan as Record<string, unknown>,
        provider_request_id: "c4-fixture",
        model_identifier_internal: "fixture",
        input_tokens: 1,
        output_tokens: 1,
      }),
    });
    const irPath = join(
      outRoot,
      "evidence",
      created.task.task_id,
      "founder-feedback-ir.json",
    );
    return {
      status: result.task.status,
      error: result.error,
      owner: result.task.failure_owner ?? null,
      ok: result.ok,
      revised: result.revised_candidate_id,
      tmp,
      irPath: existsSync(irPath) ? irPath : null,
    };
  } finally {
    setRevisionPipelineRootsForTests(null);
    setRevisionTasksDirForTests(null);
  }
}

function decision(
  partial: Partial<FounderDecision> & { decision: FounderDecision["decision"] },
): FounderDecision {
  return {
    decision_id: "fd-c4",
    review_id: "rev-c4",
    task_id: "task-c4",
    cycle_id: "cyc-c4",
    department: "resume",
    founder_actor: "founder",
    reason: "c4",
    structured_feedback: {},
    quality_scores: {},
    requested_changes: [],
    reviewed_artifacts: [],
    provider: "mock",
    dry_run: true,
    created_at: new Date().toISOString(),
    source_interface: "aios_dashboard",
    publication_allowed: false,
    next_action: "none",
    supersedes: null,
    ...partial,
  };
}

function seed(
  store: FounderPreferenceMemoryStore,
  patch: Partial<FounderPreferenceMemoryRecord> & {
    normalized_rule: string;
    scope: FounderPreferenceMemoryRecord["scope"];
    status: FounderPreferenceMemoryRecord["status"];
  },
): FounderPreferenceMemoryRecord {
  return store.upsertActive({
    issue_type: "SPACING",
    raw_founder_feedback: patch.normalized_rule,
    signal_type: "CONSTRAINT",
    confidence: "high",
    candidate_id: "cand-c4",
    review_id: "rev-c4",
    decision_id: "fd-c4",
    revision_task_id: null,
    role: null,
    category: null,
    role_family: null,
    design_family: "executive",
    architecture: "wide_header_single",
    section: null,
    component: null,
    positive_or_negative: "negative",
    source_decision: "CHANGES_REQUESTED",
    acceptance_result: "accepted",
    active: true,
    confidence_merge: false,
    ...patch,
  });
}

async function main(): Promise<void> {
  if (process.env.SOS_AIOS_LIVE === "1") {
    throw new Error("C4 harness refuses SOS_AIOS_LIVE=1");
  }

  const valid = validOaCanvas();
  const overlap = overlappingCanvas();
  const validGeom = evaluateSharedGeometryAdmission(valid);
  const overlapGeom = evaluateSharedGeometryAdmission(overlap);

  const genValid = evaluateGenerationFounderReviewAdmission({
    critic_ready: true,
    critic_gate_ready: true,
    geometry: validGeom,
  });
  const gate = new CriticGate();
  const reviewGk = new FounderReviewGatekeeper();
  const gateValid = gate.evaluate({
    task_id: "c4-gen-valid",
    cycle_id: "c4",
    candidate_id: "c4-gen-valid",
    candidate_title: "C4 valid generation",
    fixture: true,
    scores: {
      overall: 96,
      ats: 98,
      visual: 93,
      typography: 96,
      layout: 94,
      technical: 100,
      consistency: 95,
      sections: 97,
      ready: true,
    },
    geometry_pass: validGeom.pass,
  });
  const reviewValid = reviewGk.canCreateReview({
    review_id: "c4-gen-valid",
    task_id: "c4-gen-valid",
    candidate_id: "c4-gen-valid",
    gate: gateValid.gate,
  });
  const roleValid = evaluateCanvasRoleTargetIntegrity({
    target_title: "Operations Analyst",
    target_role_family: "Operations Analyst",
    canvas: valid,
    sample_title: "Operations Analyst",
    content_source: "deterministic_pack",
  });
  assert(
    validGeom.pass &&
      genValid.admit === true &&
      gateValid.gate.founder_review_allowed === true &&
      reviewValid.allowed === true &&
      roleValid.pass === true,
    "generation_valid_case",
    JSON.stringify({
      admit: genValid.admit,
      review: reviewValid.allowed,
      role: roleValid.match,
    }),
  );

  const genBadGeom = evaluateGenerationFounderReviewAdmission({
    critic_ready: true,
    critic_gate_ready: true,
    geometry: overlapGeom,
  });
  const gateBad = gate.evaluate({
    task_id: "c4-gen-overlap",
    cycle_id: "c4",
    candidate_id: "c4-gen-overlap",
    candidate_title: "C4 overlap generation",
    fixture: true,
    scores: {
      overall: 96,
      ats: 98,
      visual: 93,
      typography: 96,
      layout: 94,
      technical: 100,
      consistency: 95,
      sections: 97,
      ready: true,
    },
    geometry_pass: overlapGeom.pass,
    geometry_blocking_reasons: overlapGeom.fail_codes.map(
      (c) => `SHARED_GEOMETRY_${c}`,
    ),
  });
  assert(
    overlapGeom.pass === false &&
      genBadGeom.admit === false &&
      genBadGeom.blocked_by === "geometry" &&
      gateBad.gate.founder_review_allowed === false,
    "generation_bad_geometry_case",
    JSON.stringify(overlapGeom.fail_codes),
  );

  const mmCanvas = page([
    text("block-header-0-t1", "Alex Morgan", 24, {
      section: "header",
      role: "name",
    }),
    text("block-header-0-t2", "Marketing Manager", 48, {
      section: "header",
      role: "professional_title",
    }),
  ]);
  const roleBad = evaluateCanvasRoleTargetIntegrity({
    target_title: "Operations Analyst",
    target_role_family: "Operations Analyst",
    canvas: mmCanvas,
    sample_title: "Marketing Manager",
    content_source: "deterministic_pack",
  });
  assert(
    roleBad.pass === false,
    "generation_bad_role_case",
    `${roleBad.match} ${roleBad.reason}`,
  );

  const layoutPacket = [
    "Tighten Skills to Projects spacing in the sidebar",
    "Preserve the current Summary content",
    "Preserve Experience content",
    "Preserve Education content",
    "Keep everything else unchanged",
    "Verify there are no overlaps",
  ];
  const layoutIr = compileFounderFeedbackIR(layoutPacket);
  const layoutActions = new Set(layoutIr.items.map((i) => i.action));
  const taskMeta = readJson<{ prior_candidate_id: string; role: string }>(
    join(LAYOUT_FIXTURE, "revtask-a0009171-849.json"),
  );
  const priorCanvas = readJson<FabricCanvasDoc>(
    join(LAYOUT_FIXTURE, "prior", "canvas.json"),
  );
  const priorTexts = (priorCanvas.objects ?? [])
    .filter((o) => {
      const section = String(
        (o as { section?: string; data?: { section?: string } }).section ??
          (o as { data?: { section?: string } }).data?.section ??
          "",
      );
      return ["summary", "experience", "education"].includes(section);
    })
    .map((o) => String((o as { text?: string }).text ?? ""));
  const layoutRun = await runRevision({
    priorId: taskMeta.prior_candidate_id,
    copyPriorFrom: join(LAYOUT_FIXTURE, "prior"),
    role: taskMeta.role,
    requested_changes: layoutPacket,
    plan: emptyPlan(),
  });
  let preserved = false;
  if (layoutRun.revised) {
    const after = readJson<FabricCanvasDoc>(
      join(layoutRun.tmp, "candidates", layoutRun.revised, "canvas.json"),
    );
    const afterTexts = (after.objects ?? [])
      .filter((o) => {
        const section = String(
          (o as { section?: string; data?: { section?: string } }).section ??
            (o as { data?: { section?: string } }).data?.section ??
            "",
        );
        return ["summary", "experience", "education"].includes(section);
      })
      .map((o) => String((o as { text?: string }).text ?? ""));
    preserved =
      priorTexts.length > 0 &&
      priorTexts.every((t) => afterTexts.includes(t));
  }
  assert(
    layoutRun.ok &&
      layoutRun.status === "READY_FOR_FOUNDER_REVIEW" &&
      layoutActions.has("LAYOUT_MUTATION") &&
      layoutActions.has("CONTENT_PRESERVATION") &&
      layoutIr.completeness_sections.length === 0 &&
      Boolean(layoutRun.irPath),
    "revision_layout_only_case",
    `${layoutRun.status} ${layoutRun.owner ?? ""} ${layoutRun.error ?? ""}`,
  );
  assert(
    layoutRun.ok && preserved,
    "revision_preservation_case",
    `preserved=${preserved} revised=${layoutRun.revised ?? ""}`,
  );

  const rewrite =
    "Rewrite the Summary for an Operations Analyst";
  const contentIr = compileFounderFeedbackIR([rewrite]);
  const contentRun = await runRevision({
    priorId: "cand-c4-content",
    canvas: valid,
    role: "Operations Analyst",
    requested_changes: [rewrite],
    plan: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "replace summary",
      operations: [
        op({
          target_id: "block-summary-1-t2",
          intended_change: "replace summary",
          values: {
            text: "Operations Analyst who designs reporting cadence and process controls.",
          },
          founder_feedback_item: rewrite,
        }),
      ],
    },
  });
  assert(
    contentIr.items.some((i) => i.action === "CONTENT_MUTATION") &&
      contentRun.ok &&
      contentRun.status === "READY_FOR_FOUNDER_REVIEW",
    "revision_content_only_case",
    `${contentRun.status} ${contentRun.owner ?? ""} ${contentRun.error ?? ""}`,
  );

  const mixedPacket = [
    "Tighten Skills to Projects spacing in the sidebar",
    "Preserve Experience content",
    rewrite,
  ];
  const mixedIr = compileFounderFeedbackIR(mixedPacket);
  const mixedActions = new Set(mixedIr.items.map((i) => i.action));
  const mixedRun = await runRevision({
    priorId: "cand-c4-mixed",
    canvas: valid,
    role: "Operations Analyst",
    requested_changes: mixedPacket,
    plan: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "layout owned plus summary replace",
      operations: [
        op({
          target_id: "block-summary-1-t2",
          intended_change: "replace summary",
          values: {
            text: "Operations Analyst focused on KPI reporting and intake control.",
          },
          founder_feedback_item: rewrite,
        }),
      ],
    },
  });
  assert(
    mixedActions.has("LAYOUT_MUTATION") &&
      mixedActions.has("CONTENT_MUTATION") &&
      mixedActions.has("CONTENT_PRESERVATION") &&
      mixedRun.ok &&
      mixedRun.status === "READY_FOR_FOUNDER_REVIEW",
    "revision_mixed_case",
    `${[...mixedActions].join(",")} ${mixedRun.status} ${mixedRun.error ?? ""}`,
  );

  const satisfiedIr = compileFounderFeedbackIR([CANONICAL_COLLISION_BOUNDS_QA]);
  const satisfiedRun = await runRevision({
    priorId: "cand-c4-satisfied",
    canvas: valid,
    role: "Operations Analyst",
    requested_changes: [CANONICAL_COLLISION_BOUNDS_QA],
    plan: emptyPlan(),
  });
  assert(
    (satisfiedIr.items[0]?.action === "ALREADY_SATISFIED" ||
      satisfiedIr.items[0]?.classification === "VERIFICATION_ACCEPTANCE") &&
      satisfiedRun.ok &&
      satisfiedRun.status === "READY_FOR_FOUNDER_REVIEW",
    "revision_already_satisfied_case",
    `${satisfiedIr.items[0]?.action ?? ""} ${satisfiedRun.status} ${satisfiedRun.error ?? ""}`,
  );

  const malformed = await runRevision({
    priorId: "cand-c4-malformed",
    canvas: valid,
    role: "Operations Analyst",
    requested_changes: [rewrite],
    plan: { operations: "not-an-array" },
  });
  assert(
    !malformed.ok &&
      (malformed.status === "FAILED" ||
        /plan|schema|provider/i.test(
          `${malformed.owner ?? ""} ${malformed.error ?? ""}`,
        )),
    "malformed_provider_fail_closed_case",
    `${malformed.status} ${malformed.owner ?? ""} ${malformed.error ?? ""}`,
  );

  const badGeomRun = await runRevision({
    priorId: "cand-c4-badgeom",
    canvas: overlap,
    role: "Operations Analyst",
    requested_changes: ["Tighten Skills to Projects spacing in the sidebar"],
    plan: emptyPlan(),
  });
  const badGeomFinal = evaluateSharedGeometryAdmission(overlap);
  assert(
    !badGeomRun.ok &&
      badGeomFinal.pass === false &&
      /geometry|overlap|gate|FOUNDER/i.test(
        `${badGeomRun.status} ${badGeomRun.owner ?? ""} ${badGeomRun.error ?? ""}`,
      ),
    "revision_bad_geometry_case",
    `${badGeomRun.status} ${badGeomRun.owner ?? ""} ${badGeomRun.error ?? ""}`,
  );

  const badRoleRun = await runRevision({
    priorId: "cand-c4-badrole",
    canvas: page([
      text("block-header-0-t2", "Operations Analyst", 40, {
        section: "header",
        role: "professional_title",
      }),
    ]),
    role: "Operations Analyst",
    requested_changes: [MM_OA],
    plan: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "wrong title",
      operations: [
        op({
          target_id: "block-header-0-t2",
          intended_change: "wrong",
          values: { text: "Marketing Manager" },
          founder_feedback_item: MM_OA,
        }),
      ],
    },
  });
  assert(
    !badRoleRun.ok &&
      (badRoleRun.owner === "revision_role_integrity" ||
        /role/i.test(`${badRoleRun.owner ?? ""} ${badRoleRun.error ?? ""}`)),
    "revision_bad_role_case",
    `${badRoleRun.status} ${badRoleRun.owner ?? ""} ${badRoleRun.error ?? ""}`,
  );

  const memRoot = mkdtempSync(join(tmpdir(), "fpm-c4-"));
  mkdirSync(join(memRoot, "SOS/07_LOGS/saios/knowledge/founder-memory"), {
    recursive: true,
  });
  const store = new FounderPreferenceMemoryStore(memRoot);
  const mmOa = seed(store, {
    memory_id: "fpm-c4-mm-oa",
    scope: "ARCHITECTURE",
    issue_type: "HIERARCHY",
    status: "PROVISIONAL",
    normalized_rule: MM_OA,
    raw_founder_feedback: MM_OA,
    design_family: "professional_sidebar",
    architecture: "narrow_ats_sidebar",
  });
  const confirmed = seed(store, {
    scope: "DESIGN_FAMILY",
    status: "CONFIRMED",
    normalized_rule: FAMILY_SPACING,
    design_family: "executive",
    architecture: "wide_header_single",
  });
  const ctx = toSelectionContext({
    schema_version: "founder-memory-context-1.0.0",
    role: "Operations Analyst",
    role_family: "operations_analyst",
    category: "operations",
    design_family: "executive",
    architecture: "wide_header_single",
    design_variant: 0,
    section: null,
    component: null,
    design_family_source: "explicit",
    architecture_source: "explicit",
  });
  const layoutOnlyIr = compileFounderFeedbackIR(layoutPacket);
  const sel = selectFounderMemory({
    store,
    repoRoot: memRoot,
    channel: "revision",
    ctx,
    founderFeedbackIR: layoutOnlyIr,
  });
  assert(
    classifyMemoryLearningClass(mmOa.normalized_rule, mmOa) ===
      "TASK_SPECIFIC" &&
      !sel.selected.some((s) =>
        /Marketing Manager to Operations Analyst/.test(s.injectable_text),
      ) &&
      sel.selected.some((s) =>
        /Skills-to-Projects sidebar rhythm/.test(s.injectable_text),
      ),
    "c3_memory_discipline_in_harness",
    JSON.stringify(
      sel.selected.map((s) => ({
        id: s.memory_id,
        text: s.injectable_text,
        cls: s.learning_class,
      })),
    ),
  );

  const matureTask = evaluateMemoryMaturation(mmOa, {
    revision_outcome: "SUCCESS",
    later_founder_outcome: "APPROVE",
    same_issue_persists: false,
    attribution_certain: true,
  });
  const parentId = "cand-c4-parent";
  const revisedId = `${parentId}-revfb-ok`;
  for (const id of [parentId, revisedId]) {
    mkdirSync(
      join(memRoot, "SOS/07_LOGS/saios/first-production-cycle/candidates", id),
      { recursive: true },
    );
    writeFileSync(
      join(
        memRoot,
        "SOS/07_LOGS/saios/first-production-cycle/candidates",
        id,
        "production-target.json",
      ),
      JSON.stringify({
        title: "Operations Analyst",
        category: "operations",
        role_family: "operations_analyst",
        design_family: "executive",
        architecture: "wide_header_single",
      }),
    );
  }
  const writer = new FounderPreferenceWriter(memRoot);
  writer.writeFromDecision(
    decision({
      decision_id: "fd-c4-chg",
      review_id: "rev-c4-chg",
      decision: "CHANGES_REQUESTED",
      requested_changes: [MM_OA],
      structured_feedback: { candidate_id: parentId },
    }),
  );
  const afterApprove = writer.writeFromDecision(
    decision({
      decision_id: "fd-c4-apr",
      review_id: "rev-c4-apr",
      decision: "APPROVED",
      reason: "Looks fine",
      structured_feedback: { candidate_id: revisedId },
    }),
  );
  const afterStore = new FounderPreferenceMemoryStore(memRoot);
  const taskStillProvisional = afterStore
    .listAll()
    .filter((r) => r.normalized_rule === MM_OA)
    .every((r) => r.status !== "CONFIRMED");
  assert(
    matureTask.verdict === "KEEP_PROVISIONAL" && taskStillProvisional,
    "task_specific_memory_not_globalized",
    matureTask.reason,
  );
  assert(
    afterApprove.ok !== false && taskStillProvisional,
    "simulated_memory_maturation_case",
    `verdict=${matureTask.verdict}`,
  );

  const stageTmp = mkdtempSync(join(tmpdir(), "aios-c4-stage-"));
  const candId = "cand-c4-oa-20260929z-1";
  const candDir = join(stageTmp, candId);
  mkdirSync(candDir, { recursive: true });
  for (const f of [
    "canvas.json",
    "resume-template.json",
    "preview.png",
    "thumbnail.png",
    "critic.json",
    "editor-compatibility.json",
  ]) {
    writeFileSync(
      join(candDir, f),
      f.endsWith(".png") ? Buffer.from([137, 80, 78, 71]) : "{}\n",
    );
  }
  writeFileSync(
    join(candDir, "candidate.json"),
    JSON.stringify({ candidate_id: candId, status: "APPROVED" }),
  );
  const artifacts = validateCandidateArtifactsForStaging(candDir);
  const missing = validateCandidateArtifactsForStaging(
    join(stageTmp, "missing"),
  );
  let staged = false;
  const handoff = await autoStageAfterFounderApproval(
    {
      candidate_id: candId,
      decision: "APPROVED",
      decision_id: "fd-c4-stage",
    },
    {
      candidatesRoot: stageTmp,
      readLife: () => null,
      stageFn: async () => {
        staged = true;
        return {
          ok: true,
          idempotent: false,
          candidate_id: candId,
          generation_id: "gen-c4",
          staging_package_id: "pkg-c4",
          staging_path: null,
          lifecycle_status: "STAGED",
          validation: null,
          error: null,
          publication_allowed: false,
        };
      },
    },
  );
  assert(
    artifacts.ok &&
      !missing.ok &&
      canTransition("APPROVED", "STAGING_REQUESTED") &&
      handoff.attempted === true &&
      staged &&
      handoff.publication_allowed === false,
    "simulated_staging_eligibility_case",
    JSON.stringify({
      artifacts: artifacts.ok,
      missing: missing.missing,
      skip: handoff.skip_reason,
    }),
  );
  assert(
    canTransition("APPROVED", "STAGING_REQUESTED") &&
      matureTask.verdict === "KEEP_PROVISIONAL",
    "simulated_approval_case",
    "APPROVE path used evaluateMemoryMaturation + autoStageAfterFounderApproval",
  );

  assert(
    layoutIr.schema_version?.includes("founder-feedback-ir") ||
      layoutIr.items.length > 0,
    "c1_feedback_compiler_in_harness",
    `${layoutIr.items.length} items completeness=${layoutIr.completeness_sections.join(",")}`,
  );
  assert(
    validGeom.pass &&
      !overlapGeom.pass &&
      genValid.admit &&
      !genBadGeom.admit,
    "c2_shared_geometry_in_harness",
    `${validGeom.fail_codes.join(",")} / ${overlapGeom.fail_codes.join(",")}`,
  );
  assert(
    compileFounderFeedbackIR([CANONICAL_CONTENT_PRESERVATION]).items.some(
      (i) =>
        i.action === "CONTENT_PRESERVATION" ||
        i.classification === "PRESERVATION_CONSTRAINT",
    ),
    "canonical_preservation_still_preservation",
  );

  const C5_LINE =
    "The left green vertical line which is placed should be till the bottom.";
  const C5_EDU =
    "In the education section we can add more content for example: High schooling, college details, graduation details etc.";
  const c5Canvas = page([
    {
      type: "rect",
      id: "page-accent-rail",
      left: 50,
      top: 40,
      width: 4,
      height: 891,
      fill: "#0d9488",
    },
    text("c5-title", "UI Designer", 48, {
      section: "header",
      role: "professional_title",
      width: 400,
      height: 18,
    }),
    text(
      "block-education-3-t2",
      "B.A. in Graphic Design, Arcadia University, 2018",
      700,
      { section: "education", width: 420, height: 20 },
    ),
  ]);
  const c5Ir = compileFounderFeedbackIR([C5_LINE, C5_EDU]);
  assert(
    c5Ir.items[0]?.action === "LAYOUT_MUTATION" &&
      c5Ir.items[0]?.coverage_mode === "MUTATION_REQUIRED" &&
      c5Ir.items[1]?.action === "CONTENT_MUTATION" &&
      c5Ir.content_addition_sections.includes("education"),
    "c5_ir_natural_language_ownership",
    `${c5Ir.items.map((i) => i.action).join(",")} add=${c5Ir.content_addition_sections.join(",")}`,
  );
  assert(
    evaluateItemFulfillment({
      item: c5Ir.items[0]!,
      beforeCanvas: c5Canvas,
      afterCanvas: c5Canvas,
    }).pass === false &&
      evaluateItemFulfillment({
        item: c5Ir.items[1]!,
        beforeCanvas: c5Canvas,
        afterCanvas: c5Canvas,
      }).pass === false,
    "c5_unchanged_canvas_fulfillment_blocked",
  );
  const c5Empty = await runRevision({
    priorId: "cand-c4-c5empty",
    canvas: c5Canvas,
    role: "UI Designer",
    requested_changes: [C5_LINE, C5_EDU],
    plan: emptyPlan(),
  });
  assert(
    !c5Empty.ok && c5Empty.status !== "READY_FOR_FOUNDER_REVIEW",
    "c5_empty_plan_false_pass_blocked",
    `${c5Empty.status} ${c5Empty.owner ?? ""} ${c5Empty.error ?? ""}`,
  );
  const c5Fulfilled: FabricCanvasDoc = JSON.parse(JSON.stringify(c5Canvas));
  const rail = (c5Fulfilled.objects ?? []).find(
    (o) => (o as { id?: string }).id === "page-accent-rail",
  ) as { height?: number };
  if (rail) rail.height = 1083;
  const edu = (c5Fulfilled.objects ?? []).find(
    (o) => (o as { id?: string }).id === "block-education-3-t2",
  ) as { text?: string };
  if (edu) {
    edu.text =
      "B.A. in Graphic Design, Arcadia University, 2018. High school diploma; additional college coursework.";
  }
  assert(
    evaluateItemFulfillment({
      item: c5Ir.items[0]!,
      beforeCanvas: c5Canvas,
      afterCanvas: c5Fulfilled,
    }).pass &&
      evaluateItemFulfillment({
        item: c5Ir.items[1]!,
        beforeCanvas: c5Canvas,
        afterCanvas: c5Fulfilled,
      }).pass,
    "c5_fulfilled_canvas_passes_predicates",
  );
  const c5Run = await runRevision({
    priorId: "cand-c4-c5ok",
    canvas: c5Canvas,
    role: "UI Designer",
    requested_changes: [C5_LINE, C5_EDU],
    plan: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "extend rail and add education",
      operations: [
        {
          op: "set_dimensions",
          target_id: "page-accent-rail",
          intended_change: "extend rail to page bottom",
          before_summary: "page-accent-rail height 891 top 40",
          values: { height: 1083 },
          founder_feedback_item: C5_LINE,
          confidence: 0.9,
        },
        op({
          target_id: "block-education-3-t2",
          intended_change: "add education details",
          values: {
            text: "B.A. in Graphic Design, Arcadia University, 2018. High school diploma; additional college coursework.",
          },
          founder_feedback_item: C5_EDU,
        }),
      ],
    },
  });
  assert(
    c5Run.ok && c5Run.status === "READY_FOR_FOUNDER_REVIEW",
    "c5_fulfilled_revision_ready",
    `${c5Run.status} ${c5Run.owner ?? ""} ${c5Run.error ?? ""}`,
  );

  const natural: Array<[string, string, string]> = [
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
    [
      "Add more education details and the left vertical line should reach the bottom",
      "CONTENT_MUTATION",
      "mixed",
    ],
    [CANONICAL_COLLISION_BOUNDS_QA, "VERIFICATION", "true_already_satisfied"],
    [C5_LINE, "LAYOUT_MUTATION", "false_already_satisfied"],
    ["Do not add more education content", "CONTENT_PRESERVATION", "negation"],
    [
      "Expand the projects section, for example: case studies, outcomes, metrics etc.",
      "CONTENT_MUTATION",
      "embedded_examples",
    ],
  ];
  for (const [line, action, name] of natural) {
    const got = compileFounderFeedbackIR([line]).items[0]?.action;
    assert(got === action, `c4_matrix_${name}`, `${line} => ${got ?? "none"}`);
  }

  const mixedNaturalIr = compileFounderFeedbackIR([
    "Add more education details and the left vertical line should reach the bottom",
  ]);
  assert(
    mixedNaturalIr.items[0]?.fulfillment.some((p) => p.kind === "CONTENT_ADD") &&
      mixedNaturalIr.items[0]?.fulfillment.some((p) => p.kind === "GEOMETRY_EXTENT") &&
      mixedNaturalIr.content_addition_sections.includes("education"),
    "c4_mixed_keeps_content_and_extent",
    JSON.stringify(mixedNaturalIr.items[0]?.fulfillment),
  );

  const probeBefore = page([
    {
      type: "rect",
      id: "probe-rail",
      left: 40,
      top: 40,
      width: 4,
      height: 400,
      fill: "#0d9488",
    },
    text("probe-summary", "Short summary.", 120, {
      section: "summary",
      width: 400,
      height: 20,
    }),
    text("probe-skills", "Excel, Reporting, Demand Generation, ABM", 200, {
      section: "skills",
      width: 220,
      height: 40,
    }),
    text("probe-edu", "B.A. Design, 2018", 700, {
      section: "education",
      width: 400,
      height: 20,
    }),
    text("probe-title", "Marketing Manager", 60, {
      section: "header",
      width: 400,
      height: 18,
    }),
    text("probe-certs", "First Aid", 500, {
      section: "certifications",
      width: 220,
      height: 18,
    }),
    text("probe-projects", "Internal tooling", 400, {
      section: "projects",
      width: 220,
      height: 18,
    }),
    {
      type: "rect",
      id: "heading-bar",
      left: 48,
      top: 36,
      width: 18,
      height: 70,
      fill: "#111827",
    },
  ]);
  const probeAfter = JSON.parse(JSON.stringify(probeBefore)) as FabricCanvasDoc;
  const afterRail = (probeAfter.objects ?? []).find(
    (o) => (o as { id?: string }).id === "probe-rail",
  ) as { height?: number };
  if (afterRail) afterRail.height = 1080;
  const afterEdu = (probeAfter.objects ?? []).find(
    (o) => (o as { id?: string }).id === "probe-edu",
  ) as { text?: string };
  if (afterEdu) afterEdu.text = "B.A. Design, 2018. High school; college; graduation thesis.";
  const afterSkills = (probeAfter.objects ?? []).find(
    (o) => (o as { id?: string }).id === "probe-skills",
  ) as { text?: string };
  if (afterSkills) afterSkills.text = "";
  const afterSummary = (probeAfter.objects ?? []).find(
    (o) => (o as { id?: string }).id === "probe-summary",
  ) as { text?: string };
  if (afterSummary) {
    afterSummary.text =
      "Operations Analyst focused on KPI reporting and workflow optimization.";
  }
  const afterTitle = (probeAfter.objects ?? []).find(
    (o) => (o as { id?: string }).id === "probe-title",
  ) as { text?: string };
  if (afterTitle) afterTitle.text = "Operations Analyst";
  const afterCerts = (probeAfter.objects ?? []).find(
    (o) => (o as { id?: string }).id === "probe-certs",
  ) as { text?: string };
  if (afterCerts) afterCerts.text = "First Aid; operations reporting certificate; KPI workshop.";
  const afterProjects = (probeAfter.objects ?? []).find(
    (o) => (o as { id?: string }).id === "probe-projects",
  ) as { text?: string };
  if (afterProjects) {
    afterProjects.text =
      "Internal tooling. Case studies, outcomes, and metrics for process improvement.";
  }
  const afterBar = (probeAfter.objects ?? []).find(
    (o) => (o as { id?: string }).id === "heading-bar",
  ) as { height?: number };
  if (afterBar) afterBar.height = 1080;

  const fulfillmentProbes: Array<[string, string, boolean, boolean]> = [
    ["add more summary details", "content_add", false, true],
    ["Remove the skills section", "content_remove", false, true],
    ["Rewrite the Summary for an Operations Analyst", "content_rewrite", false, true],
    ["The heading bar should reach the bottom", "object_extend", false, true],
    ["this divider should reach the bottom", "desired_state", false, true],
    ["Extend the sidebar rail downward", "imperative", false, true],
    ["the vertical rule should be till the page edge", "should_be", false, true],
    ["we can add more certifications content", "can_add", false, true],
    [
      "Add more education details and the left vertical line should reach the bottom",
      "mixed",
      false,
      true,
    ],
    [C5_LINE, "false_already_satisfied", false, true],
    [
      "Expand the projects section, for example: case studies, outcomes, metrics etc.",
      "embedded_examples",
      false,
      true,
    ],
  ];
  for (const [line, name, unchangedPass, fulfilledPass] of fulfillmentProbes) {
    const item = compileFounderFeedbackIR([line]).items[0]!;
    const unchanged = evaluateItemFulfillment({
      item,
      beforeCanvas: probeBefore,
      afterCanvas: probeBefore,
    });
    const fulfilled = evaluateItemFulfillment({
      item,
      beforeCanvas: probeBefore,
      afterCanvas: probeAfter,
    });
    assert(
      unchanged.pass === unchangedPass,
      `c4_fulfill_${name}_unchanged`,
      unchanged.notes,
    );
    assert(
      fulfilled.pass === fulfilledPass,
      `c4_fulfill_${name}_canvas`,
      fulfilled.notes,
    );
  }
  assert(
    evaluateItemFulfillment({
      item: compileFounderFeedbackIR(["Preserve Experience content"]).items[0]!,
      beforeCanvas: probeBefore,
      afterCanvas: probeBefore,
    }).pass,
    "c4_fulfill_content_preserve_unchanged",
  );
  assert(
    evaluateItemFulfillment({
      item: compileFounderFeedbackIR([CANONICAL_COLLISION_BOUNDS_QA]).items[0]!,
      beforeCanvas: probeBefore,
      afterCanvas: probeBefore,
    }).pass,
    "c4_fulfill_true_already_satisfied_verification",
  );

  const failed = checks.filter((c) => !c.pass);
  mkdirSync(join(OUT, ".."), { recursive: true });
  writeFileSync(
    OUT,
    `${JSON.stringify(
      {
        schema_version: "department-production-parity-c4-1.0.0",
        pass: failed.length === 0,
        failed: failed.map((c) => c.name),
        checks,
        production_entry_points: [
          "evaluateSharedGeometryAdmission",
          "evaluateGenerationFounderReviewAdmission",
          "CriticGate.evaluate",
          "FounderReviewGatekeeper.canCreateReview",
          "evaluateCanvasRoleTargetIntegrity",
          "compileFounderFeedbackIR",
          "runFounderFeedbackRevision",
          "selectFounderMemory",
          "evaluateMemoryMaturation",
          "FounderPreferenceWriter.writeFromDecision",
          "validateCandidateArtifactsForStaging",
          "canTransition",
          "autoStageAfterFounderApproval",
        ],
        production_logic_duplicated: false,
        write_isolation: "mkdtemp + setRevisionPipelineRootsForTests + fixture critic gate",
        generation_note:
          "Post-render admission spine only. runFirstProductionCycle CYCLE_LOG is not relocatable; full generate/render/preview persist is not executed here.",
        parallel_memory:
          "selectFounderMemory is the prompt-memory path. design-memory.json remains a separate generation design-brain/critic path and is not read by this selector.",
      },
      null,
      2,
    )}\n`,
  );

  for (const dir of [layoutRun.tmp, contentRun.tmp, mixedRun.tmp, satisfiedRun.tmp, malformed.tmp, badGeomRun.tmp, badRoleRun.tmp, memRoot, stageTmp]) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }

  if (failed.length) {
    console.error(`C4 VERIFY FAIL ${failed.map((c) => c.name).join(", ")}`);
    process.exitCode = 1;
    return;
  }
  console.log("C4 VERIFY PASS");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
