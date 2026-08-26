/**
 * Skill Library verify — Agent #117.5
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { INITIAL_SKILLS } from "./SkillRegistry.js";
import { buildDependencyMap, expandComposition, stripDepartmentForProvider } from "./SkillComposition.js";
import { validateCatalog, validateSkillRequest } from "./SkillValidator.js";
import { buildSkillExecutionPlan } from "./SkillExecutionPlan.js";
import { SKILL_LIBRARY_RULES } from "./SkillManifest.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const CORE = join(REPO, "SOS/SAIOS/core/skills");
const CONFIG = join(REPO, "SOS/SAIOS/config");
const LOG = join(REPO, "SOS/07_LOGS/saios/skill-library");
const ARCH = join(REPO, "SOS/SAIOS/SKILL_LIBRARY_ARCHITECTURE.md");
const PKG = join(REPO, "package.json");

const CORE_FILES = [
  "README.md",
  "Skill.ts",
  "SkillRegistry.ts",
  "SkillManifest.ts",
  "SkillComposition.ts",
  "SkillValidator.ts",
  "SkillContext.ts",
  "SkillExecutionPlan.ts",
  "SkillRouterContract.ts",
  "index.ts",
  "verify.ts",
  "package.json",
];

function main(): void {
  const layerExists = CORE_FILES.every((f) => existsSync(join(CORE, f)));
  const configsOk =
    existsSync(join(CONFIG, "skill-registry.json")) &&
    existsSync(join(CONFIG, "skill-routing.policy.json"));
  const archOk = existsSync(ARCH);
  const logsOk = [
    "skill-map.json",
    "dependency-map.json",
    "routing-summary.json",
    "readiness.json",
  ].every((f) => existsSync(join(LOG, f)));

  const catalog = validateCatalog(INITIAL_SKILLS);
  const resumeCount = INITIAL_SKILLS.filter((s) => s.domain === "resume").length;
  const websiteCount = INITIAL_SKILLS.filter((s) => s.domain === "website").length;
  const commonCount = INITIAL_SKILLS.filter((s) => s.domain === "common").length;
  const skillCountsOk = resumeCount === 9 && websiteCount === 7 && commonCount === 6;

  const plan = buildSkillExecutionPlan({
    request_id: "req-skill-verify",
    skill_id: "resume.resume_critique",
    department: "resume",
    task_id: "task-verify",
    context_references: [],
    memory_references: [],
    input: { template_ref: "sample" },
    dry_run: true,
    created_at: new Date().toISOString(),
  });

  const stripped = stripDepartmentForProvider({
    skill_id: "resume.resume_critique",
    task_id: "task-verify",
    input: { template_ref: "sample" },
    context_references: [],
    memory_references: [],
  });
  const providerNeutral =
    !("department" in stripped) &&
    plan.steps.every((s) => !("department" in s.provider_payload));

  const badReq = validateSkillRequest({
    request_id: "x",
    skill_id: "resume.ats_analysis",
    department: "resume",
    task_id: "t",
    context_references: [],
    memory_references: [],
    input: { prompt: "raw", model_name: "gpt-4" },
    dry_run: true,
    created_at: new Date().toISOString(),
  });
  const rejectsRawPrompt = !badReq.ok;

  const archText = readFileSync(ARCH, "utf8");
  const noModelNames =
    !/\bgpt-4\b/i.test(archText) &&
    !/\bgpt-5\b/i.test(archText) &&
    archText.includes("No model names");

  const pkg = JSON.parse(readFileSync(PKG, "utf8"));
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const noSdk = !("openai" in deps) && !("@anthropic-ai/sdk" in deps);

  const readiness = JSON.parse(readFileSync(join(LOG, "readiness.json"), "utf8"));
  const liveOff = readiness.live_enabled === false;
  const noApi = readiness.api_calls === 0;

  const depsMap = buildDependencyMap();
  const expanded = expandComposition("resume.resume_critique");
  const compositionOk = expanded.includes("resume.ats_analysis") && expanded.length >= 3;

  const deptsDependOnSkills =
    SKILL_LIBRARY_RULES.includes("Departments request Skills") &&
    archText.includes("Departments request **Skills**");

  const checks = {
    skill_layer_exists: layerExists && configsOk && archOk && logsOk,
    departments_depend_on_skills: deptsDependOnSkills && rejectsRawPrompt,
    providers_remain_provider_neutral: providerNeutral,
    no_model_names_hardcoded: noModelNames,
    no_sdk_installed: noSdk,
    no_api_calls: noApi,
    live_remains_off: liveOff,
    catalog_valid: catalog.ok && skillCountsOk && compositionOk && Object.keys(depsMap).length === 22,
  };

  const allPass = Object.values(checks).every(Boolean);

  console.log(
    [
      "Skill Library Verify",
      "====================",
      ...Object.entries(checks).map(
        ([k, v]) => `${v ? "✔" : "✘"} ${k.replace(/_/g, " ")}`,
      ),
      "",
      `Skills: ${INITIAL_SKILLS.length} (resume=${resumeCount}, website=${websiteCount}, common=${commonCount})`,
      `Critique composition depth: ${expanded.length}`,
      `API calls: ${readiness.api_calls}`,
      `LIVE: ${readiness.live_enabled}`,
      `Overall: ${allPass ? "PASS" : "FAIL"}`,
    ].join("\n"),
  );

  process.exit(allPass ? 0 : 1);
}

main();
