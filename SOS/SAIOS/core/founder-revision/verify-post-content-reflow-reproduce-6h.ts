/**
 * Phase 6H step 2 — reproduce revtask-b9a65ad0-eb0 overlaps offline
 * from the sanitized fixture BEFORE any reflow implementation.
 *
 * No OpenAI. No production mutation.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { executeCanvasOperations } from "./CanvasOperationExecutor.js";
import { findTextOverlapFindings } from "./RevisionAcceptanceChecks.js";
import { evaluateFounderSpacingIntents } from "./FounderSpacingIntent.js";
import { resolveAllFounderSpacingRelations } from "./FounderSpacingRelation.js";
import { visualTextContentBottom } from "./TextEffectiveHeight.js";
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import type { RevisionPlan } from "./revision-task-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const FIX = joinFix();

function joinFix(): string {
  return resolve(
    REPO,
    ".cursor/debug-fixtures/revtask-b9a65ad0-eb0-sanitized",
  );
}

function loadJson<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(FIX, name), "utf8")) as T;
}

function gap(canvas: FabricCanvasDoc, a: string, b: string): number {
  const objs = (canvas.objects ?? []) as Array<Record<string, unknown>>;
  const oa = objs.find((o) => String(o.id ?? "") === a);
  const ob = objs.find((o) => String(o.id ?? "") === b);
  if (!oa || !ob) throw new Error(`missing ${a} or ${b}`);
  return Number(ob.top ?? 0) - visualTextContentBottom(oa);
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

const canvas = loadJson<FabricCanvasDoc>("prior-canvas.json");
const plan = loadJson<RevisionPlan>("revision-plan.json");
const meta = loadJson<{
  requested_changes: string[];
  expected_error: string;
  expected_text_overlaps: number;
}>("meta.json");

const srcOverlaps = findTextOverlapFindings(canvas).length;
const srcOob = oobCount(canvas);
const exec = executeCanvasOperations({ canvas, operations: plan.operations });
if (!exec.ok) {
  console.error("EXECUTE_FAIL", exec.error);
  process.exit(1);
}
const after = exec.canvas;
const overlaps = findTextOverlapFindings(after);
const projects = gap(after, "block-projects-5-t2", "block-projects-5-t3");
const certs = gap(after, "block-certifications-6-t1", "block-certifications-6-t2");
const edu = gap(after, "block-education-3-t2", "block-education-3-t3");
const pageOob = oobCount(after);

const rels = resolveAllFounderSpacingRelations({
  requested_changes: meta.requested_changes,
  canvas,
});
const intents = evaluateFounderSpacingIntents({
  requested_changes: meta.requested_changes,
  beforeCanvas: canvas,
  afterCanvas: after,
  resolved_relations: rels,
});

const approx = (got: number, expected: number, tol = 0.6) =>
  Math.abs(got - expected) <= tol;

let fail = 0;
function check(name: string, ok: boolean, detail: string): void {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${detail}`);
  if (!ok) fail += 1;
}

check("source_overlaps_zero", srcOverlaps === 0 && srcOob === 0, `pol=${srcOverlaps} oob=${srcOob}`);
check("projects_overlap", approx(projects, -14.45), `gap=${projects.toFixed(2)}`);
check("certs_heading_overlap", approx(certs, -3), `gap=${certs.toFixed(2)}`);
check("education_overlap", approx(edu, -11.95), `gap=${edu.toFixed(2)}`);
check("text_overlaps_3", overlaps.length === 3, `n=${overlaps.length}`);
check("page_oob_0", pageOob === 0, `n=${pageOob}`);
check(
  "skills_relation_satisfied",
  intents.intents.length === 1 && intents.intents[0]?.satisfied === true,
  JSON.stringify(intents.intents[0] ?? null).slice(0, 180),
);
check(
  "historical_error_string",
  /spacing intent unsatisfied/.test(meta.expected_error),
  meta.expected_error.slice(0, 80),
);

if (fail > 0) {
  console.log(`PRODUCTION_FAILURE_REPRODUCED_OFFLINE=NO (${fail} failed)`);
  process.exit(1);
}
console.log("PRODUCTION_FAILURE_REPRODUCED_OFFLINE=YES");
