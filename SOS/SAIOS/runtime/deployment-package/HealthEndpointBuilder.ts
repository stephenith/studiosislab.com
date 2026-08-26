/**
 * Health endpoint specification only — no HTTP server changes.
 */
import type { HealthSurface } from "./types.js";

export function healthSurfaces(): HealthSurface[] {
  return [
    {
      id: "runtime",
      label: "Runtime Loop",
      source: "SOS/07_LOGS/saios/runtime-loop/runtime-loop.json",
      expected: "status=READY",
    },
    {
      id: "supervisor",
      label: "Runtime Supervisor",
      source: "SOS/07_LOGS/saios/runtime-supervisor/supervisor-health.json",
      expected: "status=READY",
    },
    {
      id: "heartbeat",
      label: "Heartbeat",
      source: "SOS/07_LOGS/saios/runtime-loop/runtime-heartbeat.json",
      expected: "heartbeat_at fresh",
    },
    {
      id: "website",
      label: "Website",
      source: "SOS/07_LOGS/saios/website-department/website-health.json",
      expected: "status=HEALTHY",
    },
    {
      id: "security",
      label: "Security",
      source: "SOS/07_LOGS/saios/security-department/security-health.json",
      expected: "security_level!=RED",
    },
    {
      id: "timeline",
      label: "Timeline",
      source: "SOS/07_LOGS/saios/timeline-department/timeline-state.json",
      expected: "sprint present",
    },
    {
      id: "notifications",
      label: "Notifications",
      source: "SOS/07_LOGS/saios/notification-department/notification-report.md",
      expected: "report present",
    },
    {
      id: "resume_factory",
      label: "Resume Factory",
      source: "SOS/project-state.json",
      expected: "factory_v1.status=STABLE",
    },
    {
      id: "founder_control_center",
      label: "Founder Control Center",
      source: "SOS/07_LOGS/saios/founder-control-center/founder-control-center.json",
      expected: "status=READY",
    },
    {
      id: "overall",
      label: "Overall health",
      source: "aggregate of above",
      expected: "READY when critical surfaces pass",
    },
  ];
}

export function buildHealthcheckJs(): string {
  return `#!/usr/bin/env node
/**
 * AI OS healthcheck — Agent #112
 * Spec-driven file probe. No HTTP server. Exit 0 = healthy.
 */
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const surfaces = [
  ["runtime", "SOS/07_LOGS/saios/runtime-loop/runtime-loop.json", (d) => d.status === "READY"],
  ["supervisor", "SOS/07_LOGS/saios/runtime-supervisor/supervisor-health.json", (d) => d.status === "READY"],
  ["website", "SOS/07_LOGS/saios/website-department/website-health.json", (d) => d.status === "HEALTHY"],
  ["security", "SOS/07_LOGS/saios/security-department/security-health.json", (d) => {
    const level = String(d.security_level || "").toUpperCase();
    return level !== "RED" && level !== "CRITICAL";
  }],
  ["factory", "SOS/project-state.json", (d) => d.factory_v1 && d.factory_v1.status === "STABLE"],
];

const report = { ok: true, surfaces: {}, overall: "HEALTHY" };

for (const [id, rel, check] of surfaces) {
  const full = path.join(root, rel);
  try {
    const data = JSON.parse(fs.readFileSync(full, "utf8"));
    const pass = check(data);
    report.surfaces[id] = pass ? "ok" : "fail";
    if (!pass) report.ok = false;
  } catch (e) {
    report.surfaces[id] = "missing";
    report.ok = false;
  }
}

report.overall = report.ok ? "HEALTHY" : "DEGRADED";
process.stdout.write(JSON.stringify(report) + "\\n");
process.exit(report.ok ? 0 : 1);
`;
}

export function buildHealthSpecMd(): string {
  const tick = "`";
  const rows = healthSurfaces()
    .map(
      (s) =>
        `| ${s.label} | ${tick}${s.source}${tick} | ${s.expected} |`,
    )
    .join("\n");
  return [
    `# AI OS Health Endpoint Specification`,
    ``,
    `Agent #112 — specification only. No HTTP server changes.`,
    ``,
    `## Proposed route (future)`,
    ``,
    `${tick}GET /api/aios/health${tick}`,
    ``,
    `## Surfaces`,
    ``,
    `| Surface | Source | Expected |`,
    `|---|---|---|`,
    rows,
    ``,
    `## Probe`,
    ``,
    `Use ${tick}healthcheck.js${tick} for container/PM2 health probes (file-based).`,
    ``,
  ].join("\n");
}
