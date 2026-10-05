/**
 * Offline Teaching Assistant full-intent proof for IR 1.4.4.
 *
 * Replays the immutable fixture for revtask-232a10da-349.
 * Does not mutate the historical production task, overlay, or publication.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import {
  compileFounderFeedbackIR,
  FOUNDER_FEEDBACK_IR_SCHEMA,
  NUMBER_OF_SEMANTIC_INTERPRETATION_PATHS,
} from "./FounderFeedbackIR.js";
import {
  applyPostExecutionLayoutWorld,
  applyStyleMutations,
  compileStyleMutation,
  evaluateItemFulfillment,
  itemRequiresMutationFulfillment,
} from "./FounderFeedbackFulfillment.js";
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
const FIX = join(REPO, ".cursor/debug-fixtures/revtask-232a10da-349");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-teaching-assistant-full-intent.json",
);
const HISTORICAL_TASK = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/tasks/revtask-232a10da-349.json",
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

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
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

function isBold(o: Record<string, unknown> | undefined): boolean {
  const v = o?.fontWeight;
  const n = Number(v);
  if (Number.isFinite(n) && n >= 700) return true;
  const s = String(v ?? "").toLowerCase();
  return s === "bold" || s === "700";
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
  const meta = readJson<{ requested_changes: string[]; task_id: string }>(
    join(FIX, "meta.json"),
  );
  const prior = readJson<FabricCanvasDoc>(join(FIX, "prior-canvas.json"));
  const plan = readJson<RevisionPlan>(join(FIX, "revision-plan.json"));
  const changes = meta.requested_changes;
  assert(changes.length === 3, "fixture_has_three_requested_changes");
  assert(
    FOUNDER_FEEDBACK_IR_SCHEMA === "founder-feedback-ir-1.4.4" &&
      NUMBER_OF_SEMANTIC_INTERPRETATION_PATHS === 1,
    "ir_schema_1_4_4_single_owner",
    FOUNDER_FEEDBACK_IR_SCHEMA,
  );

  const ir = compileFounderFeedbackIR(changes);
  const header = ir.items[0]!;
  const experience = ir.items[1]!;
  const skills = ir.items[2]!;
  const style = compileStyleMutation(changes[0]!);
  assert(
    header.fulfillment.some((p) => p.kind === "RELATIONAL_ALIGNMENT") &&
      header.fulfillment.some((p) => p.kind === "STYLE") &&
      style?.fontWeight === "bold" &&
      experience.fulfillment.some((p) => p.kind === "SPACING_PAIR") &&
      skills.fulfillment.some((p) => p.kind === "PRESENTATION") &&
      itemRequiresMutationFulfillment(header) &&
      itemRequiresMutationFulfillment(experience) &&
      itemRequiresMutationFulfillment(skills),
    "ir_compiles_all_material_clauses",
    JSON.stringify({
      header: header.fulfillment.map((p) => p.kind),
      experience: experience.fulfillment.map((p) => p.kind),
      skills: skills.fulfillment.map((p) => p.kind),
    }),
  );

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
  const contact = byId(after, "block-header-0-t3");
  const priorName = byId(prior, "block-header-0-t1");
  const priorRect = byId(prior, "block-header-0-r0");
  const titleTop = Number(title?.top ?? 0);
  const rectBottom = Number(priorRect?.top ?? 0) + Number(priorRect?.height ?? 0);
  const contactTop = Number(contact?.top ?? 0);
  const titleBottom = titleTop + Number(title?.height ?? 0);
  assert(
    textOf(name) === textOf(priorName) &&
      Number(name?.top) === Number(priorName?.top) &&
      Number(name?.left) === Number(priorName?.left),
    "header_name_preserved",
    JSON.stringify({ text: textOf(name), top: name?.top, left: name?.left }),
  );
  assert(
    Number(rect?.top) === Number(priorRect?.top) &&
      Number(rect?.left) === Number(priorRect?.left) &&
      Number(rect?.height) === Number(priorRect?.height),
    "header_rectangle_preserved",
    JSON.stringify({ top: rect?.top, left: rect?.left }),
  );
  assert(
    titleTop + 0.51 >= rectBottom && textOf(title).includes("Teaching Assistant"),
    "title_below_rectangle",
    `titleTop=${titleTop} rectBottom=${rectBottom}`,
  );
  assert(isBold(title), "title_bold", String(title?.fontWeight));
  assert(
    contactTop + 1e-9 >= titleBottom && contactTop - titleBottom >= 0,
    "contact_below_title",
    `contactTop=${contactTop} titleBottom=${titleBottom}`,
  );

  const t6 = byId(after, "block-experience-2-t6");
  const t7 = byId(after, "block-experience-2-t7");
  const priorT6 = byId(prior, "block-experience-2-t6");
  const priorT7 = byId(prior, "block-experience-2-t7");
  const afterGap = Number(t7?.top ?? 0) - (Number(t6?.top ?? 0) + Number(t6?.height ?? 0));
  assert(
    textOf(t6) === textOf(priorT6) && textOf(t7) === textOf(priorT7),
    "experience_text_preserved",
  );
  assert(
    Number(t6?.height) <= 16.5 && afterGap + 1e-9 >= 0,
    "experience_named_pair_compacted",
    `t6h=${t6?.height} afterGap=${afterGap} t7top=${t7?.top}`,
  );

  const skillItems = skillsItems(after);
  const expected = [
    "Student Engagement",
    "Classroom Support",
    "Assignment Grading",
    "Instructional Material Development",
    "Peer Mentoring",
    "Communication",
    "Microsoft Office",
    "Zoom & Canvas LMS",
  ];
  const col2 = byId(after, "block-skills-4-t2-col2");
  const skillsText = objs(after)
    .filter((o) => {
      const data = o.data && typeof o.data === "object" ? (o.data as { section?: string }) : {};
      return data.section === "skills";
    })
    .map((o) => textOf(o))
    .join("\n");
  assert(
    skillItems.length === 8 && expected.every((item, i) => skillItems[i] === item),
    "skills_eight_items_order",
    JSON.stringify(skillItems),
  );
  assert(
    Boolean(col2) && /[•·]/.test(skillsText),
    "skills_columns_and_bullets",
    `col2=${Boolean(col2)} bullets=${/[•·]/.test(skillsText)}`,
  );

  const overlaps = findTextOverlapFindings(after);
  const geom = evaluateSharedGeometryAdmission(after);
  const oob = findOutOfBoundsObjects(after).filter(
    (f) => f.code !== "ACC_BOUNDS_UNEVALUABLE",
  );
  assert(
    overlaps.length === 0 &&
      geom.pass &&
      geom.page_fit_pass &&
      oob.length === 0,
    "c2_overlap_oob_page_fit",
    JSON.stringify({
      overlaps: overlaps.map((f) => f.message),
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
  assert(
    coverage.gate_pass &&
      coverage.items.every((i) => i.status === "addressed") &&
      coverage.items.every(
        (i) => !String(i.evidence?.notes ?? "").includes("LAYOUT_RHYTHM_SATISFIED") ||
          i.founder_feedback_item === changes[1],
      ) &&
      acceptance.may_return_to_founder_review === true,
    "coverage_and_final_acceptance_from_ir",
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
    JSON.stringify({
      ok: geo.ok,
      layout: geo.layout_applied,
      overlaps: geo.text_overlaps,
      err: geo.error,
    }),
  );

  const notBold = clone(after);
  const notBoldTitle = byId(notBold, "block-header-0-t2");
  if (notBoldTitle) notBoldTitle.fontWeight = 400;
  const notBoldProof = evaluateItemFulfillment({
    item: header,
    beforeCanvas: prior,
    afterCanvas: notBold,
  });
  assert(!notBoldProof.pass, "negative_title_moved_not_bold", notBoldProof.notes);

  const ontoContact = clone(after);
  const ontoTitle = byId(ontoContact, "block-header-0-t2");
  const ontoRow = byId(ontoContact, "block-header-0-t3");
  if (ontoTitle && ontoRow) ontoTitle.top = ontoRow.top;
  const ontoOverlaps = findTextOverlapFindings(ontoContact);
  const ontoGeom = evaluateSharedGeometryAdmission(ontoContact);
  assert(
    ontoOverlaps.length >= 1 || !ontoGeom.pass,
    "negative_title_on_contact_fails_c2",
    `overlaps=${ontoOverlaps.length} pass=${ontoGeom.pass}`,
  );

  const nameMoved = clone(after);
  const movedName = byId(nameMoved, "block-header-0-t1");
  if (movedName) movedName.top = Number(movedName.top ?? 0) + 20;
  const nameProof = evaluateItemFulfillment({
    item: header,
    beforeCanvas: prior,
    afterCanvas: nameMoved,
  });
  assert(!nameProof.pass, "negative_name_moved_fails_preservation", nameProof.notes);

  const spacingMiss = clone(after);
  const missT7 = byId(spacingMiss, "block-experience-2-t7");
  if (missT7) missT7.top = Number(priorT7?.top ?? 430);
  const spacingProof = evaluateItemFulfillment({
    item: experience,
    beforeCanvas: prior,
    afterCanvas: spacingMiss,
  });
  assert(!spacingProof.pass, "negative_experience_gap_not_achieved", spacingProof.notes);

  const skillsLost = clone(after);
  const skillsBody = byId(skillsLost, "block-skills-4-t2");
  if (skillsBody) {
    skillsBody.text = String(skillsBody.text ?? "")
      .split("\n")
      .slice(1)
      .join("\n");
  }
  const skillsLostProof = evaluateItemFulfillment({
    item: skills,
    beforeCanvas: prior,
    afterCanvas: skillsLost,
  });
  assert(!skillsLostProof.pass, "negative_skills_lost_item", skillsLostProof.notes);

  const rhythm = evaluateCanonicalFinalStateLayoutProof({
    requestedChange: changes[0]!,
    beforeCanvas: prior,
    afterCanvas: notBold,
  });
  const notBoldCoverage = buildFeedbackCoverage({
    requested_changes: [changes[0]!],
    plan: { ...plan, operations: [] },
    log: [],
    beforeCanvas: prior,
    afterCanvas: notBold,
  });
  assert(
    notBoldCoverage.items[0]?.status !== "addressed" &&
      (rhythm.reason === "LAYOUT_RHYTHM_SATISFIED"
        ? notBoldCoverage.items[0]?.status !== "addressed"
        : true),
    "negative_generic_rhythm_does_not_address_unfulfilled_style",
    JSON.stringify({
      status: notBoldCoverage.items[0]?.status,
      notes: notBoldCoverage.items[0]?.evidence?.notes,
      rhythm: rhythm.reason,
    }),
  );

  const styleOnly = applyStyleMutations(prior, ir);
  assert(
    isBold(byId(styleOnly, "block-header-0-t2")),
    "style_applier_sets_title_bold",
    String(byId(styleOnly, "block-header-0-t2")?.fontWeight),
  );

  if (existsSync(HISTORICAL_TASK)) {
    assert(false, "historical_task_must_remain_off_local_tree", HISTORICAL_TASK);
  } else {
    assert(true, "historical_production_task_unmutated", "absent locally");
  }
  assert(existsSync(join(FIX, "revtask-232a10da-349.json")), "fixture_task_copy_present");
  const fixtureHash = sha256(join(FIX, "revtask-232a10da-349.json"));
  assert(fixtureHash.length === 64, "fixture_task_hash", fixtureHash);

  const failed = checks.filter((c) => !c.pass);
  const report = {
    schema_version: "verify-teaching-assistant-full-intent-1.0.0",
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
  console.log(failed.length === 0 ? "TA FULL INTENT PASS" : "TA FULL INTENT FAIL");
  process.exit(failed.length === 0 ? 0 : 1);
}

main();
