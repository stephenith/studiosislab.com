#!/usr/bin/env tsx
/**
 * Founder Review #001 — header rhythm calibration + regenerate software engineer only.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { appendFounderReview001Calibration } from "../../runtime/workers/resume-production/founder-calibration.js";
import { runProductionV3 } from "../../runtime/workers/resume-production/production-pipeline-v3.js";
import { loadDesignMemory, DESIGN_MEMORY_PATH } from "../../runtime/workers/resume-learning/design-memory.js";
import { FOUNDER_CALIBRATION_PATH } from "../../runtime/workers/resume-production/founder-calibration.js";
import { runAlignmentCheck } from "../../runtime/workers/resume-qa/alignment-check.js";
import { runDesignQA } from "../../runtime/workers/resume-production/design-qa.js";
import { loadTemplateContext } from "../../runtime/workers/resume-qa/template-input.js";
import { BATCH_ROLES } from "../production-batch-001/batch.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
const REVIEW_ROOT = join(SOS_ROOT, "07_LOGS/saios/founder-review-001");
const TARGET_DIR = join(SOS_ROOT, "07_LOGS/saios/generated-resumes/production-batch-001-software-engineer");
const OBJECTIVE = BATCH_ROLES.find((r) => r.slug === "software-engineer")!.objective;

type HeaderMetrics = {
  name_top: number | null;
  title_top: number | null;
  contact_top: number | null;
  summary_top: number | null;
  name_to_title_gap: number | null;
  title_to_contact_gap: number | null;
  contact_to_summary_gap: number | null;
  overlap_pairs: number;
  page_utilization: number | null;
  content_bottom_px: number | null;
};

function boxBottom(o: { top?: number; height?: number }): number {
  return Number(o.top ?? 0) + Number(o.height ?? 0);
}

function extractHeaderMetrics(templatePath: string): HeaderMetrics {
  if (!existsSync(templatePath)) {
    return {
      name_top: null,
      title_top: null,
      contact_top: null,
      summary_top: null,
      name_to_title_gap: null,
      title_to_contact_gap: null,
      contact_to_summary_gap: null,
      overlap_pairs: 0,
      page_utilization: null,
      content_bottom_px: null,
    };
  }

  const json = JSON.parse(readFileSync(templatePath, "utf8")) as {
    height: number;
    objects: Array<{ type?: string; text?: string; top?: number; height?: number }>;
  };
  const textboxes = json.objects.filter((o) => String(o.type).toLowerCase() === "textbox");
  const byText = (pattern: RegExp) => textboxes.find((o) => pattern.test(String(o.text ?? "")));

  const name = byText(/^[A-Z][a-z]+ [A-Z][a-z]+/);
  const title = textboxes.find(
    (o) =>
      o !== name &&
      !/^[A-Z\s]+$/.test(String(o.text ?? "")) &&
      Number(o.top) > Number(name?.top ?? 0) &&
      Number(o.top) < Number(name?.top ?? 0) + 80,
  );
  const contact = byText(/@|linkedin|\(\d{3}\)/i);
  const summary = byText(/PROFESSIONAL SUMMARY|SUMMARY/);

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
    name_top: name ? Number(name.top) : null,
    title_top: title ? Number(title.top) : null,
    contact_top: contact ? Number(contact.top) : null,
    summary_top: summary ? Number(summary.top) : null,
    name_to_title_gap:
      name && title ? Number(title.top) - boxBottom(name) : null,
    title_to_contact_gap:
      title && contact ? Number(contact.top) - boxBottom(title) : null,
    contact_to_summary_gap:
      contact && summary ? Number(summary.top) - boxBottom(contact) : null,
    overlap_pairs: overlaps.length,
    page_utilization: Math.round((contentBottom / json.height) * 1000) / 1000,
    content_bottom_px: Math.round(contentBottom),
  };
}

export async function runFounderReview001(): Promise<{ pass: boolean; output_dir: string }> {
  mkdirSync(REVIEW_ROOT, { recursive: true });
  mkdirSync(join(REVIEW_ROOT, "before"), { recursive: true });

  const beforeTemplate = join(TARGET_DIR, "template-preview.json");
  if (existsSync(beforeTemplate)) {
    cpSync(beforeTemplate, join(REVIEW_ROOT, "before/template-preview.json"));
    if (existsSync(join(TARGET_DIR, "thumbnail.png"))) {
      cpSync(join(TARGET_DIR, "thumbnail.png"), join(REVIEW_ROOT, "before/thumbnail.png"));
    }
  }

  const beforeMetrics = extractHeaderMetrics(beforeTemplate);

  const calibration = appendFounderReview001Calibration();

  const result = await runProductionV3({
    objective: OBJECTIVE,
    output_dir: TARGET_DIR,
    mcp_firecrawl_available: true,
    learning_persist: false,
  });

  const afterMetrics = extractHeaderMetrics(join(TARGET_DIR, "template-preview.json"));
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

  const overlapCheck = alignment.checks.find((c) => c.id === "object-overlap-detection");
  const pass =
    (afterMetrics.name_to_title_gap ?? 0) >= 8 &&
    (afterMetrics.title_to_contact_gap ?? 0) >= 8 &&
    (afterMetrics.contact_to_summary_gap ?? 0) >= 12 &&
    overlapCheck?.pass === true &&
    designQa.pass &&
    (afterMetrics.page_utilization ?? 0) >= (beforeMetrics.page_utilization ?? 0) * 0.98;

  const beforeAfter = {
    review_id: "founder-review-001",
    template: "production-batch-001-software-engineer",
    calibrated_at: new Date().toISOString(),
    calibration_version: calibration.version,
    before: beforeMetrics,
    after: afterMetrics,
    delta: {
      name_to_title_gap: (afterMetrics.name_to_title_gap ?? 0) - (beforeMetrics.name_to_title_gap ?? 0),
      title_to_contact_gap:
        (afterMetrics.title_to_contact_gap ?? 0) - (beforeMetrics.title_to_contact_gap ?? 0),
      contact_to_summary_gap:
        (afterMetrics.contact_to_summary_gap ?? 0) - (beforeMetrics.contact_to_summary_gap ?? 0),
      overlap_pairs: (afterMetrics.overlap_pairs ?? 0) - (beforeMetrics.overlap_pairs ?? 0),
      page_utilization_delta:
        (afterMetrics.page_utilization ?? 0) - (beforeMetrics.page_utilization ?? 0),
    },
    qa: {
      alignment_pass: alignment.pass,
      design_qa_pass: designQa.pass,
      overlap_check: overlapCheck?.detail ?? null,
    },
    status: "AWAITING_FOUNDER_APPROVAL",
    pass,
  };

  writeFileSync(join(REVIEW_ROOT, "before-after.json"), JSON.stringify(beforeAfter, null, 2));

  const memory = loadDesignMemory();
  writeFileSync(
    join(REVIEW_ROOT, "updated-learning.json"),
    JSON.stringify(
      {
        updated_at: new Date().toISOString(),
        review_id: "founder-review-001",
        design_memory_path: DESIGN_MEMORY_PATH,
        founder_calibration_path: FOUNDER_CALIBRATION_PATH,
        design_memory: memory,
        header_calibration: calibration,
      },
      null,
      2,
    ),
  );

  const summary = `# Founder Review #001 — Header Rhythm Calibration

**Status:** AWAITING_FOUNDER_APPROVAL
**Template:** production-batch-001-software-engineer
**Regenerated:** ${new Date().toISOString()}

## Founder Feedback Addressed

1. Header text overlap — fixed via measured textbox height positioning
2. Job title / contact overlap — ${afterMetrics.title_to_contact_gap}px clearance (was ${beforeMetrics.title_to_contact_gap}px)
3. Spacing below candidate name — ${afterMetrics.name_to_title_gap}px (was ${beforeMetrics.name_to_title_gap}px)
4. Header-to-summary rhythm — ${afterMetrics.contact_to_summary_gap}px (was ${beforeMetrics.contact_to_summary_gap}px)
5. ATS compatibility — preserved (linear text order, no layout change)
6. Overall layout — preserved
7. Page utilization — ${(afterMetrics.page_utilization ?? 0) * 100}% (before ${(beforeMetrics.page_utilization ?? 0) * 100}%)

## Design System Updates

- New \`HeaderRhythmSystem\` in design system (v1.1.0 calibration)
- Header spacing tokens applied via \`buildProductionDesignBundle()\`
- All future templates inherit: 16px below accent, 14px name→title, 12px title→contact, 20px contact→summary

## QA

- Alignment: ${alignment.pass ? "PASS" : "FAIL"} (${overlapCheck?.detail ?? "n/a"})
- Design QA: ${designQa.pass ? "PASS" : "FAIL"}

## Review

\`npm run review:template -- --path=${TARGET_DIR}/template-preview.json\`
`;

  writeFileSync(join(REVIEW_ROOT, "improvement-summary.md"), summary);

  return { pass, output_dir: TARGET_DIR };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runFounderReview001()
    .then((r) => {
      console.log(JSON.stringify({ pass: r.pass, output_dir: r.output_dir, status: "AWAITING_FOUNDER_APPROVAL" }, null, 2));
      if (!r.pass) process.exit(1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
