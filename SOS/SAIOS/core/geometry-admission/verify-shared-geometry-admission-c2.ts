/**
 * C2 — Shared Geometry Admission offline proof.
 *
 * No production OpenAI, generation, revision, Founder decision, or LIVE.
 * Historical fixtures are read-only copies.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { CriticGate } from "../critic-gate/CriticGate.js";
import { FounderReviewGatekeeper } from "../critic-gate/FounderReviewGatekeeper.js";
import type { FabricCanvasDoc } from "../founder-revision/CanvasInventory.js";
import { findTextOverlapFindings } from "../founder-revision/RevisionAcceptanceChecks.js";
import { compileFounderFeedbackIR } from "../founder-revision/FounderFeedbackIR.js";
import { CANONICAL_CONTENT_PRESERVATION } from "../founder-revision/RequestedChangeClassification.js";
import {
  evaluateGenerationFounderReviewAdmission,
  evaluateSharedGeometryAdmission,
  SHARED_GEOMETRY_ADMISSION_SCHEMA,
} from "./SharedGeometryAdmission.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/geometry-admission/verify-shared-geometry-admission-c2.json",
);
const GOOD_HIST = join(
  REPO,
  ".cursor/debug-fixtures/revtask-a0009171-849-sanitized/prior/canvas.json",
);

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function assert(ok: boolean, name: string, detail = ""): void {
  checks.push({ name, pass: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
}

function pageCanvas(extra: Record<string, unknown>[]): FabricCanvasDoc {
  return {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      {
        type: "rect",
        id: "page-root",
        left: 0,
        top: 0,
        width: 794,
        height: 1123,
        fill: "#ffffff",
        data: { role: "pageBackground", system: true },
      },
      ...extra,
    ],
  };
}

function textbox(
  id: string,
  opts: {
    left: number;
    top: number;
    width: number;
    height: number;
    text: string;
    section: string;
  },
): Record<string, unknown> {
  return {
    type: "textbox",
    id,
    left: opts.left,
    top: opts.top,
    width: opts.width,
    height: opts.height,
    text: opts.text,
    fontSize: 10.5,
    lineHeight: 1.45,
    scaleX: 1,
    scaleY: 1,
    data: { section: opts.section },
  };
}

/** Phase 5W false-negative class: same-column wrap overlap with Y-interleaved other column. */
function overlappingCanvas(): FabricCanvasDoc {
  return pageCanvas([
    textbox("block-certifications-6-t1", {
      left: 60,
      top: 530.8,
      width: 208,
      height: 14,
      text: "CERTIFICATIONS",
      section: "certifications",
    }),
    textbox("block-certifications-6-t2", {
      left: 48,
      top: 552.8,
      width: 220,
      height: 16,
      text: "• Certified Data Entry Specialist (CDES), National Data Management Institute, 2021",
      section: "certifications",
    }),
    textbox("block-experience-2-t8", {
      left: 284,
      top: 558.8,
      width: 450,
      height: 16,
      text: "Junior Data Entry Operator — SynerTech Innovations",
      section: "experience",
    }),
    textbox("block-certifications-6-t3", {
      left: 48,
      top: 571.47,
      width: 220,
      height: 16,
      text: "• Microsoft Office Specialist (Excel), 2022",
      section: "certifications",
    }),
  ]);
}

function validCanvas(): FabricCanvasDoc {
  return pageCanvas([
    textbox("name", {
      left: 48,
      top: 40,
      width: 400,
      height: 28,
      text: "Jane Example",
      section: "header",
    }),
    textbox("title", {
      left: 48,
      top: 76,
      width: 400,
      height: 18,
      text: "Operations Analyst",
      section: "header",
    }),
    textbox("summary", {
      left: 48,
      top: 120,
      width: 700,
      height: 48,
      text: "Operations analyst with process and reporting experience.",
      section: "summary",
    }),
  ]);
}

function oobCanvas(): FabricCanvasDoc {
  const c = validCanvas();
  c.objects.push(
    textbox("oob", {
      left: 48,
      top: 1200,
      width: 200,
      height: 24,
      text: "Off the page",
      section: "languages",
    }),
  );
  return c;
}

function passingScores() {
  return {
    overall: 96,
    ats: 98,
    visual: 93,
    typography: 96,
    layout: 94,
    technical: 100,
    consistency: 95,
    sections: 97,
    ready: true,
  };
}

