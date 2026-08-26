/**
 * Agent #233 — Resume Template Runtime Conversion verify (mock).
 * Proves preview+thumbnail mandatory, resume-template.json, Ready for Review.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import {
  CYCLE_LOG,
  runFirstProductionCycle,
} from "./runFirstProductionCycle.js";
import { countCanonicalWaitingTotal } from "./CandidateStore.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(CYCLE_LOG, "resume-template-runtime-verify.json");

function forceMock(): void {
  delete process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST;
  delete process.env.OPENAI_API_KEY;
  delete process.env.SOS_OPENAI_API_KEY;
  process.env.SOS_AIOS_LIVE = "0";
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  forceMock();
  mkdirSync(CYCLE_LOG, { recursive: true });
  const waitingBefore = countCanonicalWaitingTotal(CYCLE_LOG);
  const stamp = Date.now();

  const cycle = await runFirstProductionCycle({
    verification: true,
    verification_context: "aios-verify-233",
    pause_for_founder: true,
    force_mock: true,
    select_target: false,
    target: {
      category: "engineering",
      title: "Template Runtime Engineer",
      industry: "technology",
      seniority: "mid",
      objective: `agent233-template-runtime-${stamp}`,
      role_family: "template_runtime_verify",
    },
  });

  assert(cycle.overall === "PASS", `overall=${cycle.overall} state=${cycle.state}`);
  assert(cycle.state === "WAITING_FOUNDER", `state=${cycle.state}`);
  assert(cycle.publication_allowed === false, "publication");
  assert(existsSync(join(cycle.candidate_dir, "preview.png")), "preview.png");
  assert(existsSync(join(cycle.candidate_dir, "thumbnail.png")), "thumbnail.png");
  assert(existsSync(join(cycle.candidate_dir, "canvas.json")), "canvas.json");
  assert(
    existsSync(join(cycle.candidate_dir, "resume-template.json")),
    "resume-template.json",
  );
  assert(
    existsSync(join(cycle.candidate_dir, "editor-compatibility.json")),
    "editor-compatibility",
  );
  assert(existsSync(join(cycle.candidate_dir, "critic.json")), "critic.json");

  const tmpl = JSON.parse(
    readFileSync(join(cycle.candidate_dir, "resume-template.json"), "utf8"),
  ) as {
    product_kind?: string;
    template_id?: string;
    founder_review_status?: string;
    publication_status?: string;
    preview_png?: string | null;
    thumbnail?: string | null;
  };
  assert(tmpl.product_kind === "resume_template", "product_kind");
  assert(Boolean(tmpl.template_id), "template_id");
  assert(tmpl.founder_review_status === "ready_for_review", "founder status");
  assert(tmpl.publication_status === "not_published", "publication_status");
  assert(tmpl.preview_png === "preview.png", "preview field");
  assert(tmpl.thumbnail === "thumbnail.png", "thumbnail field");

  const report = join(
    CYCLE_LOG,
    "resume-template-runtime/resume-template-runtime-report.json",
  );
  assert(existsSync(report), "runtime report");

  // Verification artifacts must not enter production Ready for Review
  assert(
    countCanonicalWaitingTotal(CYCLE_LOG) === waitingBefore,
    "production waiting unchanged",
  );

  const frSrc = readFileSync(
    join(REPO, "SOS/SAIOS/dashboard/src/views/FounderReviewView.tsx"),
    "utf8",
  );
  assert(frSrc.includes("Resume Template"), "FR Resume Template label");
  assert(!/fr-v3-label">Candidate</.test(frSrc), "no Candidate label");

  const mcSrc = readFileSync(
    join(REPO, "SOS/SAIOS/dashboard/src/views/mission-control/MissionControlHome.tsx"),
    "utf8",
  );
  assert(mcSrc.includes("Template Queue") || mcSrc.includes("Ready for Review"), "MC terminology");
  assert(mcSrc.includes('label="Templates"'), "MC Templates metric");

  const pcSrc = readFileSync(
    join(REPO, "SOS/SAIOS/core/first-production-cycle/ProductionController.ts"),
    "utf8",
  );
  // Structural owner unchanged — still exports runProduction
  assert(pcSrc.includes("export async function runProduction"), "PC owner");

  const checks = {
    resume_template_object: true,
    preview_generated: true,
    thumbnail_generated: true,
    fabric_canvas: true,
    editor_compatibility: true,
    critic_present: true,
    ready_for_review: true,
    founder_review_terminology: true,
    mission_control_terminology: true,
    production_controller_owner: true,
    no_publication: true,
    live_off: true,
    production_queue_isolated: true,
  };

  const overall = Object.values(checks).every(Boolean);
  writeFileSync(
    OUT,
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        agent: "233",
        overall: overall ? "PASS" : "FAIL",
        checks,
        template_id: tmpl.template_id,
        state: cycle.state,
        candidate_dir: cycle.candidate_dir,
      },
      null,
      2,
    )}\n`,
  );

  console.log("Resume Template Runtime Conversion Verify");
  console.log("=========================================");
  for (const [k, v] of Object.entries(checks)) {
    console.log(`${v ? "✔" : "✘"} ${k}`);
  }
  console.log(`Overall: ${overall ? "PASS" : "FAIL"}`);
  if (!overall) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
