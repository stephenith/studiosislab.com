/**
 * Phase 6I — revision role-integrity coverage repair.
 *
 * Production origin: revtask-33ef5466-f24 FAILED_COVERAGE after Phase 6H.
 * Items 20 and 26 were uncovered because ROLE_TARGET_INTEGRITY used the
 * generation structured+rendered contract. No OpenAI. No production mutation.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildFeedbackCoverage } from "./FeedbackCoverage.js";
import { buildPlanWithDeterministicSpacingOwnership } from "./DeterministicSpacingPlan.js";
import { executeCanvasOperations } from "./CanvasOperationExecutor.js";
import { founderIdentityObjectIds, findIncompleteRequestedSectionReplacements, findTextOverlapFindings, runRevisionAcceptanceChecks } from "./RevisionAcceptanceChecks.js";
import { normalizeRevisionLayout } from "./RevisionLayoutNormalizer.js";
import { pairGap } from "./PostContentReflow.js";
import { listRevisionTasks } from "./RevisionTaskStore.js";
import {
  evaluateCanvasRoleTargetIntegrity,
  evaluateRoleTargetIntegrity,
} from "../role-integrity/RoleTargetIntegrity.js";
import { evaluateRevisionRoleTargetIntegrity } from "../role-integrity/RevisionRoleTargetIntegrity.js";
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import type { OperationLogEntry, RevisionPlan } from "./revision-task-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const FIX = resolve(
  REPO,
  ".cursor/debug-fixtures/revtask-33ef5466-f24-sanitized",
);
const OLD_FIX = resolve(REPO, ".cursor/debug-fixtures/revtask-b5339d03-b67-sanitized");
const NEW_FIX = resolve(REPO, ".cursor/debug-fixtures/revtask-9441fe34-4ba-sanitized");
const H_FIX = resolve(REPO, ".cursor/debug-fixtures/revtask-b9a65ad0-eb0-sanitized");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-revision-role-integrity-6i.json",
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

function unwrapCanvas(raw: unknown): FabricCanvasDoc {
  if (raw && typeof raw === "object" && "canvas" in raw) {
    return (raw as { canvas: FabricCanvasDoc }).canvas;
  }
  return raw as FabricCanvasDoc;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function oobCount(canvas: FabricCanvasDoc): number {
  const pageW = Number(canvas.width ?? 794);
  const pageH = Number(canvas.height ?? 1123);
  let n = 0;
  for (const o of (canvas.objects ?? []) as Array<Record<string, unknown>>) {
    const left = Number(o.left ?? 0);
    const top = Number(o.top ?? 0);
    const w = Number(o.width ?? 0) * Number(o.scaleX ?? 1);
    const h = Number(o.height ?? 0) * Number(o.scaleY ?? 1);
    if (left < -1 || top < -1 || left + w > pageW + 1 || top + h > pageH + 1) n += 1;
  }
  return n;
}

function objectSection(o: Record<string, unknown>): string {
  const data = o.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const s = (data as { section?: unknown }).section;
    if (typeof s === "string") return s.trim().toLowerCase();
  }
  return "";
}

function restoreSection(
  after: FabricCanvasDoc,
  prior: FabricCanvasDoc,
  section: string,
): FabricCanvasDoc {
  const out = clone(after);
  const priorById = new Map<string, Record<string, unknown>>();
  for (const o of (prior.objects ?? []) as Array<Record<string, unknown>>) {
    if (typeof o.id === "string") priorById.set(o.id, o);
  }
  for (const o of (out.objects ?? []) as Array<Record<string, unknown>>) {
    if (objectSection(o) !== section) continue;
    const prev = typeof o.id === "string" ? priorById.get(o.id) : undefined;
    if (prev && typeof prev.text === "string") o.text = prev.text;
  }
  return out;
}

function setRenderedTitle(canvas: FabricCanvasDoc, title: string): FabricCanvasDoc {
  const out = clone(canvas);
  const objs = (out.objects ?? []) as Array<Record<string, unknown>>;
  const hit = objs.find((o) => {
    const data = o.data;
    const role =
      data && typeof data === "object" && !Array.isArray(data)
        ? String((data as { role?: unknown }).role ?? "").toLowerCase()
        : "";
    return role === "professional_title" || role === "role" || role === "job_title";
  });
  if (hit) {
    hit.text = title;
    return out;
  }
  const header = objs
    .filter((o) => objectSection(o) === "header" && typeof o.text === "string")
    .sort((a, b) => Number(a.top ?? 0) - Number(b.top ?? 0));
  if (header.length >= 2) header[1]!.text = title;
  return out;
}

function stripSectionMetadata(canvas: FabricCanvasDoc): FabricCanvasDoc {
  const out = clone(canvas);
  for (const o of (out.objects ?? []) as Array<Record<string, unknown>>) {
    if (o.data && typeof o.data === "object" && !Array.isArray(o.data)) {
      const data = { ...(o.data as Record<string, unknown>) };
      delete data.section;
      o.data = data;
    }
    delete o.section;
  }
  return out;
}

function logFromPlan(plan: RevisionPlan): OperationLogEntry[] {
  return plan.operations.map((op, index) => ({
    index,
    op: op.op,
    target_id: op.target_id ?? null,
    founder_feedback_item: op.founder_feedback_item ?? "",
    ok: true,
    before: null,
    after: null,
    error: null,
  }));
}

const beforeTasks = listRevisionTasks().map((t) => `${t.task_id}:${t.status}`);

const meta = loadJson<{
  requested_changes: string[];
  expected_uncovered_indexes: number[];
  expected_covered_before_fix: number;
  expected_total_items: number;
  expected_role_integrity_reason: string;
}>(FIX, "meta.json");
const afterCanvas = unwrapCanvas(loadJson(FIX, "post-normalization-canvas.json"));
const priorCanvas = loadJson<FabricCanvasDoc>(FIX, "prior-canvas.json");
const plan = loadJson<RevisionPlan>(FIX, "revision-plan.json");
const frozenCoverage = loadJson<{
  gate_pass: boolean;
  items: Array<{
    founder_feedback_item: string;
    status: string;
    evidence?: { notes?: string };
  }>;
}>(FIX, "feedback-coverage.json");
const frozenAcceptance = loadJson<{
  checks: Array<{
    check_type: string;
    pass: boolean;
    reason: string;
    metrics?: { rendered_role?: string };
  }>;
}>(FIX, "revision-acceptance-checks.json");

/* ------------------------------------------------------------------ *
 * 1 — exact production failure reproduced (generation contract + frozen ledger)
 * ------------------------------------------------------------------ */

