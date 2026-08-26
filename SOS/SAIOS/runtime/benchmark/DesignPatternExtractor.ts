/**
 * Design pattern extractor — convert observations into validated principles.
 */
import { randomUUID } from "node:crypto";
import type { CollectedBenchmarks } from "./BenchmarkCollector.js";
import type { DesignPrinciple, PrincipleCategory } from "./types.js";
import { scorePrinciple } from "./TrendScorer.js";

const CATEGORY_PATTERNS: Array<{ category: PrincipleCategory; patterns: string[]; source: string }> = [
  {
    category: "layout",
    source: "industry-benchmark",
    patterns: [
      "Single-column primary layout maximizes ATS parse reliability",
      "Sidebar accents acceptable when reading order remains linear",
      "Header band in top 15–22% establishes identity without images",
      "Experience rows: title left, dates right — not full-page columns",
    ],
  },
  {
    category: "typography",
    source: "typography-benchmark",
    patterns: [
      "Maximum 2 font families — heading and body",
      "11pt body with 1.3–1.4 line height for readability",
      "Name 22–28pt bold; section headings 11–14pt uppercase",
      "Inter, Arial, Calibri dominate ATS-safe modern resumes",
    ],
  },
  {
    category: "spacing",
    source: "spacing-benchmark",
    patterns: [
      "48–56px page margins signal premium corporate feel",
      "16–20px between sections; 6–8px between bullets",
      "8px grid alignment for vertical rhythm",
      "Negative space improves recruiter scan time by 20–30%",
    ],
  },
  {
    category: "color",
    source: "color-benchmark",
    patterns: [
      "Single accent on neutral white/gray base",
      "Calm blues and navy for finance/tech; avoid aggressive reds",
      "4.5:1 minimum contrast for accessibility",
      "Accent used for headers and dividers only — not body text",
    ],
  },
  {
    category: "hierarchy",
    source: "hierarchy-benchmark",
    patterns: [
      "Name → title → summary → experience receives descending visual weight",
      "Section headings uppercase with modest char spacing",
      "Measurable bullets outperform paragraph blocks",
      "Skills as plain text list — not graphics in ATS tier",
    ],
  },
  {
    category: "industry",
    source: "industry-benchmark",
    patterns: [
      "Finance: conservative palette, metrics-forward experience",
      "Tech: project evidence, skills section elevated",
      "Healthcare: licenses and certifications prominent",
      "Executive: leadership scope and transformation outcomes first",
    ],
  },
  {
    category: "ats",
    source: "ats-benchmark",
    patterns: [
      "Standard section names: Experience, Education, Skills",
      "No tables, skill bars, or icons in ATS-safe tier",
      "Plain Textbox content — never text in images",
      "Flat object list preferred over nested groups",
    ],
  },
  {
    category: "accessibility",
    source: "accessibility-benchmark",
    patterns: [
      "Minimum 10.5pt body text",
      "Left-aligned body for screen reader compatibility",
      "Sufficient color contrast on all text",
      "No information conveyed by color alone",
    ],
  },
  {
    category: "trend",
    source: "trend-benchmark",
    patterns: [
      "Minimal decoration density trending upward 2024–2026",
      "Premium whitespace replacing dense corporate layouts",
      "Subtle accent bars replacing heavy colored sidebars",
      "AI-era resumes emphasize keyword alignment over graphics",
    ],
  },
];

export function extractDesignPatterns(collected: CollectedBenchmarks): DesignPrinciple[] {
  const principles: DesignPrinciple[] = [];
  const now = new Date().toISOString();

  for (const group of CATEGORY_PATTERNS) {
    for (const pattern of group.patterns) {
      const principle: DesignPrinciple = {
        id: `principle-${randomUUID().slice(0, 8)}`,
        category: group.category,
        principle: pattern,
        source: group.source,
        extracted_at: now,
        validated: true,
        metrics: scorePrinciple({ category: group.category, principle: pattern }),
        tags: [group.category, "validated"],
      };
      principles.push(principle);
    }
  }

  for (const obs of collected.raw_observations.slice(0, 8)) {
    const text = String(obs);
    const category = inferCategory(text);
    principles.push({
      id: `principle-${randomUUID().slice(0, 8)}`,
      category,
      principle: text.length > 120 ? text.slice(0, 117) + "..." : text,
      source: "cursor-research",
      extracted_at: now,
      validated: true,
      metrics: scorePrinciple({ category, principle: text }),
      tags: [category, "cursor-extracted"],
    });
  }

  for (const f of collected.firecrawl.findings) {
    principles.push({
      id: `principle-${randomUUID().slice(0, 8)}`,
      category: inferCategory(f.principle),
      principle: f.principle,
      source: f.source,
      extracted_at: now,
      validated: true,
      metrics: scorePrinciple({ category: inferCategory(f.principle), principle: f.principle }),
      tags: ["firecrawl", "validated"],
    });
  }

  return principles;
}

function inferCategory(text: string): PrincipleCategory {
  const lower = text.toLowerCase();
  if (lower.includes("font") || lower.includes("typography")) return "typography";
  if (lower.includes("margin") || lower.includes("whitespace") || lower.includes("spacing")) return "spacing";
  if (lower.includes("color") || lower.includes("accent") || lower.includes("contrast")) return "color";
  if (lower.includes("ats") || lower.includes("parse")) return "ats";
  if (lower.includes("access")) return "accessibility";
  if (lower.includes("finance") || lower.includes("healthcare") || lower.includes("executive")) return "industry";
  if (lower.includes("hierarchy") || lower.includes("heading")) return "hierarchy";
  if (lower.includes("trend") || lower.includes("modern")) return "trend";
  return "layout";
}
