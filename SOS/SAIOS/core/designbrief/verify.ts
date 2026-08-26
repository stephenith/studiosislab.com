/**
 * DesignBrief Engine verify — Agent #127.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { createDefaultEngine } from "./DesignBriefEngine.js";
import { createDesignBrief } from "./DesignBrief.js";
import { validateDesignBrief } from "./DesignBriefValidator.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const LOG = join(REPO, "SOS/07_LOGS/saios/designbrief");
const REPORT = join(
  REPO,
  "SOS/09_REPORTS/AIOS_DESIGNBRIEF_ENGINE_V1_REPORT.md",
);
const PKG = join(REPO, "package.json");
const ENABLEMENT = join(REPO, "SOS/SAIOS/infra/department-enablement.json");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function main() {
  mkdirSync(LOG, { recursive: true });

  if (process.env.SOS_AIOS_LIVE === "1") {
    console.error("LIVE must be OFF");
    process.exit(1);
  }

  const engine = createDefaultEngine(REPO);
  const result = engine.run({ persist: true, fixture: false });

  // Fixture path — isolated, still dry-run
  const fixture = engine.run({
    persist: true,
    fixture: true,
    brain_output: {
      mock: true,
      dry_run: true,
      plan_type: "design_planning",
      sections: ["header", "summary", "experience", "skills", "education"],
      layout: {
        columns: 2, // must be forced to single_column
        margins_mm: { top: 12, right: 12, bottom: 12, left: 12 },
        page_size: "A4",
      },
      typography: { heading: "Inter", body: "Inter", scale: ["24", "14", "11"] },
      notes: ["Fixture dual-column request — must collapse to ATS single column"],
    },
    task_id: "fixture-designbrief-001",
    skill_id: "resume.layout_planning",
  });

  const dualForcedSingle = fixture.brief.layout.columns === 1;

  // Reject LIVE / publish flags if somehow injected
  const bad = createDesignBrief({
    brain_output: {
      mock: true,
      sections: ["header", "summary", "experience", "skills", "education"],
      layout: { columns: 1, page_size: "A4", margins_mm: { top: 12, right: 12, bottom: 12, left: 12 } },
      typography: { heading: "Inter", body: "Inter", scale: [24, 14, 11] },
    },
  });
  // Mutate for negative check
  const poisoned = {
    ...bad,
    publication_allowed: true as unknown as false,
  };
  const poisonedValidation = validateDesignBrief(poisoned as typeof bad);

  const pkg = JSON.parse(readFileSync(PKG, "utf8"));
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const noSdk = !("openai" in deps) && !("@anthropic-ai/sdk" in deps);

  const enablement = JSON.parse(readFileSync(ENABLEMENT, "utf8"));
  const websiteDisabled = enablement.departments?.website?.enabled === false;
  const resumeDryRun = enablement.departments?.resume?.dry_run === true;
  const autoPublishOff = enablement.departments?.resume?.auto_publish === false;

  const files = [
    "design-brief.json",
    "resume-json-instructions.json",
    "layout-blueprint.json",
    "brief-index.json",
    "designbrief-report.md",
  ];
  const filesOk = files.every((f) => existsSync(join(LOG, f)));

  const brief = result.brief;
  const checks = {
    designbrief_contract_exists: Boolean(brief.brief_id && brief.version === "1.0.0"),
    layout_blueprint: brief.layout.structure === "single_column",
    typography_blueprint: brief.typography.ats_safe_fonts_only === true,
    section_ordering: brief.sections.order.length >= 5,
    spacing_system: brief.spacing.unit_px === 4 && brief.spacing.section_gap_px > 0,
    color_palette_selection: brief.colors.ats_safe && brief.colors.contrast_ok,
    ats_constraints: brief.ats.tier === "ats_safe" && brief.ats.tables_allowed === false,
    component_mapping: brief.components.length === brief.sections.order.length,
    resume_json_mapping:
      brief.resume_json.version === "designbrief-resume-json-1.0.0" &&
      brief.resume_json.template_generated === false,
    validation_pass: brief.validation.pass === true,
    dual_column_forced_single: dualForcedSingle,
    publication_poison_rejected: poisonedValidation.pass === false,
    artifacts_written: filesOk,
    dry_run_only: brief.dry_run === true && brief.resume_json.dry_run === true,
    no_publication:
      brief.publication_allowed === false &&
      brief.resume_json.publication_allowed === false,
    no_template_generated: brief.template_generated === false,
    no_openai: noSdk,
    live_off: process.env.SOS_AIOS_LIVE !== "1" && brief.live_enabled === false,
    mock_provider_only: brief.source.provider === "mock",
    website_disabled: websiteDisabled,
    resume_dry_run: resumeDryRun,
    auto_publish_false: autoPublishOff,
  };

  const overall = Object.values(checks).every(Boolean) && result.overall === "PASS";

  const readiness = {
    generated_at: new Date().toISOString(),
    agent: "127",
    status: overall ? "ready" : "blocked",
    checks,
    overall: overall ? "PASS" : "FAIL",
    brief_id: brief.brief_id,
    task_id: brief.source.task_id,
    dry_run: true,
    publication_allowed: false,
    live_enabled: false,
    templates_generated: 0,
    publications: 0,
  };
  writeFileSync(join(LOG, "readiness.json"), `${JSON.stringify(readiness, null, 2)}\n`);

  writeFileSync(
    join(LOG, "contract-summary.json"),
    `${JSON.stringify(
      {
        layout: brief.layout.structure,
        typography: brief.typography.heading_family,
        sections: brief.sections.order,
        spacing: brief.spacing,
        colors: brief.colors.id,
        ats: brief.ats.tier,
        components: brief.components.map((c) => c.component),
        resume_json_version: brief.resume_json.version,
      },
      null,
      2,
    )}\n`,
  );

  const md = [
    `# AIOS DesignBrief Engine V1 Report`,
    ``,
    `**Agent:** #127`,
    `**Generated:** ${readiness.generated_at}`,
    `**Overall:** ${overall ? "PASS" : "FAIL"}`,
    ``,
    `## Summary`,
    ``,
    `DesignBrief layer maps Mock Brain planning output into deterministic`,
    `resume construction instructions. Dry-run only. No publication. No OpenAI. LIVE OFF.`,
    ``,
    `## Flow`,
    ``,
    `\`Knowledge → Skills → Brain → Mock → DesignBrief → Resume JSON → Renderer\``,
    ``,
    `## Checks`,
    ``,
    `| Check | Result |`,
    `|-------|--------|`,
    ...Object.entries(checks).map(
      ([k, v]) => `| ${k} | ${v ? "PASS" : "FAIL"} |`,
    ),
    ``,
    `## Brief`,
    ``,
    `- brief_id: \`${brief.brief_id}\``,
    `- task_id: \`${brief.source.task_id}\``,
    `- sections: ${brief.sections.order.join(" → ")}`,
    `- palette: ${brief.colors.id}`,
    ``,
    `## Next`,
    ``,
    `Agent #128 — Renderer dry-run consuming DesignBrief resume JSON instructions (still no publish / no LIVE).`,
    ``,
  ].join("\n");
  writeFileSync(REPORT, md, "utf8");

  console.log("DesignBrief Engine Verify");
  console.log("=========================");
  for (const [k, v] of Object.entries(checks)) {
    console.log(`${v ? "✔" : "✘"} ${k}`);
  }
  console.log("");
  console.log(`Brief: ${brief.brief_id}`);
  console.log(`LIVE: false`);
  console.log(`Overall: ${overall ? "PASS" : "FAIL"}`);

  assert(overall, "verification must PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