const genFail = evaluateCanvasRoleTargetIntegrity({
  target_title: "Operations Analyst",
  target_role_family: "Operations Analyst",
  canvas: afterCanvas,
});
assert(
  genFail.pass === false &&
    genFail.match === "ROLE_UNEVALUABLE" &&
    /structured generated role missing/i.test(genFail.reason),
  "01_current_generation_contract_failure_reproduced",
  `${genFail.match} structured=${genFail.structured_role} rendered=${genFail.rendered_role}`,
);

const frozenRole = frozenAcceptance.checks.filter(
  (c) => c.check_type === "ROLE_TARGET_INTEGRITY",
);
assert(
  frozenRole.length === 2 &&
    frozenRole.every(
      (c) =>
        c.pass === false &&
        /structured generated role missing/i.test(c.reason),
    ),
  "01b_frozen_acceptance_role_unevaluable",
  frozenRole.map((c) => c.reason).join(" | "),
);

const frozenAddressed = frozenCoverage.items.filter(
  (i) => i.status === "addressed",
).length;
const frozenUncovered = frozenCoverage.items
  .map((it, i) => ({ n: i + 1, status: it.status, notes: it.evidence?.notes ?? "" }))
  .filter((x) => x.status !== "addressed");
assert(
  frozenAddressed === 26 &&
    frozenCoverage.items.length === 28 &&
    frozenCoverage.gate_pass === false &&
    frozenUncovered.map((u) => u.n).join(",") === "20,26",
  "01c_frozen_coverage_26_of_28_items_20_26",
  `covered=${frozenAddressed} uncovered=${frozenUncovered.map((u) => u.n).join(",")}`,
);
assert(
  frozenUncovered.every((u) => /structured generated role missing/i.test(u.notes)),
  "01d_items_20_26_not_addressed_missing_structured",
  frozenUncovered.map((u) => u.notes).join(" | "),
);

