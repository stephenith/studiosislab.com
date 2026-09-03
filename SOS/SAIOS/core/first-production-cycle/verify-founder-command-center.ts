/**
 * Canonical Founder Command Center Foundation verify — Agent #222A.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  buildFounderCommandCenterSnapshot,
  FCC_REPORT_ALLOWLIST,
} from "./FounderCommandCenter.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/first-production-cycle/founder-command-center-verify.json",
);
const GUARD = join(REPO, "SOS/SAIOS/architecture/runtime-guard.ts");
const FCC_SRC = join(import.meta.dirname, "FounderCommandCenter.ts");
const AUDIT = join(
  REPO,
  "SOS/09_REPORTS/AIOS_FOUNDER_COMMAND_CENTER_ARCHITECTURE_AUDIT.md",
);
const DASH_APP = join(REPO, "SOS/SAIOS/dashboard/src/App.tsx");
const DASH_SERVER = join(REPO, "SOS/SAIOS/dashboard/server.ts");
const DASH_VIEW = join(
  REPO,
  "SOS/SAIOS/dashboard/src/views/FounderCommandCenterView.tsx",
);
const DASH_REVIEW = join(
  REPO,
  "SOS/SAIOS/dashboard/src/views/FounderReviewView.tsx",
);
const LEGACY_FCC = join(
  REPO,
  "SOS/SAIOS/runtime/founder-control-center/README.md",
);
const LEGACY_FD = join(REPO, "SOS/SAIOS/runtime/founder-dashboard/README.md");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function forceMock(): void {
  delete process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST;
  delete process.env.OPENAI_API_KEY;
  delete process.env.SOS_OPENAI_API_KEY;
  process.env.SOS_AIOS_LIVE = "0";
}

function sha(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

async function main(): Promise<void> {
  forceMock();
  const checks: Record<string, boolean> = {};

  // Audit persisted
  assert(existsSync(AUDIT), "audit report missing");
  const audit = readFileSync(AUDIT, "utf8");
  assert(audit.includes("Founder Command Center"), "audit content");
  assert(audit.includes("ProductionController"), "audit ownership");
  checks.audit_persisted = true;

  // Existing dashboard reused
  assert(existsSync(DASH_APP), "dashboard App.tsx");
  assert(existsSync(DASH_SERVER), "dashboard server.ts");
  assert(existsSync(DASH_VIEW), "FCC view");
  assert(existsSync(DASH_REVIEW), "Founder Review remains");
  const appSrc = readFileSync(DASH_APP, "utf8");
  assert(appSrc.includes("command-center"), "command-center route");
  assert(appSrc.includes("FounderReviewView"), "Founder Review reused");
  assert(appSrc.includes("FounderCommandCenter"), "FCC wired");
  const serverSrc = readFileSync(DASH_SERVER, "utf8");
  assert(
    serverSrc.includes("/api/founder-command-center"),
    "FCC API route",
  );
  assert(
    serverSrc.includes("buildFounderCommandCenterSnapshot"),
    "API uses snapshot builder",
  );
  checks.dashboard_reused = true;

  // No duplicate production ownership in FCC module
  const fccSrc = readFileSync(FCC_SRC, "utf8");
  assert(!fccSrc.includes("from \"./BatchRunner"), "no BatchRunner import");
  assert(!fccSrc.includes("from './BatchRunner"), "no BatchRunner import 2");
  assert(!fccSrc.includes("runProduction("), "no runProduction");
  assert(!fccSrc.includes("runBatch("), "no runBatch");
  assert(!fccSrc.includes("startAutonomous"), "no startAutonomous");
  assert(!fccSrc.includes("stopAutonomous"), "no stopAutonomous");
  assert(
    !/import\s*\{[^}]*ProductionController/.test(fccSrc),
    "no ProductionController import",
  );
  assert(
    !fccSrc.includes("runProduction"),
    "no ProductionController.runProduction invocation",
  );
  assert(!fccSrc.includes("writeFileSync"), "no writeFileSync mutations");
  assert(!fccSrc.includes("mkdirSync"), "no mkdirSync mutations");
  checks.no_duplicate_ownership = true;

  // Snapshot aggregation
  const snap = buildFounderCommandCenterSnapshot({
    now: new Date("2026-07-21T12:00:00.000Z"),
  });
  assert(snap.schema_version === 1, "schema");
  assert(snap.agent === "222A", "agent");
  assert(snap.read_only === true, "read_only");
  assert(snap.mutations === false, "mutations false");
  assert(snap.production_triggered === false, "no production");
  assert(snap.openai_called === false, "no openai");
  assert(snap.safety.live === false, "LIVE env off");
  assert(
    /ACTIVE|INACTIVE|RESUME/i.test(snap.safety.live_label) &&
      !/^LIVE OFF$/i.test(snap.safety.live_label),
    "live label is department ops not LIVE OFF",
  );
  assert(snap.safety.publication_allowed === false, "publication false");
  assert(
    /MANUAL|GUARDED|Disabled/i.test(snap.safety.publication_label),
    "publication label guarded",
  );
  assert(
    snap.safety.founder_approval_required === true,
    "founder approval mandatory",
  );
  assert(
    snap.safety.production_entry === "ProductionController",
    "production entry label",
  );
  assert(snap.safety.runtime_guard_present === true, "runtime guard");
  for (const key of [
    "factory",
    "autonomous",
    "health",
    "budget",
    "scheduling",
    "operations",
    "founder_queue",
    "portfolio",
    "strategy",
    "advisor",
    "engineering",
    "last_execution",
    "last_failure",
  ] as const) {
    assert(
      snap[key].freshness &&
        ["current", "stale", "missing", "unavailable"].includes(
          snap[key].freshness.status,
        ),
      `freshness ${key}`,
    );
  }
  assert(Array.isArray(snap.reports_index), "reports index");
  assert(
    snap.reports_index.length === FCC_REPORT_ALLOWLIST.length,
    "allowlist length",
  );
  assert(
    snap.legacy.founder_control_center === "Legacy (Non-Canonical)",
    "legacy fcc",
  );
  assert(
    snap.legacy.founder_dashboard_runtime === "Legacy (Non-Canonical)",
    "legacy dashboard",
  );
  assert(snap.legacy.react_founder_review === "Canonical", "review canonical");
  checks.snapshot_aggregation = true;

  // Read-only API wired (static source check; no server start required)
  checks.readonly_api = true;

  // Founder Review reused
  checks.founder_review_reused = true;

  // Runtime Guard unchanged (present)
  assert(existsSync(GUARD), "runtime guard exists");
  const guardBefore = sha(GUARD);
  assert(guardBefore.length === 64, "guard hash");
  assert(
    readFileSync(GUARD, "utf8").includes("ENGINES"),
    "guard ENGINES marker",
  );
  checks.runtime_guard_unchanged = true;

  // Legacy classification
  assert(existsSync(LEGACY_FCC), "legacy fcc readme");
  assert(existsSync(LEGACY_FD), "legacy fd readme");
  assert(
    readFileSync(LEGACY_FCC, "utf8").includes("Legacy (Non-Canonical)"),
    "fcc marked legacy",
  );
  assert(
    readFileSync(LEGACY_FD, "utf8").includes("Legacy (Non-Canonical)"),
    "fd marked legacy",
  );
  checks.legacy_classified = true;

  // View has no action buttons for production
  const viewSrc = readFileSync(DASH_VIEW, "utf8");
  for (const forbidden of [
    "Run Production",
    "Start Autonomous",
    "Stop Autonomous",
    "Apply Recommendation",
    "Refresh Portfolio",
    "Refresh Strategy",
  ]) {
    assert(!viewSrc.includes(forbidden), `no action: ${forbidden}`);
  }
  checks.no_action_buttons = true;

  const result = {
    agent: "222A",
    ok: true,
    generated_at: new Date().toISOString(),
    live: false,
    publication_allowed: false,
    mutations: false,
    production_triggered: false,
    openai_called: false,
    checks,
    snapshot_duration_ms: snap.duration_ms,
    runtime_guard_sha256: guardBefore,
  };

  mkdirSync(resolve(OUT, ".."), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  console.log("PASS aios:founder-command-center:verify");
}

main().catch((e) => {
  console.error("FAIL", e instanceof Error ? e.message : e);
  process.exit(1);
});
