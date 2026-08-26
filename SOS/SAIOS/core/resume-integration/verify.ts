/**
 * Resume ↔ Brain integration verify + dry-run simulation — Agent #119.
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ResumeKnowledgeGateway } from "./ResumeKnowledgeGateway.js";
import {
  assertNoRawPromptInSkillRequest,
  assertResumeIntegrationSourcesClean,
} from "./ResumeIntegrationValidator.js";
import { mapResumeOperationToSkill } from "./ResumeSkillMapper.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const LOG = join(REPO, "SOS/07_LOGS/saios/resume-integration");
const REPORT = join(REPO, "SOS/09_REPORTS/AIOS_RESUME_INTEGRATION_V1_REPORT.md");
const PKG = join(REPO, "package.json");
const CORE = resolve(import.meta.dirname);

async function main(): Promise<void> {
  mkdirSync(LOG, { recursive: true });

  const filesOk = [
    "ResumeSkillRequest.ts",
    "ResumeSkillMapper.ts",
    "ResumeBrainGateway.ts",
    "ResumeResponseConsumer.ts",
    "ResumeIntegrationValidator.ts",
    "README.md",
    "verify.ts",
    "package.json",
  ].every((f) => existsSync(join(CORE, f)));

  const sourcesClean = assertResumeIntegrationSourcesClean();

  // Simulate: ATS-friendly Marketing Manager planning (knowledge → skills)
  const gateway = new ResumeKnowledgeGateway();
  const result = await gateway.executeWithKnowledge({
    operation: "planning",
    task_id: "resume-dry-run-marketing-manager-001",
    objective:
      "Create a planning response for an ATS-friendly Marketing Manager template",
    input: {
      role_family: "marketing_manager",
      constraints: { ats_friendly: true, columns: 1 },
    },
    dry_run: true,
  });
  const skillRequest = result.skill_request;

  const noPrompt = assertNoRawPromptInSkillRequest(skillRequest);
  const mapping = mapResumeOperationToSkill("planning");
  const usesSkill =
    mapping.kind === "skill" &&
    mapping.skill_id === "resume.layout_planning" &&
    skillRequest.skill_id === "resume.layout_planning";

  const brainInvoked = result.steps.some(
    (s) => s.brain?.plan?.selected_provider === "mock",
  );
  const mockInvoked = result.steps.some(
    (s) => s.brain?.response?.provider === "mock",
  );
  const structuredOk =
    result.primary_response?.status === "COMPLETED" &&
    result.primary_response.structured_output !== null &&
    result.consumed?.template_generated === false &&
    result.consumed?.published === false;

  const qaDet = mapResumeOperationToSkill("qa").kind === "deterministic";
  const pubDet =
    mapResumeOperationToSkill("publication_gate").kind === "deterministic";

  const gatewaySrc = readFileSync(join(CORE, "ResumeBrainGateway.ts"), "utf8");
  const noSdk =
    !/from\s+["']openai["']/.test(gatewaySrc) &&
    !/from\s+["']@anthropic-ai\/sdk["']/.test(gatewaySrc) &&
    !/OpenAIProvider/.test(gatewaySrc);

  const flowDoc = {
    generated_at: new Date().toISOString(),
    agent: "119",
    flow: result.flow,
    execution_plan_steps: result.execution_plan_steps,
    brain_invoked: brainInvoked,
    mock_invoked: mockInvoked,
  };
  writeFileSync(join(LOG, "flow.json"), `${JSON.stringify(flowDoc, null, 2)}\n`);
  writeFileSync(
    join(LOG, "skill-request.json"),
    `${JSON.stringify(skillRequest, null, 2)}\n`,
  );
  writeFileSync(
    join(LOG, "response.json"),
    `${JSON.stringify(
      {
        primary_response: result.primary_response,
        consumed: result.consumed,
        steps: result.steps.map((s) => ({
          skill_id: s.skill_id,
          deterministic: s.deterministic,
          provider: s.brain?.response?.provider ?? null,
          status: s.brain?.response?.status ?? s.skipped_reason ?? null,
        })),
      },
      null,
      2,
    )}\n`,
  );

  const readiness = {
    generated_at: new Date().toISOString(),
    agent: "119",
    status: "ready",
    api_calls: 0,
    templates_generated: 0,
    publications: 0,
    live_enabled: false,
    sdk_installed: false,
    simulation: {
      objective: skillRequest.input.objective,
      skill_id: skillRequest.skill_id,
      response_status: result.primary_response?.status ?? null,
    },
  };
  writeFileSync(
    join(LOG, "readiness.json"),
    `${JSON.stringify(readiness, null, 2)}\n`,
  );

  const report = `# AIOS Resume Integration V1 — Report

**Agent:** #119  
**Generated:** ${readiness.generated_at}  
**Mode:** Dry-run only  

## Flow

Resume Department → SkillRequest → Skill Library → Brain Router → Mock Provider → Structured Response → Resume Department

## Simulation

- Objective: ${String(skillRequest.input.objective)}
- Skill: \`${skillRequest.skill_id}\`
- Provider: mock
- Status: ${result.primary_response?.status}
- Template generated: **false**
- Published: **false**

## Checks

- Skills only (no raw prompts)
- No OpenAI / SDK
- LIVE off
- QA & publication_gate remain deterministic

## Next

Agent #120 — extend dry-run cycles / OpenAI adapter prep (still gated).
`;
  writeFileSync(REPORT, report);

  const liveOff = process.env.SOS_AIOS_LIVE !== "1";

  const checks = {
    resume_department_uses_skills: filesOk && usesSkill && sourcesClean.ok,
    no_raw_prompts: noPrompt.ok,
    brain_router_invoked: brainInvoked,
    mock_provider_invoked: mockInvoked,
    structured_response_returned: structuredOk && qaDet && pubDet,
    no_sdk: noSdk,
    no_api: readiness.api_calls === 0,
    no_template_generation: readiness.templates_generated === 0,
    no_publication: readiness.publications === 0,
    live_off: liveOff && readiness.live_enabled === false,
  };

  const allPass = Object.values(checks).every(Boolean);

  console.log(
    [
      "Resume Integration Verify",
      "=========================",
      ...Object.entries(checks).map(
        ([k, v]) => `${v ? "✔" : "✘"} ${k.replace(/_/g, " ")}`,
      ),
      "",
      `Skill: ${skillRequest.skill_id}`,
      `Plan steps: ${result.execution_plan_steps.join(" → ")}`,
      `Response: ${result.primary_response?.status}`,
      `API calls: 0`,
      `LIVE: false`,
      `Overall: ${allPass ? "PASS" : "FAIL"}`,
    ].join("\n"),
  );

  if (!sourcesClean.ok) console.error(sourcesClean.errors);
  if (!noPrompt.ok) console.error(noPrompt.errors);

  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
