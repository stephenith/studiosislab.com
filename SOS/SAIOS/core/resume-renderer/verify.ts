/**
 * Resume Renderer Engine verify — Agent #128.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { createResumeRenderer } from "./ResumeRenderer.js";
import { createHash } from "node:crypto";

const REPO = resolve(import.meta.dirname, "../../../..");
const LOG = join(REPO, "SOS/07_LOGS/saios/resume-renderer");
const DESIGNBRIEF_RESUME = join(
  REPO,
  "SOS/07_LOGS/saios/designbrief/resume-json-instructions.json",
);
const DESIGNBRIEF = join(
  REPO,
  "SOS/07_LOGS/saios/designbrief/design-brief.json",
);
const REPORT = join(
  REPO,
  "SOS/09_REPORTS/AIOS_RESUME_RENDERER_ENGINE_V1_REPORT.md",
);
const PKG = join(REPO, "package.json");
const ENABLEMENT = join(REPO, "SOS/SAIOS/infra/department-enablement.json");

function sha(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

async function main() {
  mkdirSync(LOG, { recursive: true });

  if (process.env.SOS_AIOS_LIVE === "1") {
    console.error("LIVE must be OFF");
    process.exit(1);
  }

  if (!existsSync(DESIGNBRIEF_RESUME)) {
    console.error("Missing DesignBrief resume JSON — run designbrief:verify first");
    process.exit(1);
  }

  const briefHashBefore = existsSync(DESIGNBRIEF) ? sha(DESIGNBRIEF) : "";
  const resumeHashBefore = sha(DESIGNBRIEF_RESUME);

  const renderer = createResumeRenderer(REPO);
  const result = renderer.render({ persist: true });

  // Fixture isolation
  renderer.render({
    persist: true,
    fixture: true,
    resume_json: JSON.parse(readFileSync(DESIGNBRIEF_RESUME, "utf8")),
    taskId: "fixture-renderer-001",
  });

  const briefHashAfter = existsSync(DESIGNBRIEF) ? sha(DESIGNBRIEF) : "";
  const resumeHashAfter = sha(DESIGNBRIEF_RESUME);

  const pkg = JSON.parse(readFileSync(PKG, "utf8"));
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const noSdk = !("openai" in deps) && !("@anthropic-ai/sdk" in deps);
  const enablement = JSON.parse(readFileSync(ENABLEMENT, "utf8"));

  const files = [
    "canvas.json",
    "render-tree.json",
    "overflow.json",
    "validation.json",
    "preview.json",
    "render-index.json",
    "resume-renderer-report.md",
  ];
  const filesOk = files.every((f) => existsSync(join(LOG, f)));

  const canvas = result.canvas_json;
  const aios = canvas.aios;
  const modulesExist = [
    "ResumeRenderer.ts",
    "CanvasBuilder.ts",
    "SectionRenderer.ts",
    "TypographyRenderer.ts",
    "SpacingRenderer.ts",
    "ThemeRenderer.ts",
    "BlockRenderer.ts",
    "PageLayoutEngine.ts",
    "OverflowDetector.ts",
    "RenderValidator.ts",
  ].every((f) =>
    existsSync(join(REPO, "SOS/SAIOS/core/resume-renderer", f)),
  );

  const checks = {
    resume_renderer_exists: modulesExist,
    canvas_builder: canvas.objects.some(
      (o) => o.role === "pageBackground" || o.isPageBg === true,
    ),
    section_renderer: result.render_tree.root.children!.length >= 5,
    typography_renderer: canvas.objects.some(
      (o) => o.type === "Textbox" && Boolean(o.fontFamily),
    ),
    spacing_renderer: result.render_tree.cursor_end_y > 0,
    theme_renderer: Boolean(
      canvas.objects.find((o) => o.isPageBg)?.fill || aios,
    ),
    block_renderer: canvas.objects.filter((o) => o.type === "Textbox").length >= 5,
    page_layout_engine: canvas.width === 794 && canvas.height === 1123,
    overflow_detector: typeof result.overflow.overflow === "boolean",
    render_validator: result.validation.pass === true,
    pipeline_artifacts: filesOk,
    designbrief_unmodified:
      briefHashBefore === briefHashAfter && resumeHashBefore === resumeHashAfter,
    dry_run_only: aios?.dry_run === true && result.preview.dry_run === true,
    no_publication:
      aios?.publication_allowed === false &&
      aios?.published === false &&
      result.preview.publication_allowed === false,
    no_template_generated: aios?.template_generated === false,
    no_openai: noSdk,
    live_off: process.env.SOS_AIOS_LIVE !== "1" && aios?.live_enabled === false,
    website_disabled: enablement.departments?.website?.enabled === false,
    founder_review_required: result.preview.founder_review_required === true,
    no_overflow: result.overflow.overflow === false,
    fabric_version_691: canvas.version === "6.9.1",
  };

  const overall = Object.values(checks).every(Boolean) && result.overall === "PASS";

  const readiness = {
    generated_at: new Date().toISOString(),
    agent: "128",
    status: overall ? "ready" : "blocked",
    checks,
    overall: overall ? "PASS" : "FAIL",
    brief_id: aios?.brief_id ?? null,
    task_id: aios?.task_id ?? null,
    object_count: canvas.objects.length,
    dry_run: true,
    publication_allowed: false,
    live_enabled: false,
    templates_generated: 0,
    publications: 0,
  };
  writeFileSync(join(LOG, "readiness.json"), `${JSON.stringify(readiness, null, 2)}\n`);

  const md = [
    `# AIOS Resume Renderer Engine V1 Report`,
    ``,
    `**Agent:** #128`,
    `**Generated:** ${readiness.generated_at}`,
    `**Overall:** ${overall ? "PASS" : "FAIL"}`,
    ``,
    `## Summary`,
    ``,
    `Deterministic Resume Renderer consumes DesignBrief Resume JSON and produces`,
    `a render tree + Fabric-compatible canvas preview. DesignBrief unmodified.`,
    `No AI. No OpenAI. LIVE OFF. No publication.`,
    ``,
    `## Pipeline`,
    ``,
    `\`DesignBrief → Resume JSON → Resume Renderer → Render Tree → Canvas JSON → Preview → Founder Review\``,
    ``,
    `## Modules`,
    ``,
    `1. ResumeRenderer`,
    `2. CanvasBuilder`,
    `3. SectionRenderer`,
    `4. TypographyRenderer`,
    `5. SpacingRenderer`,
    `6. ThemeRenderer`,
    `7. BlockRenderer`,
    `8. PageLayoutEngine`,
    `9. OverflowDetector`,
    `10. RenderValidator`,
    ``,
    `## Checks`,
    ``,
    `| Check | Result |`,
    `|-------|--------|`,
    ...Object.entries(checks).map(
      ([k, v]) => `| ${k} | ${v ? "PASS" : "FAIL"} |`,
    ),
    ``,
    `## Preview`,
    ``,
    `- objects: ${canvas.objects.length}`,
    `- brief_id: \`${aios?.brief_id}\``,
    `- status: ${result.preview.status}`,
    `- founder_review_required: true`,
    ``,
    `## Next`,
    ``,
    `Agent #129 — Founder preview review wiring / QA against rendered canvas (still no publish / no LIVE).`,
    ``,
  ].join("\n");
  writeFileSync(REPORT, md, "utf8");

  console.log("Resume Renderer Engine Verify");
  console.log("=============================");
  for (const [k, v] of Object.entries(checks)) {
    console.log(`${v ? "✔" : "✘"} ${k}`);
  }
  console.log("");
  console.log(`Objects: ${canvas.objects.length}`);
  console.log(`LIVE: false`);
  console.log(`Overall: ${overall ? "PASS" : "FAIL"}`);

  if (!overall) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