function main(): void {
  if (process.env.SOS_AIOS_LIVE === "1") {
    throw new Error("C2 verifier refuses SOS_AIOS_LIVE=1");
  }

  const valid = validCanvas();
  const overlap = overlappingCanvas();
  const oob = oobCanvas();
  const validAdm = evaluateSharedGeometryAdmission(valid);
  const overlapAdm = evaluateSharedGeometryAdmission(overlap);
  const oobAdm = evaluateSharedGeometryAdmission(oob);
  const overlapFindings = findTextOverlapFindings(overlap);

  assert(
    validAdm.schema_version === SHARED_GEOMETRY_ADMISSION_SCHEMA &&
      validAdm.pass === true &&
      validAdm.text_overlap_count === 0 &&
      validAdm.page_oob_count === 0 &&
      validAdm.page_fit_pass === true,
    "valid_generation_geometry_accepted",
    JSON.stringify({
      pass: validAdm.pass,
      codes: validAdm.fail_codes,
    }),
  );

  const genInvalid = evaluateGenerationFounderReviewAdmission({
    critic_ready: true,
    critic_gate_ready: true,
    geometry: overlapAdm,
  });
  assert(
    overlapAdm.pass === false &&
      overlapAdm.fail_codes.includes("TEXT_OVERLAP") &&
      genInvalid.admit === false &&
      genInvalid.blocked_by === "geometry",
    "invalid_generation_geometry_blocked",
    JSON.stringify({
      codes: overlapAdm.fail_codes,
      overlaps: overlapAdm.text_overlap_count,
    }),
  );

  const genValid = evaluateGenerationFounderReviewAdmission({
    critic_ready: true,
    critic_gate_ready: true,
    geometry: validAdm,
  });
  assert(
    genValid.admit === true && genValid.blocked_by === "none",
    "valid_generation_can_enter_founder_review",
    JSON.stringify(genValid),
  );

  assert(
    overlapAdm.pass === false &&
      overlapAdm.text_overlap_count === overlapFindings.length &&
      overlapFindings.length > 0,
    "revision_geometry_fail_closed",
    `kernel_overlaps=${overlapAdm.text_overlap_count} primitive=${overlapFindings.length}`,
  );

  assert(
    overlapAdm.text_overlap_count === overlapFindings.length &&
      overlapAdm.pass === false &&
      validAdm.pass === true,
    "generation_revision_agreement",
    "same canvas → same kernel pass/fail",
  );

  const gate = new CriticGate();
  const reviewGk = new FounderReviewGatekeeper();
  const criticOverride = gate.evaluate({
    task_id: "c2-fixture-geometry-override",
    cycle_id: "c2-fixture",
    candidate_id: "c2-fixture-overlap",
    candidate_title: "C2 overlap fixture",
    fixture: true,
    critic_report_reference: "SOS/07_LOGS/saios/resume-critic/readiness.json",
    scores: passingScores(),
    geometry_pass: overlapAdm.pass,
    geometry_blocking_reasons: overlapAdm.fail_codes.map(
      (c) => `SHARED_GEOMETRY_${c}`,
    ),
  });
  const reviewCreate = reviewGk.canCreateReview({
    review_id: "c2-fixture-overlap",
    task_id: "c2-fixture-geometry-override",
    candidate_id: "c2-fixture-overlap",
    gate: criticOverride.gate,
  });
  assert(
    criticOverride.gate.ready === true &&
      criticOverride.gate.geometry_pass === false &&
      criticOverride.gate.founder_review_allowed === false &&
      reviewCreate.allowed === false &&
      (criticOverride.queue.added_id ?? "").startsWith("critic-remediation-"),
    "critic_cannot_override_geometry",
    JSON.stringify({
      ready: criticOverride.gate.ready,
      geometry_pass: criticOverride.gate.geometry_pass,
      founder_review_allowed: criticOverride.gate.founder_review_allowed,
      review_allowed: reviewCreate.allowed,
      queue: criticOverride.queue.added_id,
    }),
  );

  assert(
    oobAdm.pass === false &&
      (oobAdm.fail_codes.includes("PAGE_OOB") ||
        oobAdm.fail_codes.includes("PAGE_FIT")),
    "oob_and_page_fit_rejected",
    JSON.stringify(oobAdm.fail_codes),
  );

  const uneval = evaluateSharedGeometryAdmission({
    version: "5.3.0",
    width: 0,
    height: 0,
    objects: [],
  });
  assert(
    uneval.pass === false && uneval.unevaluable === true,
    "unevaluable_fail_closed",
    JSON.stringify(uneval.fail_codes),
  );

  if (existsSync(GOOD_HIST)) {
    const hist = JSON.parse(readFileSync(GOOD_HIST, "utf8")) as FabricCanvasDoc;
    const histAdm = evaluateSharedGeometryAdmission(hist);
    assert(
      histAdm.pass === true,
      "historical_good_fixture_accepted",
      JSON.stringify({
        overlaps: histAdm.text_overlap_count,
        oob: histAdm.page_oob_count,
        fit: histAdm.page_fit_pass,
        codes: histAdm.fail_codes,
      }),
    );
  } else {
    assert(false, "historical_good_fixture_accepted", `missing ${GOOD_HIST}`);
  }

  assert(
    overlapAdm.pass === false,
    "historical_bad_geometry_rejected",
    "5W-class interleaved overlap reconstructed (historical records not mutated)",
  );

  const ir = compileFounderFeedbackIR([CANONICAL_CONTENT_PRESERVATION]);
  assert(
    ir.schema_version === "founder-feedback-ir-1.0.0" &&
      ir.items.length >= 1 &&
      ir.completeness_sections.length === 0,
    "c1_ir_unaffected",
    `items=${ir.items.length} completeness=${ir.completeness_sections.join(",")}`,
  );

  const criticOnlyBlock = evaluateGenerationFounderReviewAdmission({
    critic_ready: false,
    critic_gate_ready: false,
    geometry: validAdm,
  });
  assert(
    criticOnlyBlock.admit === false && criticOnlyBlock.blocked_by === "critic",
    "critic_still_blocks_when_geometry_ok",
    JSON.stringify(criticOnlyBlock),
  );

  const failed = checks.filter((c) => !c.pass);
  const report = {
    schema_version: "shared-geometry-admission-c2-verify-1.0.0",
    at: new Date().toISOString(),
    pass: failed.length === 0,
    checks,
    failed: failed.map((c) => c.name),
    production_openai_called: false,
    production_generation_executed: false,
    production_revision_executed: false,
    founder_decision_created: false,
    publication_executed: false,
    live: false,
  };
  mkdirSync(join(REPO, "SOS/07_LOGS/saios/geometry-admission"), {
    recursive: true,
  });
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(failed.length === 0 ? "\nC2 VERIFY PASS" : "\nC2 VERIFY FAIL");
  if (failed.length) process.exit(1);
}

main();
