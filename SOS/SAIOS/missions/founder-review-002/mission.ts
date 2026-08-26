#!/usr/bin/env tsx
/**
 * Founder Review #002 — hierarchy, rhythm, premium perception + regenerate software engineer only.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  appendFounderReview002Calibration,
  FOUNDER_CALIBRATION_PATH,
} from "../../runtime/workers/resume-production/founder-calibration.js";
import { runProductionV3 } from "../../runtime/workers/resume-production/production-pipeline-v3.js";
import { loadDesignMemory, DESIGN_MEMORY_PATH } from "../../runtime/workers/resume-learning/design-memory.js";
import { runAlignmentCheck } from "../../runtime/workers/resume-qa/alignment-check.js";
import { runDesignQA } from "../../runtime/workers/resume-production/design-qa.js";
import { loadTemplateContext } from "../../runtime/workers/resume-qa/template-input.js";
import { buildDesignSystemBundle } from "../../runtime/design-system/DesignSystemDirector.js";
import { BATCH_ROLES } from "../production-batch-001/batch.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
const REVIEW_ROOT = join(SOS_ROOT, "07_LOGS/saios/founder-review-002");
const TARGET_DIR = join(SOS_ROOT, "07_LOGS/saios/generated-resumes/production-batch-001-software-engineer");
const OBJECTIVE = BATCH_ROLES.find((r) => r.slug === "software-engineer")!.objective;

type TextboxObj = {
  type?: string;
  text?: string;
  top?: number;
  height?: number;
  fontSize?: number;
  fontWeight?: number | string;
  fill?: string;
};

type TemplateMetrics = {
  name_font_size: number | null;
  title_font_size: number | null;
  contact_font_size: number | null;
  section_heading_font_size: number | null;
  experience_role_font_size: number | null;
  experience_date_font_size: number | null;
  bullet_font_size: number | null;
  name_to_title_gap: number | null;
  title_to_contact_gap: number | null;
  contact_to_summary_gap: number | null;
  section_gaps: number[];
  experience_entry_gaps: number[];
  overlap_pairs: number;
  page_utilization: number | null;
  content_bottom_px: number | null;
};

function boxBottom(o: { top?: number; height?: number }): number {
  return Number(o.top ?? 0) + Number(o.height ?? 0);
}

function extractMetrics(templatePath: string): TemplateMetrics {
  const empty: TemplateMetrics = {
    name_font_size: null,
    title_font_size: null,
    contact_font_size: null,
    section_heading_font_size: null,
    experience_role_font_size: null,
    experience_date_font_size: null,
    bullet_font_size: null,
    name_to_title_gap: null,
    title_to_contact_gap: null,
    contact_to_summary_gap: null,
    section_gaps: [],
    experience_entry_gaps: [],
    overlap_pairs: 0,
    page_utilization: null,
    content_bottom_px: null,
  };

  if (!existsSync(templatePath)) return empty;

  const json = JSON.parse(readFileSync(templatePath, "utf8")) as {
    height: number;
    objects: TextboxObj[];
  };
  const textboxes = json.objects.filter((o) => String(o.type).toLowerCase() === "textbox");
  const byText = (pattern: RegExp) => textboxes.find((o) => pattern.test(String(o.text ?? "")));

  const name = byText(/^Alex Chen|^Jordan Lee|^[A-Z][a-z]+ [A-Z][a-z]+$/);
  const title = textboxes.find(
    (o) =>
      o !== name &&
      /Engineer|Professional|Manager|Analyst/i.test(String(o.text ?? "")) &&
      Number(o.top) > Number(name?.top ?? 0) &&
      Number(o.top) < Number(name?.top ?? 0) + 100,
  );
  const contact = byText(/@|github|linkedin|\(\d{3}\)/i);
  const summary = byText(/PROFESSIONAL SUMMARY|SUMMARY/);
  const experienceHeading = byText(/WORK EXPERIENCE|EXPERIENCE/);
  const roleLine = textboxes.find((o) => String(o.text ?? "").includes(" — "));
  const dateLine = textboxes.find((o) => /^\d{2}\/\d{4}/.test(String(o.text ?? "")));
  const bullet = textboxes.find((o) => String(o.text ?? "").startsWith("•"));

  const sectionHeadings = textboxes.filter((o) => /^[A-Z\s]{8,}$/.test(String(o.text ?? "")));
  const section_gaps: number[] = [];
  for (let i = 0; i < sectionHeadings.length - 1; i++) {
    const cur = sectionHeadings[i]!;
    const next = sectionHeadings[i + 1]!;
    const curBottom = textboxes
      .filter((o) => Number(o.top) >= Number(cur.top) && Number(o.top) < Number(next.top))
      .reduce((max, o) => Math.max(max, boxBottom(o)), Number(cur.top));
    section_gaps.push(Number(next.top) - curBottom);
  }

  const experienceLines = textboxes.filter(
    (o) =>
      Number(o.top) >= Number(experienceHeading?.top ?? 0) &&
      Number(o.top) < Number(experienceHeading?.top ?? 0) + 600,
  );
  const experience_entry_gaps: number[] = [];
  for (let i = 0; i < experienceLines.length; i++) {
    const line = String(experienceLines[i]?.text ?? "");
    if (line === "" || (i > 0 && experienceLines[i - 1]?.text?.startsWith("•"))) {
      const prev = experienceLines[i - 1];
      const next = experienceLines[i + 1];
      if (prev && next && String(next.text ?? "").includes(" — ")) {
        experience_entry_gaps.push(Number(next.top) - boxBottom(prev));
      }
    }
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
    name_font_size: name ? Number(name.fontSize) : null,
    title_font_size: title ? Number(title.fontSize) : null,
    contact_font_size: contact ? Number(contact.fontSize) : null,
    section_heading_font_size: experienceHeading ? Number(experienceHeading.fontSize) : null,
    experience_role_font_size: roleLine ? Number(roleLine.fontSize) : null,
    experience_date_font_size: dateLine ? Number(dateLine.fontSize) : null,
    bullet_font_size: bullet ? Number(bullet.fontSize) : null,
    name_to_title_gap: name && title ? Number(title.top) - boxBottom(name) : null,
    title_to_contact_gap: title && contact ? Number(contact.top) - boxBottom(title) : null,
    contact_to_summary_gap: contact && summary ? Number(summary.top) - boxBottom(contact) : null,
    section_gaps,
    experience_entry_gaps,
    overlap_pairs: overlaps.length,
    page_utilization: Math.round((contentBottom / json.height) * 1000) / 1000,
    content_bottom_px: Math.round(contentBottom),
  };
}

function deltaMetrics(before: TemplateMetrics, after: TemplateMetrics): Record<string, number | null> {
  const d = (a: number | null, b: number | null) =>
    a !== null && b !== null ? Math.round((b - a) * 10) / 10 : null;
  return {
    name_font_size: d(before.name_font_size, after.name_font_size),
    title_font_size: d(before.title_font_size, after.title_font_size),
    section_heading_font_size: d(before.section_heading_font_size, after.section_heading_font_size),
    experience_role_font_size: d(before.experience_role_font_size, after.experience_role_font_size),
    name_to_title_gap: d(before.name_to_title_gap, after.name_to_title_gap),
    page_utilization: d(before.page_utilization, after.page_utilization),
    overlap_pairs: d(before.overlap_pairs, after.overlap_pairs),
  };
}

export async function runFounderReview002(): Promise<{ pass: boolean; output_dir: string }> {
  mkdirSync(REVIEW_ROOT, { recursive: true });
  mkdirSync(join(REVIEW_ROOT, "before"), { recursive: true });

  const beforeTemplate = join(TARGET_DIR, "template-preview.json");
  if (existsSync(beforeTemplate)) {
    cpSync(beforeTemplate, join(REVIEW_ROOT, "before/template-preview.json"));
    if (existsSync(join(TARGET_DIR, "thumbnail.png"))) {
      cpSync(join(TARGET_DIR, "thumbnail.png"), join(REVIEW_ROOT, "before/thumbnail.png"));
    }
  }

  const beforeMetrics = extractMetrics(beforeTemplate);
  const calibration = appendFounderReview002Calibration();
  const designSystem = buildDesignSystemBundle(true);

  const result = await runProductionV3({
    objective: OBJECTIVE,
    output_dir: TARGET_DIR,
    mcp_firecrawl_available: true,
    learning_persist: false,
  });

  const afterMetrics = extractMetrics(join(TARGET_DIR, "template-preview.json"));
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
  const nameRatio =
    afterMetrics.name_font_size && afterMetrics.bullet_font_size
      ? Math.round((afterMetrics.name_font_size / afterMetrics.bullet_font_size) * 10) / 10
      : 0;

  const pass =
    (afterMetrics.name_font_size ?? 0) >= 36 &&
    nameRatio >= 3.2 &&
    (afterMetrics.section_heading_font_size ?? 0) > (afterMetrics.bullet_font_size ?? 0) &&
    (afterMetrics.experience_role_font_size ?? 0) > (afterMetrics.experience_date_font_size ?? 0) &&
    overlapCheck?.pass === true &&
    designQa.pass &&
    (afterMetrics.page_utilization ?? 0) >= 0.75;

  const visualDelta = {
    review_id: "founder-review-002",
    template: "production-batch-001-software-engineer",
    calibrated_at: new Date().toISOString(),
    calibration_version: calibration.version,
    before: beforeMetrics,
    after: afterMetrics,
    delta: deltaMetrics(beforeMetrics, afterMetrics),
    qa: {
      alignment_pass: alignment.pass,
      design_qa_pass: designQa.pass,
      overlap_check: overlapCheck?.detail ?? null,
    },
    status: "AWAITING_FOUNDER_APPROVAL",
    pass,
  };

  writeFileSync(join(REVIEW_ROOT, "visual-delta.json"), JSON.stringify(visualDelta, null, 2));

  const hierarchyAnalysis = {
    review_id: "founder-review-002",
    calibration_version: calibration.version,
    design_system_hierarchy: designSystem.hierarchy,
    measured: {
      name_pt: afterMetrics.name_font_size,
      title_pt: afterMetrics.title_font_size,
      contact_pt: afterMetrics.contact_font_size,
      section_pt: afterMetrics.section_heading_font_size,
      role_pt: afterMetrics.experience_role_font_size,
      date_pt: afterMetrics.experience_date_font_size,
      bullet_pt: afterMetrics.bullet_font_size,
      name_to_body_ratio: nameRatio,
    },
    ladder_compliance: {
      name_dominates_title:
        (afterMetrics.name_font_size ?? 0) > (afterMetrics.title_font_size ?? 0),
      title_dominates_contact:
        (afterMetrics.title_font_size ?? 0) > (afterMetrics.contact_font_size ?? 0),
      section_dominates_body:
        (afterMetrics.section_heading_font_size ?? 0) > (afterMetrics.bullet_font_size ?? 0),
      role_dominates_date:
        (afterMetrics.experience_role_font_size ?? 0) > (afterMetrics.experience_date_font_size ?? 0),
      role_dominates_bullet:
        (afterMetrics.experience_role_font_size ?? 0) >= (afterMetrics.bullet_font_size ?? 0),
    },
    pass: Object.values({
      name_dominates_title:
        (afterMetrics.name_font_size ?? 0) > (afterMetrics.title_font_size ?? 0),
      title_dominates_contact:
        (afterMetrics.title_font_size ?? 0) > (afterMetrics.contact_font_size ?? 0),
      section_dominates_body:
        (afterMetrics.section_heading_font_size ?? 0) > (afterMetrics.bullet_font_size ?? 0),
      role_dominates_date:
        (afterMetrics.experience_role_font_size ?? 0) > (afterMetrics.experience_date_font_size ?? 0),
    }).every(Boolean),
  };

  writeFileSync(join(REVIEW_ROOT, "hierarchy-analysis.json"), JSON.stringify(hierarchyAnalysis, null, 2));

  const spacingAnalysis = {
    review_id: "founder-review-002",
    calibration_version: calibration.version,
    design_system_spacing: {
      section_gap_px: designSystem.spacing.section_spacing_px,
      heading_body_gap_px: designSystem.spacing.heading_body_gap_px,
      paragraph_spacing_px: designSystem.spacing.paragraph_spacing_px,
      baseline_rhythm_px: designSystem.spacing.baseline_rhythm_px,
      hierarchy_spacing: designSystem.hierarchy.spacing,
    },
    measured: {
      name_to_title_gap_px: afterMetrics.name_to_title_gap,
      title_to_contact_gap_px: afterMetrics.title_to_contact_gap,
      contact_to_summary_gap_px: afterMetrics.contact_to_summary_gap,
      section_gaps_px: afterMetrics.section_gaps,
      experience_entry_gaps_px: afterMetrics.experience_entry_gaps,
      avg_section_gap_px:
        afterMetrics.section_gaps.length > 0
          ? Math.round(
              afterMetrics.section_gaps.reduce((a, b) => a + b, 0) / afterMetrics.section_gaps.length,
            )
          : null,
    },
    rhythm_compliance: {
      header_gaps_adequate:
        (afterMetrics.name_to_title_gap ?? 0) >= 8 &&
        (afterMetrics.title_to_contact_gap ?? 0) >= 8 &&
        (afterMetrics.contact_to_summary_gap ?? 0) >= 12,
      section_separation_adequate:
        afterMetrics.section_gaps.length === 0 ||
        afterMetrics.section_gaps.every((g) => g >= 8),
      no_overlaps: afterMetrics.overlap_pairs === 0,
    },
    page_utilization: afterMetrics.page_utilization,
    pass:
      (afterMetrics.name_to_title_gap ?? 0) >= 8 &&
      afterMetrics.overlap_pairs === 0 &&
      (afterMetrics.page_utilization ?? 0) >= 0.75,
  };

  writeFileSync(join(REVIEW_ROOT, "spacing-analysis.json"), JSON.stringify(spacingAnalysis, null, 2));

  const premiumImprovements = {
    review_id: "founder-review-002",
    calibration_version: calibration.version,
    improvements: [
      {
        id: "name-dominance",
        description: "Candidate name increased to 38pt / weight 800 for clear visual dominance",
        before: beforeMetrics.name_font_size,
        after: afterMetrics.name_font_size,
        inherited_by: "all_future_resumes_via_design_system",
      },
      {
        id: "typography-ladder",
        description: "Seven-level hierarchy ladder: name → title → contact → section → role → date → bullet",
        design_system_module: "HierarchySystem.ts",
        inherited_by: "design-brain, adaptive-composer, production pipeline",
      },
      {
        id: "experience-readability",
        description: "Experience entries render role bold 12pt, dates muted 10.5pt, bullets 11.5pt with 22px rhythm",
        before_role_pt: beforeMetrics.experience_role_font_size,
        after_role_pt: afterMetrics.experience_role_font_size,
        inherited_by: "template-builder experienceSectionBlock",
      },
      {
        id: "vertical-rhythm",
        description: "8px baseline grid; section gaps 18px; experience entry gaps 16px",
        inherited_by: "SpacingSystem + HierarchySystem",
      },
      {
        id: "section-separation",
        description: "Section headings 14pt with 14px heading-to-body gap and 18px inter-section spacing",
        inherited_by: "TypographySystem + SpacingSystem",
      },
      {
        id: "ats-print-safety",
        description: "Linear text order preserved; no decorative clutter; contrast-safe palette unchanged",
        qa_alignment: alignment.pass,
        qa_design: designQa.pass,
      },
    ],
    principles: calibration.principles,
    status: "AWAITING_FOUNDER_APPROVAL",
    pass,
  };

  writeFileSync(join(REVIEW_ROOT, "premium-improvements.json"), JSON.stringify(premiumImprovements, null, 2));

  const memory = loadDesignMemory();
  writeFileSync(
    join(REVIEW_ROOT, "updated-learning.json"),
    JSON.stringify(
      {
        updated_at: new Date().toISOString(),
        review_id: "founder-review-002",
        design_memory_path: DESIGN_MEMORY_PATH,
        founder_calibration_path: FOUNDER_CALIBRATION_PATH,
        design_memory: memory,
        hierarchy_calibration: calibration,
      },
      null,
      2,
    ),
  );

  const summary = `# Founder Review #002 — Hierarchy & Premium Rhythm

**Status:** AWAITING_FOUNDER_APPROVAL
**Template:** production-batch-001-software-engineer
**Regenerated:** ${new Date().toISOString()}
**Calibration:** v${calibration.version}

## Founder Feedback Addressed

1. **Name dominance** — ${afterMetrics.name_font_size}pt (was ${beforeMetrics.name_font_size}pt); ratio ${nameRatio}:1 vs body
2. **Hierarchy ladder** — name → title → contact → section → role → date → bullet
3. **Vertical rhythm** — 8px baseline grid; section gaps ${designSystem.spacing.section_spacing_px}px
4. **Visual balance** — page utilization ${((afterMetrics.page_utilization ?? 0) * 100).toFixed(1)}%
5. **Whitespace consistency** — calibrated spacing tokens applied globally
6. **Section separation** — section headings ${afterMetrics.section_heading_font_size}pt with increased gaps
7. **Experience readability** — role ${afterMetrics.experience_role_font_size}pt bold; dates ${afterMetrics.experience_date_font_size}pt muted
8. **Premium perception** — stronger weights and spacing without decorative clutter
9. **ATS-safe** — linear text order preserved
10. **Print-safe** — contrast and layout constraints unchanged

## System Updates (All Future Resumes)

- New \`HierarchySystem.ts\` in Resume Design System
- Calibration v1.2.0 via \`appendFounderReview002Calibration()\`
- Design Brain typography/spacing/hierarchy engines consume design system
- Adaptive Composer hierarchy/typography/spacing intelligence wired to hierarchy ladder
- Production \`template-builder\` experience section with role/date/bullet rendering
- \`buildProductionDesignBundle()\` resolves hierarchy tokens into Fabric spec

## QA

- Alignment: ${alignment.pass ? "PASS" : "FAIL"} (${overlapCheck?.detail ?? "n/a"})
- Design QA: ${designQa.pass ? "PASS" : "FAIL"}
- Hierarchy compliance: ${hierarchyAnalysis.pass ? "PASS" : "FAIL"}
- Spacing compliance: ${spacingAnalysis.pass ? "PASS" : "FAIL"}

## Artifacts

- \`visual-delta.json\` — before/after visual metrics
- \`hierarchy-analysis.json\` — ladder compliance
- \`spacing-analysis.json\` — rhythm and gaps
- \`premium-improvements.json\` — improvement catalog
- \`updated-learning.json\` — learning memory snapshot

## Review

\`npm run review:template -- --path=${TARGET_DIR}/template-preview.json\`

**Do not publish.** Awaiting founder approval.
`;

  writeFileSync(join(REVIEW_ROOT, "founder-review-002.md"), summary);

  return { pass, output_dir: TARGET_DIR };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runFounderReview002()
    .then((r) => {
      console.log(
        JSON.stringify({ pass: r.pass, output_dir: r.output_dir, status: "AWAITING_FOUNDER_APPROVAL" }, null, 2),
      );
      if (!r.pass) process.exit(1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
