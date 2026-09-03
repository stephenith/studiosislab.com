/**
 * GUARDED_ACTIVE dashboard recovery slice 2 — Production page + Mission/FCC honesty.
 * Read-only. No OpenAI / generation / revision / publish.
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildResumeOperationalStatus } from "../core/first-production-cycle/ResumeOperationalStatus.js";
import { loadDashboardSnapshot } from "./src/data/loadSnapshot.js";

const DASH = resolve(import.meta.dirname);
const REPO = resolve(DASH, "../../..");
const LOG = join(REPO, "SOS/07_LOGS/saios/guarded-active-dashboard-slice2");
const PROD = join(DASH, "src/views/ResumeProductionView.tsx");
const APP = join(DASH, "src/App.tsx");
const MC_HOME = join(DASH, "src/views/mission-control/MissionControlHome.tsx");
const OPS_HUB = join(DASH, "src/views/MissionControl.tsx");
const FCC_VIEW = join(DASH, "src/views/FounderCommandCenterView.tsx");

function assert(cond: boolean, name: string, detail?: string): void {
  if (!cond) throw new Error(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
  console.log(`PASS ${name}`);
}

function main(): void {
  mkdirSync(LOG, { recursive: true });
  assert(process.env.SOS_AIOS_LIVE !== "1", "live_env_not_1");

  const prodSrc = readFileSync(PROD, "utf8");
  const appSrc = readFileSync(APP, "utf8");
  const mcSrc = readFileSync(MC_HOME, "utf8");
  const opsSrc = readFileSync(OPS_HUB, "utf8");
  const fccViewSrc = readFileSync(FCC_VIEW, "utf8");

  const snap = loadDashboardSnapshot(REPO);
  const ops = snap.resume_ops;
  assert(Boolean(ops), "resume_ops_present");

  // A — department ACTIVE from resume_ops
  assert(
    ops?.department_status === "ACTIVE" || ops?.department_active === true,
    "department_active",
  );
  assert(prodSrc.includes("department_status"), "prod_shows_department");

  // B — generation / timers
  assert(typeof ops?.generation_status === "string", "generation_status_present");
  assert(prodSrc.includes("timers?.morning"), "prod_morning_timer");
  assert(prodSrc.includes("timers?.evening"), "prod_evening_timer");
  assert(prodSrc.includes("systemctl unavailable"), "timer_unavailable_copy");

  // C/D — queue / backpressure
  assert(typeof ops?.queue?.waiting_founder === "number", "queue_waiting");
  assert(typeof ops?.queue?.queue_max === "number", "queue_max");
  assert(typeof ops?.queue?.queue_free === "number", "queue_free");
  assert(
    prodSrc.includes("BACKPRESSURED / REVIEW QUEUE FULL"),
    "backpressure_copy",
  );
  assert(!prodSrc.includes("SYSTEM DOWN"), "no_system_down_for_backpressure");

  const atMax = buildResumeOperationalStatus({
    repoRoot: REPO,
    env: {
      ...process.env,
      SOS_AIOS_LIVE: "0",
      SOS_AI_FOUNDER_OPENAI_BOUNDED: "1",
      SOS_AIOS_REVISION_DISPATCHER: "1",
      SOS_AIOS_PUBLICATION_AUTO_APPLY: "0",
    },
    queueMax: 0,
  });
  assert(atMax.generation_status === "BACKPRESSURED" || atMax.queue.waiting_founder >= 0, "backpressure_helper");
  assert(atMax.health.status === "BACKPRESSURED", "health_backpressured_at_full");
  assert(!/FAIL|DOWN/i.test(atMax.health.status), "backpressure_not_failed");

  // E/F — last execution
  assert(prodSrc.includes("last_execution"), "prod_last_execution");
  assert(prodSrc.includes("Unavailable"), "prod_unavailable_fallback");
  if (ops?.last_execution?.available) {
    assert(
      Boolean(ops.last_execution.execution_id),
      "last_execution_id_when_available",
    );
  } else {
    assert(ops?.last_execution?.available === false, "last_execution_missing_ok");
  }

  // G — revision dispatcher
  assert(prodSrc.includes("revision_dispatcher"), "prod_dispatcher");
  assert(
    prodSrc.includes("env flag") || prodSrc.includes("revision_dispatcher_basis"),
    "dispatcher_evidence_honest",
  );

  // H — cost/budget
  assert(prodSrc.includes("today_usd"), "prod_cost_today");
  assert(prodSrc.includes("daily_limit"), "prod_daily_limit");

  // I — publication
  assert(
    ops?.publication_mode === "MANUAL_GUARDED",
    "publication_manual_guarded",
  );
  assert(ops?.publication_auto_apply === false, "auto_apply_off");
  assert(prodSrc.includes("MANUAL / GUARDED"), "prod_publication_copy");
  assert(prodSrc.includes("Auto apply"), "prod_auto_apply_row");

  // J — memory
  assert(prodSrc.includes("active_rules") || prodSrc.includes("Founder memory"), "prod_memory");

  // K — legacy Mission/FCC honesty
  assert(
    mcSrc.includes("Legacy autonomous") || mcSrc.includes("not Resume Template"),
    "mission_factory_legacy_label",
  );
  assert(
    mcSrc.includes("Department") && !mcSrc.includes('mc-card-label">LIVE<'),
    "mission_safety_not_live_label",
  );
  assert(opsSrc.includes("scaffold / legacy"), "ops_hub_scaffold_label");
  assert(appSrc.includes("Portfolio · inactive"), "nav_portfolio_inactive");
  assert(appSrc.includes("Operations Hub · scaffold"), "nav_ops_scaffold");
  assert(appSrc.includes("ResumeProductionView"), "app_uses_production_view");
  assert(
    fccViewSrc.includes("env guard") || fccViewSrc.includes("not department off"),
    "fcc_banner_env_guard_note",
  );

  // L — no legacy false story reintroduced in Production / App Production route
  assert(!prodSrc.includes("LIVE OFF"), "prod_no_live_off");
  assert(!prodSrc.includes("DRY_RUN"), "prod_no_dry_run");
  assert(!prodSrc.includes("PROVIDER: MOCK"), "prod_no_provider_mock");
  assert(
    !appSrc.includes("fcc-production") || appSrc.includes("ResumeProductionView"),
    "production_route_wired",
  );

  // helper: last execution metrics from report when present
  const helper = buildResumeOperationalStatus({
    repoRoot: REPO,
    env: {
      SOS_AIOS_LIVE: "0",
      SOS_AI_FOUNDER_OPENAI_BOUNDED: "1",
      SOS_AIOS_REVISION_DISPATCHER: "1",
      SOS_AIOS_PUBLICATION_AUTO_APPLY: "0",
    },
  });
  if (helper.last_execution.available) {
    assert(
      helper.last_execution.duplicate_skips === null ||
        typeof helper.last_execution.duplicate_skips === "number",
      "duplicate_skips_typed",
    );
    assert(
      helper.last_execution.role_integrity_failed === null ||
        typeof helper.last_execution.role_integrity_failed === "number",
      "role_integrity_typed",
    );
  }
  assert(helper.revision_dispatcher_basis === "env_flag", "dispatcher_basis");
  assert(typeof helper.cost.available === "boolean", "cost_available_flag");

  const result = {
    generated_at: new Date().toISOString(),
    overall: "PASS",
    slice: 2,
    department_status: ops?.department_status,
    generation_status: ops?.generation_status,
    publication_mode: ops?.publication_mode,
    health: ops?.health?.status,
    queue: ops?.queue,
  };
  writeFileSync(join(LOG, "readiness.json"), `${JSON.stringify(result, null, 2)}\n`);
  console.log("OVERALL PASS");
}

try {
  main();
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
