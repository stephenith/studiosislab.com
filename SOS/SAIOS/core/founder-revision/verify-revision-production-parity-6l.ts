/**
 * Phase 6L — production-parity harness for Founder Request Changes.
 *
 * Calls the SAME top-level executor as the dispatcher: runFounderFeedbackRevision.
 * Provider output is fixture-injected. No production OpenAI. Isolated temp dirs.
 * RevisionPlanGateCircuit is not release proof.
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
  evaluateCanvasRoleTargetIntegrity,
  evaluateRoleTargetIntegrity,
} from "../role-integrity/RoleTargetIntegrity.js";
import { evaluateRevisionRoleTargetIntegrity } from "../role-integrity/RevisionRoleTargetIntegrity.js";
import {
  NUMBER_OF_PRODUCTION_REQUEST_CHANGES_EXECUTORS,
  PRODUCTION_REQUEST_CHANGES_ENTRY_POINT,
  REVISION_RELEASE_PROOF_HARNESS,
  TEST_ONLY_PARTIAL_CIRCUITS,
} from "./RevisionPipelineClassification.js";
import { evaluateSectionReplacementCompleteness } from "./SectionReplacementCompleteness.js";
import { evaluateRevisionFinalAcceptance } from "./RevisionFinalAcceptance.js";
import {
  REVISION_COPY_FILE_AUDIT,
  runFounderFeedbackRevision,
  setRevisionPipelineRootsForTests,
} from "./FounderRevisionPipeline.js";
import {
  createRevisionTask,
  setRevisionTasksDirForTests,
} from "./RevisionTaskStore.js";
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import type { RevisionPlan } from "./revision-task-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const FIX = join(
  REPO,
  ".cursor/debug-fixtures/revtask-6ddb8eb8-e9c-sanitized",
);
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-revision-production-parity-6l.json",
);
const HISTORICAL = [
  "revtask-b5339d03-b67",
  "revtask-9441fe34-4ba",
  "revtask-b9a65ad0-eb0",
  "revtask-33ef5466-f24",
  "revtask-7a1c0899-4d6",
  "revtask-dd26226e-d8b",
  "revtask-6ddb8eb8-e9c",
];

type Check = { name: string; pass: boolean; detail: string };
function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: !!cond, detail };
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function passingCritic(): CriticResult {
  const scores = {
    overall: 94,
    ats: 100,
    visual: 86,
    typography: 86,
    layout: 93,
    technical: 100,
    consistency: 100,
    sections: 100,
    thumbnail_appeal: 90,
    contrast: 90,
  };
  return {
    scores,
    reports: {
      overall: { category: "overall", score: 94, findings: [], notes: [] },
      ats: { category: "ats", score: 100, findings: [], notes: [] },
      visual: { category: "visual", score: 86, findings: [], notes: [] },
      typography: { category: "typography", score: 86, findings: [], notes: [] },
      layout: { category: "layout", score: 93, findings: [], notes: [] },
      technical: { category: "technical", score: 100, findings: [], notes: [] },
      consistency: { category: "consistency", score: 100, findings: [], notes: [] },
      sections: { category: "sections", score: 100, findings: [], notes: [] },
      thumbnail_appeal: {
        category: "thumbnail_appeal",
        score: 90,
        findings: [],
        notes: [],
      },
      contrast: { category: "contrast", score: 90, findings: [], notes: [] },
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

function textObj(
  id: string,
  text: string,
  top: number,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  const section = extra?.section ?? null;
  const role = extra?.role ?? null;
  const rest = { ...extra };
  delete rest.section;
  delete rest.role;
  return {
    type: "textbox",
    id,
    left: rest.left ?? 40,
    top,
    width: rest.width ?? 200,
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

function miniCanvas(objects: Record<string, unknown>[]): FabricCanvasDoc {
  return {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects,
  } as FabricCanvasDoc;
}

function op(partial: {
  op: string;
  target_id: string;
  intended_change: string;
  values?: Record<string, unknown>;
  founder_feedback_item: string;
}): Record<string, unknown> {
  return {
    before_summary: `${partial.op} ${partial.target_id}`,
    confidence: 0.9,
    ...partial,
  };
}

function writePrior(
  candRoot: string,
  id: string,
  canvas: FabricCanvasDoc,
): void {
  const dir = join(candRoot, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "canvas.json"), `${JSON.stringify(canvas, null, 2)}\n`);
  writeFileSync(
    join(dir, "candidate.json"),
    `${JSON.stringify({ candidate_id: id, status: "READY_FOR_FOUNDER_REVIEW" }, null, 2)}\n`,
  );
  writeFileSync(
    join(dir, "resume-template.json"),
    `${JSON.stringify({ id: "fixture" }, null, 2)}\n`,
  );
}

async function runIsolated(input: {
  priorId: string;
  canvas: FabricCanvasDoc;
  role: string;
  requested_changes: string[];
  plan: RevisionPlan | Record<string, unknown>;
  secondPlan?: RevisionPlan | Record<string, unknown>;
  testCorruptArtifact?: "preview.png";
}): Promise<{
  status: string;
  error: string | null;
  owner: string | null;
  code: string | null;
  stage: string | null;
  ok: boolean;
  revised: string | null;
  tmp: string;
}> {
  const tmp = mkdtempSync(join(tmpdir(), "aios-6l-"));
  const candRoot = join(tmp, "candidates");
  const outRoot = join(tmp, "founder-revision");
  const tasksDir = join(outRoot, "tasks");
  mkdirSync(tasksDir, { recursive: true });
  writePrior(candRoot, input.priorId, input.canvas);
  setRevisionTasksDirForTests(tasksDir);
  setRevisionPipelineRootsForTests({ candRoot, outRoot });
  try {
    const created = createRevisionTask({
      decision_id: `fd-6l-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      review_id: `founder-review-${input.priorId}`,
      prior_candidate_id: input.priorId,
      prior_canvas_path: join(candRoot, input.priorId, "canvas.json"),
      founder_reason: "6l isolated",
      requested_changes: input.requested_changes,
      role: input.role,
      design_family: "professional_sidebar",
      architecture: "narrow_ats_sidebar",
    });
    let calls = 0;
    const result = await runFounderFeedbackRevision({
      task_id: created.task.task_id,
      skip_preview: true,
      critiqueOverride: passingCritic,
      testCorruptArtifact: input.testCorruptArtifact,
      executePlanner: async () => {
        calls += 1;
        const structured =
          calls === 1
            ? input.plan
            : input.secondPlan ?? {
                schema_version: "founder-canvas-revision-plan-1.0.0",
                summary: "no additional repair operations",
                operations: [],
              };
        return {
          status: "COMPLETED",
          structured_output: structured as Record<string, unknown>,
          provider_request_id: "6l-fixture",
          model_identifier_internal: "fixture",
          input_tokens: 1,
          output_tokens: 1,
        };
      },
    });
    return {
      status: result.task.status,
      error: result.error,
      owner: result.task.failure_owner ?? null,
      code: result.task.failure_code ?? null,
      stage: result.task.failure_stage ?? null,
      ok: result.ok,
      revised: result.revised_candidate_id,
      tmp,
    };
  } finally {
    setRevisionPipelineRootsForTests(null);
    setRevisionTasksDirForTests(null);
  }
}

async function main(): Promise<void> {
  const checks: Check[] = [];
  const histHashes: Record<string, string> = {};
  for (const id of HISTORICAL) {
    const p = join(REPO, "SOS/07_LOGS/saios/founder-revision/tasks", `${id}.json`);
    if (existsSync(p)) histHashes[id] = sha256(p);
  }

  checks.push(
    assert(
      PRODUCTION_REQUEST_CHANGES_ENTRY_POINT === "runFounderFeedbackRevision" &&
        NUMBER_OF_PRODUCTION_REQUEST_CHANGES_EXECUTORS === 1,
      "classification_one_production_executor",
      PRODUCTION_REQUEST_CHANGES_ENTRY_POINT,
    ),
  );
  checks.push(
    assert(
      TEST_ONLY_PARTIAL_CIRCUITS.includes("runRevisionPlanGateCircuit") &&
        REVISION_RELEASE_PROOF_HARNESS.includes("production-parity-6l"),
      "circuit_is_test_only_not_release_proof",
      TEST_ONLY_PARTIAL_CIRCUITS.join(","),
    ),
  );
  checks.push(
    assert(
      REVISION_COPY_FILE_AUDIT.some(
        (e) =>
          e.file === "resume-json-instructions.json" &&
          e.classification === "DO_NOT_COPY",
      ),
      "copy_files_resume_json_not_copied",
      JSON.stringify(REVISION_COPY_FILE_AUDIT),
    ),
  );

  const leftoverRole = readJson<Record<string, unknown>>(
    join(FIX, "leftover/role-target-integrity.json"),
  );
  const leftoverResume = readJson<Record<string, unknown>>(
    join(FIX, "leftover/resume-json-instructions.json"),
  );
  const afterCanvas = readJson<FabricCanvasDoc>(
    join(FIX, "post-normalization-canvas.json"),
  ).canvas
    ? (readJson<{ canvas: FabricCanvasDoc }>(
        join(FIX, "post-normalization-canvas.json"),
      ).canvas)
    : readJson<FabricCanvasDoc>(join(FIX, "post-normalization-canvas.json"));
  const vg = leftoverResume.visual_guidance as
    | { resume_content?: unknown; openai_resume_content?: unknown }
    | undefined;
  const oldGen = evaluateCanvasRoleTargetIntegrity({
    target_title: "Operations Analyst",
    target_role_family: "Operations Analyst",
    canvas: afterCanvas,
    resume_content: vg?.resume_content ?? null,
    openai_resume_content: vg?.openai_resume_content ?? null,
    sample_title: null,
  });
  checks.push(
    assert(
      leftoverRole.reason === "structured generated role missing" &&
        leftoverRole.pass === false,
      "old_code_production_leftover_generation_role_fail",
      String(leftoverRole.reason),
    ),
  );
  checks.push(
    assert(
      oldGen.pass === false &&
        /structured generated role missing/i.test(oldGen.reason),
      "old_code_generation_role_reproduced_offline",
      oldGen.reason,
    ),
  );

  const nativeRole = evaluateRevisionRoleTargetIntegrity({
    target_role: "Operations Analyst",
    afterCanvas,
    beforeCanvas: readJson<FabricCanvasDoc>(join(FIX, "prior/canvas.json")),
    requested_changes: readJson<{ requested_changes: string[] }>(
      join(FIX, "revtask-6ddb8eb8-e9c.json"),
    ).requested_changes,
    plan: readJson<RevisionPlan>(join(FIX, "revision-plan.json")),
  });
  checks.push(
    assert(
      nativeRole.pass && nativeRole.match === "ROLE_MATCH",
      "fixture_revision_native_role_pass",
      nativeRole.reason,
    ),
  );

  const genMissing = evaluateRoleTargetIntegrity({
    target_title: "Operations Analyst",
    structured_role: null,
    rendered_role: "Operations Analyst",
  });
  const genMismatch = evaluateRoleTargetIntegrity({
    target_title: "Operations Analyst",
    structured_role: "Marketing Manager",
    rendered_role: "Operations Analyst",
  });
  const genMatch = evaluateRoleTargetIntegrity({
    target_title: "Marketing Manager",
    structured_role: "Marketing Manager",
    rendered_role: "Marketing Manager",
  });
  checks.push(
    assert(
      !genMissing.pass && /structured generated role missing/i.test(genMissing.reason),
      "generation_missing_structured_role_still_fails",
      genMissing.reason,
    ),
  );
  checks.push(
    assert(!genMismatch.pass, "generation_role_mismatch_still_fails", genMismatch.reason),
  );
  checks.push(
    assert(genMatch.pass, "generation_role_match_still_passes", genMatch.reason),
  );

  const taskFix = readJson<{
    requested_changes: string[];
    prior_candidate_id: string;
    role: string;
  }>(join(FIX, "revtask-6ddb8eb8-e9c.json"));
  const primary = readJson<RevisionPlan>(join(FIX, "revision-plan-ai-primary.json"));
  const repair = readJson<RevisionPlan>(join(FIX, "coverage-repair-plan.json"));
  const priorCanvas = readJson<FabricCanvasDoc>(join(FIX, "prior/canvas.json"));

  const goldenTmp = mkdtempSync(join(tmpdir(), "aios-6l-golden-"));
  const goldenCand = join(goldenTmp, "candidates");
  const goldenOut = join(goldenTmp, "founder-revision");
  const goldenTasks = join(goldenOut, "tasks");
  mkdirSync(goldenTasks, { recursive: true });
  cpSync(join(FIX, "prior"), join(goldenCand, taskFix.prior_candidate_id), {
    recursive: true,
  });
  setRevisionTasksDirForTests(goldenTasks);
  setRevisionPipelineRootsForTests({ candRoot: goldenCand, outRoot: goldenOut });
  let goldenStatus = "UNRUN";
  let goldenError: string | null = null;
  let goldenRevised: string | null = null;
  let goldenOwner: string | null = null;
  let goldenDir: string | null = null;
  try {
    const created = createRevisionTask({
      decision_id: `fd-6l-golden-${Date.now().toString(36)}`,
      review_id: `founder-review-6l-golden`,
      prior_candidate_id: taskFix.prior_candidate_id,
      prior_canvas_path: join(
        goldenCand,
        taskFix.prior_candidate_id,
        "canvas.json",
      ),
      founder_reason: "6l golden",
      requested_changes: taskFix.requested_changes,
      role: taskFix.role,
      design_family: "professional_sidebar",
      architecture: "narrow_ats_sidebar",
    });
    let calls = 0;
    const run = await runFounderFeedbackRevision({
      task_id: created.task.task_id,
      skip_preview: true,
      critiqueOverride: passingCritic,
      executePlanner: async () => {
        calls += 1;
        return {
          status: "COMPLETED",
          structured_output: (calls === 1 ? primary : repair) as unknown as Record<
            string,
            unknown
          >,
          provider_request_id: "6l-golden",
          model_identifier_internal: "fixture",
          input_tokens: 1,
          output_tokens: 1,
        };
      },
    });
    goldenStatus = run.task.status;
    goldenError = run.error;
    goldenRevised = run.revised_candidate_id;
    goldenOwner = run.task.failure_owner ?? null;
    if (run.revised_candidate_id) {
      goldenDir = join(goldenCand, run.revised_candidate_id);
    }
    checks.push(
      assert(
        run.ok && run.task.status === "READY_FOR_FOUNDER_REVIEW",
        "golden_oa_ready_for_founder_review",
        `${run.task.status} owner=${run.task.failure_owner ?? ""} ${run.error ?? ""}`,
      ),
    );
    if (goldenDir && existsSync(goldenDir)) {
      const acc = readJson<{
        overall?: string;
        may_return_to_founder_review?: boolean;
      }>(join(goldenDir, "revision-final-acceptance.json"));
      const role = readJson<{ pass?: boolean; match?: string }>(
        join(goldenDir, "revision-role-target-integrity.json"),
      );
      const cov = readJson<{
        gate_pass?: boolean;
        items?: Array<{ status: string }>;
      }>(join(goldenDir, "feedback-coverage.json"));
      const derived = readJson<{
        source?: string;
        pass?: boolean;
        structured_role?: unknown;
      }>(join(goldenDir, "role-target-integrity.json"));
      const canvas = readJson<FabricCanvasDoc>(join(goldenDir, "canvas.json"));
      const texts = (canvas.objects ?? [])
        .map((o) => String((o as { text?: string }).text ?? ""))
        .join("\n");
      const addressed = (cov.items ?? []).filter((i) => i.status === "addressed")
        .length;
      checks.push(
        assert(acc.overall === "PASS" && acc.may_return_to_founder_review === true, "golden_final_acceptance_pass", JSON.stringify(acc)),
      );
      checks.push(
        assert(role.pass === true && role.match === "ROLE_MATCH", "golden_role_integrity_pass", JSON.stringify(role)),
      );
      checks.push(
        assert(cov.gate_pass === true && addressed === 28, "golden_feedback_coverage_28_of_28", `${addressed}/${(cov.items ?? []).length}`),
      );
      checks.push(
        assert(
          derived.source === "revision_role_integrity" &&
            derived.pass === true &&
            derived.structured_role == null,
          "golden_derived_role_artifact_from_revision_owner",
          JSON.stringify(derived),
        ),
      );
      checks.push(
        assert(
          !existsSync(join(goldenDir, "resume-json-instructions.json")),
          "golden_did_not_copy_generation_resume_json",
          "resume-json-instructions.json present",
        ),
      );
      checks.push(
        assert(/Operations Analyst/.test(texts), "golden_title_operations_analyst", texts.slice(0, 120)),
      );
      checks.push(
        assert(
          /operational analysis|Operations Analyst/i.test(texts) &&
            !/Always-On ABM|Demand Generation|HubSpot Inbound/i.test(texts),
          "golden_no_marketing_residue",
          texts.slice(0, 240),
        ),
      );
      checks.push(
        assert(/Alex Morgan/.test(texts), "golden_name_preserved", "name missing"),
      );
      checks.push(
        assert(
          existsSync(join(goldenDir, "preview.png")) &&
            existsSync(join(goldenDir, "gate.json")) &&
            existsSync(join(goldenDir, "critic.json")),
          "golden_artifact_validation_pass",
          goldenDir,
        ),
      );
    }
  } finally {
    setRevisionPipelineRootsForTests(null);
    setRevisionTasksDirForTests(null);
  }

  const malformed = await runIsolated({
    priorId: "cand-6l-malformed",
    canvas: miniCanvas([textObj("t1", "Operations Analyst", 40)]),
    role: "Operations Analyst",
    requested_changes: ["Rewrite the Summary so it describes an Operations Analyst."],
    plan: { operations: "not-an-array" },
  });
  checks.push(
    assert(
      !malformed.ok &&
        (malformed.status === "FAILED" || malformed.code === "FAILED_PLAN"),
      "malformed_plan_fails_at_planner",
      `${malformed.status} ${malformed.owner} ${malformed.error}`,
    ),
  );

  const omitCanvas = miniCanvas([
    textObj("block-header-0-t1", "Alex Morgan", 12, { section: "header" }),
    textObj("block-header-0-t2", "Operations Analyst", 36, {
      section: "header",
      role: "professional_title",
    }),
    textObj("block-skills-4-t1", "SKILLS", 180, { section: "skills" }),
    textObj("block-skills-4-t2", "Marketing Analytics", 200, {
      section: "skills",
      height: 20,
    }),
    textObj("block-skills-4-t3", "ABM and Brand Strategy", 280, {
      section: "skills",
      height: 20,
    }),
  ]);
  const omitPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0" as const,
    summary: "partial skills",
    operations: [
      op({
        op: "update_text",
        target_id: "block-skills-4-t2",
        intended_change: "replace skills t2",
        values: { text: "KPI Reporting · Excel · Documentation" },
        founder_feedback_item:
          "Replace the current marketing-focused Skills with Operations Analyst skills and tools appropriate for the target role.",
      }),
    ],
  };
  const omitOwner = evaluateSectionReplacementCompleteness({
    canvas: omitCanvas,
    plan: omitPlan as RevisionPlan,
    requested_changes: [
      "Replace the current marketing-focused Skills with Operations Analyst skills and tools appropriate for the target role.",
    ],
  });
  checks.push(
    assert(
      !omitOwner.ok &&
        omitOwner.unaccounted_object_ids.includes("block-skills-4-t3"),
      "section_omission_owner_unaccounted_t3",
      JSON.stringify(omitOwner.unaccounted_object_ids),
    ),
  );
  const omit = await runIsolated({
    priorId: "cand-6l-omit",
    canvas: omitCanvas,
    role: "Operations Analyst",
    requested_changes: [
      "Replace the current marketing-focused Skills with Operations Analyst skills and tools appropriate for the target role.",
    ],
    plan: omitPlan,
  });
  checks.push(
    assert(
      !omit.ok &&
        (omit.owner === "section_replacement" ||
          /content replacement incomplete|section replacement|unaccounted/i.test(
            omit.error ?? "",
          )),
      "section_omission_fails_at_completeness",
      `${omit.status} ${omit.owner} ${omit.error}`,
    ),
  );

  const residue = await runIsolated({
    priorId: "cand-6l-residue",
    canvas: miniCanvas([
      textObj("block-header-0-t1", "Alex Morgan", 20, { section: "header" }),
      textObj("block-header-0-t2", "Marketing Manager", 40, { section: "header" }),
      textObj("block-experience-2-t1", "EXPERIENCE", 80, { section: "experience" }),
      textObj("block-experience-2-t2", "Marketing Manager — Acme", 100, {
        section: "experience",
      }),
    ]),
    role: "Operations Analyst",
    requested_changes: [
      "Change the professional title from Marketing Manager to Operations Analyst while preserving the current header design, candidate name, contact layout, colors, and typography.",
      "Replace all Marketing Manager, Senior Marketing Specialist, and Marketing Coordinator Experience content with realistic Operations Analyst-focused roles and achievements.",
    ],
    plan: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "header only",
      operations: [
        op({
          op: "update_text",
          target_id: "block-header-0-t2",
          intended_change: "title",
          values: { text: "Operations Analyst" },
          founder_feedback_item:
            "Change the professional title from Marketing Manager to Operations Analyst while preserving the current header design, candidate name, contact layout, colors, and typography.",
        }),
      ],
    },
    secondPlan: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "experience still marketing",
      operations: [
        op({
          op: "update_text",
          target_id: "block-experience-2-t2",
          intended_change: "keep marketing",
          values: { text: "Marketing Manager — Acme" },
          founder_feedback_item:
            "Replace all Marketing Manager, Senior Marketing Specialist, and Marketing Coordinator Experience content with realistic Operations Analyst-focused roles and achievements.",
        }),
      ],
    },
  });
  checks.push(
    assert(
      !residue.ok &&
        (residue.owner === "revision_role_integrity" ||
          residue.owner === "section_replacement" ||
          residue.owner === "feedback_coverage"),
      "marketing_residue_fails_at_role_or_completeness",
      `${residue.status} ${residue.owner} ${residue.error}`,
    ),
  );

  const wrong = await runIsolated({
    priorId: "cand-6l-wrong",
    canvas: miniCanvas([
      textObj("block-header-0-t2", "Operations Analyst", 40, { section: "header" }),
    ]),
    role: "Operations Analyst",
    requested_changes: [
      "Change the professional title from Marketing Manager to Operations Analyst while preserving the current header design, candidate name, contact layout, colors, and typography.",
    ],
    plan: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "wrong title",
      operations: [
        op({
          op: "update_text",
          target_id: "block-header-0-t2",
          intended_change: "wrong",
          values: { text: "Marketing Manager" },
          founder_feedback_item:
            "Change the professional title from Marketing Manager to Operations Analyst while preserving the current header design, candidate name, contact layout, colors, and typography.",
        }),
      ],
    },
  });
  checks.push(
    assert(
      !wrong.ok &&
        (wrong.owner === "revision_role_integrity" ||
          /role/i.test(wrong.error ?? "")),
      "wrong_role_fails_at_revision_role",
      `${wrong.status} ${wrong.owner} ${wrong.error}`,
    ),
  );

  const missingRole = await runIsolated({
    priorId: "cand-6l-norole",
    canvas: miniCanvas([textObj("block-header-0-t2", "Operations Analyst", 40)]),
    role: "",
    requested_changes: [
      "Before returning this revision to Founder Review, verify that the rendered professional title, Summary, Experience, Skills, Projects, Certifications, and Education all match the target role Operations Analyst.",
    ],
    plan: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "none",
      operations: [],
    },
  });
  checks.push(
    assert(
      !missingRole.ok &&
        (missingRole.owner === "revision_role_integrity" ||
          /role/i.test(missingRole.error ?? "")),
      "missing_revision_role_evidence_fails_at_role_owner",
      `${missingRole.status} ${missingRole.owner} ${missingRole.error}`,
    ),
  );

  const overlap = await runIsolated({
    priorId: "cand-6l-overlap",
    canvas: miniCanvas([
      textObj("a", "One", 100, { width: 200, height: 40, section: "summary" }),
      textObj("b", "Two", 200, { width: 200, height: 40, section: "summary" }),
    ]),
    role: "Operations Analyst",
    requested_changes: [
      "Check the full page after all content changes and ensure there are no text overlaps, clipped text, duplicate text, out-of-bounds objects, or accidental collisions.",
    ],
    plan: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "overlap",
      operations: [
        op({
          op: "set_position",
          target_id: "b",
          intended_change: "overlap",
          values: { top: 110, left: 40 },
          founder_feedback_item:
            "Check the full page after all content changes and ensure there are no text overlaps, clipped text, duplicate text, out-of-bounds objects, or accidental collisions.",
        }),
      ],
    },
  });
  checks.push(
    assert(
      !overlap.ok &&
        (overlap.owner === "final_geometry" ||
          overlap.owner === "canonical_layout" ||
          /overlap|geometry/i.test(overlap.error ?? "")),
      "overlap_fails_at_geometry_owner",
      `${overlap.status} ${overlap.owner} ${overlap.error}`,
    ),
  );

  const oob = await runIsolated({
    priorId: "cand-6l-oob",
    canvas: miniCanvas([
      textObj("a", "Body", 100, { width: 200, height: 40, section: "summary" }),
    ]),
    role: "Operations Analyst",
    requested_changes: [
      "Check the full page after all content changes and ensure there are no text overlaps, clipped text, duplicate text, out-of-bounds objects, or accidental collisions.",
    ],
    plan: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "oob",
      operations: [
        op({
          op: "set_position",
          target_id: "a",
          intended_change: "oob",
          values: { top: 2000, left: 40 },
          founder_feedback_item:
            "Check the full page after all content changes and ensure there are no text overlaps, clipped text, duplicate text, out-of-bounds objects, or accidental collisions.",
        }),
      ],
    },
  });
  checks.push(
    assert(
      !oob.ok &&
        (oob.owner === "final_geometry" ||
          oob.owner === "page_fit" ||
          oob.owner === "canonical_layout" ||
          /oob|overflow|geometry|page/i.test(oob.error ?? "")),
      "oob_fails_at_geometry_owner",
      `${oob.status} ${oob.owner} ${oob.error}`,
    ),
  );

  const preserve = await runIsolated({
    priorId: "cand-6l-preserve",
    canvas: miniCanvas([
      textObj("block-header-0-t1", "Alex Morgan", 20, { section: "header" }),
      textObj("block-header-0-t2", "Operations Analyst", 40, { section: "header" }),
    ]),
    role: "Operations Analyst",
    requested_changes: [
      "Do not change the candidate name or contact-information structure unless a small positioning adjustment is required for safe rendering.",
    ],
    plan: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "rename",
      operations: [
        op({
          op: "update_text",
          target_id: "block-header-0-t1",
          intended_change: "rename",
          values: { text: "Other Person" },
          founder_feedback_item:
            "Do not change the candidate name or contact-information structure unless a small positioning adjustment is required for safe rendering.",
        }),
      ],
    },
  });
  checks.push(
    assert(
      !preserve.ok &&
        (preserve.owner === "content_preservation" ||
          preserve.owner === "feedback_coverage" ||
          /preserv/i.test(preserve.error ?? "")),
      "preservation_fails_at_preservation_owner",
      `${preserve.status} ${preserve.owner} ${preserve.error}`,
    ),
  );

  const uncovered = await runIsolated({
    priorId: "cand-6l-uncovered",
    canvas: miniCanvas([
      textObj("block-header-0-t2", "Marketing Manager", 40, { section: "header" }),
      textObj("block-summary-1-t2", "Marketing summary", 80, { section: "summary" }),
      textObj("decoy", "decoy", 300, { section: "other" }),
    ]),
    role: "Operations Analyst",
    requested_changes: [
      "Change the professional title from Marketing Manager to Operations Analyst while preserving the current header design, candidate name, contact layout, colors, and typography.",
      "Rewrite the Summary so it describes an Operations Analyst profile focused on operational analysis, process improvement, KPI reporting, workflow optimization, data analysis, documentation, and cross-functional operations.",
    ],
    plan: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "title only",
      operations: [
        op({
          op: "update_text",
          target_id: "block-header-0-t2",
          intended_change: "title",
          values: { text: "Operations Analyst" },
          founder_feedback_item:
            "Change the professional title from Marketing Manager to Operations Analyst while preserving the current header design, candidate name, contact layout, colors, and typography.",
        }),
      ],
    },
    secondPlan: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "decoy attribution",
      operations: [
        op({
          op: "update_text",
          target_id: "decoy",
          intended_change: "not summary",
          values: { text: "still decoy" },
          founder_feedback_item:
            "Rewrite the Summary so it describes an Operations Analyst profile focused on operational analysis, process improvement, KPI reporting, workflow optimization, data analysis, documentation, and cross-functional operations.",
        }),
      ],
    },
  });
  checks.push(
    assert(
      !uncovered.ok &&
        (uncovered.owner === "feedback_coverage" ||
          uncovered.owner === "section_replacement" ||
          uncovered.owner === "revision_role_integrity"),
      "uncovered_feedback_fails_at_coverage_or_role",
      `${uncovered.status} ${uncovered.owner} ${uncovered.error}`,
    ),
  );

  const corrupt = await runIsolated({
    priorId: "cand-6l-corrupt",
    canvas: priorCanvas,
    role: "Operations Analyst",
    requested_changes: taskFix.requested_changes,
    plan: primary,
    secondPlan: repair,
    testCorruptArtifact: "preview.png",
  });
  checks.push(
    assert(
      !corrupt.ok &&
        (corrupt.status === "FAILED_ARTIFACTS" ||
          corrupt.owner === "artifact_integrity"),
      "artifact_corruption_fails_at_artifact_integrity",
      `${corrupt.status} ${corrupt.owner} ${corrupt.error}`,
    ),
  );

  const gapAcceptance = evaluateRevisionFinalAcceptance({
    plan_ok: true,
    authorization_ok: true,
    section_replacement: { ok: true, error: null },
    content_execution_ok: true,
    content_preservation_ok: true,
    canonical_layout_ok: false,
    text_overlap_count: 0,
    page_oob_count: 0,
    page_fit_ok: true,
    revision_role: {
      pass: true,
      evaluable: true,
      match: "ROLE_MATCH",
      reason: "PASS",
    },
    coverage: { gate_pass: true, all_addressed: true },
  });
  checks.push(
    assert(
      gapAcceptance.overall === "FAIL" &&
        gapAcceptance.failed_owner === "canonical_layout",
      "excessive_gap_fails_at_layout_owner",
      `${gapAcceptance.failed_owner} ${gapAcceptance.failure_reason}`,
    ),
  );

  for (const id of HISTORICAL) {
    const p = join(REPO, "SOS/07_LOGS/saios/founder-revision/tasks", `${id}.json`);
    if (!histHashes[id]) {
      checks.push(assert(true, `historical_${id}_absent_locally_unmodified`, "absent"));
      continue;
    }
    checks.push(
      assert(
        existsSync(p) && sha256(p) === histHashes[id],
        `historical_${id}_unchanged`,
        p,
      ),
    );
  }

  const leftoverAfter = readJson<Record<string, unknown>>(
    join(FIX, "leftover/role-target-integrity.json"),
  );
  checks.push(
    assert(
      leftoverAfter.reason === "structured generated role missing",
      "historical_6ddb8eb8_fixture_unchanged",
      String(leftoverAfter.reason),
    ),
  );

  const pass = checks.every((c) => c.pass);
  const report = {
    schema_version: "revision-production-parity-6l-1.0.0",
    generated_at: new Date().toISOString(),
    pass,
    production_entry_point: PRODUCTION_REQUEST_CHANGES_ENTRY_POINT,
    release_proof: REVISION_RELEASE_PROOF_HARNESS,
    old_code_golden_failure: oldGen.reason,
    golden_status: goldenStatus,
    golden_error: goldenError,
    golden_revised: goldenRevised,
    golden_owner: goldenOwner,
    checks,
    publication_allowed: false,
    live: false,
  };
  mkdirSync(join(OUT, ".."), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ pass, failed: checks.filter((c) => !c.pass) }, null, 2));
  try {
    rmSync(goldenTmp, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  if (!pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
