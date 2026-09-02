/**
 * Phase 5V — revision runtime code currency check.
 *
 * Proves git HEAD alignment and that aios-founder-dashboard was restarted
 * after the current HEAD commit when systemd is available.
 *
 * If loaded module identity cannot be proven, fail closed requiring restart.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/ops/verify-revision-runtime-code-current.json",
);

function sh(cmd: string): string {
  try {
    return execSync(cmd, {
      cwd: REPO,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (e) {
    const err = e as { stderr?: Buffer; message?: string };
    return `ERROR:${err.stderr?.toString?.() || err.message || String(e)}`;
  }
}

function parseSystemdTimestamp(raw: string): number | null {
  // e.g. ActiveEnterTimestamp=Wed 2026-09-02 07:59:58 UTC
  const m = raw.match(/^ActiveEnterTimestamp=(.+)$/i);
  if (!m || !m[1] || /n\/a/i.test(m[1])) return null;
  const t = Date.parse(m[1].trim());
  return Number.isFinite(t) ? t : null;
}

function main(): void {
  const localHead = sh("git rev-parse HEAD");
  const originMain = sh("git rev-parse origin/main 2>/dev/null || true");
  const headCommitterUnix = Number(
    sh("git log -1 --format=%ct HEAD") || "NaN",
  );
  const headSubject = sh("git log -1 --format=%s HEAD");

  let serviceActiveEnter: string | null = null;
  let serviceMainPid: string | null = null;
  let serviceActiveState: string | null = null;
  let activeEnterMs: number | null = null;
  let systemdAvailable = false;

  const show = sh(
    "systemctl show aios-founder-dashboard.service -p ActiveEnterTimestamp -p MainPID -p ActiveState --no-pager 2>/dev/null",
  );
  if (
    !show.startsWith("ERROR:") &&
    /ActiveState=/.test(show) &&
    !/ActiveState=$/m.test(show)
  ) {
    systemdAvailable = true;
    for (const line of show.split("\n")) {
      if (line.startsWith("ActiveEnterTimestamp=")) {
        serviceActiveEnter = line.slice("ActiveEnterTimestamp=".length);
        activeEnterMs = parseSystemdTimestamp(line);
      }
      if (line.startsWith("MainPID=")) serviceMainPid = line.slice(8);
      if (line.startsWith("ActiveState=")) {
        serviceActiveState = line.slice("ActiveState=".length);
      }
    }
    // Unit unknown / not installed → treat as local-only.
    if (
      !serviceActiveState ||
      serviceActiveState === "inactive" ||
      serviceActiveState === "failed" ||
      serviceActiveState === "unknown"
    ) {
      // Still available if active or activating; otherwise local-only.
      if (serviceActiveState !== "active" && serviceActiveState !== "activating" && serviceActiveState !== "reloading") {
        systemdAvailable = false;
      }
    }
  }

  // Prefer explicit unit file presence on Linux hosts.
  if (
    !systemdAvailable &&
    (existsSync("/etc/systemd/system/aios-founder-dashboard.service") ||
      existsSync("/lib/systemd/system/aios-founder-dashboard.service"))
  ) {
    // Unit file exists but show failed — fail closed on VPS-like hosts.
    systemdAvailable = true;
  }

  const headsMatch =
    !originMain.startsWith("ERROR") &&
    originMain.length === 40 &&
    localHead === originMain;

  let revisionRuntimeCodeCurrent = false;
  let reason = "";

  if (localHead.startsWith("ERROR") || localHead.length !== 40) {
    reason = "cannot_resolve_git_head";
  } else if (systemdAvailable) {
    if (!Number.isFinite(headCommitterUnix)) {
      reason = "cannot_resolve_head_committer_time";
    } else if (activeEnterMs == null) {
      reason =
        "cannot_prove_dashboard_active_enter — runtime restart required after deploy";
    } else if (activeEnterMs + 5000 < headCommitterUnix * 1000) {
      // Service last entered active before HEAD was committed → stale modules likely.
      reason =
        "dashboard ActiveEnter precedes HEAD committer time — restart aios-founder-dashboard after deploy";
      revisionRuntimeCodeCurrent = false;
    } else if (!headsMatch && originMain.length === 40) {
      reason = "HEAD != origin/main";
    } else {
      revisionRuntimeCodeCurrent = true;
      reason =
        "HEAD resolved; dashboard ActiveEnter is at/after HEAD committer time";
    }
  } else {
    // Local/dev without systemd: cannot prove loaded process identity.
    reason =
      "systemd dashboard service not available here — cannot claim REVISION_RUNTIME_CODE_CURRENT=YES without process proof; treat as local-only check";
    revisionRuntimeCodeCurrent = false;
  }

  const report = {
    schema_version: "verify-revision-runtime-code-current-1.0.0",
    ok: revisionRuntimeCodeCurrent,
    REVISION_RUNTIME_CODE_CURRENT: revisionRuntimeCodeCurrent ? "YES" : "NO",
    reason,
    local_head: localHead,
    origin_main: originMain || null,
    heads_match: headsMatch,
    head_subject: headSubject,
    head_committer_unix: Number.isFinite(headCommitterUnix)
      ? headCommitterUnix
      : null,
    systemd_available: systemdAvailable,
    service_active_state: serviceActiveState,
    service_active_enter: serviceActiveEnter,
    service_active_enter_ms: activeEnterMs,
    service_main_pid: serviceMainPid,
    operational_rule:
      "revision module deployment → ff merge → verifier suites → restart aios-founder-dashboard → health checks → only then fresh production Request Changes",
    loaded_commit_introspected: false,
    note: "Node does not expose loaded commit SHA; ActiveEnter vs HEAD committer time is the fail-closed proxy.",
  };

  mkdirSync(join(REPO, "SOS/07_LOGS/saios/ops"), { recursive: true });
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        REVISION_RUNTIME_CODE_CURRENT: report.REVISION_RUNTIME_CODE_CURRENT,
        reason: report.reason,
        local_head: report.local_head,
        origin_main: report.origin_main,
      },
      null,
      2,
    ),
  );
  // Non-zero only when systemd is present and check fails (VPS gate).
  if (systemdAvailable && !revisionRuntimeCodeCurrent) {
    process.exit(1);
  }
}

main();
