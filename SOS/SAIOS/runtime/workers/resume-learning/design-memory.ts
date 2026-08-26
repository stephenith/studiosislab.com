/**
 * Persistent design memory — founder preferences accumulated over time.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { DesignMemory, StructuredFeedback } from "./types.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../../..");
export const LEARNING_ROOT = join(SOS_ROOT, "07_LOGS/saios/learning");
export const DESIGN_MEMORY_PATH = join(LEARNING_ROOT, "design-memory.json");

export function createDefaultDesignMemory(): DesignMemory {
  return {
    version: "1.0.0",
    updated_at: new Date().toISOString(),
    accepted_layouts: [],
    rejected_layouts: [],
    preferred_spacing: {
      min_section_gap_px: 16,
      min_paragraph_gap_px: 6,
      margin_px: 48,
    },
    preferred_typography: {
      font_families: ["Inter", "Arial", "Calibri"],
      min_body_pt: 10.5,
      heading_scale: 1.8,
    },
    preferred_colors: {
      accent: ["#2563eb"],
      avoid: [],
      body_text: "#111827",
    },
    preferred_sections: {
      order: ["summary", "experience", "education", "skills", "certifications"],
      elevate: [],
    },
    preferred_visual_density: "balanced",
    preferred_ats_score: 85,
    preferred_visual_score: 75,
    feedback_count: 0,
  };
}

export function loadDesignMemory(): DesignMemory {
  if (!existsSync(DESIGN_MEMORY_PATH)) {
    return createDefaultDesignMemory();
  }
  try {
    return JSON.parse(readFileSync(DESIGN_MEMORY_PATH, "utf8")) as DesignMemory;
  } catch {
    return createDefaultDesignMemory();
  }
}

export function saveDesignMemory(memory: DesignMemory): void {
  mkdirSync(LEARNING_ROOT, { recursive: true });
  memory.updated_at = new Date().toISOString();
  writeFileSync(DESIGN_MEMORY_PATH, JSON.stringify(memory, null, 2));
}

export function applyFeedbackToMemory(
  memory: DesignMemory,
  feedback: StructuredFeedback,
): DesignMemory {
  const next = { ...memory, feedback_count: memory.feedback_count + 1 };

  if (feedback.founder_decision === "approved") {
    if (!next.accepted_layouts.includes(feedback.template_id)) {
      next.accepted_layouts.push(feedback.template_id);
    }
  } else if (feedback.founder_decision === "rejected") {
    if (!next.rejected_layouts.includes(feedback.template_id)) {
      next.rejected_layouts.push(feedback.template_id);
    }
  }

  for (const signal of feedback.signals) {
    if (signal.includes("increase_section_gap") || signal.includes("increase_vertical_rhythm")) {
      next.preferred_spacing.min_section_gap_px += 2;
      next.preferred_visual_density = "spacious";
    }
    if (signal.includes("increase_paragraph_gap") || signal.includes("increase_margins")) {
      next.preferred_spacing.min_paragraph_gap_px += 1;
      next.preferred_spacing.margin_px += 4;
    }
    if (signal.includes("reduce_accent_blue") || signal.includes("limit_accent")) {
      next.preferred_colors.avoid = [...new Set([...next.preferred_colors.avoid, "#2563eb"])];
      next.preferred_colors.accent = next.preferred_colors.accent.filter((c) => c !== "#2563eb");
      if (!next.preferred_colors.accent.length) next.preferred_colors.accent.push("#374151");
    }
    if (signal.includes("refine_font_scale") || signal.includes("improve_hierarchy")) {
      next.preferred_typography.heading_scale += 0.05;
      next.preferred_typography.min_body_pt = Math.max(10.5, next.preferred_typography.min_body_pt);
    }
    if (signal.includes("ats_safe") || signal.includes("simplify_layout")) {
      next.preferred_ats_score = Math.min(100, next.preferred_ats_score + 2);
      next.preferred_visual_density = "balanced";
    }
    if (signal.includes("elevate_skills_section")) {
      if (!next.preferred_sections.elevate.includes("skills")) {
        next.preferred_sections.elevate.push("skills");
      }
      const order = next.preferred_sections.order.filter((s) => s !== "skills");
      const expIdx = order.indexOf("experience");
      order.splice(expIdx >= 0 ? expIdx + 1 : 2, 0, "skills");
      next.preferred_sections.order = order;
    }
    if (signal.includes("remove_decorative_icons")) {
      next.preferred_ats_score = Math.min(100, next.preferred_ats_score + 1);
    }
    if (signal.includes("add_subtle_accent") || signal.includes("visual_interest")) {
      next.preferred_visual_score = Math.min(100, next.preferred_visual_score + 2);
    }
    if (signal.includes("modernize_layout")) {
      next.preferred_typography.font_families = ["Inter", "DM Sans", "Arial"];
    }
    if (signal.includes("increase_page_fill") || signal.includes("reduce_bottom_whitespace")) {
      next.preferred_visual_density = "balanced";
      next.preferred_spacing.min_section_gap_px = Math.max(14, next.preferred_spacing.min_section_gap_px - 2);
    }
    if (signal.includes("increase_body_size")) {
      next.preferred_typography.min_body_pt = Math.max(next.preferred_typography.min_body_pt, 11.5);
    }
    if (signal.includes("calibrate_scoring") || signal.includes("never_assume_perfection")) {
      next.preferred_visual_score = Math.min(next.preferred_visual_score, 85);
    }
    if (signal.includes("fix_header_overlap") || signal.includes("increase_name_bottom_spacing")) {
      next.preferred_visual_density = "balanced";
    }
    if (
      signal.includes("increase_title_contact_separation") ||
      signal.includes("improve_header_summary_rhythm")
    ) {
      next.preferred_spacing.min_paragraph_gap_px = Math.max(
        next.preferred_spacing.min_paragraph_gap_px,
        8,
      );
    }
    if (signal.includes("preserve_page_utilization")) {
      next.preferred_spacing.min_section_gap_px = Math.max(
        14,
        next.preferred_spacing.min_section_gap_px,
      );
    }
    if (signal.includes("reinforce_current_direction")) {
      next.preferred_visual_score = Math.min(100, next.preferred_visual_score + 1);
    }
  }

  return next;
}

export function applyFeedbackBatch(
  memory: DesignMemory,
  feedback: StructuredFeedback[],
): DesignMemory {
  return feedback.reduce((mem, item) => applyFeedbackToMemory(mem, item), memory);
}
