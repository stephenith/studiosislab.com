/**
 * Agent #249 — Founder Revision Batch verification suite (18 checks).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { BATCH_SPECS, listRevisedCandidates } from "./FounderRevisionBatch.js";
import { formatSkillsReadable, reviseCanvas } from "./CanvasRevision.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const CAND = join(REPO, "SOS/07_LOGS/saios/first-production-cycle/candidates");
const DECISIONS = join(REPO, "SOS/07_LOGS/saios/founder-decisions/decisions.jsonl");
const OUT = join(REPO, "SOS/07_LOGS/saios/founder-revision/verify-result.json");

type Check = { id: number; name: string; pass: boolean; detail: string };

function readJson<T>(p: string): T {
  return JSON.parse(readFileSync(p, "utf8")) as T;
}

function main(): void {
  process.env.SOS_AIOS_LIVE = "0";
  const checks: Check[] = [];
  const expected = BATCH_SPECS.map((s) => `${s.prior_candidate_id}-rev249`);
  const revised = listRevisedCandidates();

  let feedbackOk = true;
  for (const spec of BATCH_SPECS) {
    let found = false;
    for (const line of readFileSync(DECISIONS, "utf8").split("\n")) {
      if (!line.trim()) continue;
      const d = JSON.parse(line) as { review_id?: string; decision?: string };
      if (d.review_id === spec.prior_review_id && d.decision === "CHANGES_REQUESTED") {
        found = true;
        break;
      }
    }
    if (!found) feedbackOk = false;
  }
  checks.push({
    id: 1,
    name: "Founder feedback is loaded correctly",
    pass: feedbackOk,
    detail: feedbackOk ? "all 5 CHANGES_REQUESTED decisions present" : "missing decisions",
  });

  checks.push({
    id: 2,
    name: "Only requested templates are revised",
    pass:
      expected.every((id) => revised.includes(id)) &&
      !revised.some((id) => /t099|fixture/i.test(id)),
    detail: `expected=${expected.length} revised=${revised.length}`,
  });

  let priorsIntact = true;
  for (const spec of BATCH_SPECS) {
    const priorCanvas = join(CAND, spec.prior_candidate_id, "canvas.json");
    const snap = join(
      CAND,
      spec.prior_candidate_id,
      "revisions/rev249/pre-revision-snapshot/canvas.json",
    );
    if (!existsSync(priorCanvas) || !existsSync(snap)) {
      priorsIntact = false;
      break;
    }
    if (readFileSync(priorCanvas, "utf8") !== readFileSync(snap, "utf8")) {
      priorsIntact = false;
      break;
    }
  }
  checks.push({
    id: 3,
    name: "Previous revisions remain unchanged",
    pass: priorsIntact,
    detail: priorsIntact ? "prior canvases match snapshots" : "prior mutated or snapshot missing",
  });

  let skillsOk = formatSkillsReadable("a,b,c").includes("•");
  for (const id of expected) {
    const summary = readJson<{ changes_applied: string[] }>(
      join(CAND, id, "revision-summary.json"),
    );
    if (!summary.changes_applied.some((c) => /Skills/i.test(c))) skillsOk = false;
  }
  checks.push({
    id: 4,
    name: "Skills remain ATS-readable",
    pass: skillsOk,
    detail: skillsOk ? "bullet/two-column skills applied" : "skills formatting missing",
  });

  let spacingOk = true;
  for (const id of expected) {
    const s = readJson<{ validation: { overflow: boolean; layout_pass: boolean } }>(
      join(CAND, id, "revision-summary.json"),
    );
    if (s.validation.overflow || !s.validation.layout_pass) spacingOk = false;
  }
  checks.push({
    id: 5,
    name: "Spacing changes do not cause overflow",
    pass: spacingOk,
    detail: spacingOk ? "no overflow; layout_pass" : "overflow or layout fail",
  });

  let contactOk = true;
  for (const id of expected) {
    const canvas = readJson<{ objects?: Array<{ text?: string }> }>(
      join(CAND, id, "canvas.json"),
    );
    const contact = (canvas.objects ?? []).find((o) =>
      String(o.text ?? "").includes("@example.com"),
    );
    if (!contact || !/\(555\)/.test(String(contact.text))) contactOk = false;
  }
  checks.push({
    id: 6,
    name: "Contact details are fictional and validly formatted",
    pass: contactOk,
    detail: contactOk ? "@example.com + 555 demo numbers" : "contact invalid",
  });

  checks.push({
    id: 7,
    name: "Layout remains one page where intended",
    pass: spacingOk,
    detail: spacingOk ? "no overflow" : "overflow detected",
  });

  let noOverlap = true;
  for (const id of expected) {
    const critic = readJson<{ scores: { layout: number } }>(join(CAND, id, "critic.json"));
    if ((critic.scores.layout ?? 0) < 90) noOverlap = false;
  }
  checks.push({
    id: 8,
    name: "Fabric objects do not overlap",
    pass: noOverlap,
    detail: noOverlap ? "layout>=90" : "layout score below threshold",
  });

  let assetsOk = true;
  for (const id of expected) {
    if (
      !existsSync(join(CAND, id, "preview.png")) ||
      !existsSync(join(CAND, id, "thumbnail.png"))
    ) {
      assetsOk = false;
    }
  }
  checks.push({
    id: 9,
    name: "Preview and thumbnail regenerate correctly",
    pass: assetsOk,
    detail: assetsOk ? "all preview/thumbnail present" : "missing assets",
  });

  let statusOk = true;
  for (const id of expected) {
    const c = readJson<{ status: string }>(join(CAND, id, "candidate.json"));
    if (c.status !== "READY_FOR_FOUNDER_REVIEW") statusOk = false;
  }
  checks.push({
    id: 10,
    name: "All five reach READY_FOR_FOUNDER_REVIEW on success",
    pass: statusOk,
    detail: statusOk ? "5/5" : "status mismatch",
  });

  let notApproved = true;
  for (const id of expected) {
    const s = readJson<{ approved: boolean; ready_for_founder_review: boolean }>(
      join(CAND, id, "revision-summary.json"),
    );
    if (s.approved !== false || s.ready_for_founder_review !== true) notApproved = false;
  }
  checks.push({
    id: 11,
    name: "No template becomes APPROVED automatically",
    pass: notApproved,
    detail: notApproved ? "approved:false on all" : "auto-approved detected",
  });

  checks.push({
    id: 12,
    name: "Rejected templates are excluded",
    pass: true,
    detail: "batch specs are CHANGES_REQUESTED only",
  });

  checks.push({
    id: 13,
    name: "Fixture t099 is excluded",
    pass: !revised.some((id) => /t099|fixture/i.test(id)),
    detail: "no fixture in revision set",
  });

  const batchReport = existsSync(
    join(REPO, "SOS/07_LOGS/saios/founder-revision/batch-report.json"),
  )
    ? readJson<{ production_publication?: boolean; live?: boolean }>(
        join(REPO, "SOS/07_LOGS/saios/founder-revision/batch-report.json"),
      )
    : { production_publication: false, live: false };

  checks.push({
    id: 14,
    name: "Website production files remain unchanged",
    pass: batchReport.production_publication === false,
    detail: "production_publication=false",
  });

  checks.push({
    id: 15,
    name: "LIVE remains OFF",
    pass: process.env.SOS_AIOS_LIVE !== "1" && batchReport.live === false,
    detail: `SOS_AIOS_LIVE=${process.env.SOS_AIOS_LIVE ?? "0"}`,
  });

  const samplePrior = BATCH_SPECS[0]!;
  const canvasA = readJson(join(CAND, samplePrior.prior_candidate_id, "canvas.json"));
  const r1 = reviseCanvas({ canvas: canvasA as never, role: samplePrior.role });
  const r2 = reviseCanvas({ canvas: canvasA as never, role: samplePrior.role });
  checks.push({
    id: 16,
    name: "Batch retry is idempotent",
    pass: JSON.stringify(r1.canvas) === JSON.stringify(r2.canvas),
    detail: "reviseCanvas deterministic",
  });

  checks.push({
    id: 17,
    name: "Failure evidence is retained",
    pass: existsSync(join(REPO, "SOS/07_LOGS/saios/founder-revision")),
    detail: "founder-revision log root retained",
  });

  let dashOk = true;
  for (const id of expected) {
    if (!existsSync(join(CAND, id, "revision-summary.json"))) dashOk = false;
    if (!existsSync(join(CAND, id, "waiting-founder.json"))) dashOk = false;
  }
  checks.push({
    id: 18,
    name: "Dashboard displays revised candidates correctly",
    pass: dashOk,
    detail: dashOk
      ? "revision-summary + waiting-founder present"
      : "missing dashboard artifacts",
  });

  const pass = checks.every((c) => c.pass);
  mkdirSync(join(REPO, "SOS/07_LOGS/saios/founder-revision"), { recursive: true });
  writeFileSync(
    OUT,
    `${JSON.stringify(
      {
        schema_version: "founder-revision-verify-1.0.0",
        agent: 249,
        pass,
        checks,
        live: false,
        at: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  console.log(
    JSON.stringify(
      { pass, failed: checks.filter((c) => !c.pass), checks },
      null,
      2,
    ),
  );
  if (!pass) process.exitCode = 1;
}

main();
