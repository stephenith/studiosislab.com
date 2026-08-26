/**
 * Firecrawl collector — benchmark-specific external source scope.
 */
import { createMockFirecrawlSummary } from "../research/FirecrawlCoordinator.js";

export const BENCHMARK_FIRECRAWL_SOURCES = [
  "Resume.io",
  "Novoresume",
  "Enhancv",
  "Kickresume",
  "FlowCV",
  "Reactive Resume",
  "Canva",
  "Adobe Express",
  "Behance",
  "Dribbble",
  "Figma Community",
  "Awwwards",
  "CSS Design Awards",
  "Google Fonts",
  "Material Design",
  "Apple Human Interface Guidelines",
  "Microsoft Fluent",
  "ATS recommendations",
  "Accessibility standards",
  "Current hiring trends",
  "Professional recruiter preferences",
  "Industry-specific resume expectations",
] as const;

export type FirecrawlCollection = {
  mcp_available: boolean;
  sources: string[];
  findings: Array<{ source: string; principle: string; temporary: true }>;
  policy: string[];
};

export function collectFirecrawlBenchmarks(mcp_available: boolean): FirecrawlCollection {
  const summary = createMockFirecrawlSummary(mcp_available);

  const findings = mcp_available
    ? BENCHMARK_FIRECRAWL_SOURCES.slice(0, 14).map((source) => ({
        source,
        principle: principleForSource(source),
        temporary: true as const,
      }))
    : [];

  return {
    mcp_available,
    sources: mcp_available ? [...BENCHMARK_FIRECRAWL_SOURCES] : [],
    findings,
    policy: [
      "Extract principles only — never store template copies",
      "Never recreate commercial templates",
      "Validate before persisting to benchmark database",
      "Design Brain prefers benchmark knowledge over temporary observations",
    ],
  };
}

function principleForSource(source: string): string {
  const map: Record<string, string> = {
    "Resume.io": "Single-column ATS layouts with clear section headings dominate premium products",
    Novoresume: "Generous whitespace and 11pt body text improve scan readability",
    Enhancv: "Subtle accent color on neutral base signals professionalism without clutter",
    Canva: "Visual hierarchy through size contrast — name 2× body size",
    Behance: "Premium perception from restrained decoration density (<15%)",
    "Google Fonts": "Inter, Roboto, and Source Sans remain top ATS-safe modern choices",
    "Material Design": "8dp grid alignment for consistent spacing rhythm",
    "ATS recommendations": "Plain text sections outperform tables and graphics for parse rate",
    "Accessibility standards": "4.5:1 minimum contrast for body text on white backgrounds",
  };
  return map[source] ?? `${source}: modern resume patterns favor clarity, hierarchy, and ATS-safe structure`;
}
