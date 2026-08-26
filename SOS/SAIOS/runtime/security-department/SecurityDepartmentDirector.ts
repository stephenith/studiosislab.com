/**
 * Security Department Director — orchestrates read-only OS health checks.
 * AGENT #104 — never modifies business logic; never sends alerts.
 */
import { checkBackupHealth } from "./BackupHealthChecker.js";
import { checkDependencyHealth } from "./DependencyHealthChecker.js";
import { checkDiskHealth } from "./DiskHealthChecker.js";
import { checkEnvironment } from "./EnvironmentChecker.js";
import { checkFilesystemHealth } from "./FilesystemHealthChecker.js";
import { checkNodeHealth } from "./NodeHealthChecker.js";
import { checkProcessHealth } from "./ProcessHealthChecker.js";
import { checkReleaseSafety } from "./ReleaseSafetyChecker.js";
import { checkRuntimeSecurity } from "./RuntimeSecurityChecker.js";
import { buildSecurityAlerts } from "./SecurityAlertBuilder.js";
import {
  defaultSecurityConfiguration,
  persistSecurityConfiguration,
  SECURITY_DEPARTMENT_ROOT,
} from "./SecurityConfiguration.js";
import { writeSecurityReports } from "./SecurityReporter.js";
import { evaluateSecurityRisks } from "./SecurityRiskEngine.js";
import type {
  SecurityChecklistItem,
  SecurityDepartmentResult,
  SecurityFinding,
} from "./types.js";

export function runSecurityDepartment(): SecurityDepartmentResult {
  const generated_at = new Date().toISOString();
  const config = persistSecurityConfiguration(defaultSecurityConfiguration());

  const runtime = checkRuntimeSecurity(config);
  const filesystem = checkFilesystemHealth();
  const environment = checkEnvironment();
  const node = checkNodeHealth(config);
  const disk = checkDiskHealth(config);
  const processes = checkProcessHealth();
  const dependencies = checkDependencyHealth();
  const release = checkReleaseSafety();
  const backup = checkBackupHealth();

  const findings: SecurityFinding[] = [
    ...runtime.findings,
    ...filesystem.findings,
    ...environment.findings,
    ...node.findings,
    ...disk.findings,
    ...processes.findings,
    ...dependencies.findings,
    ...release.findings,
    ...backup.findings,
  ];

  const sources = [
    ...runtime.sources,
    ...filesystem.sources,
    ...environment.sources,
    ...processes.sources,
    ...dependencies.sources,
    ...release.sources,
    ...backup.sources,
  ];

  const checks = {
    runtime_security: runtime.pass,
    filesystem: filesystem.pass,
    environment: environment.pass,
    heartbeat: runtime.findings.some(
      (f) => f.id === "heartbeat-freshness" && f.pass,
    ),
    dependencies: dependencies.pass,
    publication_safety: release.pass,
    backup_metadata: backup.pass,
    report_generation: true,
    node: node.pass,
    disk: disk.pass,
    processes: processes.pass,
  };

  const checklist: SecurityChecklistItem[] = [
    {
      id: "runtime",
      label: "Runtime security",
      pass: checks.runtime_security,
      level: checks.runtime_security ? "GREEN" : "ORANGE",
      notes: "Runtime Manager health + state",
    },
    {
      id: "filesystem",
      label: "Filesystem",
      pass: checks.filesystem,
      level: checks.filesystem ? "GREEN" : "ORANGE",
      notes: "Required SOS folders readable",
    },
    {
      id: "environment",
      label: "Environment",
      pass: checks.environment,
      level: "GREEN",
      notes: "Placeholders / dry-run config",
    },
    {
      id: "heartbeat",
      label: "Heartbeat",
      pass: checks.heartbeat,
      level: checks.heartbeat ? "GREEN" : "RED",
      notes: "runtime-heartbeat.json",
    },
    {
      id: "dependencies",
      label: "Dependencies",
      pass: checks.dependencies,
      level: checks.dependencies ? "GREEN" : "RED",
      notes: "runtime-dependencies.json",
    },
    {
      id: "publication_safety",
      label: "Publication safety",
      pass: checks.publication_safety,
      level: checks.publication_safety ? "GREEN" : "ORANGE",
      notes: "Publication + catalog integrity",
    },
    {
      id: "backup_metadata",
      label: "Backup metadata",
      pass: checks.backup_metadata,
      level: checks.backup_metadata ? "GREEN" : "YELLOW",
      notes: "Rollback / backup markers",
    },
    {
      id: "report_generation",
      label: "Report generation",
      pass: true,
      level: "GREEN",
      notes: "security-* outputs",
    },
  ];

  const { security_level, status } = evaluateSecurityRisks(findings);
  const alerts = buildSecurityAlerts(findings, generated_at);

  const result: SecurityDepartmentResult = {
    generated_at,
    status,
    security_level,
    findings,
    alerts,
    checklist,
    sources,
    checks,
    output_dir: SECURITY_DEPARTMENT_ROOT,
  };

  writeSecurityReports(result);
  return result;
}

/** CLI entry */
if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runSecurityDepartment();
  console.log(
    JSON.stringify(
      {
        status: result.status,
        security_level: result.security_level,
        alerts: result.alerts.length,
        output_dir: result.output_dir,
      },
      null,
      2,
    ),
  );
}
