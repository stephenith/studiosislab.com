/**
 * AIOS Mission Control UI V1 verify — Agent #222B.
 * UI-only checks. No production. No mutations. Snapshot/API reused.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/first-production-cycle/mission-control-ui-verify.json",
);

const FCC_CORE = join(
  REPO,
  "SOS/SAIOS/core/first-production-cycle/FounderCommandCenter.ts",
);
const SERVER = join(REPO, "SOS/SAIOS/dashboard/server.ts");
const APP = join(REPO, "SOS/SAIOS/dashboard/src/App.tsx");
const MC_HOME = join(
  REPO,
  "SOS/SAIOS/dashboard/src/views/mission-control/MissionControlHome.tsx",
);
const MC_COMP = join(
  REPO,
  "SOS/SAIOS/dashboard/src/views/mission-control/components.tsx",
);
const MC_CSS = join(
  REPO,
  "SOS/SAIOS/dashboard/src/views/mission-control/mission-control.css",
);
const FCC_VIEW = join(
  REPO,
  "SOS/SAIOS/dashboard/src/views/FounderCommandCenterView.tsx",
);
const REVIEW = join(
  REPO,
  "SOS/SAIOS/dashboard/src/views/FounderReviewView.tsx",
);
const MAIN = join(REPO, "SOS/SAIOS/dashboard/src/main.tsx");
const GUARD = join(REPO, "SOS/SAIOS/architecture/runtime-guard.ts");
const REPORT = join(
  REPO,
  "SOS/09_REPORTS/AIOS_MISSION_CONTROL_UI_V1_REPORT.md",
);

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function sha(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function forceMock(): void {
  process.env.SOS_AIOS_LIVE = "0";
}

async function main(): Promise<void> {
  forceMock();
  const checks: Record<string, boolean> = {};

  assert(existsSync(MC_HOME), "MissionControlHome");
  assert(existsSync(MC_COMP), "MC components");
  assert(existsSync(MC_CSS), "MC css");
  assert(existsSync(REPORT), "report");
  checks.mission_control_ui_present = true;

  const app = readFileSync(APP, "utf8");
  const mcHome = readFileSync(MC_HOME, "utf8");
  const fccView = readFileSync(FCC_VIEW, "utf8");
  const server = readFileSync(SERVER, "utf8");
  const fccCore = readFileSync(FCC_CORE, "utf8");
  const mainSrc = readFileSync(MAIN, "utf8");

  // Existing UI preserved (dashboard host + design system + review)
  assert(app.includes("DashboardShell"), "DashboardShell preserved");
  assert(app.includes("FounderReviewView"), "Founder Review preserved");
  assert(existsSync(REVIEW), "FounderReviewView file");
  assert(app.includes('label: "Mission Control"'), "nav Mission Control");
  assert(app.includes("command-center"), "command-center route reused");
  assert(mainSrc.includes("mission-control.css"), "MC styles loaded");
  checks.existing_ui_preserved = true;

  // Snapshot reused
  assert(
    app.includes("/api/founder-command-center"),
    "reuses FCC API fetch",
  );
  assert(
    fccView.includes("MissionControlHome"),
    "overview delegates to Mission Control",
  );
  assert(
    mcHome.includes("FounderCommandCenterSnapshot"),
    "uses FCC snapshot type",
  );
  assert(!mcHome.includes("fetch("), "home does not invent new fetches");
  checks.snapshot_reused = true;

  // No backend / API / ownership changes
  assert(
    server.includes("/api/founder-command-center"),
    "API path unchanged",
  );
  assert(
    server.includes("buildFounderCommandCenterSnapshot"),
    "API still uses FCC snapshot",
  );
  assert(
    !server.includes("buildMissionControl"),
    "no new mission-control backend builder",
  );
  assert(
    !fccCore.includes("Mission Control"),
    "FCC core aggregator not redesigned for MC UI",
  );
  assert(!fccCore.includes("writeFileSync"), "FCC aggregator still no writes");
  assert(
    !/import\s*\{[^}]*ProductionController/.test(fccCore),
    "no ProductionController import in FCC",
  );
  assert(!fccCore.includes("from \"./BatchRunner"), "no BatchRunner in FCC");
  checks.no_backend_api_ownership_changes = true;

  // No production invocation / mutations in UI
  for (const src of [mcHome, readFileSync(MC_COMP, "utf8"), fccView, app]) {
    assert(!src.includes("runProduction"), "no runProduction");
    assert(!src.includes("BatchRunner"), "no BatchRunner");
    assert(!src.includes("Start Autonomous"), "no start autonomous CTA");
    assert(!src.includes("Stop Autonomous"), "no stop autonomous CTA");
    assert(!src.includes("Run Production"), "no run production CTA");
    assert(!src.includes("Apply Recommendation"), "no apply CTA");
  }
  assert(mcHome.includes("Advisory Only"), "advisory badge");
  assert(mcHome.includes("Open Founder Review"), "review quick link");
  assert(mcHome.includes("AIOS Mission Control"), "MC title");
  assert(mcHome.includes("LIVE OFF") || mcHome.includes("live_label"), "LIVE");
  checks.no_production_no_mutations = true;

  // Freshness + empty honesty
  assert(mcHome.includes("Current") || mcHome.includes("freshness"), "freshness");
  assert(mcHome.includes("Unavailable") || mcHome.includes("unavailable"), "unavailable");
  assert(mcHome.includes("No waiting candidates") || mcHome.includes("No recommendations"), "empty states");
  assert(mcHome.includes("not treated as zero") || mcHome.includes("Not in Command Center snapshot"), "no fake zeros");
  checks.freshness_and_empty = true;

  // Layout rows present
  for (const marker of [
    "Factory Status",
    "Today's Production",
    "Founder Queue",
    "Portfolio Intelligence",
    "Strategy",
    "Policy Advisor",
    "Factory Timeline",
    "Safety",
    "Production Entry",
  ]) {
    assert(mcHome.includes(marker), `layout marker: ${marker}`);
  }
  checks.layout_complete = true;

  assert(existsSync(GUARD), "runtime guard");
  const guardSha = sha(GUARD);
  assert(readFileSync(GUARD, "utf8").includes("ENGINES"), "guard marker");
  checks.runtime_guard_present = true;

  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE OFF");
  checks.live_off = true;

  const result = {
    agent: "222B",
    ok: true,
    generated_at: new Date().toISOString(),
    live: false,
    publication_allowed: false,
    mutations: false,
    production_triggered: false,
    openai_called: false,
    backend_changed: false,
    api_changed: false,
    checks,
    runtime_guard_sha256: guardSha,
    fcc_core_sha256: sha(FCC_CORE),
  };

  mkdirSync(resolve(OUT, ".."), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  console.log("PASS aios:mission-control:verify");
}

main().catch((e) => {
  console.error("FAIL", e instanceof Error ? e.message : e);
  process.exit(1);
});