/* ------------------------------------------------------------------ *
 * 2–6 — revision proof on the exact sandbox
 * ------------------------------------------------------------------ */

const incomplete = findIncompleteRequestedSectionReplacements({
  canvas: priorCanvas,
  plan,
  requested_changes: meta.requested_changes,
});
writeFileSync(
  join(FIX, "content-completeness.json"),
  `${JSON.stringify(
    {
      schema_version: "revision-content-completeness-1.0.0",
      pass: incomplete.length === 0,
      incomplete,
    },
    null,
    2,
  )}\n`,
);

const revisionProof = evaluateRevisionRoleTargetIntegrity({
  target_role: "Operations Analyst",
  afterCanvas,
  beforeCanvas: priorCanvas,
  requested_changes: meta.requested_changes,
  plan,
  incomplete_replacement_findings: incomplete,
});
assert(
  /operations analyst/i.test(String(revisionProof.rendered_title_role)),
  "02_rendered_title_operations_analyst",
  String(revisionProof.rendered_title_role),
);
assert(
  revisionProof.requested_role_sections_complete === true &&
    ["summary", "experience", "skills", "projects", "certifications", "education"].every(
      (s) => revisionProof.requested_role_sections.includes(s as typeof revisionProof.requested_role_sections[number]),
    ),
  "03_requested_oa_sections_complete",
  revisionProof.requested_role_sections.join(","),
);
assert(
  revisionProof.source_role_residue.length === 0,
  "04_source_marketing_residue_none",
  revisionProof.source_role_residue.join(","),
);
assert(
  revisionProof.pass === true &&
    (revisionProof.match === "ROLE_MATCH" ||
      revisionProof.match === "ROLE_COMPATIBLE_ALIAS"),
  "04b_revision_role_target_integrity_pass",
  `${revisionProof.match} ${revisionProof.reason}`,
);

const layout = normalizeRevisionLayout({
  canvas: afterCanvas,
  requested_changes: meta.requested_changes,
  prior_canvas: priorCanvas,
});
const acceptance = runRevisionAcceptanceChecks({
  afterCanvas,
  beforeCanvas: priorCanvas,
  plan,
  requested_changes: meta.requested_changes,
  target_role: "Operations Analyst",
  page_fit: layout.report.page_fit,
});
const roleChecks = acceptance.checks.filter(
  (c) => c.check_type === "ROLE_TARGET_INTEGRITY",
);
assert(
  roleChecks.length === 2 && roleChecks.every((c) => c.pass && c.evaluable),
  "05_acceptance_role_checks_pass",
  roleChecks.map((c) => `${c.pass}:${c.reason}`).join(" | "),
);

