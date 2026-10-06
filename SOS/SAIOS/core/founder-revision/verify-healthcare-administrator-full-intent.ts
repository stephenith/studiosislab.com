/**
 * Offline Healthcare Administrator full-intent proof for compiler-dispatch
 * consolidation (post-FAILED_COVERAGE).
 *
 * Replays a sanitized fixture copy of revtask-adf420bb-a53.
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
  compileGroupAlignment,
  compileRelativePlacement,
  evaluateItemFulfillment,
  itemRequiresMutationFulfillment,
} from "./FounderFeedbackFulfillment.js";
import {
  buildSafeNamedSpacingRelationOps,
  extractPairEndpointNeedles,
  resolveAllFounderSpacingRelations,
  resolveFounderSpacingRelation,
} from "./FounderSpacingRelation.js";
import { detectSpacingIntentDirection } from "./FounderSpacingIntent.js";
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
const FIX = join(REPO, ".cursor/debug-fixtures/revtask-adf420bb-a53");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-healthcare-administrator-full-intent.json",
);
const HISTORICAL_TASK = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/tasks/revtask-adf420bb-a53.json",
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

function bodyContentLeft(canvas: FabricCanvasDoc): number {
  const lefts = objs(canvas)
    .filter((o) => {
      const data = o.data && typeof o.data === "object" ? (o.data as { section?: string }) : {};
      const type = String(o.type ?? "").toLowerCase();
      return Boolean(data.section) && data.section !== "header" && type.includes("text");
    })
    .map((o) => Number(o.left ?? 0));
  return Math.min(...lefts);
}

function main(): void {
  const meta = readJson<{ requested_changes: string[] }>(join(FIX, "meta.json"));
  const prior = readJson<FabricCanvasDoc>(join(FIX, "prior-canvas.json"));
  const changes = meta.requested_changes;
  assert(changes.length === 3, "fixture_has_three_requested_changes");
  assert(
    FOUNDER_FEEDBACK_IR_SCHEMA === "founder-feedback-ir-1.4.5" &&
      NUMBER_OF_SEMANTIC_INTERPRETATION_PATHS === 1,
    "ir_schema_1_4_5_single_owner",
    FOUNDER_FEEDBACK_IR_SCHEMA,
  );

  const ir = compileFounderFeedbackIR(changes);
  const header = ir.items[0]!;
  const experience = ir.items[1]!;
  const skills = ir.items[2]!;
  const rel = header.fulfillment.find((p) => p.kind === "RELATIONAL_ALIGNMENT");
  const group = compileGroupAlignment(changes[0]!);
  const pairEnds = extractPairEndpointNeedles(changes[1]!);
  const pairs = experience.fulfillment.filter((p) => p.kind === "SPACING_PAIR");
  assert(
    compileRelativePlacement(changes[0]!) == null &&
      rel?.alignment?.relation === "align" &&
      rel.alignment?.axis === "horizontal" &&
      rel.alignment?.edge === "left" &&
      rel.reference?.kind === "body_content" &&
      rel.preserve?.kind === "visual" &&
      (rel.targets?.length ?? 0) === 3 &&
      rel.targets?.some((t) => t.role === "name") &&
      rel.targets?.some((t) => t.role === "professional_title") &&
      rel.targets?.some((t) => t.role === "contact") &&
      rel.targets?.every((t) => !t.quoted_text) &&
      group?.alignment.relation === "align" &&
      header.fulfillment.some((p) => p.kind === "PRESERVATION") &&
      itemRequiresMutationFulfillment(header),
    "ir_header_group_align_not_below",
    JSON.stringify({
      relative: compileRelativePlacement(changes[0]!),
      rel,
      headerKinds: header.fulfillment.map((p) => p.kind),
    }),
  );
  assert(
    detectSpacingIntentDirection(changes[1]!) !== "PRESERVE" &&
      pairs.length === 1 &&
      (pairs[0]?.present_phrases?.length ?? 0) === 2 &&
      pairEnds.length === 2 &&
      pairEnds.every((n) => /negotiating savings|collaborated with clinical/i.test(n)) &&
      !pairEnds.some((n) => /greenfield community hospital/i.test(n)) &&
      experience.fulfillment.some((p) => p.kind === "PRESERVATION") &&
      itemRequiresMutationFulfillment(experience),
    "ir_experience_pair_and_preservation",
    JSON.stringify({
      direction: detectSpacingIntentDirection(changes[1]!),
      phrases: pairs[0]?.present_phrases,
      pairEnds,
      kinds: experience.fulfillment.map((p) => p.kind),
    }),
  );
  assert(
    skills.fulfillment.some((p) => p.kind === "PRESENTATION") &&
      itemRequiresMutationFulfillment(skills),
    "ir_skills_presentation",
    JSON.stringify(skills.fulfillment.map((p) => p.kind)),
  );

  const resolved = resolveAllFounderSpacingRelations({
    requested_changes: changes,
    canvas: prior,
  });
  const named = resolved.filter((r) => r.kind === "NAMED_PAIR");
  assert(
    named.length === 1 &&
      named[0]?.upper_id === "block-experience-2-t11" &&
      named[0]?.lower_id === "block-experience-2-t12",
    "named_pair_resolves_two_bullets",
    JSON.stringify(named.map((r) => `${r.upper_id}->${r.lower_id} ${r.kind}`)),
  );
  const spacingOps = buildSafeNamedSpacingRelationOps({
    canvas: prior,
    requested_changes: changes,
    resolved_relations: resolved,
  });
  const plan: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "offline healthcare fixture replay",
    operations: spacingOps,
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
  const title = byId(after, "block-header-0-t2");
  const contact = byId(after, "block-header-0-t3");
  const priorName = byId(prior, "block-header-0-t1");
  const priorTitle = byId(prior, "block-header-0-t2");
  const priorContact = byId(prior, "block-header-0-t3");
  const bodyLeft = bodyContentLeft(after);
  const headerLefts = [name, title, contact].map((o) => Number(o?.left ?? 0));
  assert(
    headerLefts.every((l) => Math.abs(l - bodyLeft) <= 2) &&
      textOf(name) === textOf(priorName) &&
      textOf(title) === textOf(priorTitle) &&
      textOf(contact) === textOf(priorContact),
    "header_group_left_equals_body",
    JSON.stringify({ headerLefts, bodyLeft }),
  );

  const railIds = ["page-accent-rail", "block-header-0-r0"];
  assert(
    railIds.every((id) => {
      const a = byId(after, id);
      const b = byId(prior, id);
      return (
        Number(a?.left) === Number(b?.left) && Number(a?.top) === Number(b?.top)
      );
    }),
    "rails_unchanged",
    JSON.stringify(
      railIds.map((id) => ({
        id,
        after: { left: byId(after, id)?.left, top: byId(after, id)?.top },
        prior: { left: byId(prior, id)?.left, top: byId(prior, id)?.top },
      })),
    ),
  );

  const expectedSkills = [
    "Healthcare Operations Management",
    "Electronic Health Records (EHR)",
    "Regulatory Compliance",
    "Budgeting & Financial Analysis",
    "Team Leadership & Staff Development",
    "Patient Flow Optimization",
    "Contract Negotiation",
    "Quality Assurance",
  ];
  const skillItems = skillsItems(after);
  const col2 = byId(after, "block-skills-4-t2-col2");
  const skillsText = objs(after)
    .filter((o) => {
      const data = o.data && typeof o.data === "object" ? (o.data as { section?: string }) : {};
      return data.section === "skills";
    })
    .map((o) => textOf(o))
    .join("\n");
  assert(
    skillItems.length === 8 &&
      expectedSkills.every((item, i) => skillItems[i] === item) &&
      Boolean(col2) &&
      Number(col2?.left ?? 0) > Number(byId(after, "block-skills-4-t2")?.left ?? 0) &&
      /[•·]/.test(skillsText),
    "skills_eight_columns_bullets_beside",
    JSON.stringify(skillItems),
  );

  const pair = named[0]!;
  const pairAfter = resolveFounderSpacingRelation({
    requestedChange: changes[1]!,
    canvas: after,
    needles: pairs[0]?.present_phrases,
  });
  const proof = evaluateCanonicalFinalStateLayoutProof({
    requestedChange: changes[1]!,
    beforeCanvas: prior,
    afterCanvas: after,
    resolved_relation: pairAfter,
  });
  assert(
    textOf(byId(after, pair.upper_id)) === textOf(byId(prior, pair.upper_id)) &&
      textOf(byId(after, pair.lower_id)) === textOf(byId(prior, pair.lower_id)) &&
      proof.pass,
    "experience_named_pair_fulfilled",
    `${pair.upper_id}->${pair.lower_id} ${proof.reason} ${proof.final_condition}`,
  );

  const overlaps = findTextOverlapFindings(after);
  const geom = evaluateSharedGeometryAdmission(after);
  const oob = findOutOfBoundsObjects(after).filter(
    (f) => f.code !== "ACC_BOUNDS_UNEVALUABLE",
  );
  assert(
    overlaps.length === 0 && geom.pass && geom.page_fit_pass && oob.length === 0,
    "c2_overlap_oob_page_fit",
    JSON.stringify({
      overlaps: overlaps.length,
      pass: geom.pass,
      fit: geom.page_fit_pass,
      oob: oob.length,
    }),
  );

  const headerProof = evaluateItemFulfillment({
    item: header,
    beforeCanvas: prior,
    afterCanvas: after,
  });
  const expProof = evaluateItemFulfillment({
    item: experience,
    beforeCanvas: prior,
    afterCanvas: after,
  });
  const skillsProof = evaluateItemFulfillment({
    item: skills,
    beforeCanvas: prior,
    afterCanvas: after,
  });
  assert(headerProof.pass, "header_fulfillment_pass", headerProof.notes);
  assert(expProof.pass, "experience_fulfillment_pass", expProof.notes);
  assert(skillsProof.pass, "skills_fulfillment_pass", skillsProof.notes);

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
  const expNotes = String(coverage.items[1]?.evidence?.notes ?? "");
  assert(
    coverage.gate_pass &&
      coverage.items.every((i) => i.status === "addressed") &&
      (expNotes.includes("canonical_final_state_layout_proof") ||
        expNotes.includes("SPACING_PAIR") ||
        expNotes.includes("fulfillment")) &&
      !expNotes.includes("generic rhythm fallback") &&
      acceptance.may_return_to_founder_review === true &&
      acceptance.overall === "PASS",
    "coverage_from_required_ir_predicates",
    JSON.stringify({
      items: coverage.items.map((i) => ({
        status: i.status,
        notes: i.evidence?.notes,
      })),
      accept: acceptance.overall,
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

  const unbound = clone(after);
  const dropped = byId(unbound, "block-header-0-t1");
  if (dropped) dropped.text = "";
  assert(
    !evaluateItemFulfillment({
      item: header,
      beforeCanvas: prior,
      afterCanvas: unbound,
    }).pass,
    "negative_header_member_unbound",
  );

  const partial = clone(after);
  const partialName = byId(partial, "block-header-0-t1");
  if (partialName) partialName.left = 64;
  assert(
    !evaluateItemFulfillment({
      item: header,
      beforeCanvas: prior,
      afterCanvas: partial,
    }).pass,
    "negative_partial_header_move",
  );

  const railMoved = clone(after);
  const movedRail = byId(railMoved, "page-accent-rail");
  if (movedRail) movedRail.left = Number(movedRail.left ?? 0) + 12;
  assert(
    !evaluateItemFulfillment({
      item: header,
      beforeCanvas: prior,
      afterCanvas: railMoved,
    }).pass,
    "negative_rail_moved",
  );

  const pairMiss = clone(after);
  const missLower = byId(pairMiss, pair.lower_id);
  const priorLower = byId(prior, pair.lower_id);
  if (missLower) missLower.top = Number(priorLower?.top ?? 0) + 40;
  const missUpper = byId(pairMiss, pair.upper_id);
  if (missUpper) missUpper.height = 31;
  assert(
    !evaluateItemFulfillment({
      item: experience,
      beforeCanvas: prior,
      afterCanvas: pairMiss,
    }).pass,
    "negative_experience_pair_fails",
  );

  const rhythmCoverage = buildFeedbackCoverage({
    requested_changes: [changes[1]!],
    plan: { ...plan, operations: [] },
    log: [],
    beforeCanvas: prior,
    afterCanvas: pairMiss,
  });
  assert(
    rhythmCoverage.items[0]?.status !== "addressed",
    "negative_generic_rhythm_does_not_address_pair",
    JSON.stringify({
      status: rhythmCoverage.items[0]?.status,
      notes: rhythmCoverage.items[0]?.evidence?.notes,
    }),
  );

  if (existsSync(HISTORICAL_TASK)) {
    assert(false, "historical_task_must_remain_off_local_tree", HISTORICAL_TASK);
  } else {
    assert(true, "historical_production_task_unmutated", "absent locally");
  }

  const failed = checks.filter((c) => !c.pass);
  const report = {
    schema_version: "verify-healthcare-administrator-full-intent-1.0.0",
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
  console.log(
    failed.length === 0
      ? "HEALTHCARE FULL INTENT PASS"
      : "HEALTHCARE FULL INTENT FAIL",
  );
  process.exit(failed.length === 0 ? 0 : 1);
}

main();
