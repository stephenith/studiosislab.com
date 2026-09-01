/**
 * Production target intake verify — Agent #205.
 * Deterministic selection + canonical cycle consumption.
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
import { DEFAULT_PRODUCTION_TARGET } from "./ProductionTarget.js";
import {
  analyzeCategoryCoverage,
  selectNextProductionTarget,
} from "./selectProductionTarget.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const LOG = join(REPO, "SOS/07_LOGS/saios/production-target");
const REPORT = join(
  REPO,
  "SOS/09_REPORTS/AIOS_CANONICAL_RESUME_PRODUCTION_INTAKE_V1_REPORT.md",
);

async function main(): Promise<void> {
  mkdirSync(LOG, { recursive: true });
  if (process.env.SOS_AIOS_LIVE === "1") {
    console.error("LIVE must be OFF");
    process.exit(1);
  }

  const a = selectNextProductionTarget(undefined, {
    respectWaitingFounder: false,
    manifests: [],
    disable_strategy: true,
  });
  const b = selectNextProductionTarget(undefined, {
    respectWaitingFounder: false,
    manifests: [],
    disable_strategy: true,
  });
  if (!a || !b) {
    throw new Error("selectNextProductionTarget returned null in verify");
  }
  const coverage = analyzeCategoryCoverage();

  // Unique objective avoids collisions with prior verification-registry runs.
  const cycleTarget = {
    ...a,
    objective: `${a.objective} [verify-production-target ${Date.now()}]`,
  };

  const cycle = await runFirstProductionCycle({
    verification: true,
    verification_context: "aios-verify",
    pause_for_founder: true,
    select_target: false,
    target: cycleTarget,
  });

  const targetPath = join(CYCLE_LOG, "production-target.json");
  const persisted = existsSync(targetPath)
    ? (JSON.parse(readFileSync(targetPath, "utf8")) as Record<string, unknown>)
    : null;

  const providerLog = existsSync(join(CYCLE_LOG, "mock-provider.json"))
    ? (JSON.parse(
        readFileSync(join(CYCLE_LOG, "mock-provider.json"), "utf8"),
      ) as { provider?: string })
    : null;

  const defaultCycle = await runFirstProductionCycle({
    verification: true,
    verification_context: "aios-verify",
    pause_for_founder: true,
    // Backward-compat path for DEFAULT target fields; duplicate policy covered by #210 verify.
    duplicate_preflight: false,
  });

  const cycleSources = [
    readFileSync(join(import.meta.dirname, "runFirstProductionCycle.ts"), "utf8"),
    readFileSync(join(import.meta.dirname, "selectProductionTarget.ts"), "utf8"),
    readFileSync(join(import.meta.dirname, "ProductionTarget.ts"), "utf8"),
  ].join("\n");

  // Only flag real module imports — donor comments may mention legacy names.
  const noLegacyImport =
    !/from\s+["'][^"']*runtime\/scheduler[^"']*["']/.test(cycleSources) &&
    !/from\s+["'][^"']*unified-production[^"']*["']/.test(cycleSources) &&
    !/from\s+["'][^"']*ProductionExecutor[^"']*["']/.test(cycleSources);

  const checks: Record<string, boolean> = {
    deterministic_target_created:
      Boolean(a.category) &&
      Boolean(a.title) &&
      Boolean(a.industry) &&
      Boolean(a.seniority) &&
      Boolean(a.objective) &&
      a.category === b.category &&
      a.title === b.title &&
      a.objective === b.objective,
    category_selected: typeof a.category === "string" && a.category.length > 0,
    title_selected: typeof a.title === "string" && a.title.length > 0,
    industry_selected: typeof a.industry === "string" && a.industry.length > 0,
    seniority_selected:
      typeof a.seniority === "string" && a.seniority.length > 0,
    objective_generated:
      typeof a.objective === "string" && a.objective.length > 10,
    coverage_analysis_runs: coverage.length === 10,
    canonical_cycle_consumes_target:
      cycle.overall === "PASS" &&
      cycle.production_target.category === cycleTarget.category &&
      cycle.production_target.title === cycleTarget.title &&
      cycle.production_target.objective === cycleTarget.objective &&
      persisted?.category === cycleTarget.category &&
      persisted?.objective === cycleTarget.objective,
    default_target_backward_compatible:
      defaultCycle.overall === "PASS" &&
      defaultCycle.production_target.title ===
        DEFAULT_PRODUCTION_TARGET.title &&
      defaultCycle.production_target.category ===
        DEFAULT_PRODUCTION_TARGET.category &&
      defaultCycle.production_target.role_family ===
        DEFAULT_PRODUCTION_TARGET.role_family &&
      typeof defaultCycle.candidate_id === "string" &&
      defaultCycle.candidate_id.startsWith("cand-") &&
      typeof defaultCycle.task_id === "string" &&
      defaultCycle.task_id.startsWith("cycle-"),
    openai_or_mock_provider_ok:
      providerLog?.provider === "openai" || providerLog?.provider === "mock",
    waiting_founder:
      cycle.state === "WAITING_FOUNDER" && cycle.paused === true,
    publication_disabled:
      cycle.publication_allowed === false &&
      defaultCycle.publication_allowed === false,
    live_off: process.env.SOS_AIOS_LIVE !== "1",
    no_legacy_scheduler_import: noLegacyImport,
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
        agent: "205",
        overall: overall ? "PASS" : "FAIL",
        checks,
        selected: a,
        provider: providerLog?.provider ?? null,
        coverage: coverage.map((c) => ({
          category: c.category,
          saturation_score: c.saturation_score,
          priority_boost: c.priority_boost,
        })),
        cycle: {
          overall: cycle.overall,
          state: cycle.state,
          task_id: cycle.task_id,
          target: cycle.production_target,
          publication_allowed: cycle.publication_allowed,
        },
      },
      null,
      2,
    )}\n`,
  );

  writeFileSync(
    join(LOG, "selected-target.json"),
    `${JSON.stringify(a, null, 2)}\n`,
  );

  const reportBody = [
    `# AIOS Canonical Resume Production Intake V1 Report`,
    ``,
    `**Agent:** #205`,
    `**Overall:** ${overall ? "PASS" : "FAIL"}`,
    `**LIVE:** OFF`,
    ``,
    `## Summary`,
    ``,
    `Deterministic Resume Factory intake selects category / title / industry / seniority / objective`,
    `before ResumeKnowledgeGateway. Design style remains DesignBriefEngine.`,
    ``,
    `## Selected target`,
    ``,
    "```json",
    JSON.stringify(a, null, 2),
    "```",
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
    join(REPO, "SOS/SAIOS/AIOS_CANONICAL_RESUME_PRODUCTION_INTAKE_V1_REPORT.md"),
    reportBody,
    "utf8",
  );

  console.log("Production Target Intake Verify");
  console.log("===============================");
  for (const [k, v] of Object.entries(checks)) {
    console.log(`${v ? "✔" : "✘"} ${k}`);
  }
  console.log(
    `Selected: ${a.category} / ${a.title} / ${a.industry} / ${a.seniority}`,
  );
  console.log(`Provider: ${providerLog?.provider ?? "n/a"}`);
  console.log(`Cycle: ${cycle.state} · ${cycle.overall}`);
  console.log(`Overall: ${overall ? "PASS" : "FAIL"}`);
  if (!overall) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
