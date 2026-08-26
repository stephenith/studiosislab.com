/**
 * Command interpreter — parse founder objectives into structured commands.
 */
import type { CommandIntent, InterpretedCommand, ProductType } from "./types.js";

const COUNT_PATTERNS = [
  /generate\s+(\d+)/i,
  /create\s+(\d+)/i,
  /(\d+)\s+(?:ats|finance|healthcare|executive|marketing)/i,
];

const PRIORITY_KEYWORDS: Record<string, string> = {
  ats: "ats",
  finance: "finance",
  healthcare: "healthcare",
  executive: "executive",
  marketing: "marketing",
  sales: "sales",
  engineering: "engineering",
  minimal: "minimal",
  creative: "creative",
  student: "student",
  government: "government",
  academic: "academic",
  hospitality: "hospitality",
  hr: "hr",
  operations: "operations",
  visual: "visual",
};

const INDUSTRY_KEYWORDS = { ...PRIORITY_KEYWORDS };

export function interpretFounderObjective(objective: string): InterpretedCommand {
  const lower = objective.toLowerCase().trim();
  let intent: CommandIntent = "generate";
  if (lower.includes("improve")) intent = "improve";
  else if (lower.includes("analyze") || lower.includes("analysis")) intent = "analyze";
  else if (lower.includes("collection")) intent = "create_collection";

  let product_type: ProductType = "resume";
  if (lower.includes("cover letter")) product_type = "cover_letter";
  else if (lower.includes("invoice")) product_type = "invoice";
  else if (lower.includes("portfolio")) product_type = "portfolio";
  else if (lower.includes("template library") || lower.includes("current template"))
    product_type = "template_library";

  const count = extractCount(lower);
  const priority = extractPriority(lower);
  const industry = extractIndustry(lower);

  const keywords = lower
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 12);

  const supported = isSupported(product_type, intent);
  const requires_research =
    supported && (intent === "generate" || intent === "create_collection" || intent === "improve");

  return {
    raw_objective: objective,
    intent,
    product_type,
    count,
    priority,
    industry,
    keywords,
    requires_research,
    supported,
    unsupported_reason: supported
      ? undefined
      : `Product type "${product_type}" production workers not yet wired — planning only`,
  };
}

function extractCount(lower: string): number {
  for (const pattern of COUNT_PATTERNS) {
    const m = lower.match(pattern);
    if (m?.[1]) return Math.max(1, parseInt(m[1], 10));
  }
  if (lower.includes("collection")) return 5;
  return 1;
}

function extractPriority(lower: string): string {
  for (const [kw, priority] of Object.entries(PRIORITY_KEYWORDS)) {
    if (lower.includes(kw)) return priority;
  }
  return "ats";
}

function extractIndustry(lower: string): string | null {
  for (const [kw, industry] of Object.entries(INDUSTRY_KEYWORDS)) {
    if (lower.includes(kw)) return industry;
  }
  return null;
}

function isSupported(product_type: ProductType, intent: CommandIntent): boolean {
  if (intent === "analyze") return true;
  if (product_type === "resume" || product_type === "template_library") return true;
  return false;
}

export function formatCommandSummary(cmd: InterpretedCommand): string {
  return `${cmd.intent} ${cmd.count} ${cmd.product_type} (priority: ${cmd.priority})`;
}
