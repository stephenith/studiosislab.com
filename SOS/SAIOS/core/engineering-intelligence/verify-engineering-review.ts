/**
 * Founder Engineering Review verify — Agent #224.
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
} from "./EngineeringIntelligence.js";
import {
  FOUNDER_ENG_REVIEW_STATUS_PATH,
  loadEngineeringReviewProjection,
  updateFounderEngReviewStatus,
} from "./FounderEngineeringReviewOverlay.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/engineering-intelligence/engineering-review-verify.json",
);
const GUARD = join(REPO, "SOS/SAIOS/architecture/runtime-guard.ts");
const EI_SRC = join(import.meta.dirname, "EngineeringIntelligence.ts");
const OVERLAY = join(import.meta.dirname, "FounderEngineeringReviewOverlay.ts");
const MC = join(
  REPO,
  "SOS/SAIOS/dashboard/src/views/mission-control/MissionControlHome.tsx",
);
const PANEL = join(
  REPO,
  "SOS/SAIOS/dashboard/src/views/mission-control/EngineeringReviewPanel.tsx",
);
const SERVER = join(REPO, "SOS/SAIOS/dashboard/server.ts");
const PC = join(
  REPO,
  "SOS/SAIOS/core/first-production-cycle/ProductionController.ts",
);

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function sha(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

async function main(): Promise<void> {
  process.env.SOS_AIOS_LIVE = "0";
  const checks: Record<string, boolean> = {};

  const guardBefore = sha(GUARD);
  const eiBefore = sha(EI_SRC);
  const pcBefore = sha(PC);

  assert(existsSync(ENGINEERING_REPORT_PATH), "engineering report loads");
  const reportBefore = sha(ENGINEERING_REPORT_PATH);
  checks.existing_report_loads = true;

  assert(existsSync(OVERLAY), "overlay module");
  assert(existsSync(PANEL), "review panel");
  assert(existsSync(MC), "mission control");
  const overlaySrc = readFileSync(OVERLAY, "utf8");
  assert(!overlaySrc.includes("buildEngineeringIntelligenceReport"), "no regen");
  assert(!overlaySrc.includes("BatchRunner"), "no BatchRunner");
  assert(!overlaySrc.includes("runProduction"), "no runProduction");
  assert(overlaySrc.includes("founder-review-statuses.json"), "status store only");
  assert(!overlaySrc.includes("EngineeringReviewEngine"), "no review engine");
  assert(!overlaySrc.includes("RecommendationGenerator"), "no generator");
  checks.no_duplicate_engine = true;

  const proj = loadEngineeringReviewProjection({ repoRoot: REPO });
  assert(proj.duplicate_engine === false, "duplicate_engine false");
  assert(proj.duplicate_storage === false, "duplicate_storage false");
  assert(proj.execution_triggered === false, "no execution");
  assert(proj.code_modified === false, "no code mod");
  assert(proj.cleanup_triggered === false, "no cleanup");
  assert(proj.live === false, "LIVE off");
  assert(proj.publication_allowed === false, "publication false");
  assert(proj.founder_approval_required === true, "founder approval");
  assert(Array.isArray(proj.recommendations), "recs from report");
  assert(proj.recommendations.length > 0, "has recommendations");
  checks.projection_ok = true;

  const id = proj.recommendations[0]!.recommendation_id;
  const updated = updateFounderEngReviewStatus({
    recommendation_id: id,
    status: "UNDER_REVIEW",
    repoRoot: REPO,
  });
  assert(updated.execution_triggered === false, "status update no execute");
  assert(updated.code_modified === false, "status update no code");
  assert(updated.cleanup_triggered === false, "status update no cleanup");
  assert(existsSync(FOUNDER_ENG_REVIEW_STATUS_PATH), "status file");
  assert(sha(ENGINEERING_REPORT_PATH) === reportBefore, "report unchanged");
  assert(sha(EI_SRC) === eiBefore, "Engineering Intelligence unchanged");
  assert(sha(PC) === pcBefore, "ProductionController unchanged");
  checks.status_no_execution = true;

  const proj2 = loadEngineeringReviewProjection({ repoRoot: REPO });
  const item = proj2.recommendations.find((r) => r.recommendation_id === id);
  assert(item?.founder_status === "UNDER_REVIEW", "status overlay applied");
  assert(proj2.counts.under_review >= 1, "under_review count");

  // restore OPEN for cleanliness
  updateFounderEngReviewStatus({
    recommendation_id: id,
    status: "OPEN",
    repoRoot: REPO,
  });

  const mc = readFileSync(MC, "utf8");
  assert(mc.includes("EngineeringReviewPanel"), "MC wires panel");
  assert(mc.includes("AIOS Mission Control") || mc.includes("Mission Control"), "MC preserved");
  const panel = readFileSync(PANEL, "utf8");
  assert(panel.includes("Engineering Review"), "panel title");
  assert(panel.includes("Open Recommendations"), "open count");
  assert(panel.includes("UNDER_REVIEW"), "under review");
  assert(panel.includes("Approved") || panel.includes("APPROVED"), "approved");
  assert(panel.includes("filter") || panel.includes("Category"), "filters");
  assert(panel.includes("Severity"), "severity filter");
  assert(panel.includes("estimated_benefit") || panel.includes("Estimated Benefit"), "sort benefit");
  assert(!panel.includes("Run Cleanup"), "no cleanup CTA");
  assert(!panel.includes("Refactor"), "no refactor CTA");

  const server = readFileSync(SERVER, "utf8");
  assert(server.includes("/api/engineering-review"), "GET review API");
  assert(server.includes("/api/engineering-review-status"), "POST status API");
  assert(server.includes("execution/cleanup/publish controls forbidden"), "forbid execute");
  checks.mission_control_integration = true;

  assert(sha(GUARD) === guardBefore, "Runtime Guard unchanged");
  checks.runtime_guard_unchanged = true;
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE OFF");
  checks.live_off = true;

  const result = {
    agent: "224",
    ok: true,
    generated_at: new Date().toISOString(),
    live: false,
    publication_allowed: false,
    execution_triggered: false,
    code_modified: false,
    cleanup_triggered: false,
    openai_called: false,
    checks,
    runtime_guard_sha256: guardBefore,
    engineering_intelligence_sha256: eiBefore,
  };

  mkdirSync(resolve(OUT, ".."), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  console.log("PASS aios:engineering-review:verify");
}

main().catch((e) => {
  console.error("FAIL", e instanceof Error ? e.message : e);
  process.exit(1);
});
