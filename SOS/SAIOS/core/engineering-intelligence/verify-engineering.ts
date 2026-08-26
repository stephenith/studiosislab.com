/**
 * Engineering Intelligence verify — Agent #223.
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import {
  ENGINEERING_REPORT_PATH,
  buildEngineeringIntelligenceReport,
  engineeringFingerprint,
} from "./EngineeringIntelligence.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/engineering-intelligence/engineering-verify.json",
);
const GUARD = join(REPO, "SOS/SAIOS/architecture/runtime-guard.ts");
const SRC = join(import.meta.dirname, "EngineeringIntelligence.ts");
const MC = join(
  REPO,
  "SOS/SAIOS/dashboard/src/views/mission-control/MissionControlHome.tsx",
);
const FCC = join(
  REPO,
  "SOS/SAIOS/core/first-production-cycle/FounderCommandCenter.ts",
);
const PROJECT_STATE = join(REPO, "SOS/project-state.json");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function sha(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function forceMock(): void {
  delete process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST;
  delete process.env.OPENAI_API_KEY;
  delete process.env.SOS_OPENAI_API_KEY;
  process.env.SOS_AIOS_LIVE = "0";
}

async function main(): Promise<void> {
  forceMock();
  const checks: Record<string, boolean> = {};
  const guardBefore = sha(GUARD);
  const psBefore = sha(PROJECT_STATE);

  const src = readFileSync(SRC, "utf8");
  assert(!src.includes("from \"../first-production-cycle/BatchRunner"), "no BatchRunner");
  assert(!/runProduction\s*\(/.test(src), "no runProduction");
  assert(!src.includes("from \"openai\""), "no openai package import");
  assert(!src.includes("SOS_OPENAI"), "no OpenAI env usage");
  assert(!src.includes("project-state.json"), "EI must not write project-state");
  assert(src.includes("openai_called: false"), "openai_called false invariant");
  assert(!src.includes("writeFileSync(join(repoRoot, \"SOS/project-state"), "no ps write");
  checks.no_production_ownership = true;

  const now = new Date("2026-07-21T16:00:00.000Z");
  const a = buildEngineeringIntelligenceReport({ persist: false, now });
  assert(typeof a.scores.overall === "number", "overall score");
  assert(a.scores.overall >= 0 && a.scores.overall <= 100, "score range");
  assert(a.advisory_only === true, "advisory_only");
  assert(a.owns_code === false, "owns_code false");
  assert(a.owns_production === false, "owns_production false");
  assert(a.can_mutate_architecture === false, "no arch mutation");
  assert(a.code_modified === false, "no code mod");
  assert(a.production_triggered === false, "no production");
  assert(a.openai_called === false, "no openai");
  assert(a.publication_allowed === false, "no publication");
  assert(a.live === false, "LIVE off");
  assert(a.founder_approval_required === true, "founder approval");
  assert(a.project_state_modified === false, "no ps mutation flag");
  assert(Array.isArray(a.recommendations), "recs");
  for (const r of a.recommendations) {
    assert(r.status === "OPEN", "default OPEN");
    assert(r.requires_founder_approval === true, "founder req");
    assert(typeof r.recommendation_id === "string", "id");
    assert(typeof r.severity === "string", "severity");
  }
  checks.repository_inspection = true;
  checks.deterministic_scoring = true;

  const b = buildEngineeringIntelligenceReport({ persist: false, now });
  assert(
    engineeringFingerprint(a) === engineeringFingerprint(b),
    "deterministic fingerprint",
  );
  checks.deterministic_recommendations = true;

  const persisted = buildEngineeringIntelligenceReport({ persist: true, now });
  assert(
    existsSync(ENGINEERING_REPORT_PATH) ||
      existsSync(join(REPO, persisted.report_path)),
    "report written",
  );
  assert(existsSync(join(REPO, persisted.history_path)), "history written");
  checks.recommendation_history = true;

  // Mission Control integration (source)
  assert(existsSync(MC), "MC home");
  const mc = readFileSync(MC, "utf8");
  assert(mc.includes("Engineering"), "MC Engineering section");
  assert(mc.includes("engineering") || mc.includes("Engineering Score"), "MC eng score");
  const fcc = readFileSync(FCC, "utf8");
  assert(fcc.includes("engineering"), "FCC aggregates engineering report");
  checks.mission_control_integration = true;

  assert(sha(GUARD) === guardBefore, "Runtime Guard unchanged");
  assert(sha(PROJECT_STATE) === psBefore, "project-state unchanged by EI run");
  checks.runtime_guard_unchanged = true;
  checks.no_project_state_mutation = true;

  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE OFF");
  checks.live_off = true;

  const result = {
    agent: "223",
    ok: true,
    generated_at: new Date().toISOString(),
    live: false,
    publication_allowed: false,
    mutations: false,
    production_triggered: false,
    openai_called: false,
    overall: persisted.scores.overall,
    recommendation_count: persisted.recommendation_count,
    checks,
    runtime_guard_sha256: guardBefore,
  };

  mkdirSync(resolve(OUT, ".."), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  console.log("PASS aios:engineering:verify");
}

main().catch((e) => {
  console.error("FAIL", e instanceof Error ? e.message : e);
  process.exit(1);
});
