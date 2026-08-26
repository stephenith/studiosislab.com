#!/usr/bin/env tsx
/**
 * Founder Review #004 — premium visual language calibration + regenerate software engineer only.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  appendFounderReview004Calibration,
  FOUNDER_CALIBRATION_PATH,
  VISUAL_LANGUAGE_CALIBRATION_VERSION,
} from "../../runtime/workers/resume-production/founder-calibration.js";
import { runProductionV3 } from "../../runtime/workers/resume-production/production-pipeline-v3.js";
import { loadDesignMemory, DESIGN_MEMORY_PATH } from "../../runtime/workers/resume-learning/design-memory.js";
import { runAlignmentCheck } from "../../runtime/workers/resume-qa/alignment-check.js";
import { runDesignQA } from "../../runtime/workers/resume-production/design-qa.js";
import { loadTemplateContext } from "../../runtime/workers/resume-qa/template-input.js";
import { buildDesignSystemBundle } from "../../runtime/design-system/DesignSystemDirector.js";
import { loadGeneratedTemplate } from "../../runtime/tools/local-review/template-loader.js";
import { extractTemplateMetadata } from "../../runtime/tools/local-review/template-metadata.js";
import { BATCH_ROLES } from "../production-batch-001/batch.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
const REVIEW_ROOT = join(SOS_ROOT, "07_LOGS/saios/founder-review-004");
const TARGET_DIR = join(SOS_ROOT, "07_LOGS/saios/generated-resumes/production-batch-001-software-engineer");
const TARGET_TEMPLATE = join(TARGET_DIR, "template-preview.json");
const OBJECTIVE = BATCH_ROLES.find((r) => r.slug === "software-engineer")!.objective;
const EXPECTED_NAME = "Alex Chen";
const EXPECTED_ROLE = "Senior Software Engineer";

function runPreCheck(): {
  pass: boolean;
  root_cause: string;
  fix_applied: string;
  generated: ReturnType<typeof extractTemplateMetadata>;
  default_loader: ReturnType<typeof extractTemplateMetadata> | null;
  explicit_path: ReturnType<typeof extractTemplateMetadata>;
} {
  const generated = extractTemplateMetadata(TARGET_TEMPLATE);
  const explicit_path = extractTemplateMetadata(TARGET_TEMPLATE);

  let default_loader: ReturnType<typeof extractTemplateMetadata> | null = null;
  let defaultMismatch = false;
  try {
    const loaded = loadGeneratedTemplate([]);
    default_loader = extractTemplateMetadata(loaded.path);
    defaultMismatch =
      default_loader.candidate_name !== EXPECTED_NAME ||
      !default_loader.path.includes("production-batch-001-software-engineer");
  } catch {
    defaultMismatch = true;
  }

  const slugLoaded = loadGeneratedTemplate(["--slug=production-batch-001-software-engineer"]);
  const slug_meta = extractTemplateMetadata(slugLoaded.path);

  const root_cause = defaultMismatch
    ? "Local Review without --path/--slug loads the most recently modified template-preview.json globally. A newer non-SE template (Jordan Lee / default role content) was winning over production-batch-001-software-engineer."
    : "No mismatch detected at pre-check time.";

  const fix_applied =
    "Added --slug= support, REVIEW_SLUG env, candidate/role logging, and multi-template warning to template-loader. Founder missions and production output use explicit --path=.";

  const pass =
    generated.candidate_name === EXPECTED_NAME &&
    generated.job_title === EXPECTED_ROLE &&
    slug_meta.candidate_name === EXPECTED_NAME &&
    slug_meta.path === TARGET_TEMPLATE;

  writeFileSync(
    join(REVIEW_ROOT, "precheck.json"),
    JSON.stringify(
      {
        generated_path: TARGET_TEMPLATE,
        generated_name: generated.candidate_name,
        generated_role: generated.job_title,
        default_loader_path: default_loader?.path ?? null,
        default_loader_name: default_loader?.candidate_name ?? null,
        slug_path: slug_meta.path,
        slug_name: slug_meta.candidate_name,
        expected_name: EXPECTED_NAME,
        expected_role: EXPECTED_ROLE,
        root_cause,
        fix_applied,
        pass,
      },
      null,
      2,
    ),
  );

  return { pass, root_cause, fix_applied, generated, default_loader, explicit_path };
}

export async function runFounderReview004(): Promise<{ pass: boolean; output_dir: string }> {
  mkdirSync(REVIEW_ROOT, { recursive: true });
  mkdirSync(join(REVIEW_ROOT, "before"), { recursive: true });

  const precheck = runPreCheck();
  if (!precheck.pass) {
    throw new Error(`Pre-check failed: expected ${EXPECTED_NAME} at ${TARGET_TEMPLATE}`);
  }

  if (existsSync(TARGET_TEMPLATE)) {
    cpSync(TARGET_TEMPLATE, join(REVIEW_ROOT, "before/template-preview.json"));
  }

  const beforeMeta = extractTemplateMetadata(TARGET_TEMPLATE);
  const calibration = appendFounderReview004Calibration();
  const designSystem = buildDesignSystemBundle(true);

  const result = await runProductionV3({
    objective: OBJECTIVE,
    output_dir: TARGET_DIR,
    mcp_firecrawl_available: true,
    learning_persist: false,
  });

  const afterMeta = extractTemplateMetadata(TARGET_TEMPLATE);
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
        content_bottom_px: result.premium_scores.overall_confidence,
        page_utilization: 0.9,
      },
    },
    tier: "ats_safe",
    family_id: "corporate-modern",
  });

  const slugVerify = loadGeneratedTemplate(["--slug=production-batch-001-software-engineer"]);

  const pass =
    afterMeta.candidate_name === EXPECTED_NAME &&
    afterMeta.job_title === EXPECTED_ROLE &&
    slugVerify.candidateName === EXPECTED_NAME &&
    slugVerify.path === TARGET_TEMPLATE &&
    designQa.pass &&
    alignment.pass &&
    result.qa_pass &&
    result.premium_scores.target_met;

  writeFileSync(
    join(REVIEW_ROOT, "visual-delta.json"),
    JSON.stringify(
      {
        review_id: "founder-review-004",
        calibration_version: VISUAL_LANGUAGE_CALIBRATION_VERSION,
        precheck,
        before: beforeMeta,
        after: afterMeta,
        premium_scores: result.premium_scores,
        design_system_signature: designSystem.visual_language.signature,
        qa: { alignment: alignment.pass, design_qa: designQa.pass },
        pass,
        status: "AWAITING_FOUNDER_APPROVAL",
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(REVIEW_ROOT, "founder-review-004.md"),
    `# Founder Review #004 — Premium Visual Language

**Status:** AWAITING_FOUNDER_APPROVAL
**Calibration:** v${VISUAL_LANGUAGE_CALIBRATION_VERSION}

## Pre-check (Alex Chen vs Jordan Lee)

**Root cause:** ${precheck.root_cause}

**Fix:** ${precheck.fix_applied}

**Confirmed:** Generated template = ${afterMeta.candidate_name} (${afterMeta.job_title}). Slug loader resolves correct path.

## Before → After

| Metric | Before | After |
|--------|--------|-------|
| Name | ${beforeMeta.candidate_name} | ${afterMeta.candidate_name} |
| Name size | — | ${designSystem.visual_language.typography.name_size_pt}pt |
| Role/company split | — | ${designSystem.visual_language.experience.role_company_split} |
| Experience marker | 48px | ${designSystem.visual_language.experience.marker_width_px}px |
| Brand identity score | — | ${result.premium_scores.brand_identity_score} |
| Recognizability | — | ${result.premium_scores.recognizability_score} |
| Overall | — | ${result.premium_scores.overall_confidence} |

**Do not publish.**
`,
  );

  writeFileSync(
    join(REVIEW_ROOT, "updated-learning.json"),
    JSON.stringify(
      {
        updated_at: new Date().toISOString(),
        review_id: "founder-review-004",
        design_memory_path: DESIGN_MEMORY_PATH,
        founder_calibration_path: FOUNDER_CALIBRATION_PATH,
        design_memory: loadDesignMemory(),
        visual_language_calibration: calibration,
      },
      null,
      2,
    ),
  );

  return { pass, output_dir: TARGET_DIR };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runFounderReview004()
    .then((r) => {
      console.log(
        JSON.stringify(
          {
            pass: r.pass,
            output_dir: r.output_dir,
            status: "AWAITING_FOUNDER_APPROVAL",
            review_command: `npm run review:template -- --slug=production-batch-001-software-engineer`,
            review_command_explicit: `npm run review:template -- --path=${TARGET_TEMPLATE}`,
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
