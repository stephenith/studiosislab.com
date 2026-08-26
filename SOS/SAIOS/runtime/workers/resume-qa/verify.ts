#!/usr/bin/env tsx
/**
 * Self-test — simulates full QA pipeline on latest generated template.
 */
import { runAlignmentCheck } from "./alignment-check.js";
import { runSpacingCheck } from "./spacing-check.js";
import { runTypographyCheck } from "./typography-check.js";
import { runAtsCheck } from "./ats-check.js";
import { runEditorCheck } from "./editor-check.js";
import { runFabricCheck } from "./fabric-check.js";
import { runThumbnailCheck } from "./thumbnail-check.js";
import { runSEOCheck } from "./seo-check.js";
import { loadTemplateContext, GENERATED_ROOT } from "./template-input.js";
import { preparePublicationPackage } from "./publisher.js";
import { buildValidationSummary, stageResult } from "./validation-report.js";
import { RESUME_QA_WORKER } from "./index.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  assert(RESUME_QA_WORKER.worker_type === "resume-qa-worker", "worker type");
  assert(RESUME_QA_WORKER.constraints.some((c) => c.includes("src/")), "src constraint");

  const ctx = loadTemplateContext();
  assert(ctx.json.objects.length > 0, "template has objects");
  assert(ctx.source_dir.includes("generated-resumes"), "loads from generated-resumes");

  const alignment = runAlignmentCheck(ctx);
  assert(alignment.pass, "Alignment passes");

  const spacing = runSpacingCheck(ctx);
  assert(spacing.pass, "Spacing passes");

  const typography = runTypographyCheck(ctx);
  assert(typography.pass, "Typography passes");

  const ats = runAtsCheck(ctx);
  assert(ats.pass, "ATS passes");

  const editor = runEditorCheck(ctx);
  assert(editor.pass, "Editor compatibility passes");

  const fabric = runFabricCheck(ctx);
  assert(fabric.pass, "Fabric validation passes");

  const thumbnail = await runThumbnailCheck(ctx, {
    output_dir: "/tmp/resume-qa-verify",
    render_if_missing: true,
  });
  assert(thumbnail.pass, "Thumbnail validation passes");

  const seo = runSEOCheck(ctx);
  assert(seo.pass, "SEO validation passes");

  const stages = [
    stageResult("alignment", alignment),
    stageResult("spacing", spacing),
    stageResult("typography", typography),
    stageResult("ats", ats),
    stageResult("editor", editor),
    stageResult("fabric", fabric),
    stageResult("thumbnail", thumbnail),
    stageResult("seo", seo),
  ];

  const summary = buildValidationSummary(ctx, stages);
  assert(summary.pass, "Overall QA PASS");

  const pub = preparePublicationPackage(ctx, "/tmp/resume-qa-verify", summary);
  assert(pub.status === "WAITING_FOR_FOUNDER_APPROVAL", "publication status");
  assert(pub.files.some((f) => f.includes(".json")), "publishing package created");

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "resume-qa-worker",
        template: ctx.prototype_id,
        generated_root: GENERATED_ROOT,
        stages: stages.map((s) => ({ stage: s.stage, pass: s.pass })),
        overall: "PASS",
        publication_status: pub.status,
        catalog_id: pub.catalog_id,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(JSON.stringify({ pass: false, error: String(err) }, null, 2));
  process.exit(1);
});
