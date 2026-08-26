/**
 * Persist live-runtime reports.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { LiveRuntimeResult } from "./types.js";

export const LIVE_RUNTIME_ROOT = join(
  resolve(import.meta.dirname, "../../../.."),
  "SOS/07_LOGS/saios/live-runtime",
);

export function writeLiveRuntimeReports(result: LiveRuntimeResult): void {
  mkdirSync(LIVE_RUNTIME_ROOT, { recursive: true });

  writeFileSync(
    join(LIVE_RUNTIME_ROOT, "live-runtime.json"),
    JSON.stringify(
      {
        generated_at: result.generated_at,
        status: result.status,
        requested_mode: result.requested_mode,
        effective_mode: result.effective_mode,
        checks: result.checks,
        session_id: result.session.session_id,
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(LIVE_RUNTIME_ROOT, "runtime-mode.json"),
    JSON.stringify(
      {
        generated_at: result.generated_at,
        requested_mode: result.requested_mode,
        effective_mode: result.effective_mode,
        note: "LIVE requires SOS_AIOS_LIVE=1 and FounderRuntimeGate approval. Verify never enables LIVE.",
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(LIVE_RUNTIME_ROOT, "runtime-session.json"),
    JSON.stringify(result.session, null, 2),
  );

  writeFileSync(
    join(LIVE_RUNTIME_ROOT, "runtime-gate.json"),
    JSON.stringify(result.gate, null, 2),
  );

  writeFileSync(
    join(LIVE_RUNTIME_ROOT, "runtime-continuity.json"),
    JSON.stringify(
      {
        generated_at: result.generated_at,
        steps: result.continuity,
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(LIVE_RUNTIME_ROOT, "runtime-caps.json"),
    JSON.stringify(result.caps, null, 2),
  );

  const report = [
    `# Live Runtime Report`,
    ``,
    `AI OS Safe Live Mode & Continuity — Agent #111.`,
    `Not VPS. Not Docker. Continuity orchestration only.`,
    ``,
    `## Overall`,
    ``,
    `| Field | Value |`,
    `|---|---|`,
    `| Status | ${result.status} |`,
    `| Requested mode | ${result.requested_mode} |`,
    `| Effective mode | ${result.effective_mode} |`,
    `| Session | ${result.session.session_id} |`,
    `| Cycles | ${result.session.cycles_completed} |`,
    `| Gate approved | ${result.gate.approved} |`,
    `| Live flag | ${result.gate.live_flag} |`,
    ``,
    `## Checks`,
    ``,
    ...Object.entries(result.checks).map(
      ([k, v]) => `- ${k}: ${v ? "PASS" : "FAIL"}`,
    ),
    ``,
    `## Founder Gate`,
    ``,
    `- Reason: ${result.gate.reason}`,
    ...result.gate.checks.map(
      (c) => `- [${c.pass ? "x" : " "}] ${c.label} — ${c.detail}`,
    ),
    ``,
    `## Continuity`,
    ``,
    ...result.continuity.map(
      (s) => `${s.step}. ${s.ok ? "✔" : "✘"} **${s.name}** — ${s.detail}`,
    ),
    ``,
    `## Caps`,
    ``,
    ...Object.entries(result.caps).map(([k, v]) => `- ${k}: ${v}`),
    ``,
  ].join("\n");

  writeFileSync(join(LIVE_RUNTIME_ROOT, "live-runtime-report.md"), report);
}
