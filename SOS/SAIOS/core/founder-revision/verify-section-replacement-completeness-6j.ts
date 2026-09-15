/**
 * Phase 6J — whole-section content replacement completeness contract.
 *
 * Production origin: revtask-7a1c0899-4d6 FAILED_GATE after Phase 6I.
 * t2 replaced; t3 omitted keep-list content. No OpenAI. No production mutation.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { buildPlanWithDeterministicSpacingOwnership } from "./DeterministicSpacingPlan.js";
import { findIncompleteRequestedSectionReplacements } from "./RevisionAcceptanceChecks.js";
import {
  buildRevisionPlannerPrompt,
  validatePlanCoversRequestedChanges,
} from "./RevisionPromptBuilder.js";
import {
  authorizedWholeSectionReplacementSections,
  evaluateSectionReplacementCompleteness,
  requiredBodyInventoryFromInventory,
  requiredBodyObjectIdsForSections,
  sectionReplacementEvaluatorInventedCopy,
} from "./SectionReplacementCompleteness.js";
import { listRevisionTasks } from "./RevisionTaskStore.js";
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import type {
  CanvasInventoryObject,
  CanvasOperation,
  RevisionPlan,
  RevisionTask,
} from "./revision-task-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const FIX = resolve(
  REPO,
  ".cursor/debug-fixtures/revtask-7a1c0899-4d6-sanitized",
);
const HIST = {
  b5339d03: resolve(REPO, ".cursor/debug-fixtures/revtask-b5339d03-b67-sanitized"),
  "9441fe34": resolve(REPO, ".cursor/debug-fixtures/revtask-9441fe34-4ba-sanitized"),
  b9a65ad0: resolve(REPO, ".cursor/debug-fixtures/revtask-b9a65ad0-eb0-sanitized"),
  "33ef5466": resolve(REPO, ".cursor/debug-fixtures/revtask-33ef5466-f24-sanitized"),
  "7a1c0899": FIX,
};
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-section-replacement-completeness-6j.json",
);

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function assert(ok: boolean, name: string, detail = ""): void {
  checks.push({ name, pass: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
}

function loadJson<T>(dir: string, name: string): T {
  return JSON.parse(readFileSync(join(dir, name), "utf8")) as T;
}

function obj(spec: {
  id: string;
  type?: string;
  text?: string | null;
  section?: string;
  role?: string | null;
  top?: number;
}): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (spec.section) data.section = spec.section;
  if (spec.role) data.role = spec.role;
  return {
    id: spec.id,
    type: spec.type ?? "Textbox",
    text: spec.text ?? null,
    left: 48,
    top: spec.top ?? 160,
    width: spec.type === "Rect" ? 4 : 220,
    height: spec.type === "Rect" ? 14 : 40,
    data,
  };
}

function canvasOf(objects: Record<string, unknown>[]): FabricCanvasDoc {
  return { version: "6.0.0", width: 794, height: 1123, objects } as FabricCanvasDoc;
}

function opUpdate(
  id: string,
  text: string,
  item: string,
): CanvasOperation {
  return {
    op: "update_text",
    target_id: id,
    values: { text },
    founder_feedback_item: item,
    intended_change: `replace ${id}`,
    before_summary: `source ${id}`,
    confidence: 0.9,
  };
}

function opRemove(id: string, item: string): CanvasOperation {
  return {
    op: "remove_object",
    target_id: id,
    values: {},
    founder_feedback_item: item,
    intended_change: `remove ${id}`,
    before_summary: `source ${id}`,
    confidence: 0.9,
  };
}

function planOf(operations: CanvasOperation[]): RevisionPlan {
  return {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "test",
    operations,
    notes: [],
  };
}

const SKILLS_REPLACE =
  "Replace the current marketing-focused Skills with Operations Analyst skills and tools appropriate for the target role.";
const SKILLS_REMOVE =
  "Remove marketing-specific skills including Demand Generation, Brand Strategy, ABM, SEO / Content, Marketing Analytics, and Sales Enablement.";
const SKILLS_KEEP =
  "Keep useful Operations Analyst skills such as Documentation, Process Design, stakeholder communication, operational analysis, process improvement, KPI reporting, data analysis, Excel, reporting, and workflow optimization where appropriate.";
const EXP_REPLACE =
  "Replace all Marketing Manager, Senior Marketing Specialist, and Marketing Coordinator Experience content with realistic Operations Analyst-focused roles and achievements.";
const PROJ_REPLACE =
  "Replace the Always-On ABM Pilot project with a realistic Operations Analyst project focused on process improvement.";
const CERT_REPLACE =
  "Replace the marketing-specific Certifications with certifications or professional training appropriate for an Operations Analyst profile.";
const EDU_REPLACE =
  "Update the Education content where necessary so the qualifications are coherent with the Operations Analyst professional profile rather than a Marketing Manager profile.";

const skillsCanvas = canvasOf([
  obj({
    id: "block-skills-4-r0",
    type: "Rect",
    section: "skills",
    role: "section-marker",
  }),
  obj({
    id: "block-skills-4-t1",
    text: "SKILLS",
    section: "skills",
    top: 154,
  }),
  obj({
    id: "block-skills-4-t2",
    text: "Demand Generation  ·  Brand Strategy  ·  ABM  ·  SEO / Content  ·  Marketing Analytics  ·  Sales Enablement",
    section: "skills",
    top: 176,
  }),
  obj({
    id: "block-skills-4-t3",
    text: "Tools  ·  Documentation  ·  Stakeholder Comms  ·  Process Design",
    section: "skills",
    top: 274,
  }),
]);

const beforeTasks = listRevisionTasks().map((t) => `${t.task_id}:${t.status}`);
const task = loadJson<{
  requested_changes: string[];
  error: string;
  status: string;
  task_id: string;
}>(FIX, "task.json");
const prior = loadJson<FabricCanvasDoc>(FIX, "prior-canvas.json");
const prodPlan = loadJson<RevisionPlan>(FIX, "revision-plan.json");
const inventory = loadJson<CanvasInventoryObject[]>(FIX, "inventory.json");
const reproduced = loadJson<{
  t2_targeted: boolean;
  t3_targeted: boolean;
  fail: boolean;
  incomplete_ids: string[];
}>(FIX, "current-failure-reproduced.json");

const updated = new Set(
  prodPlan.operations
    .filter((o) => o.op === "update_text")
    .map((o) => o.target_id)
    .filter(Boolean),
);

assert(
  reproduced.t2_targeted === true &&
    reproduced.t3_targeted === false &&
    reproduced.fail === true &&
    reproduced.incomplete_ids.includes("block-skills-4-t3"),
  "1_exact_7a1c0899_t3_omission_reproduced_before_fix",
  "t2 targeted / t3 untargeted / FAIL recorded",
);
assert(
  updated.has("block-skills-4-t2") && !updated.has("block-skills-4-t3"),
  "1b_production_plan_still_omits_t3",
  `t2=${updated.has("block-skills-4-t2")} t3=${updated.has("block-skills-4-t3")}`,
);

const authorized = authorizedWholeSectionReplacementSections(
  task.requested_changes,
);
const requiredSkills = requiredBodyObjectIdsForSections(
  prior,
  new Set(["skills"]),
);
assert(
  authorized.has("skills") &&
    requiredSkills.includes("block-skills-4-t2") &&
    requiredSkills.includes("block-skills-4-t3") &&
    !requiredSkills.includes("block-skills-4-t1") &&
    !requiredSkills.includes("block-skills-4-r0"),
  "2_whole_section_required_body_inventory",
  requiredSkills.join(","),
);

const fixtureReport = evaluateSectionReplacementCompleteness({
  canvas: prior,
  plan: prodPlan,
  requested_changes: task.requested_changes,
});
const t2Acc = fixtureReport.sections
  .find((s) => s.section === "skills")
  ?.accounts.find((a) => a.object_id === "block-skills-4-t2");
const t3Acc = fixtureReport.sections
  .find((s) => s.section === "skills")
  ?.accounts.find((a) => a.object_id === "block-skills-4-t3");

assert(
  fixtureReport.sections
    .find((s) => s.section === "skills")
    ?.accounts.every((a) => a.disposition != null) === true,
  "3_every_required_body_object_receives_disposition",
  fixtureReport.sections
    .find((s) => s.section === "skills")
    ?.accounts.map((a) => `${a.object_id}=${a.disposition}`)
    .join(",") ?? "missing",
);

assert(
  t2Acc?.disposition === "REPLACED",
  "5_t2_replaced",
  t2Acc?.disposition ?? "missing",
);
assert(
  t3Acc?.disposition === "EXPLICITLY_PRESERVED",
  "6_t3_explicitly_preserved_without_update_text",
  `${t3Acc?.disposition} ops=${prodPlan.operations.filter((o) => o.target_id === "block-skills-4-t3").length}`,
);
assert(
  fixtureReport.ok === true && (t3Acc?.founder_items.length ?? 0) > 0,
  "6b_fixture_skills_completeness_pass",
  fixtureReport.error ?? "ok",
);
assert(
  !prodPlan.operations.some(
    (o) =>
      o.op === "update_text" &&
      o.target_id === "block-skills-4-t3" &&
      o.values &&
      (o.values as { text?: string }).text ===
        "Tools  ·  Documentation  ·  Stakeholder Comms  ·  Process Design",
  ),
  "6c_no_dummy_identical_update_text_for_t3",
  "ok",
);

const noKeep = task.requested_changes.filter((c) => !c.startsWith("Keep useful"));
const noKeepReport = evaluateSectionReplacementCompleteness({
  canvas: prior,
  plan: prodPlan,
  requested_changes: noKeep,
});
const noKeepT3 = noKeepReport.sections
  .find((s) => s.section === "skills")
  ?.accounts.find((a) => a.object_id === "block-skills-4-t3");
assert(
  noKeepReport.ok === false && noKeepT3?.disposition === "UNACCOUNTED",
  "4_unaccounted_object_fails",
  `${noKeepT3?.disposition} ${noKeepReport.error}`,
);
assert(
  (noKeepReport.error ?? "").includes("section=skills") &&
    (noKeepReport.error ?? "").includes("block-skills-4-t3"),
  "4b_error_reports_section_and_ids",
  noKeepReport.error ?? "",
);

const fullPlan = planOf([
  opUpdate("block-skills-4-t2", "Operational analysis · KPI reporting", SKILLS_REPLACE),
  opUpdate("block-skills-4-t3", "Excel · workflow optimization", SKILLS_REPLACE),
]);
const fullReport = evaluateSectionReplacementCompleteness({
  canvas: skillsCanvas,
  plan: fullPlan,
  requested_changes: [SKILLS_REPLACE],
});
assert(
  fullReport.ok &&
    fullReport.sections[0]?.accounts.every((a) => a.disposition === "REPLACED"),
  "5b_fully_replaced_section_passes",
  fullReport.sections[0]?.accounts.map((a) => a.disposition).join(",") ?? "missing",
);

assert(
  evaluateSectionReplacementCompleteness({
    canvas: skillsCanvas,
    plan: planOf([
      opUpdate("block-skills-4-t2", "Operational analysis", SKILLS_REPLACE),
    ]),
    requested_changes: [SKILLS_REPLACE],
  }).ok === false,
  "7_unchanged_object_without_preservation_intent_fails",
  "t3 omitted, no keep",
);

const preservePass = evaluateSectionReplacementCompleteness({
  canvas: skillsCanvas,
  plan: planOf([
    opUpdate("block-skills-4-t2", "Operational analysis · KPI reporting", SKILLS_REPLACE),
  ]),
  requested_changes: [SKILLS_REPLACE, SKILLS_KEEP],
});
assert(
  preservePass.ok &&
    preservePass.sections[0]?.accounts.find((a) => a.object_id === "block-skills-4-t3")
      ?.disposition === "EXPLICITLY_PRESERVED",
  "6d_explicit_preserve_synthetic_pass",
  preservePass.sections[0]?.accounts
    .map((a) => `${a.object_id}=${a.disposition}`)
    .join(",") ?? "",
);

const mixedT3 = canvasOf([
  obj({ id: "block-skills-4-t1", text: "SKILLS", section: "skills" }),
  obj({
    id: "block-skills-4-t2",
    text: "Demand Generation  ·  Brand Strategy",
    section: "skills",
  }),
  obj({
    id: "block-skills-4-t3",
    text: "Documentation · Demand Generation · Process Design",
    section: "skills",
  }),
]);
const conflictReport = evaluateSectionReplacementCompleteness({
  canvas: mixedT3,
  plan: planOf([
    opUpdate("block-skills-4-t2", "Operational analysis", SKILLS_REPLACE),
  ]),
  requested_changes: [SKILLS_REPLACE, SKILLS_REMOVE, SKILLS_KEEP],
});
const conflictT3 = conflictReport.sections[0]?.accounts.find(
  (a) => a.object_id === "block-skills-4-t3",
);
assert(
  conflictReport.ok === false && conflictT3?.disposition === "UNACCOUNTED",
  "8_preserve_cannot_override_explicit_remove",
  `${conflictT3?.disposition} ${conflictT3?.evidence}`,
);
assert(
  (conflictT3?.evidence ?? "").toLowerCase().includes("banned") ||
    (conflictT3?.evidence ?? "").toLowerCase().includes("demand generation"),
  "9_preserve_cannot_retain_banned_source_role_content",
  conflictT3?.evidence ?? "",
);

const headingReport = evaluateSectionReplacementCompleteness({
  canvas: skillsCanvas,
  plan: planOf([
    opUpdate("block-skills-4-t2", "Operational analysis", SKILLS_REPLACE),
  ]),
  requested_changes: [SKILLS_REPLACE, SKILLS_KEEP],
});
assert(
  !headingReport.sections[0]?.required_body_object_ids.includes(
    "block-skills-4-t1",
  ),
  "10_headings_excluded",
  String(headingReport.sections[0]?.required_body_object_ids),
);
assert(
  !headingReport.sections[0]?.required_body_object_ids.includes(
    "block-skills-4-r0",
  ),
  "11_markers_excluded",
  String(headingReport.sections[0]?.required_body_object_ids),
);

const dated = canvasOf([
  obj({ id: "block-experience-2-t1", text: "EXPERIENCE", section: "experience" }),
  obj({
    id: "block-experience-2-t2",
    text: "Marketing Manager — Northstar",
    section: "experience",
  }),
  obj({
    id: "block-experience-2-t3",
    text: "2021 — Present",
    section: "experience",
  }),
]);
const dateIds = requiredBodyObjectIdsForSections(
  dated,
  new Set(["experience"]),
);
assert(
  dateIds.includes("block-experience-2-t2") &&
    !dateIds.includes("block-experience-2-t3") &&
    !dateIds.includes("block-experience-2-t1"),
  "11b_dates_and_headings_excluded",
  dateIds.join(","),
);

const multiCanvas = canvasOf([
  obj({ id: "e-h", text: "EXPERIENCE", section: "experience" }),
  obj({ id: "e-b1", text: "Marketing Manager role", section: "experience" }),
  obj({ id: "e-b2", text: "Campaign bullet", section: "experience" }),
  obj({ id: "s-h", text: "SKILLS", section: "skills" }),
  obj({ id: "s-b1", text: "Demand Generation", section: "skills" }),
  obj({ id: "p-h", text: "PROJECTS", section: "projects" }),
  obj({ id: "p-b1", text: "Always-On ABM Pilot", section: "projects" }),
  obj({ id: "c-h", text: "CERTIFICATIONS", section: "certifications" }),
  obj({ id: "c-b1", text: "Google Analytics IQ", section: "certifications" }),
  obj({ id: "d-h", text: "EDUCATION", section: "education" }),
  obj({ id: "d-b1", text: "B.A. Marketing", section: "education" }),
]);
const multiPlan = planOf([
  opUpdate("e-b1", "Operations Analyst role", EXP_REPLACE),
  opUpdate("s-b1", "Process improvement", SKILLS_REPLACE),
  opUpdate("p-b1", "Workflow optimization pilot", PROJ_REPLACE),
  opUpdate("c-b1", "Lean Six Sigma Yellow Belt", CERT_REPLACE),
  opUpdate("d-b1", "B.A. Operations", EDU_REPLACE),
]);
const multiComplete = evaluateSectionReplacementCompleteness({
  canvas: multiCanvas,
  plan: multiPlan,
  requested_changes: [
    EXP_REPLACE,
    SKILLS_REPLACE,
    PROJ_REPLACE,
    CERT_REPLACE,
    EDU_REPLACE,
  ],
});
const multiOmitted = evaluateSectionReplacementCompleteness({
  canvas: multiCanvas,
  plan: planOf(multiPlan.operations.filter((o) => o.target_id !== "e-b2")),
  requested_changes: [
    EXP_REPLACE,
    SKILLS_REPLACE,
    PROJ_REPLACE,
    CERT_REPLACE,
    EDU_REPLACE,
  ],
});
assert(
  multiComplete.ok === false &&
    multiComplete.unaccounted_object_ids.includes("e-b2"),
  "12a_multi_section_omission_in_experience_not_hidden",
  String(multiComplete.unaccounted_object_ids),
);
assert(
  multiOmitted.ok === false &&
    multiOmitted.unaccounted_object_ids.includes("e-b2") &&
    !multiOmitted.unaccounted_object_ids.includes("s-b1"),
  "12b_other_sections_complete_cannot_hide_experience_omission",
  String(multiOmitted.unaccounted_object_ids),
);
const multiAll = evaluateSectionReplacementCompleteness({
  canvas: multiCanvas,
  plan: planOf([
    ...multiPlan.operations,
    opUpdate("e-b2", "Root-cause analysis bullet", EXP_REPLACE),
  ]),
  requested_changes: [
    EXP_REPLACE,
    SKILLS_REPLACE,
    PROJ_REPLACE,
    CERT_REPLACE,
    EDU_REPLACE,
  ],
});
assert(multiAll.ok === true, "12c_multi_section_all_replaced_passes", multiAll.error ?? "ok");

const canvasBefore = JSON.stringify(prior);
const afterEval = evaluateSectionReplacementCompleteness({
  canvas: prior,
  plan: prodPlan,
  requested_changes: task.requested_changes,
});
assert(
  JSON.stringify(prior) === canvasBefore &&
    sectionReplacementEvaluatorInventedCopy() === false &&
    afterEval.sections
      .flatMap((s) => s.accounts)
      .every((a) => a.disposition !== "REPLACED" || updated.has(a.object_id)),
  "13_no_deterministic_copy_invention",
  "evaluator does not mutate canvas or synthesize resume text",
);

const itemCoverage = validatePlanCoversRequestedChanges(
  prodPlan,
  task.requested_changes,
);
const skillsReplaceUncovered = itemCoverage.errors.some((e) =>
  e.includes("Replace the current marketing-focused Skills"),
);
assert(
  skillsReplaceUncovered === false,
  "14_founder_item_coverage_remains_separate_and_passed_for_skills_replace",
  `errors=${itemCoverage.errors.length} ok=${itemCoverage.ok}`,
);
assert(
  typeof itemCoverage.ok === "boolean" && fixtureReport.ok === true,
  "15_section_object_completeness_remains_separate",
  `item_ok=${itemCoverage.ok} object_ok=${fixtureReport.ok}`,
);

const findings = findIncompleteRequestedSectionReplacements({
  canvas: prior,
  plan: prodPlan,
  requested_changes: task.requested_changes,
});
assert(
  findings.length === 0,
  "11c_post_fix_findings_empty_for_preserved_t3",
  findings.map((f) => f.object_ids.join(",")).join(";"),
);

const prompt = buildRevisionPlannerPrompt({
  task: loadJson<RevisionTask>(FIX, "task.json"),
  inventory,
  page_width: 794,
  page_height: 1123,
  preview_width: 794,
  preview_height: 1123,
});
assert(
  prompt.instructions.includes("REQUIRED BODY OBJECT INVENTORY") &&
    prompt.instructions.includes("block-skills-4-t2") &&
    prompt.instructions.includes("block-skills-4-t3") &&
    prompt.instructions.includes("EXPLICITLY_PRESERVED"),
  "planner_receives_required_object_inventory",
  "ok",
);

const invEntries = requiredBodyInventoryFromInventory(
  inventory,
  new Set(["skills"]),
);
assert(
  invEntries.some((e) => e.object_id === "block-skills-4-t3") &&
    !invEntries.some((e) => e.object_id === "block-skills-4-t1"),
  "planner_inventory_excludes_heading",
  invEntries.map((e) => e.object_id).join(","),
);

const dummyPreserve = evaluateSectionReplacementCompleteness({
  canvas: skillsCanvas,
  plan: planOf([
    opUpdate(
      "block-skills-4-t2",
      "Operational analysis",
      SKILLS_REPLACE,
    ),
    opUpdate(
      "block-skills-4-t3",
      "Tools  ·  Documentation  ·  Stakeholder Comms  ·  Process Design",
      SKILLS_REPLACE,
    ),
  ]),
  requested_changes: [SKILLS_REPLACE, SKILLS_KEEP],
});
assert(
  dummyPreserve.sections[0]?.accounts.find((a) => a.object_id === "block-skills-4-t3")
    ?.disposition === "EXPLICITLY_PRESERVED",
  "dummy_identical_update_text_does_not_count_as_replaced",
  dummyPreserve.sections[0]?.accounts
    .map((a) => `${a.object_id}=${a.disposition}`)
    .join(",") ?? "",
);

const removed = evaluateSectionReplacementCompleteness({
  canvas: skillsCanvas,
  plan: planOf([
    opUpdate("block-skills-4-t2", "Operational analysis", SKILLS_REPLACE),
    opRemove("block-skills-4-t3", SKILLS_REMOVE),
  ]),
  requested_changes: [SKILLS_REPLACE, SKILLS_REMOVE, SKILLS_KEEP],
});
assert(
  removed.sections[0]?.accounts.find((a) => a.object_id === "block-skills-4-t3")
    ?.disposition === "UNACCOUNTED",
  "remove_of_keep_list_object_fails_closed",
  removed.sections[0]?.accounts
    .map((a) => `${a.object_id}=${a.disposition}`)
    .join(",") ?? "",
);

const removeMarketing = evaluateSectionReplacementCompleteness({
  canvas: skillsCanvas,
  plan: planOf([
    opRemove("block-skills-4-t2", SKILLS_REMOVE),
  ]),
  requested_changes: [SKILLS_REPLACE, SKILLS_REMOVE, SKILLS_KEEP],
});
assert(
  removeMarketing.sections[0]?.accounts.find((a) => a.object_id === "block-skills-4-t2")
    ?.disposition === "REMOVED" &&
    removeMarketing.sections[0]?.accounts.find((a) => a.object_id === "block-skills-4-t3")
      ?.disposition === "EXPLICITLY_PRESERVED" &&
    removeMarketing.ok,
  "removed_disposition_supported_for_banned_object",
  removeMarketing.sections[0]?.accounts
    .map((a) => `${a.object_id}=${a.disposition}`)
    .join(",") ?? "",
);

const owned = buildPlanWithDeterministicSpacingOwnership({
  priorCanvas: prior,
  requested_changes: task.requested_changes,
  aiPlan: prodPlan,
});
assert(
  owned.failure_kind !== "CONTENT_REPLACEMENT_INCOMPLETE",
  "pre_execution_completeness_no_longer_false_fails_on_preserved_t3",
  `${owned.failure_kind ?? "none"} ${owned.error ?? "ok"}`,
);

const overlaps = owned.overlap_count ?? -1;
const pageOob = owned.page_oob_count ?? -1;
assert(
  typeof overlaps === "number" && typeof pageOob === "number",
  "geometry_counts_recorded",
  `overlaps=${overlaps} oob=${pageOob}`,
);

function runVerify(script: string, name: string): boolean {
  const r = spawnSync("npx", ["--yes", "tsx", script], {
    cwd: REPO,
    encoding: "utf8",
    timeout: 180000,
  });
  const ok = r.status === 0;
  assert(ok, name, r.status === 0 ? "PASS" : (r.stderr || r.stdout).slice(-400));
  return ok;
}

const sixG = runVerify(
  "SOS/SAIOS/core/founder-revision/verify-durable-request-contract-6g.ts",
  "16g_phase_6g_regression",
);
const sixH = runVerify(
  "SOS/SAIOS/core/founder-revision/verify-post-content-reflow-6h.ts",
  "16h_phase_6h_regression",
);
const sixI = runVerify(
  "SOS/SAIOS/core/founder-revision/verify-revision-role-integrity-6i.ts",
  "16i_phase_6i_regression",
);
const gen = runVerify(
  "SOS/SAIOS/core/role-integrity/verify-generation-role-contract-e2e-6a.ts",
  "17_generation_role_regression",
);
const mm = runVerify(
  "SOS/SAIOS/core/founder-revision/verify-revision-production-replay.ts",
  "18_historical_marketing_manager_revision",
);

for (const [key, dir] of Object.entries(HIST)) {
  assert(existsSync(join(dir, "meta.json")) || existsSync(join(dir, "task.json")), `23_${key}_fixture_present`, dir);
}

const afterTasks = listRevisionTasks().map((t) => `${t.task_id}:${t.status}`);
assert(
  JSON.stringify(beforeTasks) === JSON.stringify(afterTasks),
  "23b_no_production_task_mutation",
  `${beforeTasks.length} tasks unchanged`,
);

const failed = checks.filter((c) => !c.pass);
const report = {
  schema_version: "verify-section-replacement-completeness-6j-1.0.0",
  ok: failed.length === 0,
  passed: checks.length - failed.length,
  failed: failed.length,
  fixture_skills_required_ids: requiredSkills,
  fixture_skills_dispositions: fixtureReport.sections
    .find((s) => s.section === "skills")
    ?.accounts.map((a) => ({ id: a.object_id, disposition: a.disposition })),
  block_skills_4_t3_result: t3Acc?.disposition ?? null,
  fixture_skills_completeness: fixtureReport.ok ? "PASS" : "FAIL",
  fixture_text_overlaps: overlaps,
  fixture_page_oob: pageOob,
  ownership_ok: owned.ok,
  ownership_failure_kind: owned.failure_kind ?? null,
  six_g: sixG,
  six_h: sixH,
  six_i: sixI,
  generation_role: gen,
  marketing_manager_replay: mm,
  openai_called: false,
  production_tasks_mutated: false,
  checks,
};
mkdirSync(join(REPO, "SOS/07_LOGS/saios/founder-revision"), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
if (!report.ok) {
  console.error(
    "FAIL verify-section-replacement-completeness-6j",
    failed.map((c) => c.name),
  );
  process.exit(1);
}
console.log(
  `SECTION_REPLACEMENT_COMPLETENESS_6J=PASS (${checks.length}/${checks.length})`,
);
