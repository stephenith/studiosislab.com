/**
 * Persist security reports (JSON + markdown).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SECURITY_DEPARTMENT_ROOT } from "./SecurityConfiguration.js";
import type {
  SecurityAlert,
  SecurityChecklistItem,
  SecurityDepartmentResult,
  SecurityFinding,
} from "./types.js";

export function writeSecurityReports(result: SecurityDepartmentResult): void {
  mkdirSync(SECURITY_DEPARTMENT_ROOT, { recursive: true });

  const health = {
    generated_at: result.generated_at,
    status: result.status,
    security_level: result.security_level,
    checks: result.checks,
    sources: result.sources,
    finding_count: result.findings.length,
    alert_count: result.alerts.length,
  };

  writeFileSync(
    join(SECURITY_DEPARTMENT_ROOT, "security-health.json"),
    JSON.stringify(health, null, 2),
  );
  writeFileSync(
    join(SECURITY_DEPARTMENT_ROOT, "security-risks.json"),
    JSON.stringify(
      {
        generated_at: result.generated_at,
        security_level: result.security_level,
        risks: result.findings.filter(
          (f) => f.level !== "GREEN" || !f.pass,
        ) as SecurityFinding[],
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(SECURITY_DEPARTMENT_ROOT, "security-alerts.json"),
    JSON.stringify(
      {
        generated_at: result.generated_at,
        note: "Alerts are payloads only — Notification Department consumes later. Do not send.",
        alerts: result.alerts as SecurityAlert[],
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(SECURITY_DEPARTMENT_ROOT, "security-checklist.json"),
    JSON.stringify(
      {
        generated_at: result.generated_at,
        checklist: result.checklist as SecurityChecklistItem[],
      },
      null,
      2,
    ),
  );

  const summary = [
    `# Security Department Summary`,
    ``,
    `- Generated: ${result.generated_at}`,
    `- Status: **${result.status}**`,
    `- Security level: **${result.security_level}**`,
    `- Findings: ${result.findings.length}`,
    `- Alerts (not sent): ${result.alerts.length}`,
    ``,
    `## Checks`,
    ...Object.entries(result.checks).map(([k, v]) => `- ${k}: ${v ? "PASS" : "FAIL"}`),
    ``,
    `## Top risks`,
    ...result.findings
      .filter((f) => f.level !== "GREEN")
      .slice(0, 12)
      .map((f) => `- [${f.level}] ${f.title}`),
    ``,
  ].join("\n");

  const report = [
    `# Security Department Report`,
    ``,
    `Operational health & protection for the AI Operating System.`,
    `This department does not modify business logic.`,
    ``,
    `## Overall`,
    ``,
    `| Field | Value |`,
    `|---|---|`,
    `| Status | ${result.status} |`,
    `| Level | ${result.security_level} |`,
    `| Generated | ${result.generated_at} |`,
    `| Alerts | ${result.alerts.length} (channel_ready=false) |`,
    ``,
    `## Findings`,
    ``,
    ...result.findings.map(
      (f) =>
        `### ${f.id}\n- Level: ${f.level}\n- Area: ${f.area}\n- Pass: ${f.pass}\n- ${f.title}\n- ${f.detail}\n`,
    ),
    `## Checklist`,
    ``,
    ...result.checklist.map(
      (c) => `- [${c.pass ? "x" : " "}] ${c.label} (${c.level}) — ${c.notes}`,
    ),
    ``,
  ].join("\n");

  writeFileSync(join(SECURITY_DEPARTMENT_ROOT, "security-summary.md"), summary);
  writeFileSync(join(SECURITY_DEPARTMENT_ROOT, "security-report.md"), report);
}
