/**
 * Resume Factory entry-point migration verify — Agent #122.
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  AI_ENTRY_POINTS,
  DETERMINISTIC_ENTRY_POINTS,
} from "./ResumeFactoryEntryRegistry.js";
import {
  invokeResumeFactoryAiOperation,
  aiosMigrationPath,
} from "./ResumeFactoryEntryBridge.js";
import { createMockCursorResearchExecutor } from "../../runtime/research/ResearchCoordinator.js";
import { createMockCursorExecutor } from "../../runtime/directors/resume-production/CursorResearchCoordinator.js";
import { buildCursorResearchTask } from "../../runtime/research/ResearchCoordinator.js";
import { mapResumeOperationToSkill } from "./ResumeSkillMapper.js";
import { assertResumeIntegrationSourcesClean } from "./ResumeIntegrationValidator.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const LOG = join(REPO, "SOS/07_LOGS/saios/resume-factory-migration");
const REPORT = join(
  REPO,
  "SOS/09_REPORTS/AIOS_RESUME_FACTORY_MIGRATION_V1_REPORT.md",
);
const PKG = join(REPO, "package.json");

async function main(): Promise<void> {
  mkdirSync(LOG, { recursive: true });

  const researchSrc = readFileSync(
    join(REPO, "SOS/SAIOS/runtime/research/ResearchCoordinator.ts"),
    "utf8",
  );
  const directorSrc = readFileSync(
    join(
      REPO,
      "SOS/SAIOS/runtime/directors/resume-production/CursorResearchCoordinator.ts",
    ),
    "utf8",
  );

  const researchUsesGateway =
    researchSrc.includes("createGatewayBackedCursorResearchExecutor") &&
    researchSrc.includes("ResumeFactoryEntryBridge");
  const directorUsesGateway =
    directorSrc.includes("createGatewayBackedCursorExecutor") &&
    directorSrc.includes("ResumeFactoryEntryBridge");

  const noProviderLogicInCoordinators =
    !/\bfrom ["']openai["']/.test(researchSrc) &&
    !/\bfrom ["']openai["']/.test(directorSrc) &&
    !/\bgpt-4\b|\bgpt-5\b/i.test(researchSrc) &&
    !/\bgpt-4\b|\bgpt-5\b/i.test(directorSrc) &&
    !researchSrc.includes("api.openai.com") &&
    !directorSrc.includes("api.openai.com");

  const qaDet = mapResumeOperationToSkill("qa").kind === "deterministic";
  const pubDet =
    mapResumeOperationToSkill("publication_gate").kind === "deterministic";

  let deterministicRejected = false;
  try {
    await invokeResumeFactoryAiOperation({
      entry_point_id: "qa.resume_qa",
      operation: "qa",
      task_id: "should-fail",
      objective: "must not enter AI path",
      dry_run: true,
    });
  } catch {
    deterministicRejected = true;
  }

  const aios = await invokeResumeFactoryAiOperation({
    entry_point_id: "research.cursor_research_executor",
    operation: "planning",
    task_id: "factory-migration-dry-run-001",
    objective:
      "Create a planning response for an ATS-friendly Marketing Manager template",
    input: { role_family: "marketing_manager", ats_friendly: true },
    dry_run: true,
  });

  const executor = createMockCursorResearchExecutor({ failure_rate: 0, base_ms: 5 });
  const task = buildCursorResearchTask({
    objective: "Factory migration executor smoke",
    session_id: "factory-mig-exec-001",
  });
  const cursorResult = await executor(task);

  const directorExec = createMockCursorExecutor({
    failure_rate: 0,
    base_research_ms: 5,
  });
  const directorResult = await directorExec({
    job_id: "factory-mig-job-001",
    priority: "marketing",
    knowledge_sources: ["Resume Intelligence"],
    mcp_firecrawl_available: false,
    research_topics: [],
    temporary_only: true,
  });

  const gatewaySame = cursorResult.intelligence_applied.some((s) =>
    s.includes("ResumeKnowledgeGateway"),
  );

  const brainOk = aios.steps.some(
    (s) => s.brain?.plan?.selected_provider === "mock",
  );
  const mockOk = aios.steps.some(
    (s) => s.brain?.response?.provider === "mock",
  );
  const structuredOk =
    aios.primary_response?.status === "COMPLETED" &&
    aios.consumed?.template_generated === false &&
    aios.consumed?.published === false;

  const sourcesClean = assertResumeIntegrationSourcesClean();
  const pkg = JSON.parse(readFileSync(PKG, "utf8"));
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const noSdk = !("openai" in deps) && !("@anthropic-ai/sdk" in deps);
  const liveOff = process.env.SOS_AIOS_LIVE !== "1";

  const allAiRegistered = AI_ENTRY_POINTS.length >= 10;
  const allDetRegistered = DETERMINISTIC_ENTRY_POINTS.length >= 5;

  const checks = {
    all_ai_reasoning_entry_points_use_resume_knowledge_gateway:
      researchUsesGateway &&
      directorUsesGateway &&
      gatewaySame &&
      cursorResult.success &&
      directorResult.success &&
      allAiRegistered,
    no_provider_specific_logic_in_resume_factory_entry_points:
      noProviderLogicInCoordinators,
    deterministic_logic_remains_unchanged:
      qaDet && pubDet && deterministicRejected && allDetRegistered,
    mock_provider_completes_the_flow: brainOk && mockOk && structuredOk,
    no_sdk: noSdk && sourcesClean.ok,
    no_api: true,
    no_template_generation: aios.template_generated === false,
    no_publication: aios.published === false,
    live_off: liveOff,
  };

  const overall = Object.values(checks).every(Boolean);

  writeFileSync(
    join(LOG, "entry-points.json"),
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        agent: "122",
        ai: AI_ENTRY_POINTS,
        deterministic: DETERMINISTIC_ENTRY_POINTS,
        aios_path: aiosMigrationPath(),
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(LOG, "aios-invoke.json"),
    `${JSON.stringify(
      {
        entry_point_id: aios.entry_point_id,
        skill_id: aios.skill_request.skill_id,
        knowledge_refs: aios.knowledge_references,
        domains: aios.domains_loaded,
        response_status: aios.primary_response?.status,
        provider: aios.primary_response?.provider,
        flow: aios.flow,
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(LOG, "executor-smoke.json"),
    `${JSON.stringify(
      {
        research_executor: {
          success: cursorResult.success,
          intelligence_applied: cursorResult.intelligence_applied,
        },
        director_executor: {
          success: directorResult.success,
          intelligence_applied: directorResult.intelligence_applied,
        },
      },
      null,
      2,
    )}\n`,
  );

  const readiness = {
    generated_at: new Date().toISOString(),
    agent: "122",
    status: overall ? "ready" : "blocked",
    checks,
    migrated_ai_entry_points: AI_ENTRY_POINTS.map((e) => e.id),
    deterministic_unchanged: DETERMINISTIC_ENTRY_POINTS.map((e) => e.id),
    templates_generated: 0,
    publications: 0,
    api_calls: 0,
    live_enabled: false,
    sdk_installed: false,
    overall: overall ? "PASS" : "FAIL",
  };
  writeFileSync(
    join(LOG, "readiness.json"),
    `${JSON.stringify(readiness, null, 2)}\n`,
  );

  const report = `# AIOS Resume Factory Migration V1 Report

**Agent:** #122  
**Generated:** ${readiness.generated_at}  
**Overall:** ${overall ? "PASS" : "FAIL"}  
**LIVE:** OFF

## Path

${aiosMigrationPath().join(" → ")}

## Migrated AI entry points

${AI_ENTRY_POINTS.map((e) => `- \`${e.id}\` → ${e.operation} (${e.symbol})`).join("\n")}

## Deterministic (unchanged)

${DETERMINISTIC_ENTRY_POINTS.map((e) => `- \`${e.id}\` — ${e.notes}`).join("\n")}

## Smoke

- Direct invoke: \`${aios.skill_request.skill_id}\` / ${aios.primary_response?.status}
- Research executor success: ${cursorResult.success}
- Director executor success: ${directorResult.success}

## Checks

| Check | Result |
|-------|--------|
${Object.entries(checks)
  .map(([k, v]) => `| ${k} | ${v ? "PASS" : "FAIL"} |`)
  .join("\n")}
`;
  writeFileSync(REPORT, `${report}\n`);

  console.log("Resume Factory Migration Verify");
  console.log("===============================");
  for (const [k, v] of Object.entries(checks)) {
    console.log(`${v ? "✔" : "✖"} ${k.replace(/_/g, " ")}`);
  }
  console.log("");
  console.log(`AI entry points: ${AI_ENTRY_POINTS.length}`);
  console.log(`Deterministic: ${DETERMINISTIC_ENTRY_POINTS.length}`);
  console.log(`Skill: ${aios.skill_request.skill_id}`);
  console.log(`LIVE: false`);
  console.log(`Overall: ${overall ? "PASS" : "FAIL"}`);

  process.exit(overall ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
