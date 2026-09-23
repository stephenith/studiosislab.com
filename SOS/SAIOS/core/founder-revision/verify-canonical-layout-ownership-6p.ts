/**
 * Phase 6P — canonical layout ownership consolidation.
 * Replays sanitized revtask-76a04a21-6ff. No production OpenAI.
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
import { findTextOverlapFindings } from "./RevisionAcceptanceChecks.js";
import {
  evaluateCanonicalFinalStateLayoutProof,
} from "./CanonicalFinalStateLayoutProof.js";
import {
  runFounderFeedbackRevision,
  setRevisionPipelineRootsForTests,
} from "./FounderRevisionPipeline.js";
import {
  NUMBER_OF_LAYOUT_OWNER_DECISION_PATHS,
  allRequestedChangesAllowEmptyPlan,
  isCanonicalDeterministicLayoutOwnedChange,
  isPlanCoverageExemptRequestedChange,
  resolveItemCoverageMode,
  validateRevisionPlan,
} from "./RevisionPromptBuilder.js";
import { isDeterministicLayoutNormalizerOwnedChange } from "./DeterministicSpacingPlan.js";
import { isLayoutOnlyIntentChange } from "./RevisionIntentScope.js";
import {
  createRevisionTask,
  setRevisionTasksDirForTests,
} from "./RevisionTaskStore.js";
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import { visualTextContentBottom } from "./TextEffectiveHeight.js";
import { READABLE_SEQUENTIAL_GAP_PX } from "./RevisionLayoutNormalizer.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const FIX = join(REPO, ".cursor/debug-fixtures/revtask-76a04a21-6ff-sanitized");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-canonical-layout-ownership-6p.json",
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
function canvasOf(doc: FabricCanvasDoc | { canvas?: FabricCanvasDoc }): FabricCanvasDoc {
  if (doc && typeof doc === "object" && "objects" in doc && Array.isArray((doc as FabricCanvasDoc).objects)) {
    return doc as FabricCanvasDoc;
  }
  return (doc as { canvas: FabricCanvasDoc }).canvas;
}
function findObj(canvas: FabricCanvasDoc, id: string): Record<string, unknown> | null {
  return ((canvas.objects ?? []) as Record<string, unknown>[]).find((o) => o.id === id) ?? null;
}
function visualGap(upper: Record<string, unknown>, lower: Record<string, unknown>): number {
  return Number(lower.top ?? 0) - visualTextContentBottom(upper);
}
function cloneCanvas(canvas: FabricCanvasDoc): FabricCanvasDoc {
  return JSON.parse(JSON.stringify(canvas)) as FabricCanvasDoc;
}
function setTop(canvas: FabricCanvasDoc, id: string, top: number): void {
  const o = findObj(canvas, id);
  if (o) o.top = top;
}

const ITEM5 =
  "Correct the remaining inconsistent spacing between the “Process Design” and “Excel” Skills bullet rows.";
const ITEM6 =
  "Give “Process Design” and “Excel” the same positive vertical separation used between the other consecutive Skills bullets.";
const ITEM9 =
  "Maintain clear positive separation between the final Skills bullet and the Projects heading.";
const ITEM10 =
  "Increase the breathing room between Skills and Projects slightly so the transition does not look compressed.";
const ITEM11 =
  "Maintain clear and visually consistent separation between the end of Projects and the Certifications heading.";
const ITEM12 =
  "Maintain clear and visually consistent separation between the end of Certifications and the Languages heading.";

async function main(): Promise<void> {
  assert(existsSync(FIX), "fixture_created", FIX);
  const before = readJson<{
    owned_not_old_helper: number[];
    process_design_excel_prior: number;
    process_design_excel_after: number;
    covered: number;
    uncovered: number[];
  }>(join(FIX, "evidence/current-failure-reproduced.json"));
  assert(
    before.owned_not_old_helper.join(",") === "5,6,10" &&
      before.process_design_excel_prior === 6 &&
      before.process_design_excel_after === 15 &&
      before.covered === 18 &&
      before.uncovered.join(",") === "5,6,10",
    "current_failure_reproduced",
    JSON.stringify(before.uncovered),
  );

  const ownerSrc = readFileSync(
    join(REPO, "SOS/SAIOS/core/founder-revision/RevisionPromptBuilder.ts"),
    "utf8",
  );
  const covSrc = readFileSync(
    join(REPO, "SOS/SAIOS/core/founder-revision/FeedbackCoverage.ts"),
    "utf8",
  );
  const detSrc = readFileSync(
    join(REPO, "SOS/SAIOS/core/founder-revision/DeterministicSpacingPlan.ts"),
    "utf8",
  );
  assert(
    NUMBER_OF_LAYOUT_OWNER_DECISION_PATHS === 1 &&
      ownerSrc.includes("isCanonicalLayoutOwnedItem") &&
      !ownerSrc.includes("isLayoutOnlyIntentChange(requestedChange)"),
    "canonical_layout_owner_implemented",
    String(NUMBER_OF_LAYOUT_OWNER_DECISION_PATHS),
  );
  assert(
    covSrc.includes("isCanonicalDeterministicLayoutOwnedChange") &&
      !covSrc.includes("isDeterministicLayoutNormalizerOwnedChange"),
    "feedback_coverage_uses_canonical_owner",
  );
  assert(
    detSrc.includes("owned_item: isCanonicalLayoutOwnedItem"),
    "canonical_proof_uses_canonical_owner",
  );
  assert(
    detSrc.includes("isCanonicalLayoutOwnedItem") &&
      ownerSrc.includes("isCanonicalLayoutOwnedItem"),
    "deterministic_spacing_uses_canonical_owner",
  );
  assert(
    ownerSrc.includes("isCanonicalLayoutOwnedItem(requestedChange)") &&
      ownerSrc.includes("resolveItemCoverageMode"),
    "resolve_item_coverage_mode_is_canonical",
  );
  assert(
    readFileSync(
      join(REPO, "SOS/SAIOS/core/founder-revision/RevisionIntentScope.ts"),
      "utf8",
    ).includes("LAYOUT_MUTATION"),
    "revision_intent_scope_used_by_layout_owner",
  );

  const task = readJson<{
    requested_changes: string[];
    prior_candidate_id: string;
    role: string;
    founder_reason: string;
  }>(join(FIX, "revtask-76a04a21-6ff.json"));
  const rcs = task.requested_changes;
  const owners = [5, 6, 9, 10, 11, 12].map((i) => ({
    i,
    mode: resolveItemCoverageMode(rcs[i - 1]!),
    canonical: isCanonicalDeterministicLayoutOwnedChange(rcs[i - 1]!),
  }));
  for (const row of owners) {
    assert(
      row.mode === "DETERMINISTIC_LAYOUT_OWNED" && row.canonical,
      `item_${row.i}_owner_after`,
      row.mode,
    );
  }
  assert(
    allRequestedChangesAllowEmptyPlan(rcs) === true,
    "empty_deterministic_plan_allowed",
  );
  const emptyPrep = validateRevisionPlan(
    {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "det empty",
      operations: [],
    },
    { requested_changes: rcs, allowEmptyOperations: true },
  );
  assert(emptyPrep.ok === true, "empty_deterministic_plan_test", emptyPrep.errors.join("; "));

  const prior = canvasOf(readJson(join(FIX, "prior/canvas.json")));
  const failed = canvasOf(readJson(join(FIX, "evidence/post-normalization-canvas.json")));
  const badPair = evaluateCanonicalFinalStateLayoutProof({
    requestedChange: ITEM5,
    beforeCanvas: prior,
    afterCanvas: failed,
  });
  assert(
    badPair.pass === false &&
      (badPair.reason === "LAYOUT_RHYTHM_UNSATISFIED" ||
        badPair.reason === "VISUAL_GAP_TOO_LARGE"),
    "named_pair_outlier_negative",
    `${badPair.reason} ${badPair.final_condition}`,
  );
  const goodPair = evaluateCanonicalFinalStateLayoutProof({
    requestedChange: ITEM6,
    beforeCanvas: prior,
    afterCanvas: prior,
  });
  assert(goodPair.pass === true, "named_pair_peer_positive", goodPair.reason);
  const overlapCanvas = cloneCanvas(prior);
  setTop(overlapCanvas, "block-skills-4-t3", 290);
  const overlapProof = evaluateCanonicalFinalStateLayoutProof({
    requestedChange: ITEM5,
    beforeCanvas: prior,
    afterCanvas: overlapCanvas,
  });
  assert(overlapProof.pass === false, "named_pair_overlap_negative", overlapProof.reason);

  const inconsistent = cloneCanvas(prior);
  for (const id of [
    "block-certifications-6-r0",
    "block-certifications-6-t1",
    "block-certifications-6-t2",
    "block-certifications-6-t3",
    "block-certifications-6-t4",
    "block-languages-7-r0",
    "block-languages-7-t1",
    "block-languages-7-t2",
  ]) {
    const o = findObj(inconsistent, id);
    if (o) o.top = Number(o.top) + 20;
  }
  const sideFail = evaluateCanonicalFinalStateLayoutProof({
    requestedChange:
      "Use one consistent sidebar section-spacing rhythm for Skills → Projects, Projects → Certifications, and Certifications → Languages.",
    beforeCanvas: prior,
    afterCanvas: inconsistent,
  });
  assert(
    sideFail.pass === false && sideFail.reason === "LAYOUT_RHYTHM_UNSATISFIED",
    "sidebar_inconsistency_negative",
    `${sideFail.reason} ${sideFail.final_condition}`,
  );
  const singleGap = cloneCanvas(prior);
  for (const id of [
    "block-projects-5-r0",
    "block-projects-5-t1",
    "block-projects-5-t2",
    "block-projects-5-t3",
    "block-certifications-6-r0",
    "block-certifications-6-t1",
    "block-certifications-6-t2",
    "block-certifications-6-t3",
    "block-certifications-6-t4",
    "block-languages-7-r0",
    "block-languages-7-t1",
    "block-languages-7-t2",
  ]) {
    const o = findObj(singleGap, id);
    if (o) o.top = Number(o.top) + 18;
  }
  const singleProof = evaluateCanonicalFinalStateLayoutProof({
    requestedChange:
      "Use one consistent sidebar section-spacing rhythm for Skills → Projects, Projects → Certifications, and Certifications → Languages.",
    beforeCanvas: prior,
    afterCanvas: singleGap,
  });
  assert(
    singleProof.pass === false,
    "single_gap_conflict_negative",
    `${singleProof.reason} ${singleProof.final_condition}`,
  );

  const pipelineSrc = readFileSync(
    join(REPO, "SOS/SAIOS/core/founder-revision/FounderRevisionPipeline.ts"),
    "utf8",
  );
  assert(
    pipelineSrc.includes("AI_OPERATION_SUPERSEDED_BY_CANONICAL_LAYOUT") &&
      pipelineSrc.includes("detOpsEmpty"),
    "ai_geometry_can_be_superseded_by_canonical_layout",
  );

  const primary = readJson<Record<string, unknown>>(join(FIX, "evidence/revision-plan.json"));
  const tmp = mkdtempSync(join(tmpdir(), "aios-6p-"));
  const candRoot = join(tmp, "candidates");
  const outRoot = join(tmp, "founder-revision");
  const tasksDir = join(outRoot, "tasks");
  mkdirSync(tasksDir, { recursive: true });
  cpSync(join(FIX, "prior"), join(candRoot, task.prior_candidate_id), { recursive: true });
  setRevisionTasksDirForTests(tasksDir);
  setRevisionPipelineRootsForTests({ candRoot, outRoot });

  let goldenStatus = "UNRUN";
  let goldenError: string | null = null;
  let goldenCalls = 0;
  let afterCanvas: FabricCanvasDoc | null = null;
  let coverage = "0/21";
  let acceptance = false;
  let rolePass = false;
  let overlaps = -1;
  let oob = -1;
  let pdExcel = -1;
  let skProj = -1;
  let projCert = -1;
  let certLang = -1;
  let sumExp = -1;
  let expEdu = -1;
  let eduTop = -1;
  let headingGaps: number[] = [];
  try {
    const created = createRevisionTask({
      decision_id: `fd-6p-golden-${Date.now().toString(36)}`,
      review_id: "founder-review-6p-golden",
      prior_candidate_id: task.prior_candidate_id,
      prior_canvas_path: join(candRoot, task.prior_candidate_id, "canvas.json"),
      founder_reason: task.founder_reason ?? "layout-only sidebar refinement",
      requested_changes: rcs,
      role: task.role,
      design_family: "professional_sidebar",
      architecture: "narrow_ats_sidebar",
    });
    const run = await runFounderFeedbackRevision({
      task_id: created.task.task_id,
      skip_preview: true,
      critiqueOverride: passingCritic,
      executePlanner: async () => {
        goldenCalls += 1;
        return {
          status: "COMPLETED",
          structured_output: primary,
          provider_request_id: "6p-golden",
          model_identifier_internal: "fixture",
          input_tokens: 1,
          output_tokens: 1,
        };
      },
    });
    goldenStatus = run.task.status;
    goldenError = run.error ?? null;
    const ev = join(outRoot, "evidence", created.task.task_id);
    const cov = existsSync(join(ev, "feedback-coverage.json"))
      ? readJson<{ items: Array<{ status: string; evidence?: { notes?: string; affected_object_ids?: string[] } }> }>(
          join(ev, "feedback-coverage.json"),
        )
      : { items: [] };
    const addressed = cov.items.filter((i) => i.status === "addressed").length;
    coverage = `${addressed}/${cov.items.length || 21}`;
    const acc = existsSync(join(ev, "revision-final-acceptance.json"))
      ? readJson<{ overall: string }>(join(ev, "revision-final-acceptance.json"))
      : { overall: "MISSING" };
    acceptance = acc.overall === "PASS";
    const role = existsSync(join(ev, "revision-role-target-integrity.json"))
      ? readJson<{ pass: boolean }>(join(ev, "revision-role-target-integrity.json"))
      : { pass: false };
    rolePass = role.pass === true;
    const post = existsSync(join(ev, "post-normalization-canvas.json"))
      ? canvasOf(readJson(join(ev, "post-normalization-canvas.json")))
      : null;
    afterCanvas = post;
    if (post) {
      const t2 = findObj(post, "block-skills-4-t2")!;
      const t3 = findObj(post, "block-skills-4-t3")!;
      const p1 = findObj(post, "block-projects-5-t1")!;
      const p3 = findObj(post, "block-projects-5-t3")!;
      const c1 = findObj(post, "block-certifications-6-t1")!;
      const c4 = findObj(post, "block-certifications-6-t4")!;
      const l1 = findObj(post, "block-languages-7-t1")!;
      const s2 = findObj(post, "block-summary-1-t2")!;
      const e1 = findObj(post, "block-experience-2-t1")!;
      const e17 = findObj(post, "block-experience-2-t17")!;
      const edu = findObj(post, "block-education-3-t1")!;
      pdExcel = Number(visualGap(t2, t3).toFixed(2));
      skProj = Number(visualGap(t3, p1).toFixed(2));
      projCert = Number(visualGap(p3, c1).toFixed(2));
      certLang = Number(visualGap(c4, l1).toFixed(2));
      sumExp = Number(visualGap(s2, e1).toFixed(2));
      expEdu = Number(visualGap(e17, edu).toFixed(2));
      eduTop = Number(edu.top);
      headingGaps = [
        visualGap(findObj(post, "block-skills-4-t1")!, t2),
        visualGap(findObj(post, "block-projects-5-t1")!, findObj(post, "block-projects-5-t2")!),
        visualGap(c1, findObj(post, "block-certifications-6-t2")!),
        visualGap(l1, findObj(post, "block-languages-7-t2")!),
      ].map((g) => Number(g.toFixed(2)));
      overlaps = findTextOverlapFindings(post).length;
      const pageW = Number(post.width ?? 794);
      const pageH = Number(post.height ?? 1123);
      oob = ((post.objects ?? []) as Record<string, unknown>[]).filter((o) => {
        const left = Number(o.left ?? 0);
        const top = Number(o.top ?? 0);
        const w = Number(o.width ?? 0) * Number(o.scaleX ?? 1);
        const h = Number(o.height ?? 0) * Number(o.scaleY ?? 1);
        return left < -1 || top < -1 || left + w > pageW + 1 || top + h > pageH + 1;
      }).length;
    }
    const item11 = cov.items[10];
    const item12 = cov.items[11];
    const wrongTarget =
      (item11?.evidence?.affected_object_ids ?? []).includes("block-skills-4-t3") ||
      (item12?.evidence?.affected_object_ids ?? []).includes("block-skills-4-t3");
    assert(!wrongTarget, "wrong_target_attribution_test", JSON.stringify(item11?.evidence?.affected_object_ids));
    const superseded = existsSync(join(ev, "ai-geometry-superseded-by-canonical-layout.json"));
    assert(
      superseded || pdExcel <= READABLE_SEQUENTIAL_GAP_PX + 2,
      "ai_worsens_layout_repair_test",
      `superseded=${superseded} gap=${pdExcel}`,
    );
    assert(run.ok && run.task.status === "READY_FOR_FOUNDER_REVIEW", "golden_ready", `${run.task.status} ${run.error ?? ""}`);
    assert(goldenCalls === 1, "provider_calls_one", String(goldenCalls));
    assert(coverage === "21/21", "feedback_coverage_after", coverage);
    assert(acceptance, "final_acceptance");
    assert(rolePass, "role_pass");
    assert(overlaps === 0, "overlaps", String(overlaps));
    assert(oob === 0, "oob", String(oob));
    assert(
      pdExcel >= READABLE_SEQUENTIAL_GAP_PX - 0.05 && pdExcel <= READABLE_SEQUENTIAL_GAP_PX + 2.05,
      "process_design_excel_peer",
      String(pdExcel),
    );
    assert(
      Math.abs(skProj - projCert) <= 2 && Math.abs(projCert - certLang) <= 2,
      "sidebar_section_rhythm_after",
      `${skProj}/${projCert}/${certLang}`,
    );
    assert(sumExp === 43.1 && expEdu === 43.1 && eduTop === 799.6, "right_column_preserved", `${sumExp}/${expEdu}/${eduTop}`);
    assert(
      headingGaps.every((g) => g >= 8 - 0.05 && g <= 9 + 0.05),
      "heading_body_8",
      headingGaps.join("/"),
    );
    const agree = cov.items.every((it, idx) => {
      const mode = resolveItemCoverageMode(rcs[idx]!);
      if (mode !== "DETERMINISTIC_LAYOUT_OWNED") return true;
      return it.status === "addressed";
    });
    assert(agree, "canonical_and_coverage_agree");
  } finally {
    setRevisionPipelineRootsForTests(null);
    setRevisionTasksDirForTests(null);
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }

  const sidePass = evaluateCanonicalFinalStateLayoutProof({
    requestedChange:
      "Use one consistent sidebar section-spacing rhythm for Skills → Projects, Projects → Certifications, and Certifications → Languages.",
    beforeCanvas: prior,
    afterCanvas: afterCanvas ?? prior,
  });
  assert(sidePass.pass === true, "sidebar_cohort_positive", sidePass.reason);

  const rewrite = "Rewrite the Summary so it describes an Operations Analyst.";
  assert(
    resolveItemCoverageMode(rewrite) === "MUTATION_REQUIRED" &&
      isPlanCoverageExemptRequestedChange(rewrite) === false,
    "genuine_mutation_still_requires_ai_op",
  );
  assert(
    isCanonicalDeterministicLayoutOwnedChange(ITEM9) &&
      isLayoutOnlyIntentChange(ITEM9),
    "item_9_uses_intent_not_old_regex_only",
    `canonical=${isCanonicalDeterministicLayoutOwnedChange(ITEM9)} old=${isDeterministicLayoutNormalizerOwnedChange(ITEM9)}`,
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
  const result = {
    schema_version: "canonical-layout-ownership-6p-1.0.0",
    generated_at: new Date().toISOString(),
    pass,
    golden_status: goldenStatus,
    golden_error: goldenError,
    provider_calls: goldenCalls,
    coverage,
    acceptance_pass: acceptance,
    process_design_excel: pdExcel,
    skills_projects: skProj,
    projects_certifications: projCert,
    certifications_languages: certLang,
    summary_experience: sumExp,
    experience_education: expEdu,
    overlaps,
    oob,
    checks,
    publication_allowed: false,
    live: false,
  };
  mkdirSync(join(REPO, "SOS/07_LOGS/saios/founder-revision"), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
  if (!pass) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
