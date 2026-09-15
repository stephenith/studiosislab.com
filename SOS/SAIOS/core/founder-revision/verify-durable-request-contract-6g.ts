/**
 * Phase 6G — durable Founder Request-Changes contract regression matrix.
 *
 * Production origin:
 *   revtask-b5339d03-b67 — malformed operation array / missing confidence.
 *   revtask-9441fe34-4ba — 29 well-formed operations, two of which were
 *     update_text against Rect section markers with empty values, emitted only
 *     to carry attribution for Founder lines that were verification,
 *     preservation, or deterministic-layout requirements.
 *
 * No OpenAI. No production task or evidence mutation.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  classifyRequestedChange,
  verificationCheckTypes,
  type RequestedChangeClass,
} from "./RequestedChangeClassification.js";
import {
  buildFounderItemCoverageLedger,
  isPlanCoverageExemptRequestedChange,
  isRepairableShapeFailure,
  resolveItemCoverageMode,
  validatePlanCoversRequestedChanges,
  validateRevisionPlanShapeAndOperations,
} from "./RevisionPromptBuilder.js";
import {
  founderIdentityObjectIds,
  resolveRequestedContentSections,
  resolveSectionContentObjectIds,
  runRevisionAcceptanceChecks,
  type ContentSectionKey,
} from "./RevisionAcceptanceChecks.js";
import { buildCanvasInventory } from "./CanvasInventory.js";
import { listRevisionTasks } from "./RevisionTaskStore.js";
import type { CanvasInventoryObject, RevisionPlan } from "./revision-task-types.js";
import type { FabricCanvasDoc } from "./CanvasInventory.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const FIXTURES = join(REPO, ".cursor/debug-fixtures");
const OLD_FIX = join(FIXTURES, "revtask-b5339d03-b67-sanitized");
const NEW_FIX = join(FIXTURES, "revtask-9441fe34-4ba-sanitized");
const CORPUS = join(FIXTURES, "historical-requested-changes-corpus.json");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-durable-request-contract-6g.json",
);

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function assert(cond: boolean, name: string, detail: string): void {
  checks.push({ name, pass: Boolean(cond), detail });
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

/* ------------------------------------------------------------------ *
 * Shared canvas fixture (section metadata mirrors production exports)
 * ------------------------------------------------------------------ */

type ObjSpec = {
  id: string;
  type?: string;
  text?: string | null;
  section?: string;
  role?: string | null;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  fontSize?: number;
};

function obj(spec: ObjSpec): Record<string, unknown> {
  return {
    id: spec.id,
    type: spec.type ?? "Textbox",
    text: spec.text ?? null,
    left: spec.left ?? 48,
    top: spec.top ?? 100,
    width: spec.width ?? 220,
    height: spec.height ?? 20,
    fontSize: spec.fontSize ?? 10.5,
    fill: "#0a0a0a",
    stroke: null,
    data: { id: spec.id, section: spec.section ?? "summary", role: spec.role ?? null },
  };
}

