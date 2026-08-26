import type { RuntimeConfig } from "../../config.js";
import type { ParsedBrief, WorkPlan } from "../types.js";
import { executeSecurityControlsStrategy } from "./security-controls.js";
import { executeMobileHubStrategy } from "./mobile-hub.js";
import { executeFounderFileStrategy, matchesFounderFileTask } from "./founder-file.js";
import { executeSosDocsStrategy } from "./sos-docs.js";
import type { StrategyOutput } from "./types.js";

function matchesSecurityControls(brief: ParsedBrief, _workPlan: WorkPlan): boolean {
  const text = `${brief.title} ${brief.objective} ${brief.description}`.toLowerCase();
  return (
    text.includes("security")
    && brief.evidence.some((e) => e.includes("security/page.tsx") || e.includes("faq/page.tsx"))
  );
}

function matchesMobileHub(brief: ParsedBrief): boolean {
  const text = `${brief.title} ${brief.description}`.toLowerCase();
  return text.includes("mobile") && brief.evidence.some((e) => e.includes("ResumeHubClient"));
}

function isSosOnly(brief: ParsedBrief): boolean {
  return brief.evidence.length > 0 && brief.evidence.every((e) => e.startsWith("SOS/"));
}

export async function runImplementationStrategy(
  config: RuntimeConfig,
  brief: ParsedBrief,
  workPlan: WorkPlan,
): Promise<StrategyOutput> {
  if (matchesSecurityControls(brief, workPlan)) {
    return executeSecurityControlsStrategy(config.repoRoot, brief);
  }

  if (matchesMobileHub(brief)) {
    return executeMobileHubStrategy(config, brief);
  }

  if (matchesFounderFileTask(brief)) {
    return executeFounderFileStrategy(config, brief, workPlan);
  }

  if (isSosOnly(brief)) {
    return executeSosDocsStrategy(config, brief, workPlan);
  }

  throw new Error(
    `No autonomous execution strategy for task ${brief.task_id}. Evidence: ${brief.evidence.join(", ")}`,
  );
}
