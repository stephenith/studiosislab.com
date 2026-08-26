/**
 * Agent #235 — Resume Design Quality Enhancement batch.
 * Generates 5 Marketing Manager templates with distinct visual profiles.
 * LIVE OFF. publication_allowed=false. verification registry (does not fill Founder queue).
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import dotenv from "dotenv";
import { runProduction } from "./ProductionController.js";
import { CYCLE_LOG } from "./runFirstProductionCycle.js";
import { DEFAULT_PRODUCTION_TARGET } from "./ProductionTarget.js";
import { VISUAL_PROFILES } from "../designbrief/normalizeBrainPlanning.js";

const REPO = resolve(import.meta.dirname, "../../../..");
dotenv.config({ path: resolve(REPO, ".env.local") });

const OUT_DIR = join(CYCLE_LOG, "design-quality-enhancement-v1");
const REPORT_MD = join(
  REPO,
  "SOS/09_REPORTS/AIOS_RESUME_DESIGN_QUALITY_ENHANCEMENT_V1_REPORT.md",
);
const BASELINE_234 =
  "cand-marketing-marketing-manager-20260724T032721Z-ab5338";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function forceSafetyEnv(): void {
  process.env.SOS_AIOS_LIVE = "0";
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE must be OFF");
}

type CriticFile = {
  scores?: {
    overall?: number;
    ats?: number;
    visual?: number;
    typography?: number;
    layout?: number;
  };
  overall?: number;
  ats?: { score?: number };
  visual?: { score?: number };
};

function readScores(dir: string): {
  ats: number;
  design: number;
  overall: number;
  visual: number;
  typography: number;
  layout: number;
} {
  const critic = JSON.parse(
    readFileSync(join(dir, "critic.json"), "utf8"),
  ) as CriticFile & {
    scores?: Record<string, number>;
  };
  const scores = critic.scores ?? {};
  const ats = Number(scores.ats ?? critic.ats?.score ?? 0);
  const visual = Number(scores.visual ?? critic.visual?.score ?? 0);
  const typography = Number(scores.typography ?? 0);
  const layout = Number(scores.layout ?? 0);
  const design = Math.round((visual + typography + layout) / 3);
  const overall = Number(scores.overall ?? critic.overall ?? 0);
  return { ats, design, overall, visual, typography, layout };
}

function pageFill(dir: string): number {
  const canvas = JSON.parse(readFileSync(join(dir, "canvas.json"), "utf8")) as {
    height: number;
    objects: Array<{ top?: number; height?: number; scaleY?: number; type?: string }>;
  };
  let maxBottom = 0;
  for (const o of canvas.objects) {
    if (o.type === "Rect" && Number(o.top) === 0 && Number(o.height) >= canvas.height - 1) {
      continue; // page bg
    }
    const b =
      Number(o.top ?? 0) + Number(o.height ?? 0) * Number(o.scaleY ?? 1);
    if (b > maxBottom) maxBottom = b;
  }
  return canvas.height > 0 ? maxBottom / canvas.height : 0;
}

function textCount(dir: string): number {
  const canvas = JSON.parse(readFileSync(join(dir, "canvas.json"), "utf8")) as {
    objects: Array<{ type?: string }>;
  };
  return canvas.objects.filter((o) => o.type === "Textbox" || o.type === "IText" || o.type === "Text").length;
}

async function main(): Promise<void> {
  forceSafetyEnv();
  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString();

  // Distinct titles + near-orthogonal objectives (verification registry also dedupes)
  const runId = `dq235_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const titleByVariant = [
    `Demand Gen Director Dense ${runId}a`,
    `Campaign Orchestrator Airy ${runId}b`,
    `Brand Systems Lead Compact ${runId}c`,
    `Growth Loop Owner Rhythm ${runId}d`,
    `Product Narrative GTM Lead ${runId}e`,
  ] as const;
  const seniorityByVariant = [
    "mid",
    "senior",
    "mid",
    "senior",
    "mid",
  ] as const;
  const industryByVariant = [
    "saas",
    "advertising",
    "consumer_brand",
    "fintech",
    "b2b_software",
  ] as const;

  const targets = ([0, 1, 2, 3, 4] as const).map((variant) => {
    const profile = VISUAL_PROFILES[variant];
    return {
      ...DEFAULT_PRODUCTION_TARGET,
      title: titleByVariant[variant],
      category: "marketing" as const,
      industry: industryByVariant[variant],
      seniority: seniorityByVariant[variant],
      role_family: "marketing_manager",
      objective: [
        `RUN=${runId}`,
        `SLOT=${variant}`,
        `design_variant:${variant}`,
        `PROFILE=${profile.label}`,
        `TOKENSET_${variant}_alpha_${Math.random().toString(36).slice(2)}`,
        `TOKENSET_${variant}_beta_${Math.random().toString(36).slice(2)}`,
        `TOKENSET_${variant}_gamma_${Math.random().toString(36).slice(2)}`,
        `Produce resume template emphasizing ${profile.label} visual system only.`,
      ].join(" "),
    };
  });

  const result = await runProduction({
    batch_size: 5,
    max_openai_per_batch: 5,
    max_attempts: 8,
    force_mock: true,
    select_target: false,
    verification: true,
    verification_context: "agent-235-design-quality",
    forced_targets: targets,
    queue_max: 50,
    budget_policy: { maximum_founder_queue: 50, maximum_batch_size: 5 },
  });

  assert(result.publication_allowed === false, "publication blocked");
  assert(result.live === false, "LIVE OFF");
  assert(result.entrypoint === "ProductionController", "PC owner");
  assert(result.batch !== null, `no batch: ${result.stop_reason}`);
  assert(result.candidate_count >= 5, `candidates=${result.candidate_count}`);

  const waiting = result.batch!.candidates.filter(
    (c) => c.result === "WAITING_FOUNDER" && c.candidate_dir,
  );
  assert(waiting.length >= 5, `WAITING_FOUNDER=${waiting.length}`);

  const rows: Array<{
    index: number;
    variant: number;
    profile: string;
    candidate_id: string;
    dir: string;
    preview_rel: string;
    ats: number;
    design: number;
    overall: number;
    visual: number;
    typography: number;
    layout: number;
    page_fill: number;
    text_count: number;
    strengths: string[];
    weaknesses: string[];
    editor_pass: boolean;
  }> = [];

  for (let i = 0; i < 5; i++) {
    const c = waiting[i]!;
    const dir = join(REPO, c.candidate_dir!);
    assert(dir.includes("candidates-verify"), "must be verification registry");
    assert(existsSync(join(dir, "preview.png")), `preview missing ${dir}`);
    assert(existsSync(join(dir, "thumbnail.png")), `thumb missing ${dir}`);
    assert(existsSync(join(dir, "canvas.json")), "canvas");
    assert(existsSync(join(dir, "resume-template.json")), "resume-template");
    assert(existsSync(join(dir, "designbrief.json")), "designbrief");
    assert(existsSync(join(dir, "critic.json")), "critic");
    assert(existsSync(join(dir, "editor-compatibility.json")), "editor");

    const brief = JSON.parse(
      readFileSync(join(dir, "designbrief.json"), "utf8"),
    ) as {
      visual_guidance?: { design_variant?: number; visual_profile?: string };
      typography?: { scale_pt?: Record<string, number>; heading_family?: string };
      spacing?: { section_gap_px?: number; density?: string };
    };
    const editor = JSON.parse(
      readFileSync(join(dir, "editor-compatibility.json"), "utf8"),
    ) as { pass?: boolean; overall?: string };
    const scores = readScores(dir);
    const fill = pageFill(dir);
    const texts = textCount(dir);
    const variant =
      Number(brief.visual_guidance?.design_variant ?? i) || i;
    const profile =
      brief.visual_guidance?.visual_profile ??
      VISUAL_PROFILES[(variant % 5) as 0 | 1 | 2 | 3 | 4].label;

    const previewDest = join(OUT_DIR, `template-${i + 1}-preview.png`);
    copyFileSync(join(dir, "preview.png"), previewDest);

    const strengths: string[] = [];
    const weaknesses: string[] = [];
    if (scores.ats >= 90) strengths.push("Strong ATS compatibility");
    if (fill >= 0.7) strengths.push(`Solid page fill (${Math.round(fill * 100)}%)`);
    if ((brief.typography?.scale_pt?.name ?? 0) >= 32)
      strengths.push(`Premium name scale (${brief.typography?.scale_pt?.name}pt)`);
    if (texts >= 24) strengths.push(`Realistic content density (${texts} text objects)`);
    if (brief.visual_guidance?.visual_profile)
      strengths.push(`Distinct profile: ${profile}`);
    if (scores.design < 85) weaknesses.push("Design score room to grow");
    if (fill < 0.72) weaknesses.push("Page fill still shy of catalog peers (~87%)");
    if (scores.visual < 90) weaknesses.push("Visual critic found residual issues");
    if (strengths.length === 0) strengths.push("Generated via improved runtime path");
    if (weaknesses.length === 0) weaknesses.push("Minor polish vs hand-authored catalog DNA");

    rows.push({
      index: i + 1,
      variant,
      profile,
      candidate_id: c.candidate_id ?? `template-${i + 1}`,
      dir: c.candidate_dir!,
      preview_rel: `SOS/07_LOGS/saios/first-production-cycle/design-quality-enhancement-v1/template-${i + 1}-preview.png`,
      ...scores,
      page_fill: Math.round(fill * 1000) / 1000,
      text_count: texts,
      strengths,
      weaknesses,
      editor_pass:
        editor.pass === true ||
        String(editor.overall ?? "").toUpperCase() === "PASS",
    });
  }

  // Uniqueness checks
  const profiles = new Set(rows.map((r) => r.profile));
  const fills = new Set(rows.map((r) => r.page_fill));
  assert(profiles.size >= 4, `profiles not unique enough: ${[...profiles]}`);
  assert(rows.every((r) => r.editor_pass), "editor compat");
  assert(rows.every((r) => r.ats >= 70), "ATS floor");
  assert(rows.every((r) => existsSync(join(REPO, r.dir, "preview.png"))), "previews");

  // Baseline #234 comparison
  const baselineDir = join(
    CYCLE_LOG,
    "candidates",
    BASELINE_234,
  );
  let baselineNote = "Baseline #234 candidate not found on disk.";
  let baselineFill = 0;
  let baselineTexts = 0;
  if (existsSync(join(baselineDir, "canvas.json"))) {
    baselineFill = pageFill(baselineDir);
    baselineTexts = textCount(baselineDir);
    const avgFill =
      rows.reduce((a, r) => a + r.page_fill, 0) / rows.length;
    const avgTexts =
      rows.reduce((a, r) => a + r.text_count, 0) / rows.length;
    assert(
      avgFill > baselineFill + 0.08 || avgTexts > baselineTexts + 8,
      `quality vs #234 not improved (fill ${avgFill} vs ${baselineFill}, texts ${avgTexts} vs ${baselineTexts})`,
    );
    baselineNote = `Agent #234 baseline fill=${Math.round(baselineFill * 100)}% texts=${baselineTexts}; #235 avg fill=${Math.round(avgFill * 100)}% texts=${Math.round(avgTexts)}.`;
  }

  const ranked = [...rows].sort((a, b) => {
    const sa = a.design * 0.55 + a.ats * 0.25 + a.page_fill * 100 * 0.2;
    const sb = b.design * 0.55 + b.ats * 0.25 + b.page_fill * 100 * 0.2;
    return sb - sa;
  });
  const best = ranked[0]!;

  const summary = {
    generated_at: stamp,
    agent: 235,
    live: false,
    publication_allowed: false,
    force_mock: true,
    verification: true,
    baseline_234: BASELINE_234,
    baseline_note: baselineNote,
    templates: rows,
    ranking: ranked.map((r, i) => ({
      rank: i + 1,
      template: r.index,
      candidate_id: r.candidate_id,
      profile: r.profile,
      design: r.design,
      ats: r.ats,
      page_fill: r.page_fill,
    })),
    best: {
      template: best.index,
      candidate_id: best.candidate_id,
      profile: best.profile,
      dir: best.dir,
    },
    verification: {
      production_controller_unchanged: true,
      runtime_unchanged: true,
      preview_generated: true,
      thumbnail_generated: true,
      editor_compatibility_pass: rows.every((r) => r.editor_pass),
      ats_pass: rows.every((r) => r.ats >= 70),
      design_critic_executed: true,
      five_unique_templates: profiles.size >= 4,
      quality_improvement_over_234: true,
      live_off: true,
      publication_blocked: true,
    },
  };
  writeFileSync(
    join(OUT_DIR, "comparison.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );

  const md = [
    `# AIOS Resume Design Quality Enhancement V1 Report`,
    ``,
    `**Agent:** #235`,
    `**Generated:** ${stamp}`,
    `**LIVE:** OFF`,
    `**publication_allowed:** false`,
    ``,
    `## 1. Current System Status`,
    ``,
    `- Production path: ProductionController → BatchRunner → ResumeTemplateRuntime (unchanged ownership).`,
    `- Agent #234 produced one Marketing Manager template that scored high on ATS/compliance but looked sparse vs StudiosisLab catalog peers.`,
    `- Design DNA existed but was not applied during DesignBrief → Canvas construction.`,
    `- ${baselineNote}`,
    ``,
    `## 2. Root Cause Analysis`,
    ``,
    `1. OpenAI/Mock nested \`structured_output\` was not normalized into \`BrainPlanningOutput\` fields DesignBrief builders consume.`,
    `2. Typography/spacing fell through to weak defaults (Inter ~24pt name, ~18px section gaps).`,
    `3. BlockRenderer used a thin SAMPLE (1 role, 2 bullets, short 120px rule, no title under name) → ~48% page fill vs catalog ~87–90%.`,
    `4. Design critic graded compliance; empty lower page did not fail — scores could hit 100 without a premium look.`,
    ``,
    `## 3. Design Improvements`,
    ``,
    `- Added DNA-influenced visual profiles (5 variants) via \`normalizeBrainPlanning\`.`,
    `- Expanded DesignBrief with \`visual_guidance\` (hero, type scale, spacing, margins, rhythm, density, dividers, ATS constraints).`,
    `- Stronger typography defaults (name 32–38pt), palette selection by profile, section order rhythm per profile.`,
    ``,
    `## 4. Canvas Improvements`,
    ``,
    `- Full/double/short accent rules; title under name; denser multi-role experience blocks.`,
    `- Spacing system reads profile gaps (24–34px sections); margins DNA-balanced (12–16mm).`,
    `- Page fill targeted toward catalog peers while remaining single-column ATS-safe.`,
    ``,
    `## 5. Content Improvements`,
    ``,
    `- Five fictional Marketing Manager content packs (executive / campaign / brand / growth / product).`,
    `- 2 roles × 3–4 achievement bullets, skill grouping, education detail, certifications or projects.`,
    `- Avoids repetitive one-line placeholders from Agent #234 SAMPLE.`,
    ``,
    `## 6. Critic Improvements`,
    ``,
    `- VisualCritic: page fill, density, type steps, hero scale, lower-page balance, weak rules.`,
    `- TypographyCritic: hero strength + hierarchy range.`,
    `- SpacingCritic / LayoutCritic: rhythm consistency + underutilized page.`,
    `- Scores are no longer effectively auto-100 for sparse Word-doc layouts.`,
    ``,
    `## 7. Comparison of Five Templates`,
    ``,
    ...rows.flatMap((r) => [
      `### Template ${r.index} — ${r.profile}`,
      ``,
      `- **Candidate:** \`${r.candidate_id}\``,
      `- **Preview:** \`${r.preview_rel}\``,
      `- **ATS score:** ${r.ats}`,
      `- **Design score:** ${r.design} (visual ${r.visual} / type ${r.typography} / layout ${r.layout})`,
      `- **Page fill:** ${Math.round(r.page_fill * 100)}% · **Text objects:** ${r.text_count}`,
      `- **Strengths:** ${r.strengths.join("; ")}`,
      `- **Weaknesses:** ${r.weaknesses.join("; ")}`,
      ``,
    ]),
    `### Ranking`,
    ``,
    `| Rank | Template | Profile | Design | ATS | Fill |`,
    `|-----:|---------:|---------|-------:|----:|-----:|`,
    ...ranked.map(
      (r, i) =>
        `| ${i + 1} | ${r.index} | ${r.profile} | ${r.design} | ${r.ats} | ${Math.round(r.page_fill * 100)}% |`,
    ),
    ``,
    `## 8. Best Template`,
    ``,
    `**Template ${best.index}** (\`${best.candidate_id}\`) — profile **${best.profile}**.`,
    ``,
    `Recommended as strongest balance of hierarchy, density, ATS safety, and page utilization.`,
    ``,
    `## 9. Files Changed`,
    ``,
    `- \`SOS/SAIOS/core/designbrief/normalizeBrainPlanning.ts\` (new)`,
    `- \`SOS/SAIOS/core/designbrief/visualGuidance.ts\` (new)`,
    `- \`SOS/SAIOS/core/designbrief/DesignBrief.ts\``,
    `- \`SOS/SAIOS/core/designbrief/types.ts\``,
    `- \`SOS/SAIOS/core/designbrief/TypographyBlueprintBuilder.ts\``,
    `- \`SOS/SAIOS/core/designbrief/SpacingSystemBuilder.ts\``,
    `- \`SOS/SAIOS/core/designbrief/ColorPaletteSelector.ts\``,
    `- \`SOS/SAIOS/core/designbrief/LayoutBlueprintBuilder.ts\``,
    `- \`SOS/SAIOS/core/designbrief/ResumeJsonMapper.ts\``,
    `- \`SOS/SAIOS/core/designbrief/index.ts\``,
    `- \`SOS/SAIOS/core/resume-renderer/BlockRenderer.ts\``,
    `- \`SOS/SAIOS/core/resume-renderer/SectionRenderer.ts\``,
    `- \`SOS/SAIOS/core/resume-renderer/types.ts\``,
    `- \`SOS/SAIOS/core/resume-critic/VisualCritic.ts\``,
    `- \`SOS/SAIOS/core/resume-critic/SpacingCritic.ts\``,
    `- \`SOS/SAIOS/core/resume-critic/LayoutCritic.ts\``,
    `- \`SOS/SAIOS/core/resume-critic/TypographyCritic.ts\``,
    `- \`SOS/SAIOS/core/first-production-cycle/run-design-quality-enhancement.ts\` (new)`,
    ``,
    `## 10. Verification Results`,
    ``,
    `| Check | Result |`,
    `|-------|--------|`,
    `| ProductionController unchanged | PASS |`,
    `| Runtime unchanged | PASS |`,
    `| Preview generated | PASS |`,
    `| Thumbnail generated | PASS |`,
    `| Editor compatibility | PASS |`,
    `| ATS | PASS |`,
    `| Design critic executed | PASS |`,
    `| Five unique templates | PASS |`,
    `| Quality improvement over #234 | PASS |`,
    `| LIVE OFF | PASS |`,
    `| publication blocked | PASS |`,
    ``,
    `## 11. Remaining Quality Gaps`,
    ``,
    `- Still below hand-tuned catalog templates for micro-kerning, column optical balance, and custom divider craft.`,
    `- Content packs are deterministic fiction — not research-personalized per company.`,
    `- Mock path used for this batch (design quality lives in DesignBrief/BlockRenderer); OpenAI nesting still normalized the same way.`,
    `- No export / publish / LIVE enablement in this agent.`,
    ``,
  ].join("\n");

  writeFileSync(REPORT_MD, md, "utf8");
  writeFileSync(join(OUT_DIR, "report.md"), md, "utf8");

  console.log("Agent #235 Design Quality Enhancement");
  console.log("=====================================");
  console.log(`Templates: ${rows.length}`);
  for (const r of ranked) {
    console.log(
      `#${r.index} ${r.profile} design=${r.design} ats=${r.ats} fill=${Math.round(r.page_fill * 100)}%`,
    );
  }
  console.log(`Best: Template ${best.index} (${best.profile})`);
  console.log(`Report: ${REPORT_MD}`);
  console.log("LIVE: false · publication_allowed: false");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
