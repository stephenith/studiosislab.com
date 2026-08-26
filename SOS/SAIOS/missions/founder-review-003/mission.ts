#!/usr/bin/env tsx
/**
 * Founder Review #003 — premium visual refinement + regenerate software engineer only.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  appendFounderReview003Calibration,
  FOUNDER_CALIBRATION_PATH,
  PREMIUM_CALIBRATION_VERSION,
} from "../../runtime/workers/resume-production/founder-calibration.js";
import { runProductionV3 } from "../../runtime/workers/resume-production/production-pipeline-v3.js";
import { loadDesignMemory, DESIGN_MEMORY_PATH } from "../../runtime/workers/resume-learning/design-memory.js";
import { runAlignmentCheck } from "../../runtime/workers/resume-qa/alignment-check.js";
import { runDesignQA } from "../../runtime/workers/resume-production/design-qa.js";
import { loadTemplateContext } from "../../runtime/workers/resume-qa/template-input.js";
import { buildDesignSystemBundle } from "../../runtime/design-system/DesignSystemDirector.js";
import { BATCH_ROLES } from "../production-batch-001/batch.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
const REVIEW_ROOT = join(SOS_ROOT, "07_LOGS/saios/founder-review-003");
const TARGET_DIR = join(SOS_ROOT, "07_LOGS/saios/generated-resumes/production-batch-001-software-engineer");
const OBJECTIVE = BATCH_ROLES.find((r) => r.slug === "software-engineer")!.objective;

type PremiumMetrics = {
  content_width_px: number | null;
  margin_px: number | null;
  accent_bar_width_px: number | null;
  header_rule_count: number;
  section_marker_count: number;
  section_rule_count: number;
  section_transitions: number[];
  overlap_pairs: number;
  page_utilization: number | null;
  content_bottom_px: number | null;
  first_impression_elements: number;
};

function boxBottom(o: { top?: number; height?: number }): number {
  return Number(o.top ?? 0) + Number(o.height ?? 0);
}

function extractPremiumMetrics(templatePath: string, canvasWidth = 794): PremiumMetrics {
  const empty: PremiumMetrics = {
    content_width_px: null,
    margin_px: null,
    accent_bar_width_px: null,
    header_rule_count: 0,
    section_marker_count: 0,
    section_rule_count: 0,
    section_transitions: [],
    overlap_pairs: 0,
    page_utilization: null,
    content_bottom_px: null,
    first_impression_elements: 0,
  };
  if (!existsSync(templatePath)) return empty;

  const json = JSON.parse(readFileSync(templatePath, "utf8")) as {
    width: number;
    height: number;
    objects: Array<Record<string, unknown>>;
  };
  const objects = json.objects;
  const textboxes = objects.filter((o) => String(o.type).toLowerCase() === "textbox");
  const minLeft = Math.min(...textboxes.map((o) => Number(o.left ?? 0)));
  const maxRight = Math.max(
    ...textboxes.map((o) => Number(o.left ?? 0) + Number(o.width ?? 0)),
  );

  const accentBars = objects.filter(
    (o) => o.data && (o.data as { role?: string }).role === "accent-bar",
  );
  const markers = objects.filter(
    (o) => o.data && (o.data as { role?: string }).role === "section-marker",
  );
  const rules = objects.filter(
    (o) => o.data && (o.data as { role?: string }).role === "section-rule",
  );

  const sectionHeadings = textboxes.filter((o) =>
    /^(PROFESSIONAL SUMMARY|WORK EXPERIENCE|TECHNICAL SKILLS|EDUCATION|CERTIFICATIONS)$/.test(
      String(o.text ?? ""),
    ),
  );
  const transitions: number[] = [];
  for (let i = 0; i < sectionHeadings.length - 1; i++) {
    const cur = sectionHeadings[i]!;
    const next = sectionHeadings[i + 1]!;
    const blockBottom = textboxes
      .filter(
        (o) =>
          Number(o.top) >= Number(cur.top) &&
          Number(o.top) < Number(next.top) &&
          o !== cur,
      )
      .reduce((max, o) => Math.max(max, boxBottom(o)), boxBottom(cur));
    transitions.push(Number(next.top) - blockBottom);
  }

  const overlaps: number[] = [];
  for (let i = 0; i < textboxes.length; i++) {
    for (let j = i + 1; j < textboxes.length; j++) {
      const a = textboxes[i]!;
      const b = textboxes[j]!;
      const vOverlap = Math.min(boxBottom(a), boxBottom(b)) - Math.max(Number(a.top), Number(b.top));
      if (vOverlap > 8) overlaps.push(1);
    }
  }

  const contentBottom = textboxes.reduce((max, o) => Math.max(max, boxBottom(o)), 0);

  return {
    content_width_px: Math.round(maxRight - minLeft),
    margin_px: minLeft,
    accent_bar_width_px: accentBars[0] ? Number(accentBars[0].width) : null,
    header_rule_count: rules.filter((o) => Number(o.top) < 200).length,
    section_marker_count: markers.length,
    section_rule_count: rules.length,
    section_transitions: transitions,
    overlap_pairs: overlaps.length,
    page_utilization: Math.round((contentBottom / json.height) * 1000) / 1000,
    content_bottom_px: Math.round(contentBottom),
    first_impression_elements: accentBars.length + rules.filter((o) => Number(o.top) < 200).length,
  };
}

export async function runFounderReview003(): Promise<{ pass: boolean; output_dir: string }> {
  mkdirSync(REVIEW_ROOT, { recursive: true });
  mkdirSync(join(REVIEW_ROOT, "before"), { recursive: true });

  const beforeTemplate = join(TARGET_DIR, "template-preview.json");
  if (existsSync(beforeTemplate)) {
    cpSync(beforeTemplate, join(REVIEW_ROOT, "before/template-preview.json"));
    if (existsSync(join(TARGET_DIR, "thumbnail.png"))) {
      cpSync(join(TARGET_DIR, "thumbnail.png"), join(REVIEW_ROOT, "before/thumbnail.png"));
    }
  }

  const beforeMetrics = extractPremiumMetrics(beforeTemplate);
  const calibration = appendFounderReview003Calibration();
  const designSystem = buildDesignSystemBundle(true);

  const result = await runProductionV3({
    objective: OBJECTIVE,
    output_dir: TARGET_DIR,
    mcp_firecrawl_available: true,
    learning_persist: false,
  });

  const afterMetrics = extractPremiumMetrics(join(TARGET_DIR, "template-preview.json"));
  const qaCtx = loadTemplateContext(TARGET_DIR);
  const alignment = runAlignmentCheck(qaCtx);
  const designQa = runDesignQA({
    template: {
      prototype_id: result.prototype_id,
      title: "Software Engineer",
      family_id: "corporate-modern",
      tier: "ats_safe",
      json: qaCtx.json,
      metrics: {
        content_bottom_px: afterMetrics.content_bottom_px ?? 0,
        page_utilization: afterMetrics.page_utilization ?? 0,
      },
    },
    tier: "ats_safe",
    family_id: "corporate-modern",
  });

  const pass =
    (afterMetrics.content_width_px ?? 0) >= 700 &&
    (afterMetrics.margin_px ?? 99) <= 48 &&
    afterMetrics.section_marker_count >= 4 &&
    afterMetrics.section_rule_count >= 5 &&
    afterMetrics.overlap_pairs === 0 &&
    designQa.pass &&
    alignment.pass &&
    result.qa_pass &&
    result.premium_scores.target_met;

  const visualDelta = {
    review_id: "founder-review-003",
    calibration_version: PREMIUM_CALIBRATION_VERSION,
    before: beforeMetrics,
    after: afterMetrics,
    delta: {
      content_width_px: (afterMetrics.content_width_px ?? 0) - (beforeMetrics.content_width_px ?? 0),
      margin_px: (afterMetrics.margin_px ?? 0) - (beforeMetrics.margin_px ?? 0),
      section_markers: afterMetrics.section_marker_count - beforeMetrics.section_marker_count,
      page_utilization: (afterMetrics.page_utilization ?? 0) - (beforeMetrics.page_utilization ?? 0),
    },
    premium_scores: result.premium_scores,
    qa: { alignment: alignment.pass, design_qa: designQa.pass },
    pass,
    status: "AWAITING_FOUNDER_APPROVAL",
  };

  writeFileSync(join(REVIEW_ROOT, "visual-delta.json"), JSON.stringify(visualDelta, null, 2));

  const summary = `# Founder Review #003 — Premium Visual Refinement

**Status:** AWAITING_FOUNDER_APPROVAL
**Calibration:** v${PREMIUM_CALIBRATION_VERSION}
**Regenerated:** ${new Date().toISOString()}

## Before → After

| Metric | Before | After |
|--------|--------|-------|
| Content width | ${beforeMetrics.content_width_px}px | ${afterMetrics.content_width_px}px |
| Margins | ${beforeMetrics.margin_px}px | ${afterMetrics.margin_px}px |
| Section markers | ${beforeMetrics.section_marker_count} | ${afterMetrics.section_marker_count} |
| Section rules | ${beforeMetrics.section_rule_count} | ${afterMetrics.section_rule_count} |
| Page utilization | ${((beforeMetrics.page_utilization ?? 0) * 100).toFixed(1)}% | ${((afterMetrics.page_utilization ?? 0) * 100).toFixed(1)}% |
| Overlaps | ${beforeMetrics.overlap_pairs} | ${afterMetrics.overlap_pairs} |

## Premium Scores

- First impression: ${result.premium_scores.first_impression_score}
- Visual rhythm: ${result.premium_scores.visual_rhythm_score}
- Composition: ${result.premium_scores.composition_score}
- Density: ${result.premium_scores.density_score}
- Design identity: ${result.premium_scores.design_identity_score}
- Overall: ${result.premium_scores.overall_confidence}

## QA

- Alignment: ${alignment.pass ? "PASS" : "FAIL"}
- Design QA: ${designQa.pass ? "PASS" : "FAIL"}
- Pipeline: ${result.pass ? "PASS" : "FAIL"}

**Do not publish.** Awaiting founder approval.
`;

  writeFileSync(join(REVIEW_ROOT, "founder-review-003.md"), summary);
  writeFileSync(
    join(REVIEW_ROOT, "updated-learning.json"),
    JSON.stringify(
      {
        updated_at: new Date().toISOString(),
        review_id: "founder-review-003",
        design_memory_path: DESIGN_MEMORY_PATH,
        founder_calibration_path: FOUNDER_CALIBRATION_PATH,
        design_memory: loadDesignMemory(),
        premium_calibration: calibration,
        design_system_modules: [
          "PremiumHeaderSystem",
          "SectionRhythmSystem",
          "PremiumIdentitySystem",
          "ContentDensitySystem",
          "PageWidthSystem",
        ],
      },
      null,
      2,
    ),
  );

  return { pass, output_dir: TARGET_DIR };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runFounderReview003()
    .then((r) => {
      console.log(
        JSON.stringify(
          {
            pass: r.pass,
            output_dir: r.output_dir,
            status: "AWAITING_FOUNDER_APPROVAL",
            review_command: `npm run review:template -- --path=${r.output_dir}/template-preview.json`,
          },
          null,
          2,
        ),
      );
      if (!r.pass) process.exit(1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
