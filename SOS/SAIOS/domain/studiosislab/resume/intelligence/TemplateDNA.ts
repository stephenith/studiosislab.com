import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DesignFamilyId, ResumeIntelligenceDatabase, TemplateDNA } from "./types.js";
import { DESIGN_FAMILIES } from "./DesignFamilies.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DNA_PATH = join(__dirname, "data/template-dna.json");
const DESIGN_INTELLIGENCE_PATH = join(
  __dirname,
  "data/design-intelligence-principles.json",
);

type DnaBundle = {
  analyzed_at: string;
  count: number;
  families: Record<string, string[]>;
  entries: TemplateDNA[];
};

let cachedBundle: DnaBundle | null = null;

function loadBundle(): DnaBundle {
  if (!cachedBundle) {
    cachedBundle = JSON.parse(readFileSync(DNA_PATH, "utf8")) as DnaBundle;
  }
  return cachedBundle;
}

/**
 * Full Template DNA database — one entry per published template (79 total).
 */
export function getTemplateDNA(): TemplateDNA[] {
  return loadBundle().entries;
}

export function getTemplateDNAById(id: string): TemplateDNA | undefined {
  const normalized = (id || "").toLowerCase().trim();
  return loadBundle().entries.find((e) => e.id === normalized);
}

export function getTemplatesByFamily(familyId: DesignFamilyId): TemplateDNA[] {
  return loadBundle().entries.filter((e) => e.family === familyId);
}

export function buildResumeIntelligenceDatabase(): ResumeIntelligenceDatabase {
  const bundle = loadBundle();
  const familyIndex = bundle.families as Record<DesignFamilyId, string[]>;
  return {
    version: "1.0.0",
    analyzed_at: bundle.analyzed_at,
    published_template_count: bundle.count,
    design_families: [...DESIGN_FAMILIES],
    template_dna: bundle.entries,
    family_index: familyIndex,
  };
}

/** Agent #236 — Design Intelligence principles layered onto Design DNA store. */
export function getDesignIntelligencePrinciples(): Record<string, unknown> | null {
  if (!existsSync(DESIGN_INTELLIGENCE_PATH)) return null;
  return JSON.parse(
    readFileSync(DESIGN_INTELLIGENCE_PATH, "utf8"),
  ) as Record<string, unknown>;
}
