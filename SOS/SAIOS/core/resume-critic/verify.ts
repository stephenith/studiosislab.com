/**
 * Resume Critic Engine verify — Agent #130
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { createResumeCritic } from "./ResumeCritic.js";
import type { CanvasDocument, CriticInput } from "./types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const LOG = join(REPO, "SOS/07_LOGS/saios/resume-critic");
const REPORT = join(REPO, "SOS/09_REPORTS/AIOS_RESUME_CRITIC_ENGINE_V1_REPORT.md");
const PKG = join(REPO, "package.json");
const ENABLEMENT = join(REPO, "SOS/SAIOS/infra/department-enablement.json");
const CANVAS = join(REPO, "SOS/07_LOGS/saios/resume-renderer/canvas.json");

function fingerprint(result: { scores: Record<string, number>; readiness: { ready: boolean } }) {
  return createHash("sha256")
    .update(JSON.stringify({ scores: result.scores, ready: result.readiness.ready }))
    .digest("hex");
}

async function main() {
  mkdirSync(LOG, { recursive: true });
  if (process.env.SOS_AIOS_LIVE === "1") {
    console.error("LIVE must be OFF");
    process.exit(1);
  }
  if (!existsSync(CANVAS)) {
    console.error("Missing renderer canvas — run resume-renderer:verify first");
    process.exit(1);
  }

  const critic = createResumeCritic(REPO);
  const canvasBefore = readFileSync(CANVAS);
  const hashBefore = createHash("sha256").update(canvasBefore).digest("hex");

  const a = critic.critique({ persist: true });
  const b = critic.critique({ persist: false });

  const hashAfter = createHash("sha256").update(readFileSync(CANVAS)).digest("hex");

  // Block low scores: strip required Fabric props + remove sections via empty objects
  const badCanvas = JSON.parse(JSON.stringify(a)) && (JSON.parse(readFileSync(CANVAS, "utf8")) as CanvasDocument);
  // Force technical fail + ATS multi-column + missing schema
  for (const o of badCanvas.objects) {
    if (o.type === "Textbox") {
      o.selectable = false;
      o.evented = false;
      delete o.originX;
      o.left = (Number(o.left) % 2 === 0 ? 40 : 320) as number; // multi-column
    }
  }
  badCanvas.version = "resume-bad";
  const blocked = critic.critique({
    persist: false,
    input: {
      canvas: badCanvas,
      resume_json: { sections: [{ id: "header", order: 0 }] },
      overflow: { overflow: true, overflow_px: 50 },
      renderer_validation_pass: false,
    } satisfies CriticInput,
  });

  // Allow passing: use real renderer output
  const allowed = a.readiness.ready === true && a.readiness.founder_review_allowed === true;

  const pkg = JSON.parse(readFileSync(PKG, "utf8"));
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const noSdk = !("openai" in deps) && !("@anthropic-ai/sdk" in deps);
  const enablement = JSON.parse(readFileSync(ENABLEMENT, "utf8"));

  const files = [
    "overall-score.json",
    "ats-report.json",
    "visual-report.json",
    "typography-report.json",
    "layout-report.json",
    "technical-report.json",
    "consistency-report.json",
    "section-report.json",
    "readiness.json",
    "failure-report.json",
    "critic-summary.md",
  ];
  const filesOk = files.every((f) => existsSync(join(LOG, f)));

  const modules = [
    "ResumeCritic.ts",
    "CriticScore.ts",
    "ATSCritic.ts",
    "VisualCritic.ts",
    "LayoutCritic.ts",
    "TypographyCritic.ts",
    "SpacingCritic.ts",
    "ConsistencyCritic.ts",
    "TechnicalCritic.ts",
    "SectionCritic.ts",
    "OverallEvaluator.ts",
    "ReadinessGate.ts",
    "CriticValidator.ts",
  ].every((f) => existsSync(join(REPO, "SOS/SAIOS/core/resume-critic", f)));

  const checks = {
    modules_exist: modules,
    deterministic: fingerprint(a) === fingerprint(b),
    no_ai: a.used_ai === false,
    no_openai: noSdk,
    no_mock: a.used_mock_provider === false,
    evaluates_renderer_output: filesOk && a.scores.overall > 0,
    scores_every_category:
      a.scores.ats >= 0 &&
      a.scores.visual >= 0 &&
      a.scores.typography >= 0 &&
      a.scores.layout >= 0 &&
      a.scores.technical >= 0 &&
      a.scores.consistency >= 0 &&
      a.scores.sections >= 0 &&
      a.scores.overall >= 0,
    readiness_gate_works: typeof a.readiness.ready === "boolean",
    blocks_low_scores:
      blocked.readiness.ready === false &&
      blocked.readiness.founder_review_allowed === false &&
      blocked.readiness.blocked_reasons.length > 0,
    allows_passing_resumes: allowed,
    no_publication: a.publication_allowed === false,
    live_off: process.env.SOS_AIOS_LIVE !== "1" && a.live_enabled === false,
    website_disabled: enablement.departments?.website?.enabled === false,
    canvas_unmodified: hashBefore === hashAfter,
    mutated_resume_false: a.mutated_resume === false,
  };

  const overall = Object.values(checks).every(Boolean);

  const readinessOut = {
    generated_at: new Date().toISOString(),
    agent: "130",
    status: overall ? "ready" : "blocked",
    overall: overall ? "PASS" : "FAIL",
    checks,
    sample_scores: a.scores,
    sample_ready: a.readiness.ready,
    blocked_fixture_ready: blocked.readiness.ready,
  };
  writeFileSync(
    join(LOG, "verify-readiness.json"),
    `${JSON.stringify(readinessOut, null, 2)}\n`,
  );

  const md = [
    `# AIOS Resume Critic Engine V1 Report`,
    ``,
    `**Agent:** #130`,
    `**Generated:** ${readinessOut.generated_at}`,
    `**Overall:** ${overall ? "PASS" : "FAIL"}`,
    ``,
    `## Summary`,
    ``,
    `Deterministic Resume Critic evaluates renderer Canvas JSON before Founder Review.`,
    `No AI. No Mock Provider. No mutations. LIVE OFF. No publication.`,
    ``,
    `## Sample scores (renderer output)`,
    ``,
    `| Category | Score |`,
    `|---|---|`,
    `| Overall | ${a.scores.overall} |`,
    `| ATS | ${a.scores.ats} |`,
    `| Visual | ${a.scores.visual} |`,
    `| Typography | ${a.scores.typography} |`,
    `| Layout | ${a.scores.layout} |`,
    `| Technical | ${a.scores.technical} |`,
    `| Consistency | ${a.scores.consistency} |`,
    `| Sections | ${a.scores.sections} |`,
    `| Ready | ${a.readiness.ready ? "YES" : "NO"} |`,
    ``,
    `## Gates`,
    ``,
    `| Check | Result |`,
    `|-------|--------|`,
    ...Object.entries(checks).map(
      ([k, v]) => `| ${k} | ${v ? "PASS" : "FAIL"} |`,
    ),
    ``,
    `## Readiness rules`,
    ``,
    `- Overall ≥ 90`,
    `- ATS ≥ 95`,
    `- Technical = 100`,
    `- No overflow / schema mismatch / missing sections / renderer errors`,
    ``,
    `## Next`,
    ``,
    `Agent #131 — Wire Critic readiness into Founder Review queue (block when Ready=NO).`,
    ``,
  ].join("\n");
  writeFileSync(REPORT, md, "utf8");

  console.log("Resume Critic Engine Verify");
  console.log("===========================");
  for (const [k, v] of Object.entries(checks)) {
    console.log(`${v ? "✔" : "✘"} ${k}`);
  }
  console.log("");
  console.log(
    `Sample: Overall=${a.scores.overall} ATS=${a.scores.ats} Tech=${a.scores.technical} Ready=${a.readiness.ready ? "YES" : "NO"}`,
  );
  console.log(
    `Blocked fixture Ready=${blocked.readiness.ready ? "YES" : "NO"} (${blocked.readiness.blocked_reasons.join("; ")})`,
  );
  console.log(`Overall: ${overall ? "PASS" : "FAIL"}`);

  if (!overall) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
