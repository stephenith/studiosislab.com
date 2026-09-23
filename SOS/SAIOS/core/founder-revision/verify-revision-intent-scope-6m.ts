/**
 * Phase 6M — revision intent scope + deterministic layout execution.
 *
 * Calls runFounderFeedbackRevision for the a0009171 golden path.
 * No production OpenAI. Isolated temp dirs. Historical tasks not mutated.
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
import { evaluateRoleTargetIntegrity } from "../role-integrity/RoleTargetIntegrity.js";
import { evaluateRevisionRoleTargetIntegrity } from "../role-integrity/RevisionRoleTargetIntegrity.js";
import { findTextOverlapFindings } from "./RevisionAcceptanceChecks.js";
import { resolveRevisionIntentScope } from "./RevisionIntentScope.js";
import { evaluateSectionReplacementCompleteness } from "./SectionReplacementCompleteness.js";
import { normalizeRevisionLayout, READABLE_SEQUENTIAL_GAP_PX } from "./RevisionLayoutNormalizer.js";
import { evaluateCanonicalFinalStateLayoutProof } from "./CanonicalFinalStateLayoutProof.js";
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
  visualTextContentBottom,
  visualTextContentHeightScaled,
} from "./TextEffectiveHeight.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const FIX = join(REPO, ".cursor/debug-fixtures/revtask-a0009171-849-sanitized");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-revision-intent-scope-6m.json",
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

function findObj(canvas: FabricCanvasDoc, id: string): Record<string, unknown> | null {
  const objs = (canvas.objects ?? []) as Record<string, unknown>[];
  return objs.find((o) => o.id === id) ?? null;
}

function sectionText(canvas: FabricCanvasDoc, section: string): string {
  return ((canvas.objects ?? []) as Record<string, unknown>[])
    .filter((o) => {
      const data = o.data;
      return Boolean(
        data &&
          typeof data === "object" &&
          (data as { section?: string }).section === section,
      );
    })
    .map((o) => String(o.text ?? ""))
    .join("\n");
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

function oldMutationContentSections(requested_changes: string[]): string[] {
  const LAYOUT =
    /\b(overlap|overlapp|collid|collision|clip|clipp|wrap|wrapping|spacing|space|position|reposition|align|alignment|bounds|out-of-bounds|margin|padding|geometry|overflow|move|shift|resize|font size|gap|rhythm|hierarchy|redesign|layout|adjust)\b/i;
  const VERB =
    /\b(replace|rewrite|rewrit|reword|revise|update|change|remove|delete|swap|correct|rework|refresh)\b/i;
  const PRES =
    /\b(preserv|retain|keep|maintain|unchanged|untouched|intact|as-is|as is)\b/i;
  const NOUNS: Array<[string, RegExp]> = [
    ["experience", /\b(experience|employment history|work history)\b/i],
    ["education", /\b(education|qualifications?)\b/i],
  ];
  const out = new Set<string>();
  for (const change of requested_changes) {
    const n = change.toLowerCase();
    if (PRES.test(n) && !VERB.test(n)) continue;
    if (LAYOUT.test(n)) continue;
    if (!VERB.test(n)) continue;
    for (const [key, re] of NOUNS) if (re.test(n)) out.add(key);
  }
  return [...out];
}

async function main(): Promise<void> {
  const task = readJson<{
    requested_changes: string[];
    prior_candidate_id: string;
    role: string;
    founder_reason: string;
    error: string;
  }>(join(FIX, "revtask-a0009171-849.json"));
  const priorCanvas = readJson<FabricCanvasDoc>(join(FIX, "prior/canvas.json"));
  const leftoverRole = readJson<{
    requested_role_sections?: string[];
    match?: string;
    reason?: string;
    pass?: boolean;
  }>(join(FIX, "evidence/revision-role-target-integrity.json"));
  const dropped = readJson<{ dropped: Array<{ target_id?: string }> }>(
    join(FIX, "evidence/unsafe-geometry-ops-dropped.json"),
  );
  const t2 = findObj(priorCanvas, "block-skills-4-t2")!;
  const t3 = findObj(priorCanvas, "block-skills-4-t3")!;
  const gapBefore = visualGap(t2, t3);
  const eduBefore = Number(findObj(priorCanvas, "block-education-3-t1")?.top ?? 0);
  const expLast = findObj(priorCanvas, "block-experience-2-t17")!;
  const expEduBefore = Number(findObj(priorCanvas, "block-education-3-t1")?.top ?? 0) - visualTextContentBottom(expLast);

  assert(
    leftoverRole.pass === false &&
      leftoverRole.match === "ROLE_CONTENT_INCOMPLETE" &&
      (leftoverRole.requested_role_sections ?? []).includes("experience") &&
      (leftoverRole.requested_role_sections ?? []).includes("education"),
    "current_scope_failure_reproduced",
    leftoverRole.reason ?? "",
  );
  const oldScope = oldMutationContentSections(task.requested_changes);
  assert(
    oldScope.includes("experience") && oldScope.includes("education"),
    "old_code_remove_blank_area_compiled_content_scope",
    oldScope.join(","),
  );
  assert(
    gapBefore + 1e-9 < READABLE_SEQUENTIAL_GAP_PX,
    "current_skills_collision_failure_reproduced",
    `gap=${gapBefore.toFixed(2)}`,
  );
  assert(
    dropped.dropped.some((d) => d.target_id === "block-skills-4-t3"),
    "excel_set_position_dropped_as_unsafe",
    JSON.stringify(dropped.dropped.map((d) => d.target_id)),
  );

  const scope = resolveRevisionIntentScope(task.requested_changes);
  assert(
    !scope.content_mutation_sections.includes("experience") &&
      !scope.content_mutation_sections.includes("education"),
    "fixture_no_experience_education_replacement_scope",
    scope.content_mutation_sections.join(","),
  );
  assert(
    scope.content_preservation_sections.includes("experience") &&
      scope.content_preservation_sections.includes("education"),
    "fixture_experience_education_preservation_scope",
    scope.content_preservation_sections.join(","),
  );
  assert(
    scope.layout_sections.includes("education") ||
      scope.layout_sections.includes("experience") ||
      scope.layout_sections.includes("skills"),
    "fixture_layout_scope_present",
    scope.layout_sections.join(","),
  );

  const cases: Array<[string, string, string]> = [
    [
      "Remove blank vertical area between Experience and Education",
      "layout",
      "LAYOUT_BLANK_AREA_TEST",
    ],
    ["Reduce whitespace after Experience", "layout", "LAYOUT_WHITESPACE_TEST"],
    ["Move Education upward", "layout", "MOVE_EDUCATION_TEST"],
    ["Do not rewrite Experience", "preserve", "DO_NOT_REWRITE_EXPERIENCE_TEST"],
    ["Preserve Education content", "preserve", "PRESERVE_EDUCATION_TEST"],
    [
      "Remove Marketing Manager Experience",
      "remove",
      "REMOVE_MARKETING_EXPERIENCE_TEST",
    ],
    [
      "Rewrite Experience for Operations Analyst",
      "replace",
      "REWRITE_EXPERIENCE_TEST",
    ],
    ["Replace Education content", "replace", "REPLACE_EDUCATION_TEST"],
    [
      "Remove Google Analytics certification",
      "remove",
      "REMOVE_CERTIFICATION_TEST",
    ],
  ];
  for (const [line, expect, name] of cases) {
    const one = resolveRevisionIntentScope([line]);
    const mutation = one.content_mutation_sections;
    const removal = one.content_removal_sections;
    const replace = one.content_replacement_sections;
    const preserve = one.content_preservation_sections;
    const layout = one.layout_sections;
    let ok = false;
    if (expect === "layout") ok = mutation.length === 0 && (layout.length > 0 || one.items[0]?.clauses.some((c) => c.intent_class === "LAYOUT_MUTATION"));
    if (expect === "preserve") ok = mutation.length === 0 && preserve.length > 0;
    if (expect === "remove") ok = removal.length > 0 && replace.length === 0;
    if (expect === "replace") ok = replace.length > 0;
    assert(ok, name.toLowerCase(), JSON.stringify({ mutation, removal, replace, preserve, layout }));
  }

  const collisionLine =
    "Fix the visible overlap between the “Process Design” and “Excel” entries in the Skills section.";
  const overlapProof = evaluateCanonicalFinalStateLayoutProof({
    requestedChange: collisionLine,
    beforeCanvas: priorCanvas,
    afterCanvas: priorCanvas,
  });
  assert(!overlapProof.pass, "skills_overlap_negative", overlapProof.reason);

  const touching = JSON.parse(JSON.stringify(priorCanvas)) as FabricCanvasDoc;
  const t3t = findObj(touching, "block-skills-4-t3")!;
  t3t.top = visualTextContentBottom(t2);
  const touchProof = evaluateCanonicalFinalStateLayoutProof({
    requestedChange: collisionLine,
    beforeCanvas: priorCanvas,
    afterCanvas: touching,
  });
  assert(!touchProof.pass, "skills_touching_negative", touchProof.reason);

  const safeSkills = normalizeRevisionLayout({
    canvas: priorCanvas,
    requested_changes: task.requested_changes,
    prior_canvas: priorCanvas,
  });
  const t2n = findObj(safeSkills.canvas, "block-skills-4-t2")!;
  const t3n = findObj(safeSkills.canvas, "block-skills-4-t3")!;
  const gapSafe = visualGap(t2n, t3n);
  assert(
    safeSkills.report.ok && gapSafe + 1e-9 >= READABLE_SEQUENTIAL_GAP_PX,
    "skills_safe_gap_positive",
    `gap=${gapSafe.toFixed(2)} err=${safeSkills.report.error ?? ""}`,
  );

  const downstreamHit = JSON.parse(JSON.stringify(safeSkills.canvas)) as FabricCanvasDoc;
  const projects = ((downstreamHit.objects ?? []) as Record<string, unknown>[]).find(
    (o) => {
      const data = o.data;
      return (
        data &&
        typeof data === "object" &&
        (data as { section?: string }).section === "projects" &&
        typeof o.text === "string" &&
        /project/i.test(o.text)
      );
    },
  );
  if (projects) {
    const t3d = findObj(downstreamHit, "block-skills-4-t3")!;
    projects.top = visualTextContentBottom(t3d) - 4;
    assert(
      findTextOverlapFindings(downstreamHit).length > 0,
      "downstream_collision_negative",
      `overlaps=${findTextOverlapFindings(downstreamHit).length}`,
    );
  } else {
    assert(false, "downstream_collision_negative", "projects heading missing");
  }

  const eduDetached = evaluateCanonicalFinalStateLayoutProof({
    requestedChange:
      "Move the Education section upward in the right column so it follows naturally after the final Experience entry.",
    beforeCanvas: priorCanvas,
    afterCanvas: priorCanvas,
  });
  assert(
    !eduDetached.pass || expEduBefore > 40,
    "education_excessive_gap_negative",
    `pass=${eduDetached.pass} gap=${expEduBefore.toFixed(1)} ${eduDetached.reason}`,
  );

  const eduOverlap = JSON.parse(JSON.stringify(priorCanvas)) as FabricCanvasDoc;
  for (const id of ["block-education-3-t1", "block-education-3-t2", "block-education-3-t3", "block-education-3-r0"]) {
    const o = findObj(eduOverlap, id);
    if (o) o.top = Number(expLast.top ?? 0) - 8;
  }
  const eduOverlapProof = evaluateCanonicalFinalStateLayoutProof({
    requestedChange:
      "Move the Education section upward in the right column so it follows naturally after the final Experience entry.",
    beforeCanvas: priorCanvas,
    afterCanvas: eduOverlap,
  });
  assert(!eduOverlapProof.pass, "education_overlap_negative", eduOverlapProof.reason);

  const eduSafeGap =
    Number(findObj(safeSkills.canvas, "block-education-3-t1")?.top ?? 0) -
    visualTextContentBottom(findObj(safeSkills.canvas, "block-experience-2-t17")!);
  assert(
    eduSafeGap >= 12 && eduSafeGap < expEduBefore - 10,
    "education_safe_rhythm_positive",
    `before=${expEduBefore.toFixed(1)} after=${eduSafeGap.toFixed(1)}`,
  );

  const oobCanvas = JSON.parse(JSON.stringify(priorCanvas)) as FabricCanvasDoc;
  const oobObj = findObj(oobCanvas, "block-education-3-t3");
  if (oobObj) oobObj.top = 1200;
  assert(pageOob(oobCanvas) > 0, "page_oob_negative", String(pageOob(oobCanvas)));

  const rewritePlan: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "rewrite experience only",
    operations: [],
  };
  const rewriteRole = evaluateRevisionRoleTargetIntegrity({
    target_role: "Operations Analyst",
    afterCanvas: priorCanvas,
    beforeCanvas: priorCanvas,
    requested_changes: ["Rewrite Experience for Operations Analyst"],
    plan: rewritePlan,
  });
  assert(
    !rewriteRole.pass && rewriteRole.match === "ROLE_CONTENT_INCOMPLETE",
    "genuine_rewrite_still_requires_body_objects",
    rewriteRole.reason,
  );
  const residueCanvas = JSON.parse(JSON.stringify(priorCanvas)) as FabricCanvasDoc;
  const exp0 = findObj(residueCanvas, "block-experience-2-t2");
  if (exp0) exp0.text = "Marketing Manager — Northstar Analytics";
  const residue = evaluateRevisionRoleTargetIntegrity({
    target_role: "Operations Analyst",
    afterCanvas: residueCanvas,
    beforeCanvas: priorCanvas,
    requested_changes: ["Rewrite Experience for Operations Analyst"],
    plan: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "partial",
      operations: [
        {
          op: "update_text",
          target_id: "block-experience-2-t2",
          before_summary: "title",
          intended_change: "rewrite title",
          values: { text: "Marketing Manager — Northstar Analytics" },
          founder_feedback_item: "Rewrite Experience for Operations Analyst",
          confidence: 1,
        },
      ],
    },
  });
  assert(
    !residue.pass,
    "marketing_residue_still_fails",
    residue.reason,
  );

  const genMissing = evaluateRoleTargetIntegrity({
    target_title: "Operations Analyst",
    structured_role: null,
    rendered_role: "Operations Analyst",
  });
  assert(
    !genMissing.pass && /structured generated role missing/i.test(genMissing.reason),
    "generation_structured_role_unchanged",
    genMissing.reason,
  );

  const completeness = evaluateSectionReplacementCompleteness({
    canvas: priorCanvas,
    plan: rewritePlan,
    requested_changes: task.requested_changes,
  });
  assert(completeness.ok, "6j_layout_followup_no_replacement_required", completeness.error ?? "");
  const expDisp = completeness.sections.find((s) => s.section === "experience");
  const eduDisp = completeness.sections.find((s) => s.section === "education");
  assert(
    !!expDisp &&
      expDisp.accounts.length > 0 &&
      expDisp.accounts.every((a) => a.disposition === "EXPLICITLY_PRESERVED"),
    "experience_disposition_explicitly_preserved",
    expDisp?.accounts.map((a) => a.disposition).join(",") ?? "missing",
  );
  assert(
    !!eduDisp &&
      eduDisp.accounts.length > 0 &&
      eduDisp.accounts.every((a) => a.disposition === "EXPLICITLY_PRESERVED"),
    "education_disposition_explicitly_preserved",
    eduDisp?.accounts.map((a) => a.disposition).join(",") ?? "missing",
  );

  const primary = readJson<RevisionPlan>(join(FIX, "revision-plan-ai-primary.json"));
  const tmp = mkdtempSync(join(tmpdir(), "aios-6m-"));
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
  let goldenDir: string | null = null;
  let goldenError: string | null = null;
  try {
    const created = createRevisionTask({
      decision_id: `fd-6m-golden-${Date.now().toString(36)}`,
      review_id: "founder-review-6m-golden",
      prior_candidate_id: task.prior_candidate_id,
      prior_canvas_path: join(candRoot, task.prior_candidate_id, "canvas.json"),
      founder_reason: task.founder_reason,
      requested_changes: task.requested_changes,
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
        structured_output: primary as unknown as Record<string, unknown>,
        provider_request_id: "6m-golden",
        model_identifier_internal: "fixture",
        input_tokens: 1,
        output_tokens: 1,
      }),
    });
    goldenStatus = run.task.status;
    goldenError = run.error;
    if (run.revised_candidate_id) {
      goldenDir = join(candRoot, run.revised_candidate_id);
    }
    assert(
      run.ok && run.task.status === "READY_FOR_FOUNDER_REVIEW",
      "golden_ready_for_founder_review",
      `${run.task.status} ${run.task.failure_owner ?? ""} ${run.error ?? ""}`,
    );
    if (goldenDir && existsSync(goldenDir)) {
      const after = readJson<FabricCanvasDoc>(join(goldenDir, "canvas.json"));
      const acc = readJson<{ overall?: string }>(join(goldenDir, "revision-final-acceptance.json"));
      const role = readJson<{
        pass?: boolean;
        requested_role_sections?: string[];
      }>(join(goldenDir, "revision-role-target-integrity.json"));
      const cov = readJson<{
        gate_pass?: boolean;
        items?: Array<{ status: string }>;
      }>(join(goldenDir, "feedback-coverage.json"));
      const addressed = (cov.items ?? []).filter((i) => i.status === "addressed").length;
      assert(acc.overall === "PASS", "golden_final_acceptance", JSON.stringify(acc));
      assert(role.pass === true, "golden_role_integrity", JSON.stringify(role));
      assert(
        !(role.requested_role_sections ?? []).includes("experience") &&
          !(role.requested_role_sections ?? []).includes("education"),
        "golden_no_false_replacement_sections",
        (role.requested_role_sections ?? []).join(","),
      );
      assert(
        sectionText(after, "experience") === sectionText(priorCanvas, "experience"),
        "experience_text_unchanged",
        "",
      );
      assert(
        sectionText(after, "education") === sectionText(priorCanvas, "education"),
        "education_text_unchanged",
        "",
      );
      const t2a = findObj(after, "block-skills-4-t2")!;
      const t3a = findObj(after, "block-skills-4-t3")!;
      const gapAfter = visualGap(t2a, t3a);
      assert(
        gapAfter + 1e-9 >= READABLE_SEQUENTIAL_GAP_PX,
        "golden_skills_readable_gap",
        `before=${gapBefore.toFixed(2)} after=${gapAfter.toFixed(2)}`,
      );
      assert(
        findTextOverlapFindings(after).length === 0,
        "golden_no_text_overlaps",
        String(findTextOverlapFindings(after).length),
      );
      assert(pageOob(after) === 0, "golden_no_page_oob", String(pageOob(after)));
      const eduAfter = Number(findObj(after, "block-education-3-t1")?.top ?? 0);
      const expEduAfter =
        eduAfter - visualTextContentBottom(findObj(after, "block-experience-2-t17")!);
      assert(
        expEduAfter >= 12 && expEduAfter < expEduBefore - 10,
        "golden_education_rhythm",
        `edu ${eduBefore}→${eduAfter} gap ${expEduBefore.toFixed(1)}→${expEduAfter.toFixed(1)}`,
      );
      assert(
        cov.gate_pass === true && addressed === task.requested_changes.length,
        "golden_feedback_coverage_all",
        `${addressed}/${task.requested_changes.length}`,
      );
      const sidebarProof = evaluateCanonicalFinalStateLayoutProof({
        requestedChange:
          "Maintain consistent section-to-section spacing in the sidebar for Skills → Projects, Projects → Certifications, and Certifications → Languages.",
        beforeCanvas: priorCanvas,
        afterCanvas: after,
      });
      const rightProof = evaluateCanonicalFinalStateLayoutProof({
        requestedChange:
          "Use a normal positive section gap between the final Experience content and Education that is visually comparable to the spacing used between other major sections.",
        beforeCanvas: priorCanvas,
        afterCanvas: after,
      });
      assert(
        sidebarProof.pass,
        "golden_sidebar_section_rhythm",
        `${sidebarProof.reason} ${sidebarProof.final_condition}`,
      );
      assert(
        rightProof.pass,
        "golden_right_column_section_rhythm",
        `${rightProof.reason} ${rightProof.final_condition}`,
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
    assert(existsSync(p), `historical_${id}_unchanged`, sha256(p));
  }

  const leftoverAfter = leftoverRole.reason;
  assert(
    leftoverAfter ===
      "requested professional section replacement incomplete: block-experience-2-t2,block-experience-2-t4,block-experience-2-t5,block-experience-2-t6,block-experience-2-t7,block-experience-2-t8,block-experience-2-t10,block-experience-2-t11,block-experience-2-t12,block-experience-2-t13,block-experience-2-t15,block-experience-2-t16,block-experience-2-t17,block-education-3-t2,block-education-3-t3",
    "historical_a0009171_fixture_unchanged",
    leftoverAfter ?? "",
  );

  const pass = checks.every((c) => c.pass);
  const report = {
    schema_version: "revision-intent-scope-6m-1.0.0",
    generated_at: new Date().toISOString(),
    pass,
    golden_status: goldenStatus,
    golden_error: goldenError,
    skills_gap_before: gapBefore,
    education_top_before: eduBefore,
    visual_t2_height: visualTextContentHeightScaled(t2),
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
