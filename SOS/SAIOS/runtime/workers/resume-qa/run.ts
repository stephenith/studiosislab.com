import { mkdirSync } from "node:fs";
import { runAlignmentCheck } from "./alignment-check.js";
import { runSpacingCheck } from "./spacing-check.js";
import { runTypographyCheck } from "./typography-check.js";
import { runAtsCheck } from "./ats-check.js";
import { runEditorCheck } from "./editor-check.js";
import { runFabricCheck } from "./fabric-check.js";
import { runThumbnailCheck } from "./thumbnail-check.js";
import { runSEOCheck } from "./seo-check.js";
import { loadTemplateContext } from "./template-input.js";
import { preparePublicationPackage, readPublicationPackageSummary } from "./publisher.js";
import { stageResult, writeQAReports, getQAOutputDir } from "./validation-report.js";

async function main(): Promise<void> {
  const sourceArg = process.argv.find((a) => a.startsWith("--source="));
  const sourceDir = sourceArg?.slice("--source=".length);

  console.log("[qa] Loading generated template…");
  const ctx = loadTemplateContext(sourceDir);
  console.log(`[qa] Template: ${ctx.prototype_id}`);
  console.log(`[qa] Source: ${ctx.source_dir}`);

  const stages = [
    stageResult("alignment", runAlignmentCheck(ctx)),
    stageResult("spacing", runSpacingCheck(ctx)),
    stageResult("typography", runTypographyCheck(ctx)),
    stageResult("ats", runAtsCheck(ctx)),
    stageResult("editor", runEditorCheck(ctx)),
    stageResult("fabric", runFabricCheck(ctx)),
  ];

  const qaOutputDir = getQAOutputDir(ctx);
  mkdirSync(qaOutputDir, { recursive: true });

  const thumbnailReport = await runThumbnailCheck(ctx, {
    output_dir: qaOutputDir,
    render_if_missing: true,
  });
  stages.push(stageResult("thumbnail", thumbnailReport));

  const seoReport = runSEOCheck(ctx);
  stages.push(stageResult("seo", seoReport));

  const { output_dir, summary } = writeQAReports(ctx, stages);
  console.log(`[qa] Reports written to ${output_dir}`);

  for (const stage of stages) {
    console.log(`[qa] ${stage.stage}: ${stage.pass ? "PASS" : "FAIL"}`);
  }

  const pub = preparePublicationPackage(ctx, output_dir, summary);
  console.log("");
  console.log(readPublicationPackageSummary(pub));
  console.log("");
  console.log(`Overall QA: ${summary.pass ? "PASS" : "FAIL"}`);
  console.log(`Publication package: ${pub.package_dir}`);

  if (!summary.pass) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
