/**
 * Score + risk derivation from checks.
 */
import type {
  CheckResult,
  RiskItem,
  ScoreBreakdown,
  VpsRecommendation,
} from "./types.js";
import { readJson } from "./utils.js";

export function scoreChecks(checks: CheckResult[]): {
  score: number;
  max_score: number;
  score_pct: number;
  breakdown: ScoreBreakdown[];
} {
  const byCat = new Map<string, CheckResult[]>();
  for (const c of checks) {
    const list = byCat.get(c.category) ?? [];
    list.push(c);
    byCat.set(c.category, list);
  }

  const breakdown: ScoreBreakdown[] = [];
  let score = 0;
  let max_score = 0;

  for (const [category, list] of byCat) {
    let catScore = 0;
    let catMax = 0;
    let pass_count = 0;
    let fail_count = 0;
    for (const c of list) {
      catMax += c.weight;
      if (c.pass) {
        catScore += c.weight;
        pass_count += 1;
      } else {
        fail_count += 1;
      }
    }
    breakdown.push({
      category,
      score: catScore,
      max: catMax,
      pass_count,
      fail_count,
    });
    score += catScore;
    max_score += catMax;
  }

  const score_pct =
    max_score > 0 ? Math.round((score / max_score) * 1000) / 10 : 0;
  return { score, max_score, score_pct, breakdown };
}

export function deriveRisks(checks: CheckResult[]): RiskItem[] {
  const risks: RiskItem[] = [];
  const failed = checks.filter((c) => !c.pass);

  for (const f of failed) {
    risks.push({
      id: `risk-${f.id}`,
      level: f.weight >= 3 ? "HIGH" : "MEDIUM",
      title: `Failed check: ${f.label}`,
      detail: f.detail,
      mitigation: "Resolve before enabling SOS_AIOS_LIVE on VPS",
    });
  }

  const security = readJson<{ security_level?: string }>(
    "SOS/07_LOGS/saios/security-department/security-health.json",
  );
  if (String(security?.security_level).toUpperCase() === "ORANGE") {
    risks.push({
      id: "risk-disk-orange",
      level: "MEDIUM",
      title: "Security level ORANGE (disk/env)",
      detail: "Operational health degraded — often disk usage",
      mitigation: "Free disk space on host before long-running LIVE",
    });
  }

  const catalog = readJson<{
    operations?: { catalog_integrity?: { conflicts_detected?: number } };
  }>("SOS/project-state.json");
  const conflicts =
    catalog?.operations?.catalog_integrity?.conflicts_detected ?? 0;
  if (conflicts > 0) {
    risks.push({
      id: "risk-catalog-conflict",
      level: "MEDIUM",
      title: "Catalog integrity conflict(s)",
      detail: `conflicts_detected=${conflicts}`,
      mitigation: "Resolve provisional ID conflicts before batch publish",
    });
  }

  const pending = readJson<{ pending_actions?: string[] }>(
    "SOS/project-state.json",
  );
  if ((pending?.pending_actions ?? []).some((a) => /founder/i.test(a))) {
    risks.push({
      id: "risk-fr-pending",
      level: "LOW",
      title: "Founder review pending",
      detail: "FR#004 awaiting approval",
      mitigation: "Approve FR before production publish waves",
    });
  }

  risks.push({
    id: "risk-live-default-off",
    level: "LOW",
    title: "LIVE mode intentionally disabled",
    detail: "SOS_AIOS_LIVE defaults to 0 — correct for first VPS",
    mitigation: "Keep VERIFY/DRY_RUN until Founder Gate + monitoring proven",
  });

  return risks;
}

export function buildVpsRecommendation(): VpsRecommendation {
  return {
    minimum: {
      label: "Minimum VPS (verify / dry-run continuity)",
      cpu: "2 vCPU",
      ram: "4 GB",
      disk: "60 GB SSD",
      bandwidth: "2 TB / month",
      estimated_monthly_usd: [12, 24],
    },
    recommended: {
      label: "Recommended VPS (AI OS + website + logs)",
      cpu: "4 vCPU",
      ram: "8 GB",
      disk: "160 GB SSD",
      bandwidth: "4–5 TB / month",
      estimated_monthly_usd: [40, 70],
    },
    node_version: "22 LTS",
    ubuntu_version: "24.04 LTS",
    estimated_capacity:
      "Recommended host supports continuous Runtime Loop/Supervisor, Next.js website, Telegram bridge, and ~1–3 months of SOS logs without aggressive rotation.",
    notes: [
      "No Kubernetes required",
      "PM2 or systemd + Nginx reverse proxy",
      "Keep SOS_AIOS_LIVE=0 until gate + monitoring proven on host",
      "Disk pressure is the primary operational risk (Security ORANGE observed)",
    ],
  };
}
