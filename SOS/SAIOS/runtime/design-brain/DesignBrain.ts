/**
 * Resume Design Brain — primary design authority for all Resume Production Workers.
 * Makes design decisions only — never generates templates or Fabric JSON.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createMockCursorResearchExecutor } from "../research/ResearchCoordinator.js";
import type { CursorResearchExecutor } from "../research/ResearchCoordinator.js";
import {
  integrateResearch,
  renderResearchSummaryMd,
  type ValidatedResearch,
} from "./ResearchIntegration.js";
import { runDesignDecisionEngine } from "./DesignDecisionEngine.js";
import { appendBrainMemory } from "./DesignMemory.js";
import type { BrainRunOptions, BrainRunResult } from "./types.js";

export const DESIGN_BRAIN = {
  module: "resume-design-brain",
  version: "1.0.0",
  role: "design_authority_only",
  description:
    "Primary design decision authority. Workers request decisions — never decide layout, typography, or color directly.",
} as const;

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
export const BRAIN_OUTPUT_ROOT = join(SOS_ROOT, "07_LOGS/saios/design-brain");
export const BRAIN_SESSIONS_ROOT = join(BRAIN_OUTPUT_ROOT, "sessions");

export type RunDesignBrainOptions = BrainRunOptions & {
  cursor_executor?: CursorResearchExecutor;
};

export function allocateBrainSessionId(date = new Date()): string {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
  mkdirSync(BRAIN_SESSIONS_ROOT, { recursive: true });
  const prefix = `brain-${ymd}-`;
  const existing = readdirSync(BRAIN_SESSIONS_ROOT).filter((n) => n.startsWith(prefix));
  return `${prefix}${String(existing.length + 1).padStart(3, "0")}`;
}

export async function runDesignBrain(options: RunDesignBrainOptions): Promise<BrainRunResult> {
  const session_id = allocateBrainSessionId();
  const session_dir = join(BRAIN_SESSIONS_ROOT, session_id);
  if (existsSync(session_dir)) {
    throw new Error(`Brain session exists — will not overwrite: ${session_dir}`);
  }
  mkdirSync(session_dir, { recursive: true });

  const executor =
    options.cursor_executor ??
    createMockCursorResearchExecutor({ failure_rate: 0, base_ms: 8 });

  const research = await integrateResearch({
    objective: options.objective,
    executor,
    mcp_available: options.mcp_firecrawl_available ?? false,
  });

  const engine = runDesignDecisionEngine(options.objective, research, options);

  const pass =
    engine.quality.target_met &&
    engine.confidence.target_met &&
    engine.decisions.originality_score >= 65;

  const artifacts = persistBrainOutput(session_dir, {
    session_id,
    objective: options.objective,
    research,
    engine,
  });

  appendBrainMemory(
    {
      recorded_at: new Date().toISOString(),
      source: "research",
      note: `Design brain session ${session_id}`,
      preferences: {
        typography_bias: [engine.decisions.typography_system.primary_font],
        color_bias: [engine.decisions.color_system.primary_accent],
        layout_bias: [engine.decisions.layout_family],
        ats_priority: engine.decisions.ats_mode === "ats_first",
        premium_preference: engine.decisions.premium_feel,
      },
    },
    options.persist !== false,
  );

  return {
    pass,
    session_id,
    session_dir,
    decisions: engine.decisions,
    quality: engine.quality,
    confidence: engine.confidence,
  };
}

function persistBrainOutput(
  session_dir: string,
  payload: {
    session_id: string;
    objective: string;
    research: ValidatedResearch;
    engine: ReturnType<typeof runDesignDecisionEngine>;
  },
): string[] {
  const { engine, research, objective, session_id } = payload;

  const design_brain = {
    session_id,
    version: DESIGN_BRAIN.version,
    generated_at: new Date().toISOString(),
    objective,
    role: DESIGN_BRAIN.role,
    decisions_summary: {
      design_language: engine.decisions.design_language,
      visual_style: engine.decisions.visual_style,
      layout_family: engine.decisions.layout_family,
      ats_mode: engine.decisions.ats_mode,
      originality_score: engine.decisions.originality_score,
      confidence: engine.confidence.overall,
    },
  };

  writeFileSync(join(session_dir, "design-brain.json"), JSON.stringify(design_brain, null, 2));
  writeFileSync(
    join(session_dir, "design-decisions.json"),
    JSON.stringify(engine.decisions, null, 2),
  );
  writeFileSync(join(session_dir, "design-quality.json"), JSON.stringify(engine.quality, null, 2));
  writeFileSync(
    join(session_dir, "design-confidence.json"),
    JSON.stringify(engine.confidence, null, 2),
  );
  writeFileSync(
    join(session_dir, "research-summary.md"),
    renderResearchSummaryMd(research, objective),
  );
  writeFileSync(
    join(session_dir, "visual-analysis.md"),
    renderVisualAnalysisMd(engine),
  );
  writeFileSync(join(session_dir, "brain-report.md"), renderBrainReportMd(payload));

  mirrorToBrainRoot(session_dir, [
    "design-brain.json",
    "design-decisions.json",
    "design-quality.json",
    "design-confidence.json",
    "research-summary.md",
    "visual-analysis.md",
    "brain-report.md",
  ]);

  return [
    "design-brain.json",
    "design-decisions.json",
    "design-quality.json",
    "design-confidence.json",
    "research-summary.md",
    "visual-analysis.md",
    "brain-report.md",
  ];
}

function mirrorToBrainRoot(session_dir: string, files: string[]): void {
  mkdirSync(BRAIN_OUTPUT_ROOT, { recursive: true });
  for (const f of files) {
    copyFileSync(join(session_dir, f), join(BRAIN_OUTPUT_ROOT, f));
  }
}

function renderVisualAnalysisMd(engine: ReturnType<typeof runDesignDecisionEngine>): string {
  const d = engine.decisions;
  return [
    "# Visual Analysis",
    "",
    `**Layout family:** ${d.layout_family}`,
    `**Visual style:** ${d.visual_style}`,
    `**Design language:** ${d.design_language}`,
    "",
    "## Grid",
    "",
    `- Columns: ${d.grid_system.columns}`,
    `- Base unit: ${d.grid_system.base_unit_px}px`,
    `- Margins: ${d.grid_system.margin_px}px`,
    "",
    "## Typography",
    "",
    `- Primary: ${d.typography_system.primary_font}`,
    `- Body: ${d.typography_system.body_size_pt}pt`,
  ].join("\n");
}

function renderBrainReportMd(payload: {
  session_id: string;
  objective: string;
  engine: ReturnType<typeof runDesignDecisionEngine>;
}): string {
  const { engine, session_id, objective } = payload;
  return [
    "# Design Brain Report",
    "",
    `**Session:** \`${session_id}\``,
    `**Objective:** ${objective}`,
    `**Overall quality:** ${engine.quality.overall_quality}`,
    `**Confidence:** ${engine.confidence.overall}`,
    "",
    "## Integration",
    "",
    "Research Engine → Design Brain → Resume Production Worker V2",
    "",
    "*Design authority only — no template generation.*",
  ].join("\n");
}