const ownedForCoverage = buildPlanWithDeterministicSpacingOwnership({
  priorCanvas: priorCanvas,
  requested_changes: meta.requested_changes,
  aiPlan: plan,
});
const coveredExec = executeCanvasOperations({
  canvas: priorCanvas,
  operations: ownedForCoverage.plan?.operations ?? [],
});
const coveredCanvas = coveredExec.ok ? coveredExec.canvas : afterCanvas;
const coveredLayout = normalizeRevisionLayout({
  canvas: coveredCanvas,
  requested_changes: meta.requested_changes,
  prior_canvas: priorCanvas,
});
const coveredAcceptance = runRevisionAcceptanceChecks({
  afterCanvas: coveredCanvas,
  beforeCanvas: priorCanvas,
  plan: ownedForCoverage.plan ?? plan,
  requested_changes: meta.requested_changes,
  target_role: "Operations Analyst",
  page_fit: coveredLayout.report.page_fit,
});
const coverage = buildFeedbackCoverage({
  requested_changes: meta.requested_changes,
  plan: ownedForCoverage.plan ?? plan,
  log: coveredExec.ok ? coveredExec.log : logFromPlan(plan),
  beforeCanvas: priorCanvas,
  afterCanvas: coveredCanvas,
  acceptanceReport: coveredAcceptance,
  layoutNormalizationReport: coveredLayout.report,
});
const covered = coverage.items.filter((i) => i.status === "addressed").length;
assert(
  coverage.items[19]?.status === "addressed",
  "05b_item_20_covered",
  coverage.items[19]?.evidence?.notes ?? "",
);
assert(
  coverage.items[25]?.status === "addressed",
  "05c_item_26_covered",
  coverage.items[25]?.evidence?.notes ?? "",
);
assert(
  covered === 28 && coverage.items.length === 28 && coverage.gate_pass === true,
  "06_feedback_coverage_28_of_28",
  `covered=${covered} gate=${coverage.gate_pass} uncovered=${coverage.items
    .map((it, i) => (it.status === "addressed" ? null : i + 1))
    .filter(Boolean)
    .join(",")}`,
);

const dummyRoleOps = plan.operations.filter((op) => {
  const attrs = [
    op.founder_feedback_item,
    ...(op.founder_feedback_items ?? []),
  ].filter((x): x is string => typeof x === "string");
  return attrs.some(
    (a) =>
      a === meta.requested_changes[19] || a === meta.requested_changes[25],
  );
});
assert(
  dummyRoleOps.length === 0,
  "07_no_dummy_ops_for_items_20_26",
  String(dummyRoleOps.length),
);

/* ------------------------------------------------------------------ *
 * 8–12 — negatives A–E
 * ------------------------------------------------------------------ */

const headerOnly = restoreSection(afterCanvas, priorCanvas, "experience");
const headerOnlyProof = evaluateRevisionRoleTargetIntegrity({
  target_role: "Operations Analyst",
  afterCanvas: headerOnly,
  beforeCanvas: priorCanvas,
  requested_changes: meta.requested_changes,
  plan,
  incomplete_replacement_findings: [],
});
assert(
  headerOnlyProof.pass === false &&
    (headerOnlyProof.match === "ROLE_MISMATCH" ||
      headerOnlyProof.match === "ROLE_CONTENT_INCOMPLETE") &&
    headerOnlyProof.source_role_residue.length > 0,
  "08_header_only_marketing_experience_fails",
  `${headerOnlyProof.match} residue=${headerOnlyProof.source_role_residue.join(",")}`,
);

const marketingSummary = restoreSection(afterCanvas, priorCanvas, "summary");
const summaryProof = evaluateRevisionRoleTargetIntegrity({
  target_role: "Operations Analyst",
  afterCanvas: marketingSummary,
  beforeCanvas: priorCanvas,
  requested_changes: meta.requested_changes,
  plan,
  incomplete_replacement_findings: [],
});
assert(
  summaryProof.pass === false && summaryProof.match === "ROLE_MISMATCH",
  "09_oa_header_marketing_summary_fails",
  `${summaryProof.match} ${summaryProof.reason}`,
);

const experienceIds = new Set<string>();
for (const o of (priorCanvas.objects ?? []) as Array<Record<string, unknown>>) {
  if (objectSection(o) === "experience" && typeof o.id === "string") {
    experienceIds.add(o.id);
  }
}
const incompletePlan: RevisionPlan = {
  ...plan,
  operations: plan.operations.filter(
    (op) => !(op.op === "update_text" && op.target_id && experienceIds.has(op.target_id)),
  ),
};
const incompleteProof = evaluateRevisionRoleTargetIntegrity({
  target_role: "Operations Analyst",
  afterCanvas: restoreSection(afterCanvas, priorCanvas, "experience"),
  beforeCanvas: priorCanvas,
  requested_changes: meta.requested_changes,
  plan: incompletePlan,
});
assert(
  incompleteProof.pass === false &&
    incompleteProof.match === "ROLE_CONTENT_INCOMPLETE",
  "10_incomplete_experience_replacement_fails",
  `${incompleteProof.match} ${incompleteProof.reason}`.slice(0, 220),
);

