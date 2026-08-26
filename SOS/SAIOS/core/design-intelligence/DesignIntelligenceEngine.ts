/**
 * Agent #236 — Design Intelligence Engine.
 * Controlled research stage: Template DNA → reusable principles → DesignBrief.
 * Not a new runtime. Does not publish. LIVE OFF.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { getTemplateDNA } from "../../domain/studiosislab/resume/intelligence/TemplateDNA.js";
import {
  DESIGN_INTELLIGENCE_PRINCIPLES,
  type DesignIntelligencePrinciples,
  type LayoutFamilyId,
} from "./principles.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const DOMAIN_OUT = join(
  REPO,
  "SOS/SAIOS/domain/studiosislab/resume/intelligence/data/design-intelligence-principles.json",
);
const LOG_DIR = join(REPO, "SOS/07_LOGS/saios/design-intelligence");

export type DesignIntelligenceRunResult = {
  principles: DesignIntelligencePrinciples;
  wrote: string[];
  dna_entries_sampled: number;
  overall: "PASS" | "FAIL";
};

function sampleDnaFamilies(families: string[]): {
  family: string;
  sample_ids: string[];
  median_name_hint: number;
  count: number;
}[] {
  const entries = getTemplateDNA();
  return families.map((family) => {
    const matched = entries.filter((e) => e.family === family);
    const sizes = matched
      .map((e) => Number(e.typography_profile?.size_max ?? 0))
      .filter((n) => n > 0)
      .sort((a, b) => a - b);
    const median = sizes.length
      ? sizes[Math.floor(sizes.length / 2)]!
      : DESIGN_INTELLIGENCE_PRINCIPLES.typography_scale.name_pt.target;
    return {
      family,
      sample_ids: matched.slice(0, 4).map((e) => e.id),
      median_name_hint: median,
      count: matched.length,
    };
  });
}

/**
 * Run controlled Design Intelligence research and persist principles into Design DNA store.
 */
export function runDesignIntelligence(opts?: {
  repoRoot?: string;
  persist?: boolean;
}): DesignIntelligenceRunResult {
  if (process.env.SOS_AIOS_LIVE === "1") {
    throw new Error("DesignIntelligenceEngine refuses SOS_AIOS_LIVE=1");
  }

  const root = opts?.repoRoot ?? REPO;
  const principles: DesignIntelligencePrinciples = {
    ...DESIGN_INTELLIGENCE_PRINCIPLES,
    extracted_at: new Date().toISOString(),
  };

  const sampled = sampleDnaFamilies(
    principles.source.catalog_families_sampled,
  );
  const maxNameHints = sampled.map((s) => s.median_name_hint).filter((n) => n >= 28);
  if (maxNameHints.length) {
    const avg =
      maxNameHints.reduce((a, b) => a + b, 0) / maxNameHints.length;
    // Nudge target toward catalog without exceeding ATS-readable max
    principles.typography_scale.name_pt.target = Math.min(
      42,
      Math.max(38, Math.round(avg > 50 ? 40 : avg > 36 ? 40 : 38)),
    );
  }

  const wrote: string[] = [];
  if (opts?.persist !== false) {
    mkdirSync(join(root, "SOS/SAIOS/domain/studiosislab/resume/intelligence/data"), {
      recursive: true,
    });
    mkdirSync(join(root, "SOS/07_LOGS/saios/design-intelligence"), {
      recursive: true,
    });

    const domainPath = join(
      root,
      "SOS/SAIOS/domain/studiosislab/resume/intelligence/data/design-intelligence-principles.json",
    );
    const logDir = join(root, "SOS/07_LOGS/saios/design-intelligence");
    const payload = {
      ...principles,
      dna_family_samples: sampled,
      live_enabled: false,
      publication_allowed: false,
    };
    writeFileSync(domainPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    wrote.push(domainPath);

    const researchPath = join(logDir, "design-intelligence-research.json");
    writeFileSync(
      researchPath,
      `${JSON.stringify(
        {
          agent: 236,
          stage: "design_intelligence_research",
          dry_run: true,
          publication_allowed: false,
          live: false,
          principles_version: principles.version,
          dna_entries_total: getTemplateDNA().length,
          families_sampled: sampled,
          trends: principles.modern_trends,
          ats_constraints: principles.ats_safe_styling,
          generated_at: principles.extracted_at,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    wrote.push(researchPath);

    const md = [
      `# Design Intelligence Research`,
      ``,
      `- agent: 236`,
      `- principles: ${principles.version}`,
      `- DNA entries: ${getTemplateDNA().length}`,
      `- page-fill target: ${principles.page_fill.target}`,
      `- name target: ${principles.typography_scale.name_pt.target}pt`,
      `- layout families: ${principles.layout_families.map((l) => l.id).join(", ")}`,
      `- LIVE: false`,
      `- publication_allowed: false`,
      ``,
      `## Principles (summary)`,
      ``,
      ...principles.modern_trends.map((t) => `- ${t}`),
      ``,
      `## Role preferences`,
      ``,
      ...Object.entries(principles.role_preferences).map(
        ([role, pref]) =>
          `- **${role}**: layouts ${pref.preferred_layout_order.join(" → ")}; DNA ${pref.dna_families.join(", ")}`,
      ),
      ``,
    ].join("\n");
    const mdPath = join(logDir, "design-intelligence-research.md");
    writeFileSync(mdPath, md, "utf8");
    wrote.push(mdPath);
  }

  return {
    principles,
    wrote,
    dna_entries_sampled: getTemplateDNA().length,
    overall: "PASS",
  };
}

export function loadDesignIntelligencePrinciples(
  repoRoot?: string,
): DesignIntelligencePrinciples {
  const root = repoRoot ?? REPO;
  const path = join(
    root,
    "SOS/SAIOS/domain/studiosislab/resume/intelligence/data/design-intelligence-principles.json",
  );
  if (existsSync(path)) {
    try {
      const raw = JSON.parse(
        readFileSync(path, "utf8"),
      ) as DesignIntelligencePrinciples;
      if (raw?.version && raw.layout_families) return raw;
    } catch {
      /* fall through */
    }
  }
  return DESIGN_INTELLIGENCE_PRINCIPLES;
}

export function resolveLayoutFamily(
  roleFamily: string,
  variant: number,
  principles?: DesignIntelligencePrinciples,
): LayoutFamilyId {
  const p = principles ?? DESIGN_INTELLIGENCE_PRINCIPLES;
  const pref =
    p.role_preferences[roleFamily] ??
    p.role_preferences.marketing_manager!;
  const order = pref.preferred_layout_order;
  return order[Math.abs(variant) % order.length]!;
}

export { DOMAIN_OUT, LOG_DIR, DESIGN_INTELLIGENCE_PRINCIPLES };
