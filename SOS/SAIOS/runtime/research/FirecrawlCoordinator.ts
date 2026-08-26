/**
 * Firecrawl MCP coordinator — builds external research scope for Cursor Agent.
 * SAIOS never researches directly; coordinates topics only.
 */
import type { FirecrawlResearchSummary } from "./types.js";

export const FIRECRAWL_RESEARCH_TOPICS = [
  "Modern ATS Resume Design",
  "Resume.io",
  "Canva Resume Templates",
  "Novoresume",
  "Enhancv",
  "Harvard Resume Guide",
  "Microsoft Resume Templates",
  "Google Docs Resume Templates",
  "LinkedIn Resume Guidance",
  "Typography Trends",
  "Color Trends",
  "Whitespace Trends",
  "Corporate Design Trends",
  "Accessibility",
  "Recruiter Reading Behaviour",
  "Current Hiring Trends",
  "Current Resume Layout Trends",
] as const;

export function buildFirecrawlScope(mcp_available: boolean): {
  topics: string[];
  mcp_available: boolean;
  policy: string[];
} {
  return {
    topics: mcp_available ? [...FIRECRAWL_RESEARCH_TOPICS] : [],
    mcp_available,
    policy: [
      "Summarize findings only — never copy layouts",
      "Never clone designs",
      "Never violate copyright",
      "Temporary execution knowledge — do not overwrite StudiosisLab permanent knowledge",
    ],
  };
}

export function createMockFirecrawlSummary(mcp_available: boolean): FirecrawlResearchSummary {
  if (!mcp_available) {
    return {
      mcp_available: false,
      topics_researched: [],
      findings: [],
      copyright_safe: true,
      copied_layouts: false,
    };
  }

  const sampleTopics = FIRECRAWL_RESEARCH_TOPICS.slice(0, 8);
  return {
    mcp_available: true,
    topics_researched: [...FIRECRAWL_RESEARCH_TOPICS],
    findings: sampleTopics.map((topic) => ({
      topic,
      summary: mockFindingForTopic(topic),
      temporary: true as const,
    })),
    copyright_safe: true,
    copied_layouts: false,
  };
}

function mockFindingForTopic(topic: string): string {
  const summaries: Record<string, string> = {
    "Modern ATS Resume Design":
      "Single-column layouts with standard headings dominate; minimal decoration improves parse rates.",
    "Typography Trends":
      "Inter, Calibri, and Arial remain safe; 10.5–11pt body with clear heading scale.",
    "Whitespace Trends":
      "Generous margins (48–56px) and section gaps improve recruiter scan time.",
    "Color Trends":
      "Single accent color on neutral white/gray; avoid multi-color headers for ATS.",
    "Harvard Resume Guide":
      "Reverse-chronological experience, measurable bullets, education after experience for experienced candidates.",
  };
  return (
    summaries[topic] ??
    `Current ${topic} trends favor clarity, accessibility, and ATS-safe structure (summary only — no layout cloning).`
  );
}