const wrongTitle = setRenderedTitle(afterCanvas, "Marketing Manager");
const wrongTitleProof = evaluateRevisionRoleTargetIntegrity({
  target_role: "Operations Analyst",
  afterCanvas: wrongTitle,
  beforeCanvas: priorCanvas,
  requested_changes: meta.requested_changes,
  plan,
  incomplete_replacement_findings: incomplete,
});
assert(
  wrongTitleProof.pass === false && wrongTitleProof.match === "ROLE_MISMATCH",
  "11_wrong_rendered_title_fails",
  `${wrongTitleProof.match} title=${wrongTitleProof.rendered_title_role}`,
);

const missingCanvas = evaluateRevisionRoleTargetIntegrity({
  target_role: "Operations Analyst",
  requested_changes: meta.requested_changes,
});
const missingTarget = evaluateRevisionRoleTargetIntegrity({
  target_role: "",
  afterCanvas,
  requested_changes: meta.requested_changes,
});
const missingSections = evaluateRevisionRoleTargetIntegrity({
  target_role: "Operations Analyst",
  afterCanvas: stripSectionMetadata(afterCanvas),
  beforeCanvas: priorCanvas,
  requested_changes: meta.requested_changes,
  plan,
});
const missingCompleteness = evaluateRevisionRoleTargetIntegrity({
  target_role: "Operations Analyst",
  afterCanvas,
  requested_changes: meta.requested_changes,
});
assert(
  missingCanvas.match === "ROLE_UNEVALUABLE" &&
    missingTarget.match === "ROLE_UNEVALUABLE" &&
    missingSections.match === "ROLE_UNEVALUABLE" &&
    missingCompleteness.match === "ROLE_UNEVALUABLE" &&
    !missingCanvas.evaluable &&
    !missingTarget.evaluable &&
    !missingSections.evaluable &&
    !missingCompleteness.evaluable,
  "12_missing_revision_native_evidence_unevaluable",
  [missingCanvas.reason, missingTarget.reason, missingSections.reason, missingCompleteness.reason]
    .map((r) => r.slice(0, 80))
    .join(" | "),
);

/* ------------------------------------------------------------------ *
 * 13–14 — generation contract unchanged
 * ------------------------------------------------------------------ */

const genMissingStructured = evaluateRoleTargetIntegrity({
  target_title: "Operations Analyst",
  target_role_family: "operations_analyst",
  structured_role: null,
  rendered_role: "Operations Analyst",
});
assert(
  genMissingStructured.pass === false &&
    genMissingStructured.match === "ROLE_UNEVALUABLE" &&
    /structured generated role missing/i.test(genMissingStructured.reason),
  "13_generation_missing_structured_role_still_fails",
  genMissingStructured.reason,
);
assert(
  evaluateCanvasRoleTargetIntegrity({
    target_title: "Operations Analyst",
    canvas: afterCanvas,
  }).pass === false,
  "14_generation_canvas_without_structured_still_fails",
  "ok",
);
assert(
  evaluateRoleTargetIntegrity({
    target_title: "Operations Analyst",
    structured_role: "Operations Analyst",
    rendered_role: "Operations Analyst",
  }).pass === true,
  "14b_generation_dual_structured_rendered_still_passes",
  "ok",
);
assert(
  evaluateRoleTargetIntegrity({
    target_title: "Operations Analyst",
    structured_role: "Marketing Manager",
    rendered_role: "Operations Analyst",
  }).pass === false,
  "14c_generation_structured_rendered_disagreement_still_fails",
  "ok",
);

/* ------------------------------------------------------------------ *
 * 15–17 geometry + identity + historical fixtures present
 * ------------------------------------------------------------------ */

