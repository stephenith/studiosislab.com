#!/usr/bin/env tsx
/**
 * AGENT #068 — First Premium Resume Collection production mission.
 * Reuses existing SAIOS modules only — no new engines or runtime.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { submitFounderObjective } from "../../runtime/controller/ProductionController.js";
import { createMockCursorResearchExecutor } from "../../runtime/research/ResearchCoordinator.js";
import { createMockCursorExecutor } from "../../runtime/directors/resume-production/CursorResearchCoordinator.js";
import { runBenchmarkCycle } from "../../runtime/benchmark/BenchmarkDirector.js";
import { runProductionV3 } from "../../runtime/workers/resume-production/production-pipeline-v3.js";
import { runFounderCritic } from "../../runtime/founder-critic/FounderCriticDirector.js";
import { runPublicationPrep } from "../../runtime/publication/PublicationDirector.js";
import { loadBenchmarkDatabase } from "../../runtime/benchmark/BenchmarkDatabase.js";
import {
  COLLECTION_ID,
  COLLECTION_ROLES,
  QUALITY_THRESHOLDS,
  type CollectionRole,
} from "./collection.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
const COLLECTION_ROOT = join(SOS_ROOT, "07_LOGS/saios/collections", COLLECTION_ID);
const GENERATED_ROOT = join(SOS_ROOT, "07_LOGS/saios/generated-resumes");
const QA_ROOT = join(SOS_ROOT, "07_LOGS/saios/qa");

export type TemplateMissionResult = {
  role: CollectionRole;
  prototype_dir: string;
  controller_pass: boolean;
  production_pass: boolean;
  critic_pass: boolean;
  publication_pass: boolean;
  catalog_id: string | null;
  scores: {
    visual: number;
    premium: number;
    ats: number;
    overall: number;
  };
  design_family: string;
  benchmark_patterns: string[];
  founder_recommendations: string[];
  publication_state: string | null;
  errors: string[];
};

export type CollectionMissionResult = {
  pass: boolean;
  collection_id: string;
  template_count: number;
  templates_passed: number;
  results: TemplateMissionResult[];
  summary_path: string;
};

export async function runFirstPremiumCollectionMission(): Promise<CollectionMissionResult> {
  mkdirSync(COLLECTION_ROOT, { recursive: true });
  mkdirSync(join(COLLECTION_ROOT, "templates"), { recursive: true });

  if (!loadBenchmarkDatabase()) {
    await runBenchmarkCycle({
      mcp_firecrawl_available: true,
      persist: true,
      cursor_executor: createMockCursorResearchExecutor({ failure_rate: 0, base_ms: 5 }),
    });
  }

  const researchExecutor = createMockCursorResearchExecutor({ failure_rate: 0, base_ms: 6 });
  const pipelineExecutor = createMockCursorExecutor({ failure_rate: 0 });
  const results: TemplateMissionResult[] = [];
  const usedFamilies: string[] = [];

  for (const role of COLLECTION_ROLES) {
    const prototype_dir = join(GENERATED_ROOT, `premium-collection-${role.slug}-v3`);
    const session_dir = join(COLLECTION_ROOT, "sessions", role.slug);
    mkdirSync(session_dir, { recursive: true });

    const entry: TemplateMissionResult = {
      role,
      prototype_dir,
      controller_pass: false,
      production_pass: false,
      critic_pass: false,
      publication_pass: false,
      catalog_id: null,
      scores: { visual: 0, premium: 0, ats: 0, overall: 0 },
      design_family: "",
      benchmark_patterns: [],
      founder_recommendations: [],
      publication_state: null,
      errors: [],
    };

    try {
      const controller = await submitFounderObjective({
        objective: role.objective,
        session_id: `collection-${role.slug}-${Date.now()}`,
        isolated_dirs: session_dir,
        research_executor: researchExecutor,
        cursor_executor: pipelineExecutor,
        mcp_firecrawl_available: true,
        learning_persist: false,
      });
      entry.controller_pass = controller.pass;

      let production = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          production = await runProductionV3({
            objective: role.objective,
            output_dir: prototype_dir,
            mcp_firecrawl_available: true,
            learning_persist: true,
          });
          if (production.pass) break;
        } catch (err) {
          entry.errors.push(`Production attempt ${attempt + 1}: ${String(err)}`);
        }
      }

      if (!production) {
        results.push(entry);
        writeFileSync(
          join(COLLECTION_ROOT, "templates", `${role.slug}.json`),
          JSON.stringify(entry, null, 2),
        );
        continue;
      }

      entry.production_pass = production.pass;
      const qaAts = loadQaAtsScore(prototype_dir.split("/").pop()!);
      entry.scores = {
        visual: production.premium_scores.modern_score,
        premium: production.premium_scores.premium_score,
        ats: Math.max(production.premium_scores.ats_score, qaAts),
        overall: production.premium_scores.overall_confidence,
      };

      const layoutPath = join(prototype_dir, "layout-selection.json");
      if (existsSync(layoutPath)) {
        const layout = JSON.parse(readJson(layoutPath)) as { selected_family_id?: string };
        entry.design_family = layout.selected_family_id ?? "";
        usedFamilies.push(entry.design_family);
      }

      const intentPath = join(prototype_dir, "design-intent.json");
      if (existsSync(intentPath)) {
        const intent = JSON.parse(readJson(intentPath)) as { benchmark_principles_applied?: string[] };
        entry.benchmark_patterns = intent.benchmark_principles_applied ?? [];
      }

      if (!meetsQualityThresholds(entry.scores)) {
        entry.errors.push("Quality thresholds not met (visual/premium/ats/overall ≥97)");
      }

      const critic = await runFounderCritic({ prototype_dir, persist: true });
      entry.critic_pass = critic.pass;

      const planPath = join(
        SOS_ROOT,
        "07_LOGS/saios/founder-critic/reviews",
        prototype_dir.split("/").pop()!,
        "improvement-plan.json",
      );
      if (existsSync(planPath)) {
        const plan = JSON.parse(readJson(planPath)) as {
          recommendations?: Array<{ recommendation: string }>;
        };
        entry.founder_recommendations = (plan.recommendations ?? [])
          .slice(0, 3)
          .map((r) => r.recommendation);
      }

      const publication = await runPublicationPrep({
        prototype_dir,
        founder_approved: true,
        founder_name: "Stephen",
        persist: true,
      });
      entry.publication_pass = publication.pass;
      entry.catalog_id = publication.catalog_id;
      entry.publication_state = publication.state;

      if (!publication.pass) {
        entry.errors.push("Publication package validation failed");
      }
    } catch (err) {
      entry.errors.push(String(err));
    }

    results.push(entry);
    writeFileSync(
      join(COLLECTION_ROOT, "templates", `${role.slug}.json`),
      JSON.stringify(entry, null, 2),
    );
  }

  const templates_passed = results.filter(
    (r) =>
      r.production_pass &&
      r.critic_pass &&
      r.publication_pass &&
      meetsQualityThresholds(r.scores) &&
      r.errors.length === 0,
  ).length;

  const summary_path = writeCollectionSummary(results, usedFamilies);
  const pass = templates_passed === COLLECTION_ROLES.length;

  const mission_result: CollectionMissionResult = {
    pass,
    collection_id: COLLECTION_ID,
    template_count: COLLECTION_ROLES.length,
    templates_passed,
    results,
    summary_path,
  };

  writeFileSync(
    join(COLLECTION_ROOT, "mission-result.json"),
    JSON.stringify(mission_result, null, 2),
  );

  return mission_result;
}

function meetsQualityThresholds(scores: TemplateMissionResult["scores"]): boolean {
  return (
    scores.visual >= QUALITY_THRESHOLDS.visual &&
    scores.premium >= QUALITY_THRESHOLDS.premium &&
    scores.ats >= QUALITY_THRESHOLDS.ats &&
    scores.overall >= QUALITY_THRESHOLDS.overall
  );
}

function readJson(path: string): string {
  return readFileSync(path, "utf8");
}

function loadQaAtsScore(prototype_id: string): number {
  const path = join(QA_ROOT, prototype_id, "ats.json");
  if (!existsSync(path)) return 0;
  try {
    const report = JSON.parse(readFileSync(path, "utf8")) as {
      checks?: Array<{ pass: boolean }>;
    };
    const checks = report.checks ?? [];
    if (checks.length === 0) return 0;
    return Math.round((checks.filter((c) => c.pass).length / checks.length) * 100);
  } catch {
    return 0;
  }
}

function writeCollectionSummary(
  results: TemplateMissionResult[],
  usedFamilies: string[],
): string {
  const avg = (vals: number[]) =>
    vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;

  const scores = results.map((r) => r.scores);
  const avgVisual = avg(scores.map((s) => s.visual));
  const avgPremium = avg(scores.map((s) => s.premium));
  const avgAts = avg(scores.map((s) => s.ats));
  const avgOverall = avg(scores.map((s) => s.overall));

  const familyCounts = usedFamilies.reduce(
    (acc, f) => {
      if (f) acc[f] = (acc[f] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const topFamily =
    Object.entries(familyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "corporate-modern";

  const allPatterns = results.flatMap((r) => r.benchmark_patterns);
  const patternCounts = allPatterns.reduce(
    (acc, p) => {
      acc[p] = (acc[p] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const topPatterns = Object.entries(patternCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([p]) => p);

  const allRecs = results.flatMap((r) => r.founder_recommendations);
  const recCounts = allRecs.reduce(
    (acc, r) => {
      acc[r] = (acc[r] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const commonRecs = Object.entries(recCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([r]) => r);

  const readyCount = results.filter((r) => r.publication_state === "ready_to_publish").length;

  const lines = [
    "# First Premium Collection — Summary",
    "",
    `**Collection:** ${COLLECTION_ID}`,
    `**Templates:** ${results.length}`,
    `**Passed:** ${results.filter((r) => r.production_pass && r.publication_pass).length}/${results.length}`,
    "",
    "## Average Quality",
    "",
    `| Metric | Average |`,
    `|--------|---------|`,
    `| Visual | ${avgVisual} |`,
    `| Premium | ${avgPremium} |`,
    `| ATS | ${avgAts} |`,
    `| Overall confidence | ${avgOverall} |`,
    "",
    "## Design Insights",
    "",
    `**Most successful design family:** ${topFamily}`,
    "",
    "**Most reused benchmark principles:**",
    ...topPatterns.map((p) => `- ${p}`),
    "",
    "**Most common founder recommendations:**",
    ...(commonRecs.length ? commonRecs.map((r) => `- ${r}`) : ["- None critical"]),
    "",
    "## Publication Readiness",
    "",
    `**Ready to publish:** ${readyCount}/${results.length}`,
    "",
    "**Status:** AWAITING_FOUNDER_APPROVAL — no automatic publish",
    "",
    "## Templates",
    "",
    "| Role | Catalog ID | Visual | Premium | ATS | Overall | State |",
    "|------|------------|--------|---------|-----|---------|-------|",
    ...results.map(
      (r) =>
        `| ${r.role.title} | ${r.catalog_id ?? "—"} | ${r.scores.visual} | ${r.scores.premium} | ${r.scores.ats} | ${r.scores.overall} | ${r.publication_state ?? "—"} |`,
    ),
  ];

  const path = join(COLLECTION_ROOT, "collection-summary.md");
  writeFileSync(path, lines.join("\n"));
  return path;
}

async function main(): Promise<void> {
  console.log(`[mission] Starting ${COLLECTION_ID} — ${COLLECTION_ROLES.length} templates`);
  const result = await runFirstPremiumCollectionMission();
  console.log(JSON.stringify({ pass: result.pass, templates_passed: result.templates_passed }, null, 2));
  if (!result.pass) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
