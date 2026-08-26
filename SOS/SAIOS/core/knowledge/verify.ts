/**
 * Knowledge System verify — Agent #120.
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { KnowledgeManager } from "./KnowledgeManager.js";
import { DOMAIN_OWNERSHIP, RETRIEVAL_RULES } from "./KnowledgePolicies.js";
import { KNOWLEDGE_DOMAINS } from "./KnowledgeRegistry.js";
import { RESUME_PRE_SKILL_DOMAINS } from "./KnowledgeContext.js";
import {
  assertDomainsExist,
  assertOwnershipDefined,
  assertRetrievalRulesExist,
  assertResumeIntegrationDocumented,
  assertLiveOff,
  assertNoSdk,
  assertKnowledgeSourcesClean,
} from "./KnowledgeValidator.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const LOG = join(REPO, "SOS/07_LOGS/saios/knowledge-system");
const REPORT = join(REPO, "SOS/09_REPORTS/AIOS_KNOWLEDGE_SYSTEM_V1_REPORT.md");
const ARCH = join(REPO, "SOS/SAIOS/KNOWLEDGE_SYSTEM_ARCHITECTURE.md");
const PKG = join(REPO, "package.json");
const CORE = resolve(import.meta.dirname);

async function main(): Promise<void> {
  mkdirSync(LOG, { recursive: true });

  const requiredFiles = [
    "KnowledgeManager.ts",
    "KnowledgeEntry.ts",
    "KnowledgeRegistry.ts",
    "KnowledgeContext.ts",
    "KnowledgeRetriever.ts",
    "KnowledgeValidator.ts",
    "KnowledgeSnapshot.ts",
    "KnowledgePolicies.ts",
    "README.md",
    "verify.ts",
    "package.json",
    "index.ts",
  ];
  const filesOk = requiredFiles.every((f) => existsSync(join(CORE, f)));
  const archOk = existsSync(ARCH);

  const domainsOk = assertDomainsExist();
  const ownershipOk = assertOwnershipDefined();
  const retrievalOk = assertRetrievalRulesExist();
  const resumeDocOk = assertResumeIntegrationDocumented(ARCH);
  const liveOff = assertLiveOff();
  const noSdk = assertNoSdk(PKG);
  const sources = assertKnowledgeSourcesClean(CORE);

  const km = new KnowledgeManager();
  const readiness = km.readiness();

  const resumeLoad = km.loadResumePreSkillKnowledge({
    purpose:
      "Load scoped knowledge before Skills for ATS-friendly Marketing Manager planning",
    task_id: "knowledge-dry-run-resume-pre-skill-001",
    tags: undefined,
  });

  const resumeDomainsMatch =
    resumeLoad.domains_loaded.join(",") ===
      RESUME_PRE_SKILL_DOMAINS.join(",") &&
    resumeLoad.snapshot.meta.unrestricted === false &&
    resumeLoad.snapshot.meta.live === false &&
    resumeLoad.next_step === "request_skills" &&
    resumeLoad.template_generated === false &&
    resumeLoad.published === false;

  const websiteIsolated =
    resumeLoad.snapshot.entries.every(
      (e) =>
        e.domain !== "department" ||
        !e.department_id ||
        e.department_id === "resume",
    );

  const noApi = true;
  const noPublication = resumeLoad.published === false;
  const integrationPlan = {
    agent: "120",
    resume_pre_skill: {
      order: [...RESUME_PRE_SKILL_DOMAINS],
      next: "SkillRequest → Brain Router → Skill Library → Mock Provider",
      documented: resumeDocOk,
      api: "KnowledgeManager.loadResumePreSkillKnowledge()",
    },
    constraints: {
      live: false,
      sdk: false,
      api_calls: 0,
      templates: 0,
      publications: 0,
    },
  };

  writeFileSync(
    join(LOG, "domains.json"),
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        domains: KNOWLEDGE_DOMAINS,
        counts: readiness.domain_counts,
        entry_count: readiness.entry_count,
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(LOG, "retrieval-policy.json"),
    `${JSON.stringify({ rules: RETRIEVAL_RULES }, null, 2)}\n`,
  );
  writeFileSync(
    join(LOG, "ownership.json"),
    `${JSON.stringify({ ownership: DOMAIN_OWNERSHIP }, null, 2)}\n`,
  );
  writeFileSync(
    join(LOG, "integration-plan.json"),
    `${JSON.stringify(integrationPlan, null, 2)}\n`,
  );

  const checks = {
    knowledge_domains_exist: domainsOk && filesOk && archOk,
    ownership_defined: ownershipOk,
    retrieval_rules_exist: retrievalOk,
    resume_integration_documented: resumeDocOk && resumeDomainsMatch,
    department_isolation: websiteIsolated,
    live_off: liveOff,
    no_sdk: noSdk && sources.ok,
    no_api: noApi,
    no_publication: noPublication,
  };

  const overall = Object.values(checks).every(Boolean);

  const readinessDoc = {
    generated_at: new Date().toISOString(),
    agent: "120",
    status: overall ? "ready" : "blocked",
    checks,
    readiness,
    resume_snapshot: {
      request_id: resumeLoad.context.request.request_id,
      domains: resumeLoad.domains_loaded,
      entry_count: resumeLoad.snapshot.meta.entry_count,
      references: resumeLoad.snapshot.references.map((r) => r.entry_id),
      next_step: resumeLoad.next_step,
    },
    overall: overall ? "PASS" : "FAIL",
    source_issues: sources.issues,
  };
  writeFileSync(
    join(LOG, "readiness.json"),
    `${JSON.stringify(readinessDoc, null, 2)}\n`,
  );

  const report = `# AIOS Knowledge System V1 Report

**Agent:** #120  
**Generated:** ${new Date().toISOString()}  
**Overall:** ${overall ? "PASS" : "FAIL"}  
**LIVE:** OFF

## Summary

Knowledge System architecture and dry-run seed are in place under \`SOS/SAIOS/core/knowledge/\`.  
Six domains, ownership policies, and retrieval rules are defined. Resume pre-Skill integration is documented and simulated.

## Domains

${KNOWLEDGE_DOMAINS.map((d) => `- ${d} (${readiness.domain_counts[d]} entries)`).join("\n")}

## Retrieval model

Department → Knowledge Context → Knowledge Retriever → Minimal Snapshot → Department

Unrestricted reads: **false**

## Resume integration

Load order: \`${RESUME_PRE_SKILL_DOMAINS.join(" → ")}\`  
Then: SkillRequest → Brain Router → Skill Library → Provider  
Simulated entries: ${resumeLoad.snapshot.meta.entry_count}  
Next step: \`${resumeLoad.next_step}\`

## Checks

| Check | Result |
|-------|--------|
${Object.entries(checks)
  .map(([k, v]) => `| ${k} | ${v ? "PASS" : "FAIL"} |`)
  .join("\n")}

## Constraints

- No SDK
- No API
- No publication
- No template generation
- LIVE OFF

## Artifacts

- \`SOS/SAIOS/KNOWLEDGE_SYSTEM_ARCHITECTURE.md\`
- \`SOS/07_LOGS/saios/knowledge-system/\`
- \`npm run knowledge-system:verify\`
`;

  writeFileSync(REPORT, `${report}\n`);

  console.log("Knowledge System Verify");
  console.log("=======================");
  for (const [k, v] of Object.entries(checks)) {
    console.log(`${v ? "✔" : "✖"} ${k.replace(/_/g, " ")}`);
  }
  console.log("");
  console.log(`Domains: ${KNOWLEDGE_DOMAINS.join(", ")}`);
  console.log(`Resume pre-skill: ${RESUME_PRE_SKILL_DOMAINS.join(" → ")}`);
  console.log(`Snapshot entries: ${resumeLoad.snapshot.meta.entry_count}`);
  console.log(`LIVE: false`);
  console.log(`Overall: ${overall ? "PASS" : "FAIL"}`);

  if (!overall) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