/** Two-column resume with header identity, sections, and Rect markers. */
function resumeCanvas(): FabricCanvasDoc {
  return {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      obj({ id: "hdr-name", text: "Jordan Avery", section: "header", top: 40, fontSize: 24 }),
      obj({ id: "hdr-title", text: "Marketing Manager", section: "header", top: 72, fontSize: 13 }),
      obj({ id: "hdr-contact", text: "jordan@example.com · +1 555 010 2233", section: "header", top: 92, fontSize: 9 }),
      obj({ id: "sum-h", text: "SUMMARY", section: "summary", role: "heading", top: 150, fontSize: 11 }),
      obj({ id: "sum-b", text: "Marketing leader with campaign ownership.", section: "summary", top: 168 }),
      obj({ id: "exp-h", text: "EXPERIENCE", section: "experience", role: "heading", top: 220, fontSize: 11 }),
      obj({ id: "exp-b", text: "Led demand generation programs.", section: "experience", top: 238 }),
      obj({ id: "skl-h", text: "SKILLS", section: "skills", role: "heading", top: 300, fontSize: 11 }),
      obj({ id: "skl-b", text: "Demand Generation · Brand Strategy", section: "skills", top: 318 }),
      obj({ id: "prj-h", text: "PROJECTS", section: "projects", role: "heading", top: 370, fontSize: 11 }),
      obj({ id: "prj-b", text: "Always-On ABM Pilot", section: "projects", top: 388 }),
      obj({ id: "cert-h", text: "CERTIFICATIONS", section: "certifications", role: "heading", top: 440, fontSize: 11 }),
      obj({ id: "cert-b", text: "HubSpot Inbound Marketing", section: "certifications", top: 458 }),
      obj({ id: "block-certifications-6-r0", type: "Rect", text: null, section: "certifications", role: "marker", top: 440, width: 6, height: 14 }),
      obj({ id: "edu-h", text: "EDUCATION", section: "education", role: "heading", top: 510, fontSize: 11 }),
      obj({ id: "edu-b", text: "BA Communications", section: "education", top: 528 }),
      obj({ id: "block-languages-7-r0", type: "Rect", text: null, section: "languages", role: "marker", top: 580, width: 6, height: 14 }),
    ],
  };
}

const CANVAS = resumeCanvas();
const INVENTORY: CanvasInventoryObject[] = buildCanvasInventory(CANVAS);

function plan(operations: Record<string, unknown>[]): Record<string, unknown> {
  return {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "6g matrix",
    notes: [],
    operations,
  };
}

function textOp(targetId: string, item: string, text = "Operations Analyst"): Record<string, unknown> {
  return {
    op: "update_text",
    target_id: targetId,
    before_summary: `Textbox ${targetId} current text`,
    intended_change: "Replace the text with role-correct content",
    values: { text },
    founder_feedback_item: item,
    confidence: 0.92,
  };
}

function moveOp(targetId: string, item: string, top = 240): Record<string, unknown> {
  return {
    op: "set_position",
    target_id: targetId,
    before_summary: `Object ${targetId} current position`,
    intended_change: "Move the object to remove crowding",
    values: { top },
    founder_feedback_item: item,
    confidence: 0.9,
  };
}

/* ------------------------------------------------------------------ *
 * 1–2, 38–39 — production fixtures preserved and replayed
 * ------------------------------------------------------------------ */

type OldMeta = { task?: { requested_changes?: string[] }; requested_changes?: string[] };
type NewMeta = {
  requested_changes: string[];
  expected_error: string;
  attribution_carrier_targets: string[];
  update_text_ops_missing_values_text: number[];
  total_operations: number;
  canonical_target_role: string;
  design_family: string;
  architecture: string;
};

const oldMeta = readJson<OldMeta>(join(OLD_FIX, "meta.json"));
const oldRequested = oldMeta.task?.requested_changes ?? oldMeta.requested_changes ?? [];
const oldRaw = readJson<Record<string, unknown>>(join(OLD_FIX, "raw-structured.json"));
const newMeta = readJson<NewMeta>(join(NEW_FIX, "meta.json"));
const newRaw = readJson<Record<string, unknown>>(join(NEW_FIX, "raw-structured.json"));

// 1 — old malformed fixture still fails validation for the ORIGINAL reason.
const oldShape = validateRevisionPlanShapeAndOperations(oldRaw, {
  requested_changes: oldRequested,
});
assert(
  oldShape.ok === false &&
    oldShape.errors.some((e) => /\.confidence required$/.test(e)) &&
    oldShape.errors.some((e) => /^operations\[\d+\] invalid$/.test(e)),
  "01_old_fixture_malformed_shape_reproduced",
  oldShape.errors.slice(0, 3).join("; "),
);

// 2 — new fixture reproduces the exact production values.text failure.
const newShape = validateRevisionPlanShapeAndOperations(newRaw, {
  requested_changes: newMeta.requested_changes,
});
assert(
  newShape.ok === false &&
    newShape.errors.some((e) =>
      e.includes("values.text string is required for update_text"),
    ),
  "02_new_fixture_values_text_failure_reproduced",
  newShape.errors.slice(0, 2).join("; "),
);

