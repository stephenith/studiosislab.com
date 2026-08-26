/**
 * Filesystem / folder structure health.
 */
import { accessSync, constants, existsSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./SecurityConfiguration.js";
import { sourceEntry } from "./security-utils.js";
import type { SecurityFinding } from "./types.js";

const REQUIRED_FOLDERS = [
  "SOS",
  "SOS/SAIOS/runtime",
  "SOS/07_LOGS/saios",
  "SOS/07_LOGS/saios/runtime-manager",
  "SOS/07_LOGS/saios/production-dashboard",
  "SOS/07_LOGS/saios/timeline-department",
  "SOS/07_LOGS/saios/notification-department",
  "SOS/07_LOGS/saios/website-department",
  "SOS/07_LOGS/saios/catalog-integrity",
  "SOS/07_LOGS/saios/publication",
];

export function checkFilesystemHealth(): {
  findings: SecurityFinding[];
  sources: ReturnType<typeof sourceEntry>[];
  pass: boolean;
} {
  const findings: SecurityFinding[] = [];
  const sources = REQUIRED_FOLDERS.map((rel) =>
    sourceEntry(rel, join(REPO_ROOT, rel)),
  );

  for (const rel of REQUIRED_FOLDERS) {
    const path = join(REPO_ROOT, rel);
    if (!existsSync(path)) {
      findings.push({
        id: `fs-missing-${rel.replace(/[\\/]/g, "-")}`,
        area: "filesystem",
        level: "ORANGE",
        title: `Missing runtime folder: ${rel}`,
        detail: path,
        source: "filesystem",
        pass: false,
      });
      continue;
    }
    try {
      accessSync(path, constants.R_OK);
      findings.push({
        id: `fs-ok-${rel.replace(/[\\/]/g, "-")}`,
        area: "filesystem",
        level: "GREEN",
        title: `Readable: ${rel}`,
        detail: path,
        source: "filesystem",
        pass: true,
      });
    } catch {
      findings.push({
        id: `fs-perm-${rel.replace(/[\\/]/g, "-")}`,
        area: "filesystem",
        level: "RED",
        title: `Not readable: ${rel}`,
        detail: path,
        source: "filesystem",
        pass: false,
      });
    }
  }

  const projectState = join(REPO_ROOT, "SOS/project-state.json");
  findings.push({
    id: "fs-project-state",
    area: "filesystem",
    level: existsSync(projectState) ? "GREEN" : "CRITICAL",
    title: existsSync(projectState) ? "project-state.json present" : "project-state.json missing",
    detail: projectState,
    source: "filesystem",
    pass: existsSync(projectState),
  });

  return {
    findings,
    sources,
    pass: findings.every((f) => f.pass || f.level === "YELLOW"),
  };
}
