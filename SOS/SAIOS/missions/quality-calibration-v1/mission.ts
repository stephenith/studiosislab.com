/**
 * Quality calibration v1 — regenerate Software Engineer and compare before/after.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { appendFounderCalibration } from "../../runtime/workers/resume-production/founder-calibration.js";
import { runProductionV3 } from "../../runtime/workers/resume-production/production-pipeline-v3.js";
import { runVisualRenderEvaluation } from "../../runtime/visual-render/VisualRenderDirector.js";
import { runFounderCritic } from "../../runtime/founder-critic/FounderCriticDirector.js";
import { scoreBand } from "../../runtime/workers/resume-production/founder-calibration.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
const CAL_ROOT = join(SOS_ROOT, "07_LOGS/saios/quality-calibration-v1");
const BEFORE_DIR = join(
  SOS_ROOT,
  "07_LOGS/saios/production-batch-001/templates/software-engineer/artifacts",
);
const BEFORE_GENERATED = join(
  SOS_ROOT,
  "07_LOGS/saios/generated-resumes/production-batch-001-software-engineer",
);
const AFTER_DIR = join(CAL_ROOT, "software-engineer-after");
const OBJECTIVE =
  "Production batch 001: Premium ATS resume template for a senior software engineer. Technical projects, clean hierarchy, Fabric 6.9.1, founder publication quality.";

export type QualitySnapshot = {
  source: string;
  page_utilization: number | null;
  content_bottom_px: number | null;
  name_size_pt: number | null;
  body_size_pt: number | null;
  section_size_pt: number | null;
  visual: number | null;
  premium: number | null;
  render: number | null;
  overall: number | null;
  ats: number | null;
};

function extractMetricsFromTemplate(templatePath: string): Partial<QualitySnapshot> {
  if (!existsSync(templatePath)) return {};
  const json = JSON.parse(readFileSync(templatePath, "utf8")) as {
    height: number;
    objects: Array<{ type?: string; fontSize?: number; top?: number; lineHeight?: number; text?: string }>;
  };
  const textboxes = json.objects.filter((o) => String(o.type).toLowerCase() === "textbox");
  const fontSizes = textboxes.map((o) => Number(o.fontSize ?? 0)).filter((n) => n > 0);
  const nameSize = Math.max(...fontSizes, 0);
  const bodySizes = fontSizes.filter((n) => n < 20);
  const sectionSizes = textboxes
    .filter((o) => /^[A-Z\s]+$/.test(String(o.text ?? "")))
    .map((o) => Number(o.fontSize ?? 0));
  const contentBottom = textboxes.reduce((max, o) => {
    const top = Number(o.top ?? 0);
    const fs = Number(o.fontSize ?? 11);
    const lh = Number(o.lineHeight ?? 1.35);
    return Math.max(max, top + fs * lh * 2);
  }, 0);
  const h = json.height ?? 1123;
  return {
    page_utilization: Math.round((contentBottom / h) * 1000) / 1000,
    content_bottom_px: Math.round(contentBottom),
    name_size_pt: nameSize || null,
    body_size_pt: bodySizes.length ? Math.min(...bodySizes) : null,
    section_size_pt: sectionSizes.length ? Math.max(...sectionSizes) : null,
  };
}

function loadBeforeScores(): Partial<QualitySnapshot> {
  const resultPath = join(
    SOS_ROOT,
    "07_LOGS/saios/production-batch-001/templates/software-engineer/result.json",
  );
  if (!existsSync(resultPath)) return {};
  const result = JSON.parse(readFileSync(resultPath, "utf8")) as {
    scores: { visual: number; premium: number; render: number; overall: number; ats: number };
  };
  return {
    source: "production-batch-001",
    visual: result.scores.visual,
    premium: result.scores.premium,
    render: result.scores.render,
    overall: result.scores.overall,
    ats: result.scores.ats,
  };
}

function snapshotBefore(): QualitySnapshot {
  const templatePath = existsSync(join(BEFORE_DIR, "template-preview.json"))
    ? join(BEFORE_DIR, "template-preview.json")
    : join(BEFORE_GENERATED, "template-preview.json");
  return {
    source: "production-batch-001 (pre-calibration)",
    ...extractMetricsFromTemplate(templatePath),
    ...loadBeforeScores(),
  } as QualitySnapshot;
}

export async function runQualityCalibration(): Promise<{
  pass: boolean;
  before: QualitySnapshot;
  after: QualitySnapshot;
  output_dir: string;
}> {
  mkdirSync(CAL_ROOT, { recursive: true });
  mkdirSync(join(CAL_ROOT, "before"), { recursive: true });

  const before = snapshotBefore();
  const beforeTemplate = existsSync(join(BEFORE_DIR, "template-preview.json"))
    ? join(BEFORE_DIR, "template-preview.json")
    : join(BEFORE_GENERATED, "template-preview.json");
  if (existsSync(beforeTemplate)) {
    writeFileSync(join(CAL_ROOT, "before", "template-preview.json"), readFileSync(beforeTemplate));
  }
  writeFileSync(join(CAL_ROOT, "before", "snapshot.json"), JSON.stringify(before, null, 2));

  const calibration = appendFounderCalibration();
  writeFileSync(join(CAL_ROOT, "founder-calibration.json"), JSON.stringify(calibration, null, 2));

  const productionObjectives = [
    OBJECTIVE,
    `${OBJECTIVE} Operations-management layout; differentiate from recent production memory.`,
    `${OBJECTIVE} Minimal-ats single-column; unique family selection required.`,
    `${OBJECTIVE} Executive-ats hierarchy; alternate family for batch originality.`,
    `${OBJECTIVE} Administrative-ats conservative layout; skills-forward metrics block.`,
    `${OBJECTIVE} Hybrid corporate-modern with distinct spacing rhythm and alternate section emphasis.`,
  ];

  let production = null;
  for (let i = 0; i < productionObjectives.length; i++) {
    try {
      production = await runProductionV3({
        objective: productionObjectives[i]!,
        output_dir: AFTER_DIR,
        mcp_firecrawl_available: true,
        learning_persist: false,
        seed: 1001 + i,
      });
      break;
    } catch {
      /* retry with alternate objective */
    }
  }
  if (!production) {
    throw new Error("Production failed after calibration retries");
  }

  if (!production.qa_pass) {
    throw new Error(`Production QA failed: ${AFTER_DIR}`);
  }

  const render = await runVisualRenderEvaluation({
    template_path: join(AFTER_DIR, "template-preview.json"),
    mcp_firecrawl_available: true,
    persist: true,
  });

  await runFounderCritic({
    prototype_dir: AFTER_DIR,
    objective: OBJECTIVE,
    persist: true,
  });

  const afterMetrics = extractMetricsFromTemplate(join(AFTER_DIR, "template-preview.json"));
  const after: QualitySnapshot = {
    source: "quality-calibration-v1 (post-calibration)",
    ...afterMetrics,
    visual: Math.max(production.premium_scores.modern_score, render.scores.premium_score),
    premium: production.premium_scores.premium_score,
    render: render.scores.overall_render_score,
    overall: production.confidence.overall_confidence,
    ats: production.premium_scores.ats_score,
  };

  const delta = buildDelta(before, after);
  writeFileSync(join(CAL_ROOT, "quality-delta.json"), JSON.stringify(delta, null, 2));
  mkdirSync(join(CAL_ROOT, "after"), { recursive: true });
  writeFileSync(join(CAL_ROOT, "after", "snapshot.json"), JSON.stringify(after, null, 2));
  writeFileSync(join(CAL_ROOT, "improvement-comparison.md"), buildComparisonMd(before, after, delta, production));

  const pass = verifyImprovements(before, after, production, render);
  writeFileSync(join(CAL_ROOT, "verification.json"), JSON.stringify({ pass, before, after, delta }, null, 2));

  return { pass, before, after, output_dir: CAL_ROOT };
}

