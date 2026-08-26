import { randomBytes } from "node:crypto";
import type { Priority } from "../shared/types.js";
import type { FounderObjective, ProductEpic, ProductFeature } from "./types.js";

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  ten: 10,
  twenty: 20,
  fifty: 50,
};

function generateEpicId(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-` +
    `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}` +
    `${pad(now.getUTCMilliseconds())}`;
  return `PD-EPIC-${stamp}-${randomBytes(2).toString("hex")}`;
}

function detectPriority(text: string): Priority {
  if (/\b(urgent|asap|p0|critical)\b/i.test(text)) return "P0";
  if (/\b(important|p1|high)\b/i.test(text)) return "P1";
  if (/\b(low|p3|minor)\b/i.test(text)) return "P3";
  return "P2";
}

function parseQuantity(text: string): number {
  const digit = text.match(/\b(\d+)\b/);
  if (digit) return Math.max(1, Math.min(200, parseInt(digit[1]!, 10)));
  for (const [word, n] of Object.entries(WORD_NUMBERS)) {
    if (new RegExp(`\\b${word}\\b`, "i").test(text)) return n;
  }
  return 1;
}

function detectDomain(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(resume|cv|ats)\b/.test(lower)) return "resume-templates";
  if (/\b(invoice|billing)\b/.test(lower)) return "invoice-templates";
  if (/\b(portfolio)\b/.test(lower)) return "portfolio";
  if (/\b(seo)\b/.test(lower)) return "seo";
  return "general-product";
}

type FeatureBlueprint = {
  slug: string;
  name: string;
  description: string;
  worker_type: string;
  capability: string;
  jobRatio: number;
  parallel_safe: boolean;
};

const RESUME_TEMPLATE_FEATURES: FeatureBlueprint[] = [
  {
    slug: "resume-templates",
    name: "Resume Templates",
    description: "Core ATS resume template engineering deliverables",
    worker_type: "resume-worker",
    capability: "resume",
    jobRatio: 1,
    parallel_safe: true,
  },
  {
    slug: "resume-assets",
    name: "Resume Assets",
    description: "Icons, sections, and reusable resume asset packs",
    worker_type: "ui-worker",
    capability: "ui",
    jobRatio: 0.6,
    parallel_safe: true,
  },
  {
    slug: "seo-pages",
    name: "SEO Pages",
    description: "Landing and discovery pages for template catalog",
    worker_type: "seo-worker",
    capability: "seo",
    jobRatio: 1,
    parallel_safe: true,
  },
  {
    slug: "thumbnail-images",
    name: "Thumbnail Images",
    description: "Preview thumbnails for template marketplace listings",
    worker_type: "ui-worker",
    capability: "ui",
    jobRatio: 1,
    parallel_safe: true,
  },
  {
    slug: "ats-validation",
    name: "ATS Validation",
    description: "Automated ATS compatibility checks per template",
    worker_type: "testing-worker",
    capability: "testing",
    jobRatio: 0.4,
    parallel_safe: false,
  },
  {
    slug: "sample-profiles",
    name: "Sample Profiles",
    description: "Representative candidate profiles for template demos",
    worker_type: "resume-worker",
    capability: "resume",
    jobRatio: 0.2,
    parallel_safe: true,
  },
];

const GENERIC_FEATURES: FeatureBlueprint[] = [
  {
    slug: "core-deliverables",
    name: "Core Deliverables",
    description: "Primary product deliverables from founder objective",
    worker_type: "ui-worker",
    capability: "ui",
    jobRatio: 1,
    parallel_safe: true,
  },
  {
    slug: "quality-validation",
    name: "Quality Validation",
    description: "Verification and QA for deliverables",
    worker_type: "testing-worker",
    capability: "testing",
    jobRatio: 0.3,
    parallel_safe: false,
  },
  {
    slug: "documentation",
    name: "Documentation",
    description: "Product documentation and usage guides",
    worker_type: "documentation-worker",
    capability: "documentation",
    jobRatio: 0.2,
    parallel_safe: true,
  },
];

function blueprintForDomain(domain: string): FeatureBlueprint[] {
  if (domain === "resume-templates") return RESUME_TEMPLATE_FEATURES;
  return GENERIC_FEATURES;
}

function estimateJobs(quantity: number, ratio: number): number {
  return Math.max(1, Math.ceil(quantity * ratio));
}

/**
 * Convert one founder objective into product features under an epic.
 */
export class FeaturePlanner {
  planEpic(objective: FounderObjective): ProductEpic {
    const text = objective.raw_text.trim();
    return {
      id: generateEpicId(),
      title: text,
      objective: text,
      priority: detectPriority(text),
      quantity: parseQuantity(text),
      domain: detectDomain(text),
      created_at: new Date().toISOString(),
    };
  }

  planFeatures(epic: ProductEpic): ProductFeature[] {
    const blueprints = blueprintForDomain(epic.domain);
    return blueprints.map((bp) => ({
      id: `${epic.id}-FEAT-${bp.slug}`,
      epic_id: epic.id,
      name: bp.name,
      description: `${bp.description} for: ${epic.objective}`,
      worker_type: bp.worker_type,
      capability: bp.capability,
      estimated_jobs: estimateJobs(epic.quantity, bp.jobRatio),
      parallel_safe: bp.parallel_safe,
    }));
  }
}