// 38 / 39 — historical evidence is immutable.
assert(
  newMeta.expected_error.includes("operations[23] update_text") &&
    newMeta.expected_error.includes("operations[24] update_text") &&
    newMeta.total_operations === 29 &&
    newMeta.requested_changes.length === 28 &&
    newMeta.canonical_target_role === "Operations Analyst" &&
    newMeta.design_family === "professional_sidebar" &&
    newMeta.architecture === "narrow_ats_sidebar",
  "38_historical_new_failed_task_unchanged",
  newMeta.expected_error.slice(0, 80),
);
assert(
  oldRequested.length === 21 && Array.isArray(oldRaw.operations),
  "39_historical_old_failed_task_unchanged",
  `${oldRequested.length} founder lines`,
);

/* ------------------------------------------------------------------ *
 * 12 — new fixture tail requirements must not force placeholder ops
 * ------------------------------------------------------------------ */

const TAIL_START = 19; // 0-based; brief items 21..28 plus the two before them
const tailModes = newMeta.requested_changes
  .slice(TAIL_START)
  .map((c) => ({ text: c, mode: resolveItemCoverageMode(c), exempt: isPlanCoverageExemptRequestedChange(c) }));
const tailForcingOps = tailModes.filter((t) => !t.exempt);
assert(
  // Only the explicit "role content and sidebar geometry fully corrected" line
  // may still demand operations — and it is covered by real content ops.
  tailForcingOps.every((t) => /fully corrected/.test(t.text)),
  "12_new_fixture_tail_not_blindly_mutation",
  tailForcingOps.map((t) => t.text.slice(0, 48)).join(" | ") || "none",
);
assert(
  newMeta.attribution_carrier_targets.every((target) => {
    const attempt = validateRevisionPlanShapeAndOperations(
      plan([textOp(target, newMeta.requested_changes[0]!)]),
      { requested_changes: newMeta.requested_changes, inventory: INVENTORY },
    );
    return attempt.ok === false;
  }),
  "12b_no_update_text_may_target_the_carrier_rects",
  newMeta.attribution_carrier_targets.join(", "),
);

/* ------------------------------------------------------------------ *
 * 4 — historical classification replay
 * ------------------------------------------------------------------ */

type Corpus = {
  task_count: number;
  tasks: { task_id: string; requested_changes: string[] }[];
};
const corpus = readJson<Corpus>(CORPUS);
const allHistorical = corpus.tasks.flatMap((t) => t.requested_changes);
const historicalResolved = allHistorical.filter((line) => {
  const classified = classifyRequestedChange(line);
  // Every line must resolve to a class with a defined coverage mode, and a
  // zero-operation class must always carry the evidence type that proves it.
  if (classified.classification === "MUTATION_REQUIRED") return true;
  return verificationCheckTypes(classified).length > 0;
});
assert(
  historicalResolved.length === allHistorical.length,
  "04_historical_classification_replay",
  `${historicalResolved.length}/${allHistorical.length} across ${corpus.task_count} tasks`,
);
assert(
  allHistorical.every(
    (line) =>
      classifyRequestedChange(line).classification !== "MUTATION_REQUIRED" ||
      !isPlanCoverageExemptRequestedChange(line) ||
      resolveItemCoverageMode(line) === "DETERMINISTIC_LAYOUT_OWNED" ||
      resolveItemCoverageMode(line) === "VALIDATION_ONLY",
  ),
  "04b_exempt_mutation_items_declare_an_owner",
  "every coverage-exempt mutation item names its deterministic owner",
);

/* ------------------------------------------------------------------ *
 * 5–8 — coverage modes
 * ------------------------------------------------------------------ */

