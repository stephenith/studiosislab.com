import type { ChecklistResult, DeveloperReportInput } from "../types.js";
import { grepFile } from "./generic.js";

export function runMobileHubChecks(
  repoRoot: string,
  devReport: DeveloperReportInput,
): ChecklistResult[] {
  const hubFile =
    devReport.files_changed.find((f) => /ResumeHubClient\.tsx$/i.test(f))
    ?? "src/app/resume/ResumeHubClient.tsx";

  const results: ChecklistResult[] = [];

  results.push({
    item_id: "CHK-STRAT-MOB-1",
    passed: grepFile(repoRoot, hubFile, /editor\/mobile|\/resume\/.*\/edit\/mobile|mobile.*editor/i),
    notes: `Mobile editor routing in ${hubFile}`,
  });

  results.push({
    item_id: "CHK-STRAT-MOB-2",
    passed: grepFile(repoRoot, hubFile, /ResumeHub|template|gallery/i),
    notes: "Resume hub core patterns present",
  });

  results.push({
    item_id: "CHK-STRAT-MOB-3",
    passed: devReport.files_changed.some((f) => /resume|hub|mobile/i.test(f)),
    notes: "Mobile/hub files in change set",
  });

  return results;
}
