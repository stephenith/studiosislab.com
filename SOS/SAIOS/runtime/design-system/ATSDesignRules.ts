/**
 * ATS design rules — wraps domain standards with component flags.
 */
import {
  ATS_STANDARDS,
  EXTERNAL_ATS_PRINCIPLES_2025_2026,
  MARKET_ATS_NOTES,
} from "../../domain/studiosislab/resume/ATSStandards.js";
import type { ATSComponentFlags } from "./types.js";
import { DESIGN_SYSTEM_VERSION } from "./types.js";

export type ATSRule = {
  id: string;
  category: "layout" | "typography" | "section" | "export" | "component";
  rule: string;
  required: boolean;
} & ATSComponentFlags;

const COMPONENT_RULES: ATSRule[] = [
  {
    id: "ats-single-column",
    category: "layout",
    rule: "ATS tier templates use single-column reading order",
    required: true,
    ats_safe: true,
    machine_readable: true,
    text_order: "top-to-bottom linear",
    contrast_safe: true,
    print_safe: true,
  },
  {
    id: "ats-textbox-only",
    category: "layout",
    rule: "All readable content in Textbox objects — no text in images",
    required: true,
    ats_safe: true,
    machine_readable: true,
    text_order: "preserved in export",
    contrast_safe: true,
    print_safe: true,
  },
  {
    id: "ats-standard-headings",
    category: "section",
    rule: "Use standard section headings recognized by parsers",
    required: true,
    ats_safe: true,
    machine_readable: true,
    text_order: "heading before section content",
    contrast_safe: true,
    print_safe: true,
  },
  {
    id: "ats-system-fonts",
    category: "typography",
    rule: "Tier A system fonts for ATS tier templates",
    required: true,
    ats_safe: true,
    machine_readable: true,
    text_order: "font does not affect order",
    contrast_safe: true,
    print_safe: true,
  },
  {
    id: "ats-no-skill-bars",
    category: "component",
    rule: "Skill bars and progress meters are decorative only",
    required: true,
    ats_safe: false,
    machine_readable: false,
    text_order: "skill text must accompany bars",
    contrast_safe: true,
    print_safe: true,
  },
];

export function buildATSDesignRules() {
  return {
    version: DESIGN_SYSTEM_VERSION,
    domain_standards: [...ATS_STANDARDS],
    market_notes: MARKET_ATS_NOTES,
    external_principles: [...EXTERNAL_ATS_PRINCIPLES_2025_2026],
    component_rules: COMPONENT_RULES,
    required_flags: ["ats_safe", "machine_readable", "text_order", "contrast_safe", "print_safe"],
    generated_at: new Date().toISOString(),
  };
}