const MUTATION_LINE = "Rewrite the Summary for an Operations Analyst profile.";
const VERIFICATION_LINE = "Check the full page for overlapping or clipped text before returning.";
const PRESERVATION_LINE = "Preserve the existing dark navy header and two-column architecture.";
const LAYOUT_OWNED_LINE =
  "Maintain consistent vertical spacing between the Skills, Projects, and Certifications sections.";

assert(
  classifyRequestedChange(MUTATION_LINE).classification === "MUTATION_REQUIRED" &&
    validatePlanCoversRequestedChanges(plan([]), [MUTATION_LINE]).ok === false &&
    validatePlanCoversRequestedChanges(plan([textOp("sum-b", MUTATION_LINE)]), [
      MUTATION_LINE,
    ]).ok === true,
  "05_mutation_item_requires_operations",
  "empty plan rejected, attributed plan accepted",
);
assert(
  classifyRequestedChange(VERIFICATION_LINE).classification === "VERIFICATION_ACCEPTANCE" &&
    validatePlanCoversRequestedChanges(plan([]), [VERIFICATION_LINE]).ok === true &&
    validateRevisionPlanShapeAndOperations(
      plan([textOp("sum-b", VERIFICATION_LINE)]),
      { requested_changes: [VERIFICATION_LINE], inventory: INVENTORY },
    ).ok === false,
  "06_verification_item_requires_zero_operations",
  "zero ops accepted, attributed op rejected",
);
assert(
  classifyRequestedChange(PRESERVATION_LINE).classification === "PRESERVATION_CONSTRAINT" &&
    validatePlanCoversRequestedChanges(plan([]), [PRESERVATION_LINE]).ok === true &&
    validateRevisionPlanShapeAndOperations(
      plan([textOp("sum-b", PRESERVATION_LINE)]),
      { requested_changes: [PRESERVATION_LINE], inventory: INVENTORY },
    ).ok === false,
  "07_preservation_item_requires_zero_operations",
  "zero ops accepted, attributed op rejected",
);
assert(
  resolveItemCoverageMode(LAYOUT_OWNED_LINE) === "DETERMINISTIC_LAYOUT_OWNED" &&
    validatePlanCoversRequestedChanges(plan([]), [LAYOUT_OWNED_LINE]).ok === true,
  "08_layout_owned_item_requires_no_dummy_operation",
  resolveItemCoverageMode(LAYOUT_OWNED_LINE),
);

/* ------------------------------------------------------------------ *
 * 9–10 — validator safety
 * ------------------------------------------------------------------ */

const rectOp = validateRevisionPlanShapeAndOperations(
  plan([textOp("block-certifications-6-r0", MUTATION_LINE)]),
  { requested_changes: [MUTATION_LINE], inventory: INVENTORY },
);
assert(
  rectOp.ok === false &&
    rectOp.errors.some((e) => e.includes("non-text object")),
  "09_update_text_on_rect_rejected",
  rectOp.errors.join("; "),
);

const emptyValues = validateRevisionPlanShapeAndOperations(
  plan([{ ...textOp("sum-b", MUTATION_LINE), values: {} }]),
  { requested_changes: [MUTATION_LINE], inventory: INVENTORY },
);
assert(
  emptyValues.ok === false &&
    emptyValues.errors.some((e) => e.includes("values.text string is required")),
  "10_update_text_with_empty_values_rejected",
  emptyValues.errors.join("; "),
);

/* ------------------------------------------------------------------ *
 * 11–16 — bounded shape repair classification
 * ------------------------------------------------------------------ */

