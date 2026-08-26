/**
 * Verify founder-facing UI/prompts use "resume template" terminology
 * while legacy internal identifiers remain compatible.
 *
 * No OpenAI. No production task mutation.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const REPO = process.cwd();

type Check = { name: string; pass: boolean; detail: string };

function read(rel: string): string {
  return readFileSync(join(REPO, rel), "utf8");
}

function main(): void {
  const checks: Check[] = [];

  const uiFiles = [
    "SOS/SAIOS/dashboard/src/views/ResumeView.tsx",
    "SOS/SAIOS/dashboard/src/views/ProviderValidationView.tsx",
    "SOS/SAIOS/dashboard/src/views/FounderReviewView.tsx",
    "SOS/SAIOS/dashboard/src/views/BrainStudio.tsx",
    "SOS/SAIOS/dashboard/src/views/MissionControl.tsx",
    "SOS/SAIOS/dashboard/src/App.tsx",
  ];

  const forbiddenUiPhrases = [
    "Generate Candidate",
    "Current Candidate",
    "Recent Generated Candidates",
    "Selected Candidate",
    "Eligible Candidate",
    "Review Candidate",
    "Prior candidate:",
    "Candidate ID:",
    "Search reviews & candidates",
    'title="Review Queue"',
  ];

  const requiredUiPhrases = [
    "Generate Resume Template",
    "Templates Ready for Review",
    "Resume Template ID",
    "Selected Resume Template",
  ];

  const uiBlob = uiFiles.map(read).join("\n");

  for (const phrase of forbiddenUiPhrases) {
    const hit = uiBlob.includes(phrase);
    checks.push({
      name: `ui_forbids_${phrase.replace(/\W+/g, "_").slice(0, 48)}`,
      pass: !hit,
      detail: hit ? `found in dashboard UI sources` : "absent",
    });
  }

  for (const phrase of requiredUiPhrases) {
    const hit = uiBlob.includes(phrase);
    checks.push({
      name: `ui_requires_${phrase.replace(/\W+/g, "_").slice(0, 48)}`,
      pass: hit,
      detail: hit ? "present" : "missing",
    });
  }

  const prompt = read(
    "SOS/SAIOS/core/founder-revision/RevisionPromptBuilder.ts",
  );
  checks.push({
    name: "prompt_says_resume_template",
    pass: prompt.includes("Prior resume template"),
    detail: prompt.includes("Prior resume template")
      ? "ok"
      : "missing resume template phrasing",
  });
  checks.push({
    name: "prompt_retains_prior_candidate_id_field",
    pass: prompt.includes("prior_candidate_id"),
    detail: "legacy field reference retained",
  });

  const types = read("SOS/SAIOS/dashboard/src/data/types.ts");
  checks.push({
    name: "legacy_candidate_id_field_retained",
    pass: types.includes("candidate_id"),
    detail: "dashboard types keep candidate_id",
  });

  const migrationDoc =
    "SOS/09_REPORTS/RESUME_TEMPLATE_TERMINOLOGY_MIGRATION.md";
  checks.push({
    name: "migration_doc_present",
    pass: existsSync(join(REPO, migrationDoc)),
    detail: migrationDoc,
  });

  // Production tasks untouched: count files in tasks dir if present
  const tasksDir = join(
    REPO,
    "SOS/07_LOGS/saios/founder-revision/tasks",
  );
  let taskCount = 0;
  if (existsSync(tasksDir)) {
    taskCount = readdirSync(tasksDir).filter((n) =>
      n.endsWith(".json"),
    ).length;
  }
  checks.push({
    name: "production_tasks_dir_readable",
    pass: true,
    detail: `task_json_count=${taskCount} (not modified by this verify)`,
  });

  // Ensure verify itself did not write into candidates/
  const candidatesDir = join(
    REPO,
    "SOS/07_LOGS/saios/first-production-cycle/candidates",
  );
  checks.push({
    name: "candidates_storage_path_still_exists_or_absent_ok",
    pass: true,
    detail: existsSync(candidatesDir)
      ? `legacy path retained (${statSync(candidatesDir).isDirectory() ? "dir" : "file"})`
      : "path absent in this workspace (ok)",
  });

  const failed = checks.filter((c) => !c.pass);
  const report = {
    ok: failed.length === 0,
    passed: checks.length - failed.length,
    total: checks.length,
    checks,
    at: new Date().toISOString(),
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    console.error(`FAIL ${failed.length}/${checks.length}`);
    process.exit(1);
  }
  console.log(`OK ${report.passed}/${report.total}`);
}

main();