const overlaps = findTextOverlapFindings(afterCanvas).length;
const pageOob = oobCount(afterCanvas);
const projects = pairGap(afterCanvas, "block-projects-5-t2", "block-projects-5-t3") ?? 0;
const certs = pairGap(afterCanvas, "block-certifications-6-t1", "block-certifications-6-t2") ?? 0;
const edu = pairGap(afterCanvas, "block-education-3-t2", "block-education-3-t3") ?? 0;
const certLang =
  pairGap(afterCanvas, "block-certifications-6-t4", "block-languages-7-t1") ??
  pairGap(afterCanvas, "block-certifications-6-t4", "block-languages-7-r0") ??
  0;
assert(overlaps === 0, "18_fixture_text_overlaps_0", String(overlaps));
assert(pageOob === 0, "19_fixture_page_oob_0", String(pageOob));
assert(projects + 1e-6 >= 2, "18b_projects_gap_positive", projects.toFixed(2));
assert(certs + 1e-6 >= 2, "18c_certs_heading_gap_positive", certs.toFixed(2));
assert(edu + 1e-6 >= 2, "18d_education_gap_positive", edu.toFixed(2));
assert(certLang + 1e-6 >= 2, "18e_certs_languages_gap_positive", certLang.toFixed(2));

const priorIds = founderIdentityObjectIds(priorCanvas);
const afterIds = founderIdentityObjectIds(afterCanvas);
const priorById = new Map(
  ((priorCanvas.objects ?? []) as Array<Record<string, unknown>>).map((o) => [
    String(o.id ?? ""),
    o,
  ]),
);
const afterById = new Map(
  ((afterCanvas.objects ?? []) as Array<Record<string, unknown>>).map((o) => [
    String(o.id ?? ""),
    o,
  ]),
);
let identityUnchanged = priorIds.size > 0 && afterIds.size === priorIds.size;
for (const id of priorIds) {
  if (!afterIds.has(id)) identityUnchanged = false;
  const a = String(priorById.get(id)?.text ?? "");
  const b = String(afterById.get(id)?.text ?? "");
  if (a !== b) identityUnchanged = false;
}
assert(
  identityUnchanged &&
    !revisionProof.residue_object_ids.some((id) => priorIds.has(id)),
  "20_candidate_name_contact_protected",
  `ids=${[...priorIds].join(",")}`,
);

assert(
  loadJson<{ task_id?: string }>(OLD_FIX, "meta.json") != null,
  "21_historical_b5339d03_fixture_present",
  "ok",
);
assert(
  loadJson<{ task_id?: string }>(NEW_FIX, "meta.json") != null,
  "21b_historical_9441fe34_fixture_present",
  "ok",
);
assert(
  loadJson<{ task_id?: string }>(H_FIX, "meta.json") != null,
  "21c_historical_b9a65ad0_fixture_present",
  "ok",
);
assert(
  meta.expected_total_items === 28,
  "21d_historical_33ef5466_fixture_immutable_shape",
  String(meta.expected_total_items),
);

const afterTasks = listRevisionTasks().map((t) => `${t.task_id}:${t.status}`);
assert(
  JSON.stringify(beforeTasks) === JSON.stringify(afterTasks),
  "21e_no_production_task_mutation",
  `${beforeTasks.length} tasks unchanged`,
);

const failed = checks.filter((c) => !c.pass);
const report = {
  schema_version: "verify-revision-role-integrity-6i-1.0.0",
  ok: failed.length === 0,
  passed: checks.length - failed.length,
  failed: failed.length,
  fixture_feedback_coverage_after: `${covered}/28`,
  dummy_operations_for_role_verification: dummyRoleOps.length,
  fixture_text_overlaps: overlaps,
  fixture_page_oob: pageOob,
  revision_role_match: revisionProof.match,
  openai_called: false,
  production_tasks_mutated: false,
  checks,
};
mkdirSync(join(REPO, "SOS/07_LOGS/saios/founder-revision"), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
if (!report.ok) {
  console.error("FAIL verify-revision-role-integrity-6i", failed.map((c) => c.name));
  process.exit(1);
}
console.log(`REVISION_ROLE_INTEGRITY_6I=PASS (${checks.length}/${checks.length})`);