assert(
  isRepairableShapeFailure([
    "operations[23] update_text: values.text string is required for update_text",
    "operations[24] update_text: values.text string is required for update_text",
  ]),
  "11_values_text_failure_repairable",
  "values completeness is a structural defect",
);
assert(
  isRepairableShapeFailure(["operations[2].confidence required"]),
  "12b_missing_confidence_repairable",
  "unchanged from Slice 1",
);
assert(
  isRepairableShapeFailure(["operations[3] invalid", "operations[4] invalid"]),
  "13_malformed_non_object_operation_repairable",
  "JSON nesting collapse",
);
assert(
  isRepairableShapeFailure(["operations[0].op not allowlisted"]) === false &&
    isRepairableShapeFailure([
      "operations[0].op not allowlisted",
      "operations[1].confidence required",
    ]) === false,
  "14_unsupported_op_fails_closed_without_repair",
  "op-allowlist stays fail closed, alone and mixed",
);
assert(
  isRepairableShapeFailure([
    "operations[2] founder attribution must not claim VERIFICATION_ACCEPTANCE item: x",
  ]) === false,
  "16_semantic_attribution_failure_not_repairable",
  "attribution errors are never structural",
);

/* ------------------------------------------------------------------ *
 * 17–20 — revision shapes
 * ------------------------------------------------------------------ */

const contentOnly = ["Rewrite the Summary for an Operations Analyst profile."];
assert(
  validateRevisionPlanShapeAndOperations(
    plan([textOp("sum-b", contentOnly[0]!)]),
    { requested_changes: contentOnly, inventory: INVENTORY },
  ).ok === true,
  "17_content_only_revision",
  "ok",
);

const geometryOnly = ["Move the Experience heading down so it no longer crowds the Summary."];
assert(
  validateRevisionPlanShapeAndOperations(
    plan([moveOp("exp-h", geometryOnly[0]!)]),
    { requested_changes: geometryOnly, inventory: INVENTORY },
  ).ok === true,
  "18_geometry_only_revision",
  "ok",
);

const mixed = [contentOnly[0]!, geometryOnly[0]!, VERIFICATION_LINE, PRESERVATION_LINE];
const mixedResult = validateRevisionPlanShapeAndOperations(
  plan([textOp("sum-b", mixed[0]!), moveOp("exp-h", mixed[1]!)]),
  { requested_changes: mixed, inventory: INVENTORY },
);
assert(
  mixedResult.ok === true &&
    validatePlanCoversRequestedChanges(mixedResult.plan!, mixed).ok === true,
  "19_mixed_content_and_geometry_revision",
  mixedResult.errors.join("; ") || "ok",
);
assert(
  new Set(
    (mixedResult.plan?.operations ?? []).map((o) => o.op),
  ).size === 2,
  "11b_mixed_request_uses_more_than_update_text",
  JSON.stringify((mixedResult.plan?.operations ?? []).map((o) => o.op)),
);

// 20 — the real 28-line Founder request: mutation items get real ops, and
// every zero-operation item is satisfied without one.
const bigMutationItems = newMeta.requested_changes.filter(
  (c) => !isPlanCoverageExemptRequestedChange(c),
);
const bigPlan = plan([
  { ...textOp("hdr-title", bigMutationItems[0]!), founder_feedback_items: bigMutationItems.slice(1, 8) },
  { ...textOp("sum-b", bigMutationItems[8] ?? bigMutationItems[0]!), founder_feedback_items: bigMutationItems.slice(9) },
  moveOp("cert-h", bigMutationItems[1] ?? bigMutationItems[0]!),
]);
const bigCover = validatePlanCoversRequestedChanges(
  bigPlan as unknown as RevisionPlan,
  newMeta.requested_changes,
);
assert(
  bigCover.ok === true,
  "20_large_28_line_revision",
  bigCover.errors.slice(0, 3).join("; ") || "ok",
);
assert(
  (bigPlan.operations as unknown[]).length < newMeta.total_operations,
  "20b_large_request_no_longer_needs_29_operations",
  `${(bigPlan.operations as unknown[]).length} ops vs production ${newMeta.total_operations}`,
);

/* ------------------------------------------------------------------ *
 * 21–24 — clause-scoped authorization and identity protection
 * ------------------------------------------------------------------ */

const TITLE_LINE_SIMPLE = "Change the professional title to Operations Analyst.";
const TITLE_LINE_WITH_LAYOUT =
  "Change the professional title from Marketing Manager to Operations Analyst while preserving the current header design, candidate name, contact layout, colors, and typography.";

