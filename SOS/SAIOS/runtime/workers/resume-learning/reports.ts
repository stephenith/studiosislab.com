/**
 * Write learning artifacts to SOS/07_LOGS/saios/learning/
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  ConfidenceScore,
  DesignMemory,
  LearnedPattern,
  LearnedRulesLayer,
  QualityHistory,
  StructuredFeedback,
} from "./types.js";
import { LEARNING_ROOT } from "./design-memory.js";

export type ReportPayload = {
  structured_feedback: StructuredFeedback[];
  patterns: LearnedPattern[];
  learned_rules: LearnedRulesLayer;
  memory: DesignMemory;
  quality: QualityHistory;
  confidence_scores: ConfidenceScore[];
};

export function writeLearningReports(payload: ReportPayload): string {
  mkdirSync(LEARNING_ROOT, { recursive: true });

  writeFileSync(
    join(LEARNING_ROOT, "feedback.json"),
    JSON.stringify(
      {
        processed_at: new Date().toISOString(),
        count: payload.structured_feedback.length,
        items: payload.structured_feedback,
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(LEARNING_ROOT, "learned-patterns.json"),
    JSON.stringify(
      {
        extracted_at: new Date().toISOString(),
        count: payload.patterns.length,
        patterns: payload.patterns,
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(LEARNING_ROOT, "confidence.json"),
    JSON.stringify(
      {
        computed_at: new Date().toISOString(),
        scores: payload.confidence_scores,
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(LEARNING_ROOT, "quality-history.json"),
    JSON.stringify(payload.quality, null, 2),
  );

  writeFileSync(join(LEARNING_ROOT, "report.md"), renderReportMd(payload));

  return LEARNING_ROOT;
}

function renderReportMd(payload: ReportPayload): string {
  const lines: string[] = [
    "# Resume Learning Engine Report",
    "",
    `**Generated:** ${new Date().toISOString()}`,
    "",
    "## Knowledge flow",
    "",
    "```",
    "Base Standards",
    "       ↓",
    "Resume Intelligence",
    "       ↓",
    "Founder Learning  ← this engine",
    "       ↓",
    "Generation",
    "```",
    "",
    "## Summary",
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Feedback processed | ${payload.structured_feedback.length} |`,
    `| Patterns extracted | ${payload.patterns.length} |`,
    `| Learned rules | ${payload.learned_rules.rules.length} |`,
    `| Approval rate | ${payload.quality.approval_percentage}% |`,
    `| Memory feedback count | ${payload.memory.feedback_count} |`,
    "",
    "## Top learned patterns",
    "",
  ];

  for (const p of payload.patterns.slice(0, 8)) {
    lines.push(
      `- **${p.category}** — ${p.pattern} (${p.occurrences}×, confidence ${(p.confidence * 100).toFixed(0)}%)`,
    );
  }

  lines.push("", "## Confidence scores", "");
  for (const c of payload.confidence_scores.slice(0, 10)) {
    lines.push(
      `- \`${c.template_id}\` — **${c.overall_confidence}** (ATS ${c.components.ats}, design ${c.components.design_quality}, history ${c.components.historical_approval}, similarity ${c.components.similarity_to_approved})`,
    );
  }

  lines.push("", "## Most common corrections", "");
  for (const corr of payload.quality.most_common_corrections.slice(0, 6)) {
    lines.push(`- ${corr.category}: ${corr.count}`);
  }

  if (payload.quality.design_trends.length) {
    lines.push("", "## Design trends", "");
    for (const t of payload.quality.design_trends) {
      lines.push(`- ${t}`);
    }
  }

  lines.push("", "## Founder memory snapshot", "");
  lines.push(`- Accepted layouts: ${payload.memory.accepted_layouts.join(", ") || "—"}`);
  lines.push(`- Rejected layouts: ${payload.memory.rejected_layouts.join(", ") || "—"}`);
  lines.push(
    `- Preferred spacing: section ${payload.memory.preferred_spacing.min_section_gap_px}px, margin ${payload.memory.preferred_spacing.margin_px}px`,
  );
  lines.push(`- Preferred density: ${payload.memory.preferred_visual_density}`);
  lines.push(`- Elevated sections: ${payload.memory.preferred_sections.elevate.join(", ") || "—"}`);
  lines.push("", "## Learned rules (layer — base standards preserved)", "");
  for (const rule of payload.learned_rules.rules.slice(0, 12)) {
    lines.push(`- [${rule.priority}] ${rule.recommendation}`);
  }

  lines.push("", "---", "", "*Base standards are never overwritten. Learned rules are consumed as an overlay layer.*");

  return lines.join("\n");
}
