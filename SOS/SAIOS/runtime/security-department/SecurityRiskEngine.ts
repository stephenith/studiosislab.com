/**
 * Aggregate findings → overall security level + risk list.
 */
import type { SecurityFinding, SecurityLevel } from "./types.js";

const LEVEL_RANK: Record<SecurityLevel, number> = {
  GREEN: 0,
  YELLOW: 1,
  ORANGE: 2,
  RED: 3,
  CRITICAL: 4,
};

export function maxLevel(levels: SecurityLevel[]): SecurityLevel {
  return levels.reduce<SecurityLevel>(
    (acc, l) => (LEVEL_RANK[l] > LEVEL_RANK[acc] ? l : acc),
    "GREEN",
  );
}

export function evaluateSecurityRisks(findings: SecurityFinding[]): {
  security_level: SecurityLevel;
  risks: SecurityFinding[];
  status: "READY" | "DEGRADED" | "BLOCKED";
} {
  const risks = findings.filter(
    (f) => !f.pass || LEVEL_RANK[f.level] >= LEVEL_RANK.YELLOW,
  );
  const security_level = maxLevel(findings.map((f) => f.level));
  let status: "READY" | "DEGRADED" | "BLOCKED" = "READY";
  if (LEVEL_RANK[security_level] >= LEVEL_RANK.CRITICAL) status = "BLOCKED";
  else if (LEVEL_RANK[security_level] >= LEVEL_RANK.ORANGE) status = "DEGRADED";
  else if (LEVEL_RANK[security_level] >= LEVEL_RANK.YELLOW) status = "DEGRADED";
  return { security_level, risks, status };
}
