/**
 * Disk usage estimate for SOS log volume.
 */
import { execSync } from "node:child_process";
import { join } from "node:path";
import { REPO_ROOT, type SecurityConfiguration } from "./SecurityConfiguration.js";
import type { SecurityFinding } from "./types.js";

export function checkDiskHealth(config: SecurityConfiguration): {
  findings: SecurityFinding[];
  pass: boolean;
} {
  const target = join(REPO_ROOT, "SOS");
  let usedPct: number | null = null;
  let detail = "unavailable";

  try {
    const out = execSync(`df -k "${target}" | tail -1`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const parts = out.split(/\s+/);
    const capacity = parts.find((p) => p.endsWith("%"));
    if (capacity) {
      usedPct = Number(capacity.replace("%", ""));
      detail = out;
    }
  } catch {
    usedPct = null;
  }

  if (usedPct == null || Number.isNaN(usedPct)) {
    return {
      findings: [
        {
          id: "disk-unknown",
          area: "disk",
          level: "YELLOW",
          title: "Disk usage estimate unavailable",
          detail: "df probe failed — non-blocking",
          source: "disk",
          pass: true,
        },
      ],
      pass: true,
    };
  }

  let level: SecurityFinding["level"] = "GREEN";
  if (usedPct >= config.disk_critical_pct) level = "CRITICAL";
  else if (usedPct >= config.disk_warn_pct) level = "ORANGE";
  else if (usedPct >= config.disk_warn_pct - 10) level = "YELLOW";

  return {
    findings: [
      {
        id: "disk-usage",
        area: "disk",
        level,
        title: `Disk usage ~${usedPct}% on SOS volume`,
        detail,
        source: "disk",
        pass: usedPct < config.disk_critical_pct,
      },
    ],
    pass: usedPct < config.disk_critical_pct,
  };
}