function buildDelta(before: QualitySnapshot, after: QualitySnapshot) {
  const diff = (a: number | null, b: number | null) =>
    a != null && b != null ? Math.round((b - a) * 1000) / 1000 : null;
  return {
    page_utilization_delta: diff(before.page_utilization, after.page_utilization),
    content_bottom_px_delta: diff(before.content_bottom_px, after.content_bottom_px),
    name_size_pt_delta: diff(before.name_size_pt, after.name_size_pt),
    body_size_pt_delta: diff(before.body_size_pt, after.body_size_pt),
    section_size_pt_delta: diff(before.section_size_pt, after.section_size_pt),
    visual_score_delta: diff(before.visual, after.visual),
    premium_score_delta: diff(before.premium, after.premium),
    render_score_delta: diff(before.render, after.render),
    overall_score_delta: diff(before.overall, after.overall),
    before_score_band: {
      visual: before.visual != null ? scoreBand(before.visual) : null,
      premium: before.premium != null ? scoreBand(before.premium) : null,
      render: before.render != null ? scoreBand(before.render) : null,
    },
    after_score_band: {
      visual: after.visual != null ? scoreBand(after.visual) : null,
      premium: after.premium != null ? scoreBand(after.premium) : null,
      render: after.render != null ? scoreBand(after.render) : null,
    },
    scores_now_realistic:
      (after.premium ?? 100) < 98 &&
      (after.overall ?? 100) < 97 &&
      !((before.visual === 100 && before.premium === 100 && before.render === 100) &&
        (after.visual === 100 && after.premium === 100 && after.render === 100)),
  };
}

