/**
 * Offline Dental Hygienist full-intent proof for IR 1.4.5 target-binding.
 *
 * Replays a sanitized fixture copy of revtask-f67ce2e4-bb0.
 * Does not mutate the historical production task, overlay, or publication.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import {
  compileFounderFeedbackIR,
  FOUNDER_FEEDBACK_IR_SCHEMA,
  NUMBER_OF_SEMANTIC_INTERPRETATION_PATHS,
} from "./FounderFeedbackIR.js";
import {
  applyPostExecutionLayoutWorld,
  compileRelativePlacement,
  compileTargetDescriptor,
  evaluateItemFulfillment,
  itemRequiresMutationFulfillment,
} from "./FounderFeedbackFulfillment.js";
import {
  buildSafeNamedSpacingRelationOps,
  resolveAllFounderSpacingRelations,
  resolveFounderSpacingRelation,
} from "./FounderSpacingRelation.js";
import { buildFeedbackCoverage } from "./FeedbackCoverage.js";
import { evaluateRevisionFinalAcceptance } from "./RevisionFinalAcceptance.js";
import { evaluateCanonicalFinalStateLayoutProof } from "./CanonicalFinalStateLayoutProof.js";
import { validatePlanGeometrySafety } from "./PlanGeometrySafety.js";
import { executeCanvasOperations } from "./CanvasOperationExecutor.js";
import { evaluateSharedGeometryAdmission } from "../geometry-admission/SharedGeometryAdmission.js";
import {
  findOutOfBoundsObjects,
  findTextOverlapFindings,
} from "./RevisionAcceptanceChecks.js";
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import type { RevisionPlan } from "./revision-task-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const FIX = join(REPO, ".cursor/debug-fixtures/revtask-f67ce2e4-bb0");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-dental-hygienist-full-intent.json",
);
const HISTORICAL_TASK = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/tasks/revtask-f67ce2e4-bb0.json",
);

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function assert(ok: boolean, name: string, detail = ""): void {
  checks.push({ name, pass: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function objs(canvas: FabricCanvasDoc): Array<Record<string, unknown>> {
  return (canvas.objects ?? []) as Array<Record<string, unknown>>;
}

function byId(canvas: FabricCanvasDoc, id: string): Record<string, unknown> | undefined {
  return objs(canvas).find((o) => o.id === id);
}

function textOf(o: Record<string, unknown> | undefined): string {
  return String(o?.text ?? "");
}

function skillsItems(canvas: FabricCanvasDoc): string[] {
  const bodies = objs(canvas).filter((o) => {
    const data = o.data && typeof o.data === "object" ? (o.data as { section?: string }) : {};
    if (data.section !== "skills") return false;
    const t = textOf(o).trim();
    return t.length > 0 && !/^skills$/i.test(t);
  });
  return bodies
    .sort((a, b) => Number(a.left ?? 0) - Number(b.left ?? 0))
    .flatMap((o) =>
      textOf(o)
        .split(/\n+/)
        .map((line) => line.replace(/^[•·\-–—*]\s+/, "").trim())
        .filter(Boolean),
    );
}

function pairGap(
  canvas: FabricCanvasDoc,
  upperId: string,
  lowerId: string,
): number {
  const upper = byId(canvas, upperId);
  const lower = byId(canvas, lowerId);
  return Number(lower?.top ?? 0) - (Number(upper?.top ?? 0) + Number(upper?.height ?? 0));
}

function main(): void {
  const meta = readJson<{
    requested_changes: string[];
    education_added_text: string;
  }>(join(FIX, "meta.json"));
  const prior = readJson<FabricCanvasDoc>(join(FIX, "prior-canvas.json"));
  const eduPlan = readJson<RevisionPlan>(join(FIX, "education-op.json"));
  const changes = meta.requested_changes;
  assert(changes.length === 4, "fixture_has_four_requested_changes");
  assert(
    FOUNDER_FEEDBACK_IR_SCHEMA === "founder-feedback-ir-1.4.5" &&
      NUMBER_OF_SEMANTIC_INTERPRETATION_PATHS === 1,
    "ir_schema_1_4_5_single_owner",
    FOUNDER_FEEDBACK_IR_SCHEMA,
  );

  const ir = compileFounderFeedbackIR(changes);
  const contact = ir.items[0]!;
  const education = ir.items[1]!;
  const skills = ir.items[2]!;
  const experience = ir.items[3]!;
  const rel = contact.fulfillment.find((p) => p.kind === "RELATIONAL_ALIGNMENT");
  const pairs = experience.fulfillment.filter((p) => p.kind === "SPACING_PAIR");
  assert(
    rel?.target?.role === "contact" &&
      rel.target.shape === "text" &&
      (rel.reference?.kind === "visual" &&
        (rel.reference.descriptor.role === "header_band" ||
          rel.reference.descriptor.shape === "rect")) &&
      rel.preserve?.kind === "explicit_objects" &&
      (rel.preserve.descriptors?.length ?? 0) >= 3 &&
      pairs.length === 2 &&
      education.fulfillment.some((p) => p.kind === "CONTENT_ADD") &&
      skills.fulfillment.some((p) => p.kind === "PRESENTATION") &&
      itemRequiresMutationFulfillment(contact) &&
      itemRequiresMutationFulfillment(experience),
    "ir_compiles_contact_preserve_and_two_pairs",
    JSON.stringify({
      target: rel?.target,
      ref: rel?.reference,
      preserve: rel?.preserve,
      pairs: pairs.map((p) => p.present_phrases),
    }),
  );
  assert(
    compileTargetDescriptor(
      "Extend the vertical line on the left till the page bottom",
    ).shape === "line" &&
      compileTargetDescriptor(
        "Extend the vertical line on the left till the page bottom",
      ).role !== "contact",
    "graphical_line_does_not_compile_as_contact",
  );
  assert(
    compileRelativePlacement(
      "Move the vertical line below the light background rectangle.",
    )?.target?.shape === "line",
    "vertical_line_below_does_not_bind_contact_role",
    JSON.stringify(
      compileRelativePlacement(
        "Move the vertical line below the light background rectangle.",
      )?.target,
    ),
  );

  const resolved = resolveAllFounderSpacingRelations({
    requested_changes: changes,
    canvas: prior,
  });
  const named = resolved.filter((r) => r.kind === "NAMED_PAIR");
  assert(
    named.length >= 2 &&
      named.some((r) => r.lower_id.endsWith("-t7")) &&
      named.some((r) => r.lower_id.endsWith("-t13")),
    "two_named_pairs_resolve",
    JSON.stringify(named.map((r) => `${r.upper_id}->${r.lower_id} ${r.kind}`)),
  );
  const spacingOps = buildSafeNamedSpacingRelationOps({
    canvas: prior,
    requested_changes: changes,
    resolved_relations: resolved,
  });
  const plan: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "offline dental fixture replay",
    operations: [...eduPlan.operations, ...spacingOps],
    notes: [`named_relation_ops=${spacingOps.length}`],
  };
  const executed = executeCanvasOperations({ canvas: prior, operations: plan.operations });
  assert(executed.ok, "fixture_plan_executes", executed.error ?? "");
  const world = applyPostExecutionLayoutWorld({
    canvas: executed.canvas,
    ir,
    requested_changes: changes,
    prior_canvas: prior,
  });
  const after = world.canvas;

  const name = byId(after, "block-header-0-t1");
  const rect = byId(after, "block-header-0-r0");
  const title = byId(after, "block-header-0-t2");
  const row = byId(after, "block-header-0-t3");
  const priorName = byId(prior, "block-header-0-t1");
  const priorRect = byId(prior, "block-header-0-r0");
  const priorTitle = byId(prior, "block-header-0-t2");
  const priorRow = byId(prior, "block-header-0-t3");
  const rectBottom =
    Number(priorRect?.top ?? 0) + Number(priorRect?.height ?? 0);
  const rowTop = Number(row?.top ?? 0);
  assert(
    textOf(name) === textOf(priorName) &&
      Number(name?.top) === Number(priorName?.top) &&
      Number(name?.left) === Number(priorName?.left),
    "name_preserved",
    textOf(name),
  );
  assert(
    textOf(title) === textOf(priorTitle) &&
      Number(title?.top) === Number(priorTitle?.top),
    "title_preserved",
    textOf(title),
  );
  assert(
    Number(rect?.top) === Number(priorRect?.top) &&
      Number(rect?.height) === Number(priorRect?.height) &&
      Number(rect?.left) === Number(priorRect?.left),
    "rectangle_preserved",
  );
  assert(
    rowTop >= rectBottom + 7.5 &&
      textOf(row) === textOf(priorRow) &&
      Number(row?.left) === Number(priorRow?.left),
    "contact_below_rectangle_with_gap",
    `rowTop=${rowTop} rectBottom=${rectBottom}`,
  );

  const edu = byId(after, "block-education-3-t2");
  assert(
    textOf(edu).includes("Associate of Applied Science in Dental Hygiene") &&
      textOf(edu).includes(meta.education_added_text),
    "education_add_preserves_original",
    textOf(edu).slice(0, 180),
  );

  const expectedSkills = [
    "Clinical Dental Hygiene",
    "Periodontal Assessment",
    "Patient Education & Communication",
    "Digital Charting & Practice Management Software",
    "Infection Control & Sterilization",
    "Ultrasonic & Hand Scaling",
    "Oral Health Promotion",
  ];
  const skillItems = skillsItems(after);
  const col2 = byId(after, "block-skills-4-t2-col2");
  assert(
    skillItems.length === 7 &&
      expectedSkills.every((item, i) => skillItems[i] === item) &&
      Boolean(col2) &&
      Number(col2?.left ?? 0) > Number(byId(after, "block-skills-4-t2")?.left ?? 0),
    "skills_columns_order_preserved",
    JSON.stringify(skillItems),
  );

  const pair1 = named.find((r) => r.lower_id.endsWith("-t7"))!;
  const pair2 = named.find((r) => r.lower_id.endsWith("-t13"))!;
  const p1After = resolveFounderSpacingRelation({
    requestedChange: changes[3]!,
    canvas: after,
    needle: pairs[0]?.present_phrases?.[0],
  });
  const p2After = resolveFounderSpacingRelation({
    requestedChange: changes[3]!,
    canvas: after,
    needle: pairs[1]?.present_phrases?.[0],
  });
  const proof1 = evaluateCanonicalFinalStateLayoutProof({
    requestedChange: changes[3]!,
    beforeCanvas: prior,
    afterCanvas: after,
    resolved_relation: p1After,
  });
  const proof2 = evaluateCanonicalFinalStateLayoutProof({
    requestedChange: changes[3]!,
    beforeCanvas: prior,
    afterCanvas: after,
    resolved_relation: p2After,
  });
  assert(
    textOf(byId(after, pair1.upper_id)) === textOf(byId(prior, pair1.upper_id)) &&
      textOf(byId(after, pair1.lower_id)) === textOf(byId(prior, pair1.lower_id)) &&
      proof1.pass,
    "experience_pair_1_fulfilled",
    `${pair1.upper_id}->${pair1.lower_id} before=${pairGap(prior, pair1.upper_id, pair1.lower_id)} after_stored=${pairGap(after, pair1.upper_id, pair1.lower_id)} ${proof1.reason}`,
  );
  assert(
    textOf(byId(after, pair2.upper_id)) === textOf(byId(prior, pair2.upper_id)) &&
      textOf(byId(after, pair2.lower_id)) === textOf(byId(prior, pair2.lower_id)) &&
      proof2.pass,
    "experience_pair_2_fulfilled",
    `${pair2.upper_id}->${pair2.lower_id} before=${pairGap(prior, pair2.upper_id, pair2.lower_id)} after_stored=${pairGap(after, pair2.upper_id, pair2.lower_id)} ${proof2.reason}`,
  );

  const overlaps = findTextOverlapFindings(after);
  const geom = evaluateSharedGeometryAdmission(after);
  const oob = findOutOfBoundsObjects(after).filter(
    (f) => f.code !== "ACC_BOUNDS_UNEVALUABLE",
  );
  assert(
    overlaps.length === 0 && geom.pass && geom.page_fit_pass && oob.length === 0,
    "c2_overlap_oob_page_fit",
    JSON.stringify({ overlaps: overlaps.length, pass: geom.pass, fit: geom.page_fit_pass }),
  );

  const contactProof = evaluateItemFulfillment({
    item: contact,
    beforeCanvas: prior,
    afterCanvas: after,
  });
  const eduProof = evaluateItemFulfillment({
    item: education,
    beforeCanvas: prior,
    afterCanvas: after,
  });
  const skillsProof = evaluateItemFulfillment({
    item: skills,
    beforeCanvas: prior,
    afterCanvas: after,
  });
  const expProof = evaluateItemFulfillment({
    item: experience,
    beforeCanvas: prior,
    afterCanvas: after,
  });
  assert(contactProof.pass, "contact_fulfillment_pass", contactProof.notes);
  assert(eduProof.pass, "education_fulfillment_pass", eduProof.notes);
  assert(skillsProof.pass, "skills_fulfillment_pass", skillsProof.notes);
  assert(expProof.pass, "experience_fulfillment_pass", expProof.notes);

  const coverage = buildFeedbackCoverage({
    requested_changes: changes,
    plan,
    log: executed.log,
    beforeCanvas: prior,
    afterCanvas: after,
  });
  const acceptance = evaluateRevisionFinalAcceptance({
    plan_ok: true,
    authorization_ok: true,
    section_replacement: { ok: true, error: null },
    content_execution_ok: true,
    content_preservation_ok: true,
    canonical_layout_ok: true,
    text_overlap_count: overlaps.length,
    page_oob_count: oob.length,
    page_fit_ok: geom.page_fit_pass,
    revision_role: { pass: true, evaluable: true, match: true, reason: "ok" },
    coverage,
  });
  const expNotes = String(coverage.items[3]?.evidence?.notes ?? "");
  const namedPairProofCount = (
    expNotes.match(/canonical_final_state_layout_proof spacing intent/g) ?? []
  ).length;
  const distinctHeadingBodies = new Set(
    (expNotes.match(/heading_body=[\d.]+/g) ?? []).map((m) => m.replace("heading_body=", "")),
  );
  assert(
    coverage.gate_pass &&
      coverage.items.every((i) => i.status === "addressed") &&
      namedPairProofCount === 2 &&
      distinctHeadingBodies.size === 2 &&
      acceptance.may_return_to_founder_review === true &&
      acceptance.overall === "PASS",
    "coverage_and_final_acceptance",
    JSON.stringify({
      items: coverage.items.map((i) => ({ status: i.status, notes: i.evidence?.notes })),
      accept: acceptance.overall,
      namedPairProofCount,
    }),
  );

  const geo = validatePlanGeometrySafety({
    canvas: prior,
    plan,
    requested_changes: changes,
  });
  assert(
    geo.ok && geo.layout_applied && geo.text_overlaps === 0,
    "plan_geometry_parity_pass",
    JSON.stringify({ ok: geo.ok, layout: geo.layout_applied, err: geo.error }),
  );

  const noContact = clone(after);
  const dropped = byId(noContact, "block-header-0-t3");
  if (dropped) dropped.text = "not-a-contact-object";
  const noContactProof = evaluateItemFulfillment({
    item: contact,
    beforeCanvas: prior,
    afterCanvas: noContact,
  });
  assert(!noContactProof.pass, "negative_contact_unbound", noContactProof.notes);

  const noRect = clone(after);
  noRect.objects = objs(noRect).filter((o) => o.id !== "block-header-0-r0");
  const noRectProof = evaluateItemFulfillment({
    item: contact,
    beforeCanvas: prior,
    afterCanvas: noRect,
  });
  assert(!noRectProof.pass, "negative_rectangle_unbound", noRectProof.notes);

  const nameMoved = clone(after);
  const movedName = byId(nameMoved, "block-header-0-t1");
  if (movedName) movedName.top = Number(movedName.top ?? 0) + 18;
  assert(
    !evaluateItemFulfillment({
      item: contact,
      beforeCanvas: prior,
      afterCanvas: nameMoved,
    }).pass,
    "negative_name_moved",
  );

  const titleMoved = clone(after);
  const movedTitle = byId(titleMoved, "block-header-0-t2");
  if (movedTitle) movedTitle.top = Number(movedTitle.top ?? 0) + 18;
  assert(
    !evaluateItemFulfillment({
      item: contact,
      beforeCanvas: prior,
      afterCanvas: titleMoved,
    }).pass,
    "negative_title_moved",
  );

  const rectMoved = clone(after);
  const movedRect = byId(rectMoved, "block-header-0-r0");
  if (movedRect) movedRect.top = Number(movedRect.top ?? 0) + 12;
  assert(
    !evaluateItemFulfillment({
      item: contact,
      beforeCanvas: prior,
      afterCanvas: rectMoved,
    }).pass,
    "negative_rectangle_moved",
  );

  const pair2Miss = clone(after);
  const missLower2 = byId(pair2Miss, pair2.lower_id);
  const priorLower2 = byId(prior, pair2.lower_id);
  if (missLower2) missLower2.top = Number(priorLower2?.top ?? 0) + 40;
  const upper2 = byId(pair2Miss, pair2.upper_id);
  if (upper2) upper2.height = 31;
  assert(
    !evaluateItemFulfillment({
      item: experience,
      beforeCanvas: prior,
      afterCanvas: pair2Miss,
    }).pass,
    "negative_second_pair_fails_item",
  );

  const pair1Miss = clone(after);
  const missLower1 = byId(pair1Miss, pair1.lower_id);
  const priorLower1 = byId(prior, pair1.lower_id);
  if (missLower1) missLower1.top = Number(priorLower1?.top ?? 0) + 40;
  const upper1 = byId(pair1Miss, pair1.upper_id);
  if (upper1) upper1.height = 31;
  assert(
    !evaluateItemFulfillment({
      item: experience,
      beforeCanvas: prior,
      afterCanvas: pair1Miss,
    }).pass,
    "negative_first_pair_fails_item",
  );

  const wrongGap = clone(after);
  const wrongLower = byId(wrongGap, pair1.lower_id);
  if (wrongLower) wrongLower.top = Number(wrongLower.top ?? 0) + 48;
  assert(
    !evaluateItemFulfillment({
      item: experience,
      beforeCanvas: prior,
      afterCanvas: wrongGap,
    }).pass,
    "negative_wrong_final_gap",
  );

  const rhythm = evaluateCanonicalFinalStateLayoutProof({
    requestedChange: changes[3]!,
    beforeCanvas: prior,
    afterCanvas: pair2Miss,
  });
  const rhythmCoverage = buildFeedbackCoverage({
    requested_changes: [changes[3]!],
    plan: { ...plan, operations: [] },
    log: [],
    beforeCanvas: prior,
    afterCanvas: pair2Miss,
  });
  assert(
    rhythmCoverage.items[0]?.status !== "addressed" &&
      (rhythm.reason === "LAYOUT_RHYTHM_SATISFIED"
        ? rhythmCoverage.items[0]?.status !== "addressed"
        : true),
    "negative_generic_rhythm_does_not_address_pair",
    JSON.stringify({
      status: rhythmCoverage.items[0]?.status,
      notes: rhythmCoverage.items[0]?.evidence?.notes,
      rhythm: rhythm.reason,
    }),
  );

  assert(
    compileTargetDescriptor("Move the complete contact-details line downward")
      .role === "contact" &&
      compileTargetDescriptor("Move the left green vertical line")
        .shape === "line",
    "ambiguous_line_language_stays_fail_closed_for_rails",
  );

  if (existsSync(HISTORICAL_TASK)) {
    assert(false, "historical_task_must_remain_off_local_tree", HISTORICAL_TASK);
  } else {
    assert(true, "historical_production_task_unmutated", "absent locally");
  }

  const failed = checks.filter((c) => !c.pass);
  const report = {
    schema_version: "verify-dental-hygienist-full-intent-1.0.0",
    at: new Date().toISOString(),
    ok: failed.length === 0,
    openai_calls: 0,
    live_retry: false,
    publication_allowed: false,
    checks,
    failed: failed.map((c) => c.name),
  };
  mkdirSync(join(OUT, ".."), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(failed.length === 0 ? "DENTAL FULL INTENT PASS" : "DENTAL FULL INTENT FAIL");
  process.exit(failed.length === 0 ? 0 : 1);
}

main();
