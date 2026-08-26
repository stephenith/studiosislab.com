import type { ChecklistResult, DeveloperReportInput, ParsedQaBrief } from "../types.js";
import { runGenericStrategyChecks } from "./generic.js";
import { runSecurityControlsChecks } from "./security-controls.js";
import { runMobileHubChecks } from "./mobile-hub.js";
import { isFounderFileQaBrief, runFounderFileChecks } from "./founder-file.js";

export function selectQaStrategy(
  brief: ParsedQaBrief,
  devReport: DeveloperReportInput,
): "security" | "mobile" | "founder_file" | "generic" {
  if (isFounderFileQaBrief(brief, devReport)) {
    return "founder_file";
  }
  const text = `${brief.objective} ${brief.title} ${devReport.summary}`.toLowerCase();
  const files = devReport.files_changed.join(" ").toLowerCase();

  if (/security|faq.*security|active security controls/i.test(text + files)) {
    return "security";
  }
  if (/mobile|resumehub|resume hub|phone users/i.test(text + files)) {
    return "mobile";
  }
  return "generic";
}

export function runStrategyChecks(
  repoRoot: string,
  brief: ParsedQaBrief,
  devReport: DeveloperReportInput,
): ChecklistResult[] {
  const strategy = selectQaStrategy(brief, devReport);
  const generic = runGenericStrategyChecks(repoRoot, brief, devReport);

  if (strategy === "founder_file") {
    return [...generic, ...runFounderFileChecks(repoRoot, brief, devReport)];
  }
  if (strategy === "security") {
    return [...generic, ...runSecurityControlsChecks(repoRoot, devReport)];
  }
  if (strategy === "mobile") {
    return [...generic, ...runMobileHubChecks(repoRoot, devReport)];
  }
  return generic;
}