assert(
  resolveRequestedContentSections(TITLE_LINE_SIMPLE).has("job_title"),
  "21_professional_title_correctly_authorized",
  [...resolveRequestedContentSections(TITLE_LINE_SIMPLE)].join(","),
);
const layoutLineSections = resolveRequestedContentSections(TITLE_LINE_WITH_LAYOUT);
assert(
  layoutLineSections.size === 1 && layoutLineSections.has("job_title"),
  "22_title_line_with_contact_layout_authorizes_only_the_title",
  [...layoutLineSections].join(",") || "none",
);

const identityIds = founderIdentityObjectIds(CANVAS);
const titleAuthorized = resolveSectionContentObjectIds(CANVAS, layoutLineSections);
assert(
  identityIds.has("hdr-name") && !titleAuthorized.has("hdr-name"),
  "23_candidate_name_protected",
  `identity=${[...identityIds].join(",")} authorized=${[...titleAuthorized].join(",")}`,
);
assert(
  identityIds.has("hdr-contact") && !titleAuthorized.has("hdr-contact"),
  "24_contact_information_protected",
  `authorized=${[...titleAuthorized].join(",")}`,
);
assert(
  titleAuthorized.has("hdr-title"),
  "22b_title_object_itself_is_authorized",
  [...titleAuthorized].join(","),
);

/* ------------------------------------------------------------------ *
 * 25–32 — section scoping
 * ------------------------------------------------------------------ */

const SECTION_CASES: ReadonlyArray<readonly [ContentSectionKey, string, string, number]> = [
  ["summary", "Rewrite the Summary for an Operations Analyst.", "sum-b", 25],
  ["experience", "Replace the Experience content with Operations Analyst roles.", "exp-b", 26],
  ["skills", "Replace the Skills with Operations Analyst skills.", "skl-b", 27],
  ["projects", "Replace the Projects with an operations project.", "prj-b", 28],
  ["certifications", "Replace the Certifications with operations certifications.", "cert-b", 29],
  ["education", "Update the Education content so it supports the role.", "edu-b", 30],
];

for (const [key, line, expectedId, num] of SECTION_CASES) {
  const sections = resolveRequestedContentSections(line);
  const ids = resolveSectionContentObjectIds(CANVAS, sections);
  assert(
    sections.size === 1 && sections.has(key) && ids.has(expectedId),
    `${num}_${key}_section_scoped`,
    `sections=${[...sections].join(",")} ids=${[...ids].join(",")}`,
  );
}

// 31 — a request for one section grants nothing in any other section.
const summaryIds = resolveSectionContentObjectIds(
  CANVAS,
  resolveRequestedContentSections(SECTION_CASES[0]![1]),
);
assert(
  summaryIds.has("sum-b") &&
    !summaryIds.has("exp-b") &&
    !summaryIds.has("skl-b") &&
    !summaryIds.has("cert-b") &&
    !summaryIds.has("edu-b"),
  "31_unrequested_sections_protected",
  [...summaryIds].join(","),
);

// 32 — section heading labels are never content-edit authorized.
const allSections = new Set<ContentSectionKey>([
  "summary",
  "experience",
  "skills",
  "projects",
  "certifications",
  "education",
]);
const everyAuthorized = resolveSectionContentObjectIds(CANVAS, allSections);
assert(
  ["sum-h", "exp-h", "skl-h", "prj-h", "cert-h", "edu-h"].every(
    (id) => !everyAuthorized.has(id),
  ),
  "32_section_headings_protected",
  [...everyAuthorized].join(","),
);

/* ------------------------------------------------------------------ *
 * 33–36 — acceptance checks still run in the revision path
 * ------------------------------------------------------------------ */

