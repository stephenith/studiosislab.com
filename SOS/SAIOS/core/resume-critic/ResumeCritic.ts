/**
 * ResumeCritic — orchestrates deterministic evaluation of renderer output.
 * Never redesigns, never reasons, never calls AI/providers, never mutates.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { evaluateAll } from "./OverallEvaluator.js";
import { evaluateReadiness } from "./ReadinessGate.js";
import { validateCriticResult } from "./CriticValidator.js";
import type {
  CanvasDocument,
  CriticInput,
  CriticResult,
  OverflowLite,
  ResumeJsonLite,
} from "./types.js";

function atomicWrite(path: string, data: unknown): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

export type ResumeCriticOptions = {
  repoRoot?: string;
  canvasPath?: string;
  resumeJsonPath?: string;
  overflowPath?: string;
  validationPath?: string;
  persist?: boolean;
  input?: CriticInput;
};

export class ResumeCritic {
  constructor(private readonly repoRoot: string) {}

  critique(opts: ResumeCriticOptions = {}): CriticResult {
    if (process.env.SOS_AIOS_LIVE === "1") {
      throw new Error("ResumeCritic refuses to run while SOS_AIOS_LIVE=1");
    }

    const root = opts.repoRoot ?? this.repoRoot;
    let input = opts.input;

    if (!input) {
      const canvasPath =
        opts.canvasPath ??
        join(root, "SOS/07_LOGS/saios/resume-renderer/canvas.json");
      const resumeJsonPath =
        opts.resumeJsonPath ??
        join(root, "SOS/07_LOGS/saios/designbrief/resume-json-instructions.json");
      const overflowPath =
        opts.overflowPath ??
        join(root, "SOS/07_LOGS/saios/resume-renderer/overflow.json");
      const validationPath =
        opts.validationPath ??
        join(root, "SOS/07_LOGS/saios/resume-renderer/validation.json");

      const canvas = JSON.parse(
        readFileSync(canvasPath, "utf8"),
      ) as CanvasDocument;
      const resume_json = existsSync(resumeJsonPath)
        ? (JSON.parse(readFileSync(resumeJsonPath, "utf8")) as ResumeJsonLite)
        : null;
      const overflow = existsSync(overflowPath)
        ? (JSON.parse(readFileSync(overflowPath, "utf8")) as OverflowLite)
        : null;
      const validation = existsSync(validationPath)
        ? (JSON.parse(readFileSync(validationPath, "utf8")) as { pass?: boolean })
        : null;

      input = {
        canvas,
        resume_json,
        overflow,
        renderer_validation_pass: validation?.pass ?? null,
      };
    }

    // Deep clone canvas so we never mutate caller/renderer artifacts
    const safeInput: CriticInput = {
      canvas: JSON.parse(JSON.stringify(input.canvas)) as CanvasDocument,
      resume_json: input.resume_json
        ? (JSON.parse(JSON.stringify(input.resume_json)) as ResumeJsonLite)
        : null,
      overflow: input.overflow
        ? (JSON.parse(JSON.stringify(input.overflow)) as OverflowLite)
        : null,
      renderer_validation_pass: input.renderer_validation_pass,
    };

    const bundle = evaluateAll(safeInput);
    const readiness = evaluateReadiness({
      scores: bundle.scores,
      reports: bundle.reports,
      overflow: Boolean(safeInput.overflow?.overflow),
    });

    const result: CriticResult = {
      scores: bundle.scores,
      reports: bundle.reports,
      readiness,
      evaluated_at: new Date().toISOString(),
      dry_run: true,
      publication_allowed: false,
      live_enabled: false,
      mutated_resume: false,
      used_ai: false,
      used_mock_provider: false,
    };

    const integrity = validateCriticResult(result);
    if (!integrity.pass) {
      throw new Error(`Critic integrity failed: ${integrity.errors.join("; ")}`);
    }

    if (opts.persist !== false) {
      this.persist(root, result, bundle.spacing_detail);
    }

    return result;
  }

  private persist(
    root: string,
    result: CriticResult,
    spacing: { findings: unknown[]; metrics: unknown; score: number },
  ): void {
    const dir = join(root, "SOS/07_LOGS/saios/resume-critic");
    mkdirSync(dir, { recursive: true });

    atomicWrite(join(dir, "overall-score.json"), {
      ...result.scores,
      ready: result.readiness.ready,
      evaluated_at: result.evaluated_at,
    });
    atomicWrite(join(dir, "ats-report.json"), result.reports.ats);
    atomicWrite(join(dir, "visual-report.json"), result.reports.visual);
    atomicWrite(join(dir, "typography-report.json"), result.reports.typography);
    atomicWrite(join(dir, "layout-report.json"), {
      ...result.reports.layout,
      spacing,
    });
    atomicWrite(join(dir, "technical-report.json"), result.reports.technical);
    atomicWrite(join(dir, "consistency-report.json"), result.reports.consistency);
    atomicWrite(join(dir, "section-report.json"), result.reports.sections);
    atomicWrite(join(dir, "readiness.json"), {
      ...result.readiness,
      scores: result.scores,
      dry_run: true,
      publication_allowed: false,
      live_enabled: false,
      used_ai: false,
      used_mock_provider: false,
      mutated_resume: false,
      agent: "130",
      generated_at: result.evaluated_at,
    });

    const failures = Object.values(result.reports).flatMap((r) =>
      r.findings.filter((f) => f.severity === "fail"),
    );
    atomicWrite(join(dir, "failure-report.json"), {
      ready: result.readiness.ready,
      blocked_reasons: result.readiness.blocked_reasons,
      failures,
      count: failures.length,
    });

    const md = [
      `# Resume Critic Summary`,
      ``,
      `| Category | Score |`,
      `|---|---|`,
      `| Overall | ${result.scores.overall} |`,
      `| ATS | ${result.scores.ats} |`,
      `| Visual | ${result.scores.visual} |`,
      `| Typography | ${result.scores.typography} |`,
      `| Layout | ${result.scores.layout} |`,
      `| Technical | ${result.scores.technical} |`,
      `| Consistency | ${result.scores.consistency} |`,
      `| Sections | ${result.scores.sections} |`,
      `| Ready | ${result.readiness.ready ? "YES" : "NO"} |`,
      ``,
      result.readiness.ready
        ? `Founder Review: **allowed**`
        : `Founder Review: **blocked** — ${result.readiness.blocked_reasons.join("; ")}`,
      ``,
      `- dry_run: true`,
      `- used_ai: false`,
      `- mutated_resume: false`,
      ``,
    ].join("\n");
    writeFileSync(join(dir, "critic-summary.md"), md, "utf8");
  }
}

export function createResumeCritic(repoRoot?: string): ResumeCritic {
  return new ResumeCritic(repoRoot ?? resolve(import.meta.dirname, "../../../.."));
}
