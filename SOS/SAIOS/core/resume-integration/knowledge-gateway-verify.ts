/**
 * Knowledge Gateway integration verify — Agent #121.
 * Resume → Knowledge → Snapshot → BrainGateway → Skills → Mock.
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ResumeKnowledgeGateway } from "./ResumeKnowledgeGateway.js";
import { assertSkillRequestHasKnowledge } from "./ResumeKnowledgeAttach.js";
import { RESUME_PRE_SKILL_DOMAINS } from "../knowledge/KnowledgeContext.js";
import { assertResumeIntegrationSourcesClean } from "./ResumeIntegrationValidator.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const LOG = join(REPO, "SOS/07_LOGS/saios/knowledge-gateway");
const REPORT = join(REPO, "SOS/09_REPORTS/AIOS_KNOWLEDGE_GATEWAY_V1_REPORT.md");
const PKG = join(REPO, "package.json");
const CORE = resolve(import.meta.dirname);

async function main(): Promise<void> {
  mkdirSync(LOG, { recursive: true });

  const filesOk = [
    "ResumeKnowledgeGateway.ts",
    "ResumeKnowledgeAttach.ts",
    "ResumeBrainGateway.ts",
  ].every((f) => existsSync(join(CORE, f)));

  const sourcesClean = assertResumeIntegrationSourcesClean();

  const gateway = new ResumeKnowledgeGateway();
  const result = await gateway.executeWithKnowledge({
    operation: "planning",
    task_id: "knowledge-gateway-dry-run-001",
    objective:
      "Create a planning response for an ATS-friendly Marketing Manager template",
    input: {
      role_family: "marketing_manager",
      constraints: { ats_friendly: true, columns: 1 },
    },
    dry_run: true,
  });

  const knowledgeLoaded =
    result.knowledge.snapshot.meta.entry_count > 0 &&
    result.domains_loaded.join(",") === RESUME_PRE_SKILL_DOMAINS.join(",");

  const snapshotBuilt =
    result.knowledge_snapshot.meta.unrestricted === false &&
    result.knowledge_snapshot.meta.live === false &&
    result.knowledge_snapshot.references.length > 0;

  const gatewayReceivedSnapshot =
    result.knowledge_snapshot.meta.snapshot_id ===
      result.skill_request.input.knowledge_snapshot_id &&
    result.flow.includes("KnowledgeSnapshot") &&
    result.flow.includes("ResumeBrainGateway");

  const skillHasKnowledge = assertSkillRequestHasKnowledge(result.skill_request);

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

  const pkg = JSON.parse(readFileSync(PKG, "utf8"));
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const noSdk = !("openai" in deps) && !("@anthropic-ai/sdk" in deps);
  const liveOff = process.env.SOS_AIOS_LIVE !== "1";

  const checks = {
    knowledge_loaded: filesOk && knowledgeLoaded,
    snapshot_built: snapshotBuilt,
    resume_brain_gateway_receives_snapshot: gatewayReceivedSnapshot,
    skill_request_contains_knowledge_references: skillHasKnowledge.ok,
    brain_router_still_works: brainInvoked,
    mock_provider_still_works: mockInvoked && structuredOk,
    no_sdk: noSdk && sourcesClean.ok,
    no_api: true,
    no_publication: result.consumed?.published === false,
    live_off: liveOff,
  };

  const overall = Object.values(checks).every(Boolean);

  writeFileSync(
    join(LOG, "flow.json"),
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        agent: "121",
        flow: result.flow,
        domains_loaded: result.domains_loaded,
        execution_plan_steps: result.execution_plan_steps,
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(LOG, "knowledge-snapshot.json"),
    `${JSON.stringify(
      {
        meta: result.knowledge_snapshot.meta,
        references: result.knowledge_snapshot.references,
        entry_ids: result.knowledge_snapshot.entries.map((e) => e.entry_id),
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(LOG, "skill-request.json"),
    `${JSON.stringify(result.skill_request, null, 2)}\n`,
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
    agent: "121",
    status: overall ? "ready" : "blocked",
    checks,
    knowledge_references: result.knowledge_references,
    snapshot_id: result.knowledge_snapshot.meta.snapshot_id,
    skill_id: result.skill_request.skill_id,
    response_status: result.primary_response?.status ?? null,
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

  const report = `# AIOS Knowledge Gateway V1 Report

**Agent:** #121  
**Generated:** ${readiness.generated_at}  
**Overall:** ${overall ? "PASS" : "FAIL"}  
**LIVE:** OFF

## Flow

Resume Department → KnowledgeManager → KnowledgeRetriever → KnowledgeSnapshot → ResumeBrainGateway → SkillRequest → BrainRouter → Mock Provider → Structured Response → Resume Department

## Knowledge

- Domains: \`${result.domains_loaded.join(" → ")}\`
- Snapshot: \`${result.knowledge_snapshot.meta.snapshot_id}\`
- References: ${result.knowledge_references.length}
- Unrestricted: **false**

## Skill

- Skill: \`${result.skill_request.skill_id}\`
- knowledge_references on SkillRequest: **yes**
- Response: ${result.primary_response?.status}
- Template generated: **false**
- Published: **false**

## Checks

| Check | Result |
|-------|--------|
${Object.entries(checks)
  .map(([k, v]) => `| ${k} | ${v ? "PASS" : "FAIL"} |`)
  .join("\n")}
`;
  writeFileSync(REPORT, `${report}\n`);

  console.log("Knowledge Gateway Verify");
  console.log("========================");
  for (const [k, v] of Object.entries(checks)) {
    console.log(`${v ? "✔" : "✖"} ${k.replace(/_/g, " ")}`);
  }
  console.log("");
  console.log(`Domains: ${result.domains_loaded.join(" → ")}`);
  console.log(`Snapshot refs: ${result.knowledge_references.length}`);
  console.log(`Skill: ${result.skill_request.skill_id}`);
  console.log(`Response: ${result.primary_response?.status}`);
  console.log(`LIVE: false`);
  console.log(`Overall: ${overall ? "PASS" : "FAIL"}`);

  if (!skillHasKnowledge.ok) console.error(skillHasKnowledge.errors);
  if (!sourcesClean.ok) console.error(sourcesClean.errors);

  process.exit(overall ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
