/**
 * Offline Digital Marketing Specialist full-intent proof for ownership /
 * presentation / multi-pair / offset consolidation (post-FAILED_PLAN).
 *
 * Replays a sanitized fixture copy of revtask-a3de0a46-4da.
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
  founderFeedbackIROwnershipErrors,
} from "./FounderFeedbackIR.js";
import {
  applyPostExecutionLayoutWorld,
  compileRelativePlacement,
  evaluateItemFulfillment,
  itemRequiresMutationFulfillment,
} from "./FounderFeedbackFulfillment.js";
import {
  buildSafeNamedSpacingRelationOps,
  extractAllNamedSpacingPairs,
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
import {
  allRequestedChangesAllowEmptyPlan,
  validateRevisionPlanShapeAndOperations,
} from "./RevisionPromptBuilder.js";
import { buildCanvasInventory } from "./CanvasInventory.js";
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import type { RevisionPlan } from "./revision-task-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const FIX = join(REPO, ".cursor/debug-fixtures/revtask-a3de0a46-4da");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-digital-marketing-specialist-full-intent.json",
);
const HISTORICAL_TASK = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/tasks/revtask-a3de0a46-4da.json",
);

const EXPECTED_SKILLS = [
  "Google Ads",
  "SEO Strategy",
  "Google Analytics",
  "Email Marketing Platforms",
  "Content Marketing",
  "Social Media Advertising",
  "Campaign Optimization",
  "Data Analysis",
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

  const sourceSkills = textOf(byId(prior, "block-skills-4-t2"));
  assert(
    EXPECTED_SKILLS.every((s) => sourceSkills.includes(s)) &&
      /Data Analysis/.test(sourceSkills),
    "source_canvas_has_eight_skills",
    sourceSkills,
  );
  const inventory = buildCanvasInventory(prior);
  const invSkills = inventory.find((o) => o.id === "block-skills-4-t2");
  assert(
    Boolean(invSkills?.text?.endsWith("…")) &&
      (invSkills?.text_len ?? 0) > 160,
    "inventory_truncation_is_marked",
    JSON.stringify({ text: invSkills?.text, len: invSkills?.text_len }),
  );

  const ir = compileFounderFeedbackIR(changes);
  const header = ir.items[0]!;
  const skills = ir.items[1]!;
  const experience = ir.items[2]!;
  assert(
    founderFeedbackIROwnershipErrors(ir).length === 0 &&
      ir.items.every((item) => item.coverage_mode === "DETERMINISTIC_LAYOUT_OWNED") &&
      allRequestedChangesAllowEmptyPlan(changes),
    "ownership_all_deterministic_empty_plan_legal",
    JSON.stringify(
      ir.items.map((item) => ({
        class: item.classification,
        mode: item.coverage_mode,
        action: item.action,
      })),
    ),
  );
  const emptyShape = validateRevisionPlanShapeAndOperations(
    { schema_version: "founder-canvas-revision-plan-1.0.0", operations: [] },
    { allowEmptyOperations: true, requested_changes: changes },
  );
  assert(emptyShape.ok, "plan_schema_accepts_empty_deterministic_plan", emptyShape.errors.join("; "));
  const illegalAttr = validateRevisionPlanShapeAndOperations(
    {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      operations: [
        {
          op: "update_text",
          target_id: "block-skills-4-t2",
          before_summary: "skills body",
          intended_change: "rewrite skills",
          values: { text: "x" },
          founder_feedback_item: changes[1],
          confidence: 0.9,
        },
      ],
    },
    { requested_changes: changes, inventory },
  );
  assert(
    !illegalAttr.ok &&
      illegalAttr.errors.some((e) =>
        /must not claim (VERIFICATION_ACCEPTANCE|DETERMINISTIC_LAYOUT_OWNED)/.test(e),
      ),
    "plan_schema_rejects_skills_attribution",
    illegalAttr.errors.join("; "),
  );

  const rel = compileRelativePlacement(changes[0]!);
  assert(
    header.coverage_mode === "DETERMINISTIC_LAYOUT_OWNED" &&
      rel?.alignment.relation === "below" &&
      rel.alignment.clearance_px === 2 &&
      header.fulfillment.some((p) => p.kind === "PRESERVATION") &&
      itemRequiresMutationFulfillment(header),
    "ir_header_below_clearance_and_preserve",
    JSON.stringify(rel?.alignment),
  );
  const spec = skills.fulfillment.find((p) => p.kind === "PRESENTATION")?.presentation_spec;
  assert(
    skills.action === "PRESENTATION_MUTATION" &&
      skills.coverage_mode === "DETERMINISTIC_LAYOUT_OWNED" &&
      spec?.grouping?.items_per_group === 4 &&
      spec.grouping?.continue_beside === true &&
      itemRequiresMutationFulfillment(skills),
    "ir_skills_presentation_four_plus_remainder",
    JSON.stringify(spec?.grouping),
  );
  const namedPairs = extractAllNamedSpacingPairs(changes[2]!);
  const pairPreds = experience.fulfillment.filter((p) => p.kind === "SPACING_PAIR");
  assert(
    pairPreds.length === 2 &&
      namedPairs.length === 2 &&
      experience.fulfillment.some((p) => p.kind === "PRESERVATION") &&
      itemRequiresMutationFulfillment(experience),
    "ir_experience_two_pairs_and_preservation",
    JSON.stringify(namedPairs),
  );

  const resolved = resolveAllFounderSpacingRelations({
    requested_changes: changes,
    canvas: prior,
  });
  const named = resolved.filter((r) => r.kind === "NAMED_PAIR");
  assert(
    named.length === 2 &&
      named[0]?.upper_id === "block-experience-2-t11" &&
      named[0]?.lower_id === "block-experience-2-t12" &&
      named[1]?.upper_id === "block-experience-2-t12" &&
      named[1]?.lower_id === "block-experience-2-t13",
    "named_pairs_resolve_three_bullets",
    JSON.stringify(named.map((r) => `${r.upper_id}->${r.lower_id}`)),
  );
  const spacingOps = buildSafeNamedSpacingRelationOps({
    canvas: prior,
    requested_changes: changes,
    resolved_relations: resolved,
  });
  const plan: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "offline digital marketing fixture replay",
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

  const band = byId(after, "block-header-0-r0");
  const priorBand = byId(prior, "block-header-0-r0");
  const name = byId(after, "block-header-0-t1");
  const title = byId(after, "block-header-0-t2");
  const contact = byId(after, "block-header-0-t3");
  const priorName = byId(prior, "block-header-0-t1");
  const priorTitle = byId(prior, "block-header-0-t2");
  const priorContact = byId(prior, "block-header-0-t3");
  const bandBottom = Number(priorBand?.top ?? 0) + Number(priorBand?.height ?? 0);
  const contactTop = Number(contact?.top ?? 0);
  assert(
    contactTop + 1e-9 >= bandBottom + 2 - 0.51 &&
      textOf(name) === textOf(priorName) &&
      textOf(title) === textOf(priorTitle) &&
      textOf(contact) === textOf(priorContact) &&
      Number(name?.top) === Number(priorName?.top) &&
      Number(title?.top) === Number(priorTitle?.top) &&
      Number(band?.top) === Number(priorBand?.top) &&
      Number(band?.left) === Number(priorBand?.left) &&
      Number(band?.height) === Number(priorBand?.height),
    "header_contact_below_band_preserve",
    JSON.stringify({ contactTop, bandBottom, gap: contactTop - bandBottom }),
  );

  const skillItems = skillsItems(after);
  const col1 = byId(after, "block-skills-4-t2");
  const col2 = byId(after, "block-skills-4-t2-col2");
  const col1Items = textOf(col1)
    .split(/\n+/)
    .map((line) => line.replace(/^[•·\-–—*]\s+/, "").trim())
    .filter(Boolean);
  assert(
    skillItems.length === 8 &&
      EXPECTED_SKILLS.every((item, i) => skillItems[i] === item) &&
      col1Items.length === 4 &&
      Boolean(col2) &&
      Number(col2?.left ?? 0) > Number(col1?.left ?? 0) &&
      /[•·]/.test(textOf(col1)) &&
      !/·\s*$/.test(textOf(col1)),
    "skills_eight_four_plus_remainder_bullets",
    JSON.stringify({ skillItems, col1Items, col2: textOf(col2) }),
  );

  for (const [i, pair] of named.entries()) {
    const pairAfter = resolveFounderSpacingRelation({
      requestedChange: changes[2]!,
      canvas: after,
      needles: pairPreds[i]?.present_phrases,
    });
    const proof = evaluateCanonicalFinalStateLayoutProof({
      requestedChange: changes[2]!,
      beforeCanvas: prior,
      afterCanvas: after,
      resolved_relation: pairAfter,
    });
    assert(
      textOf(byId(after, pair.upper_id)) === textOf(byId(prior, pair.upper_id)) &&
        textOf(byId(after, pair.lower_id)) === textOf(byId(prior, pair.lower_id)) &&
        proof.pass,
      `experience_pair_${i + 1}_fulfilled`,
      `${pair.upper_id}->${pair.lower_id} ${proof.reason} ${proof.final_condition}`,
    );
  }

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

  assert(
    evaluateItemFulfillment({ item: header, beforeCanvas: prior, afterCanvas: after }).pass,
    "header_fulfillment_pass",
  );
  assert(
    evaluateItemFulfillment({ item: skills, beforeCanvas: prior, afterCanvas: after }).pass,
    "skills_fulfillment_pass",
  );
  assert(
    evaluateItemFulfillment({ item: experience, beforeCanvas: prior, afterCanvas: after }).pass,
    "experience_fulfillment_pass",
  );

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
  assert(
    coverage.gate_pass &&
      coverage.items.every((i) => i.status === "addressed") &&
      acceptance.may_return_to_founder_review === true &&
      acceptance.overall === "PASS",
    "coverage_and_final_acceptance_pass",
    JSON.stringify({
      items: coverage.items.map((i) => ({ status: i.status, notes: i.evidence?.notes })),
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

  const edge = clone(after);
  const edgeContact = byId(edge, "block-header-0-t3");
  if (edgeContact) edgeContact.top = bandBottom;
  assert(
    !evaluateItemFulfillment({
      item: header,
      beforeCanvas: prior,
      afterCanvas: edge,
    }).pass,
    "negative_contact_on_band_edge_fails",
  );
  const overlap = clone(after);
  const overlapContact = byId(overlap, "block-header-0-t3");
  if (overlapContact) overlapContact.top = bandBottom - 8;
  assert(
    !evaluateItemFulfillment({
      item: header,
      beforeCanvas: prior,
      afterCanvas: overlap,
    }).pass,
    "negative_contact_inside_band_fails",
  );
  const tooClose = clone(after);
  const closeContact = byId(tooClose, "block-header-0-t3");
  if (closeContact) closeContact.top = bandBottom + 0.4;
  assert(
    !evaluateItemFulfillment({
      item: header,
      beforeCanvas: prior,
      afterCanvas: tooClose,
    }).pass,
    "negative_tiny_gap_short_of_clearance_fails",
  );
  const nameMut = clone(after);
  const mutName = byId(nameMut, "block-header-0-t1");
  if (mutName) mutName.text = "Renamed";
  assert(
    !evaluateItemFulfillment({
      item: header,
      beforeCanvas: prior,
      afterCanvas: nameMut,
    }).pass,
    "negative_name_mutation_fails",
  );
  const bandMoved = clone(after);
  const movedBand = byId(bandMoved, "block-header-0-r0");
  if (movedBand) movedBand.top = Number(movedBand.top ?? 0) + 10;
  assert(
    !evaluateItemFulfillment({
      item: header,
      beforeCanvas: prior,
      afterCanvas: bandMoved,
    }).pass,
    "negative_band_movement_fails",
  );

  const pair2Miss = clone(after);
  const missLower = byId(pair2Miss, named[1]!.lower_id);
  const priorLower = byId(prior, named[1]!.lower_id);
  if (missLower) missLower.top = Number(priorLower?.top ?? 0) + 40;
  assert(
    !evaluateItemFulfillment({
      item: experience,
      beforeCanvas: prior,
      afterCanvas: pair2Miss,
    }).pass,
    "negative_pair2_fail_fails_item",
  );
  const pair1Miss = clone(after);
  const missFirst = byId(pair1Miss, named[0]!.lower_id);
  const priorFirst = byId(prior, named[0]!.lower_id);
  if (missFirst) missFirst.top = Number(priorFirst?.top ?? 0) + 40;
  assert(
    !evaluateItemFulfillment({
      item: experience,
      beforeCanvas: prior,
      afterCanvas: pair1Miss,
    }).pass,
    "negative_pair1_fail_fails_item",
  );

  const missingSkill = clone(after);
  const skillBox = byId(missingSkill, "block-skills-4-t2");
  if (skillBox) {
    skillBox.text = String(skillBox.text ?? "").replace("Google Ads\n", "");
  }
  assert(
    !evaluateItemFulfillment({
      item: skills,
      beforeCanvas: prior,
      afterCanvas: missingSkill,
    }).pass,
    "negative_missing_skill_fails",
  );

  if (existsSync(HISTORICAL_TASK)) {
    assert(false, "historical_task_must_remain_off_local_tree", HISTORICAL_TASK);
  } else {
    assert(true, "historical_production_task_unmutated", "absent locally");
  }

  const failed = checks.filter((c) => !c.pass);
  const report = {
    schema_version: "verify-digital-marketing-specialist-full-intent-1.0.0",
    at: new Date().toISOString(),
    ok: failed.length === 0,
    openai_calls: 0,
    live_retry: false,
    publication_allowed: false,
    source_skills_count: 8,
    checks,
    failed: failed.map((c) => c.name),
  };
  mkdirSync(join(OUT, ".."), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    failed.length === 0
      ? "DIGITAL MARKETING FULL INTENT PASS"
      : "DIGITAL MARKETING FULL INTENT FAIL",
  );
  process.exit(failed.length === 0 ? 0 : 1);
}

main();