function verifyImprovements(
  before: QualitySnapshot,
  after: QualitySnapshot,
  production: Awaited<ReturnType<typeof runProductionV3>>,
  render: Awaited<ReturnType<typeof runVisualRenderEvaluation>>,
): boolean {
  const utilImproved = (after.page_utilization ?? 0) > (before.page_utilization ?? 0);
  const utilInTarget =
    (after.page_utilization ?? 0) >= 0.78 && (after.page_utilization ?? 0) <= 0.92;
  const typeImproved =
    (after.name_size_pt ?? 0) >= (before.name_size_pt ?? 0) &&
    (after.body_size_pt ?? 0) >= (before.body_size_pt ?? 0);
  const scoresRealistic =
    (after.premium ?? 100) < 98 &&
    (after.overall ?? 100) < 97 &&
    !((after.visual === 100 && after.premium === 100 && after.render === 100));
  const pipelinePass = production.qa_pass && render.pass;
  return utilImproved && utilInTarget && typeImproved && scoresRealistic && pipelinePass;
}

function buildComparisonMd(
  before: QualitySnapshot,
  after: QualitySnapshot,
  delta: ReturnType<typeof buildDelta>,
  production: Awaited<ReturnType<typeof runProductionV3>>,
): string {
  return [
    "# Software Engineer — Quality Calibration Comparison",
    "",
    "## BEFORE (production-batch-001)",
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Page utilization | ${((before.page_utilization ?? 0) * 100).toFixed(1)}% |`,
    `| Content bottom | ${before.content_bottom_px}px |`,
    `| Name size | ${before.name_size_pt}pt |`,
    `| Body size | ${before.body_size_pt}pt |`,
    `| Section size | ${before.section_size_pt}pt |`,
    `| Visual score | ${before.visual} (${delta.before_score_band.visual}) |`,
    `| Premium score | ${before.premium} (${delta.before_score_band.premium}) |`,
    `| Render score | ${before.render} (${delta.before_score_band.render}) |`,
    "",
    "## AFTER (quality-calibration-v1)",
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Page utilization | ${((after.page_utilization ?? 0) * 100).toFixed(1)}% |`,
    `| Content bottom | ${after.content_bottom_px}px |`,
    `| Name size | ${after.name_size_pt}pt |`,
    `| Body size | ${after.body_size_pt}pt |`,
    `| Section size | ${after.section_size_pt}pt |`,
    `| Visual score | ${after.visual} (${delta.after_score_band.visual}) |`,
    `| Premium score | ${after.premium} (${delta.after_score_band.premium}) |`,
    `| Render score | ${after.render} (${delta.after_score_band.render}) |`,
    "",
    "## DELTA",
    "",
    `| Metric | Change |`,
    `|--------|--------|`,
    `| Page utilization | ${delta.page_utilization_delta != null ? `+${(delta.page_utilization_delta * 100).toFixed(1)}%` : "—"} |`,
    `| Name size | ${delta.name_size_pt_delta != null ? `+${delta.name_size_pt_delta}pt` : "—"} |`,
    `| Body size | ${delta.body_size_pt_delta != null ? `+${delta.body_size_pt_delta}pt` : "—"} |`,
    `| Visual score | ${delta.visual_score_delta ?? "—"} |`,
    `| Premium score | ${delta.premium_score_delta ?? "—"} |`,
    `| Render score | ${delta.render_score_delta ?? "—"} |`,
    "",
    "## Local Review",
    "",
    `\`${production.local_review_command}\``,
    "",
    "## Assessment",
    "",
    delta.scores_now_realistic
      ? "Scores are now calibrated — no longer assuming perfection for technically correct output."
      : "Scores may still need further calibration.",
    "",
    (after.page_utilization ?? 0) >= 0.8
      ? "Page utilization meets founder target (80–90%)."
      : "Page utilization improved but may need further tuning.",
  ].join("\n");
}

async function main(): Promise<void> {
  console.log("[calibration] Regenerating Software Engineer with founder calibration v1");
  const result = await runQualityCalibration();
  console.log(JSON.stringify({ pass: result.pass, output_dir: result.output_dir }, null, 2));
  if (!result.pass) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
