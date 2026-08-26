/**
 * Publication / release safety (read-only log inspection).
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./SecurityConfiguration.js";
import { readJsonSafe, sourceEntry } from "./security-utils.js";
import type { SecurityFinding } from "./types.js";

export function checkReleaseSafety(): {
  findings: SecurityFinding[];
  sources: ReturnType<typeof sourceEntry>[];
  pass: boolean;
} {
  const pubDir = join(REPO_ROOT, "SOS/07_LOGS/saios/publication");
  const catDir = join(REPO_ROOT, "SOS/07_LOGS/saios/catalog-integrity");
  const dashPath = join(
    REPO_ROOT,
    "SOS/07_LOGS/saios/production-dashboard/dashboard.json",
  );
  const sources = [
    sourceEntry("publication", pubDir),
    sourceEntry("catalog-integrity", catDir),
    sourceEntry("production-dashboard", dashPath),
  ];
  const findings: SecurityFinding[] = [];

  findings.push({
    id: "publication-dir",
    area: "release_safety",
    level: existsSync(pubDir) ? "GREEN" : "ORANGE",
    title: existsSync(pubDir) ? "Publication log directory present" : "Publication logs missing",
    detail: pubDir,
    source: "publication",
    pass: existsSync(pubDir),
  });

  if (existsSync(pubDir)) {
    const files = readdirSync(pubDir);
    const broken = files.filter((f) => /fail|error|broken/i.test(f));
    findings.push({
      id: "publication-broken-reports",
      area: "release_safety",
      level: broken.length ? "YELLOW" : "GREEN",
      title: broken.length
        ? `${broken.length} publication files look failure-related`
        : "No obvious broken publication reports by filename",
      detail: broken.slice(0, 5).join(", ") || "none",
      source: "publication",
      pass: true,
    });
  }

  const catalogLatest = existsSync(catDir)
    ? readdirSync(catDir).find((f) => f.includes("integrity") && f.endsWith(".json"))
    : null;
  if (catalogLatest) {
    const report = readJsonSafe<{ status?: string; conflicts?: unknown[] }>(
      join(catDir, catalogLatest),
    );
    const conflicts = Array.isArray(report.data?.conflicts)
      ? report.data!.conflicts!.length
      : 0;
    findings.push({
      id: "catalog-integrity",
      area: "release_safety",
      level: conflicts > 0 ? "YELLOW" : "GREEN",
      title:
        conflicts > 0
          ? `Catalog integrity reports ${conflicts} conflict(s)`
          : "Catalog integrity report present",
      detail: catalogLatest,
      source: "catalog-integrity",
      pass: true,
    });
  } else {
    findings.push({
      id: "catalog-integrity-missing",
      area: "release_safety",
      level: "YELLOW",
      title: "Catalog integrity JSON not found",
      detail: catDir,
      source: "catalog-integrity",
      pass: true,
    });
  }

  findings.push({
    id: "dashboard-summary",
    area: "release_safety",
    level: existsSync(dashPath) ? "GREEN" : "YELLOW",
    title: existsSync(dashPath)
      ? "Production dashboard present"
      : "Production dashboard missing",
    detail: dashPath,
    source: "production-dashboard",
    pass: true,
  });

  return {
    findings,
    sources,
    pass: findings.every((f) => f.pass || f.level === "YELLOW"),
  };
}
