/**
 * Canonical research integration verify — Agent #206.
 * LIVE OFF. No publication. No scheduler activation.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import dotenv from "dotenv";
dotenv.config({
  path: resolve(process.cwd(), ".env.local"),
});
import {
  CYCLE_LOG,
  runFirstProductionCycle,
} from "./runFirstProductionCycle.js";
import { assertResearchContext } from "./ResearchContext.js";
import { buildResearchContext } from "./buildResearchContext.js";
import { selectNextProductionTarget } from "./selectProductionTarget.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const LOG = join(REPO, "SOS/07_LOGS/saios/research-integration");
const REPORT = join(
  REPO,
  "SOS/09_REPORTS/AIOS_CANONICAL_RESUME_RESEARCH_INTEGRATION_V1_REPORT.md",
);

async function main(): Promise<void> {
  mkdirSync(LOG, { recursive: true });
  if (process.env.SOS_AIOS_LIVE === "1") {
    console.error("LIVE must be OFF");
    process.exit(1);
  }

  const target = selectNextProductionTarget();
  const researchA = buildResearchContext(target);
  const researchB = buildResearchContext(target);

  const cycle = await runFirstProductionCycle({
    verification: true,
    verification_context: "aios-verify",
    pause_for_founder: true,
    select_target: true,
  });

  const researchPath = join(CYCLE_LOG, "research-context.json");
  const handoffPath = join(CYCLE_LOG, "research-handoff.json");
  const targetPath = join(CYCLE_LOG, "production-target.json");
  const brainPath = join(CYCLE_LOG, "brain.json");
  const providerPath = join(CYCLE_LOG, "mock-provider.json");

  const persistedResearch = existsSync(researchPath)
    ? (JSON.parse(readFileSync(researchPath, "utf8")) as Record<string, unknown>)
    : null;
  const handoff = existsSync(handoffPath)
    ? (JSON.parse(readFileSync(handoffPath, "utf8")) as Record<string, unknown>)
    : null;
  const brain = existsSync(brainPath)
    ? (JSON.parse(readFileSync(brainPath, "utf8")) as Record<string, unknown>)
    : null;
  const provider = existsSync(providerPath)
    ? (JSON.parse(readFileSync(providerPath, "utf8")) as {
        provider?: string;
        structured_output?: Record<string, unknown> | null;
      })
    : null;

  const sources = [
    readFileSync(join(import.meta.dirname, "buildResearchContext.ts"), "utf8"),
    readFileSync(join(import.meta.dirname, "runFirstProductionCycle.ts"), "utf8"),
  ].join("\n");

  const noLegacyEngineImport =
    !/from\s+["'][^"']*runtime\/research[^"']*["']/.test(sources) &&
    !/from\s+["'][^"']*unified-production[^"']*["']/.test(sources) &&
    !/from\s+["'][^"']*runtime\/scheduler[^"']*["']/.test(sources);

  const checks: Record<string, boolean> = {
    production_target_generated:
      existsSync(targetPath) &&
      Boolean(cycle.production_target?.category) &&
      Boolean(cycle.production_target?.objective),
    research_context_generated:
      assertResearchContext(researchA) &&
      researchA.category === researchB.category &&
      JSON.stringify(researchA.ats_guidance) ===
        JSON.stringify(researchB.ats_guidance) &&
      assertResearchContext(cycle.research_context) &&
      existsSync(researchPath) &&
      Boolean(persistedResearch?.ats_guidance) &&
      Boolean(persistedResearch?.typography_guidance) &&
      Boolean(persistedResearch?.layout_guidance) &&
      Boolean(persistedResearch?.industry_guidance) &&
      Array.isArray(persistedResearch?.research_sources),
    gateway_receives_both:
      handoff?.research_attached === true &&
      brain?.research_attached === true &&
      brain?.research_briefing_present === true &&
      cycle.research_context.category === cycle.production_target.category,
    openai_or_mock_enriched:
      (provider?.provider === "openai" || provider?.provider === "mock") &&
      provider?.structured_output != null &&
      handoff?.research_briefing != null,
    pipeline_includes_research:
      cycle.stages.some((s) => s.stage === "research" && s.status === "completed") &&
      cycle.stages.some((s) => s.stage === "production_intake"),
    waiting_founder:
      cycle.state === "WAITING_FOUNDER" && cycle.paused === true && cycle.overall === "PASS",
    publication_disabled: cycle.publication_allowed === false,
    live_off: process.env.SOS_AIOS_LIVE !== "1",
    no_legacy_research_engine_import: noLegacyEngineImport,
    runtime_guard_present: existsSync(
      join(REPO, "SOS/SAIOS/architecture/runtime-guard.ts"),
    ),
  };

  const overall = Object.values(checks).every(Boolean);

  writeFileSync(
    join(LOG, "readiness.json"),
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        agent: "206",
        overall: overall ? "PASS" : "FAIL",
        checks,
        target: cycle.production_target,
        research: {
          category: cycle.research_context.category,
          ats_tier: cycle.research_context.ats_guidance.compatibility_tier,
          sources: cycle.research_context.research_sources.length,
        },
        provider: provider?.provider ?? null,
        cycle: {
          overall: cycle.overall,
          state: cycle.state,
          publication_allowed: cycle.publication_allowed,
        },
      },
      null,
      2,
    )}\n`,
  );

  const reportBody = [
    `# AIOS Canonical Resume Research Integration V1 Report`,
    ``,
    `**Agent:** #206`,
    `**Overall:** ${overall ? "PASS" : "FAIL"}`,
    `**LIVE:** OFF`,
    ``,
    `## Summary`,
    ``,
    `Canonical research stage builds deterministic ResearchContext after ProductionTarget`,
    `and before ResumeKnowledgeGateway. OpenAI/Mock planning receives research_briefing`,
    `via ResumeBrainGateway instructions. DesignBriefEngine remains visual owner.`,
    ``,
    `## Target + Research`,
    ``,
    `- category: **${cycle.production_target.category}**`,
    `- title: ${cycle.production_target.title}`,
    `- ATS tier: ${cycle.research_context.ats_guidance.compatibility_tier}`,
    `- layout: ${cycle.research_context.layout_guidance.structure}`,
    `- sources: ${cycle.research_context.research_sources.length}`,
    `- provider: ${provider?.provider ?? "n/a"}`,
    ``,
    `| Check | Result |`,
    `|-------|--------|`,
    ...Object.entries(checks).map(
      ([k, v]) => `| ${k} | ${v ? "PASS" : "FAIL"} |`,
    ),
    ``,
  ].join("\n");

  writeFileSync(REPORT, reportBody, "utf8");
  writeFileSync(
    join(
      REPO,
      "SOS/SAIOS/AIOS_CANONICAL_RESUME_RESEARCH_INTEGRATION_V1_REPORT.md",
    ),
    reportBody,
    "utf8",
  );

  console.log("Canonical Research Integration Verify");
  console.log("=====================================");
  for (const [k, v] of Object.entries(checks)) {
    console.log(`${v ? "✔" : "✘"} ${k}`);
  }
  console.log(
    `Target: ${cycle.production_target.category} / ${cycle.production_target.title}`,
  );
  console.log(
    `Research: ${cycle.research_context.ats_guidance.compatibility_tier} · sources=${cycle.research_context.research_sources.length}`,
  );
  console.log(`Provider: ${provider?.provider ?? "n/a"}`);
  console.log(`Cycle: ${cycle.state} · ${cycle.overall}`);
  console.log(`Overall: ${overall ? "PASS" : "FAIL"}`);
  if (!overall) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
