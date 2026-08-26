import type { ChecklistResult, DeveloperReportInput } from "../types.js";
import { grepFile } from "./generic.js";

export function runSecurityControlsChecks(
  repoRoot: string,
  devReport: DeveloperReportInput,
): ChecklistResult[] {
  const results: ChecklistResult[] = [];

  const securityPage = devReport.files_changed.find((f) => /security\/page\.tsx$/i.test(f))
    ?? "src/app/security/page.tsx";
  const faqPage = devReport.files_changed.find((f) => /faq\/page\.tsx$/i.test(f))
    ?? "src/app/faq/page.tsx";

  results.push({
    item_id: "CHK-STRAT-SEC-1",
    passed: grepFile(repoRoot, securityPage, /security|controls|encryption/i),
    notes: `Security page content check: ${securityPage}`,
  });

  results.push({
    item_id: "CHK-STRAT-SEC-2",
    passed:
      grepFile(repoRoot, faqPage, /\/security|security page/i)
      || grepFile(repoRoot, faqPage, /href=["']\/security["']/),
    notes: `FAQ links to security: ${faqPage}`,
  });

  results.push({
    item_id: "CHK-STRAT-SEC-3",
    passed: devReport.files_changed.some((f) => /security|faq/i.test(f)),
    notes: "Security-related files modified",
  });

  return results;
}