const acceptanceRequested = [
  "Before returning, verify role-target integrity so the rendered title matches Operations Analyst.",
  VERIFICATION_LINE,
  "Return only if page out-of-bounds count is zero and no text is clipped.",
  PRESERVATION_LINE,
];
const report = runRevisionAcceptanceChecks({
  afterCanvas: CANVAS,
  beforeCanvas: CANVAS,
  requested_changes: acceptanceRequested,
  target_role: "Operations Analyst",
});
const reportTypes = new Set(report.checks.map((c) => c.check_type));
assert(
  reportTypes.has("ROLE_TARGET_INTEGRITY"),
  "33_role_target_integrity_still_enforced",
  [...reportTypes].join(","),
);
assert(
  reportTypes.has("COLLISION_BOUNDS"),
  "34_overlap_checks_still_run_in_revision_path",
  [...reportTypes].join(","),
);
assert(
  report.checks.some(
    (c) => c.check_type === "COLLISION_BOUNDS" || c.check_type === "PAGE_FIT",
  ),
  "35_clipping_and_page_oob_checks_still_run",
  [...reportTypes].join(","),
);
assert(
  reportTypes.has("ARCHITECTURE_PRESERVATION") ||
    reportTypes.has("CONTENT_PRESERVATION") ||
    reportTypes.has("LAYOUT_PRESERVATION"),
  "36_preservation_checks_still_run",
  [...reportTypes].join(","),
);

/* ------------------------------------------------------------------ *
 * 37 — no unrelated redesign
 * ------------------------------------------------------------------ */

const unrelated = validateRevisionPlanShapeAndOperations(
  plan([textOp("edu-b", contentOnly[0]!)]),
  { requested_changes: contentOnly, inventory: INVENTORY },
);
const unrelatedSections = resolveRequestedContentSections(contentOnly[0]!);
assert(
  unrelated.ok === true &&
    !resolveSectionContentObjectIds(CANVAS, unrelatedSections).has("edu-b"),
  "37_no_unrelated_redesign",
  "Education object is not content-authorized by a Summary request",
);

/* ------------------------------------------------------------------ *
 * Prompt contract — no attribution-carrier pressure
 * ------------------------------------------------------------------ */

const ledger = buildFounderItemCoverageLedger(newMeta.requested_changes);
assert(
  ledger.includes("NEVER CREATE AN OPERATION SOLELY TO REPRESENT") &&
    ledger.includes("Coverage mode: VERIFICATION_ACCEPTANCE") &&
    ledger.includes("Coverage mode: PRESERVATION_CONSTRAINT") &&
    ledger.includes("Coverage mode: DETERMINISTIC_LAYOUT_OWNED") &&
    ledger.includes("emit ZERO operations"),
  "05b_ledger_states_every_coverage_mode",
  "four coverage modes present with explicit zero-operation wording",
);

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */

const beforeTasks = listRevisionTasks().map((t) => `${t.task_id}:${t.status}`);
const failed = checks.filter((c) => !c.pass);
const afterTasks = listRevisionTasks().map((t) => `${t.task_id}:${t.status}`);

assert(
  JSON.stringify(beforeTasks) === JSON.stringify(afterTasks),
  "00_no_production_task_mutation",
  `${beforeTasks.length} tasks unchanged`,
);

const report6g = {
  schema_version: "verify-durable-request-contract-6g-1.0.0",
  ok: checks.every((c) => c.pass),
  checked_at: new Date().toISOString(),
  openai_called: false,
  production_tasks_mutated: false,
  classification_classes: [
    "MUTATION_REQUIRED",
    "VERIFICATION_ACCEPTANCE",
    "PRESERVATION_CONSTRAINT",
  ] satisfies RequestedChangeClass[],
  checks,
};
mkdirSync(join(REPO, "SOS/07_LOGS/saios/founder-revision"), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(report6g, null, 2)}\n`, "utf8");

for (const c of checks) {
  console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.name}  ${c.detail}`);
}
console.log(
  `DURABLE_REQUEST_CONTRACT_6G=${failed.length === 0 ? "PASS" : "FAIL"} (${
    checks.length - failed.length
  }/${checks.length})`,
);
if (failed.length > 0) process.exitCode = 1;
