/**
 * GUARDED_ACTIVE dashboard recovery slice 1 — top-bar + Review ops badges.
 * Read-only. No OpenAI. No generation/revision. No env mutation.
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildResumeOperationalStatus } from "../core/first-production-cycle/ResumeOperationalStatus.js";
import { loadDashboardSnapshot } from "./src/data/loadSnapshot.js";

const DASH = resolve(import.meta.dirname);
const REPO = resolve(DASH, "../../..");
const LOG = join(REPO, "SOS/07_LOGS/saios/guarded-active-dashboard-slice1");
const APP = join(DASH, "src/App.tsx");
const REVIEW = join(DASH, "src/views/FounderReviewView.tsx");
const CARD = join(
  DASH,
  "src/design-system/components/RuntimeStatusCard.tsx",
);

function assert(cond: boolean, name: string, detail?: string): void {
  if (!cond) {
    throw new Error(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
  }
  console.log(`PASS ${name}`);
}

function main(): void {
  mkdirSync(LOG, { recursive: true });
  assert(process.env.SOS_AIOS_LIVE !== "1", "live_env_not_1");

  const appSrc = readFileSync(APP, "utf8");
  const reviewSrc = readFileSync(REVIEW, "utf8");
  const cardSrc = readFileSync(CARD, "utf8");

  // A — bounded OpenAI → provider not MOCK
  const bounded = buildResumeOperationalStatus({
    repoRoot: REPO,
    env: {
      ...process.env,
      SOS_AIOS_LIVE: "0",
      SOS_AI_FOUNDER_OPENAI_BOUNDED: "1",
      SOS_AIOS_REVISION_DISPATCHER: "1",
      SOS_AIOS_PUBLICATION_AUTO_APPLY: "0",
    },
  });
  assert(bounded.sos_aios_live === "0", "bounded_live_remains_0");
  assert(bounded.department_active === true, "bounded_department_active");
  assert(
    bounded.provider_label === "OPENAI BOUNDED",
    "bounded_provider_label",
    bounded.provider_label,
  );
  assert(
    !/MOCK/i.test(bounded.provider_label),
    "bounded_provider_not_mock",
  );

  // B — LIVE=0 does not mean inactive; UI must not hardcode LIVE OFF
  assert(
    !appSrc.includes('"LIVE OFF"') && !appSrc.includes("?? \"LIVE OFF\""),
    "app_no_live_off_fallback",
  );
  assert(!reviewSrc.includes("LIVE OFF"), "review_no_live_off_badge");
  assert(
    bounded.department_status === "ACTIVE",
    "department_active_while_live_0",
  );

  // C/D — cost: real string from ops; empty → Unavailable in UI helpers
  assert(
    typeof bounded.top_bar.cost_today_usd === "string",
    "cost_today_is_string",
  );
  assert(appSrc.includes("costTodayLabel"), "app_cost_helper");
  assert(
    appSrc.includes("Unavailable") && appSrc.includes("cost_today_usd"),
    "app_cost_unavailable_path",
  );
  assert(
    !appSrc.includes('"$0.00"') && !appSrc.includes("cost_today_usd: \"0.00\""),
    "app_no_hardcoded_zero_cost",
  );

  // E/F — freshness: no hb prefix; Unavailable when missing
  assert(!/\bhb\s/.test(appSrc) && !appSrc.includes("hb {"), "app_no_hb_prefix");
  assert(appSrc.includes("freshnessLabel"), "app_freshness_label");
  assert(cardSrc.includes("Freshness"), "card_freshness_label");
  assert(cardSrc.includes("Unavailable"), "card_unavailable_fallback");

  // G — publication manual/guarded not global dry_run in Review header
  assert(
    !reviewSrc.includes('const mode = "dry_run"'),
    "review_no_hardcoded_dry_run_mode",
  );
  assert(
    !reviewSrc.includes("dry run only"),
    "review_no_dry_run_only_subtitle",
  );
  assert(
    /publication_label|MANUAL\s*\/\s*GUARDED|MANUAL_GUARDED/i.test(reviewSrc),
    "review_publication_guarded_surfaced",
  );
  assert(
    bounded.publication_mode === "MANUAL_GUARDED",
    "ops_publication_manual_guarded",
  );
  assert(bounded.publication_auto_apply === false, "ops_auto_apply_off");

  // H — Review badges share top_bar truth with App
  assert(
    reviewSrc.includes("snapshot.top_bar.provider") &&
      reviewSrc.includes("snapshot.top_bar.mode") &&
      reviewSrc.includes("snapshot.top_bar.live_label"),
    "review_uses_top_bar",
  );
  assert(appSrc.includes("top_bar.provider"), "app_uses_top_bar_provider");

  // I — Review workflow actions unchanged
  assert(/Approve/i.test(reviewSrc), "review_approve_present");
  assert(/Request Changes/i.test(reviewSrc), "review_request_changes_present");
  assert(/Reject/i.test(reviewSrc), "review_reject_present");
  assert(
    reviewSrc.includes("/api/founder-decision") ||
      reviewSrc.includes("founder-decision"),
    "review_decision_api_present",
  );

  // Provider fallback when bounded disabled
  const unbound = buildResumeOperationalStatus({
    repoRoot: REPO,
    env: {
      SOS_AIOS_LIVE: "0",
      SOS_AI_FOUNDER_OPENAI_BOUNDED: "0",
      SOS_AI_FOUNDER_OPENAI_ONE_TEST: "0",
      SOS_AIOS_REVISION_DISPATCHER: "1",
      SOS_AIOS_PUBLICATION_AUTO_APPLY: "0",
    },
  });
  assert(
    unbound.provider_label === "MOCK",
    "unbounded_provider_mock",
    unbound.provider_label,
  );
  assert(unbound.department_active === true, "dispatcher_keeps_department_active");

  // Snapshot contract (process env may or may not have BOUNDED locally)
  const snap = loadDashboardSnapshot(REPO);
  assert(snap.top_bar.live === false || process.env.SOS_AIOS_LIVE === "1", "snap_live_false_when_off");
  assert(snap.top_bar.live === (process.env.SOS_AIOS_LIVE === "1"), "snap_live_matches_env");
  assert(!/^LIVE OFF$/i.test(snap.top_bar.live_label), "snap_live_label_not_live_off");
  assert(!/^dry_run$/i.test(snap.top_bar.mode), "snap_mode_not_dry_run");
  assert(
    typeof snap.top_bar.cost_today_usd === "string" &&
      snap.top_bar.cost_today_usd.length > 0,
    "snap_cost_present",
  );
  assert(
    /MANUAL/i.test(String(snap.top_bar.publication_label ?? "")),
    "snap_publication_manual",
  );
  assert(Boolean(snap.resume_ops), "snap_resume_ops_present");
  assert(
    !JSON.stringify(snap.top_bar).includes("runtime-heartbeat"),
    "snap_no_legacy_heartbeat_path",
  );

  const result = {
    generated_at: new Date().toISOString(),
    overall: "PASS",
    slice: 1,
    bounded_provider: bounded.provider_label,
    snap_provider: snap.top_bar.provider,
    snap_mode: snap.top_bar.mode,
    snap_cost: snap.top_bar.cost_today_usd,
    snap_freshness: snap.top_bar.heartbeat_age,
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
