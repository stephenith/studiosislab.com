/**
 * Sidebar system — accent column widgets.
 */
import type { ATSComponentFlags } from "./types.js";
import { DESIGN_SYSTEM_VERSION } from "./types.js";

export type SidebarWidget = {
  id: string;
  name: string;
  width_ratio: number;
  position: "left" | "right";
  allowed_content: string[];
} & ATSComponentFlags;

const SIDEBAR_WIDGETS: SidebarWidget[] = [
  {
    id: "contact-sidebar",
    name: "Contact Sidebar",
    width_ratio: 0.3,
    position: "left",
    allowed_content: ["contact", "skills", "languages"],
    ats_safe: false,
    machine_readable: true,
    text_order: "contact → skills → languages",
    contrast_safe: true,
    print_safe: true,
  },
  {
    id: "skills-sidebar",
    name: "Skills Sidebar",
    width_ratio: 0.28,
    position: "right",
    allowed_content: ["skills", "certifications", "languages"],
    ats_safe: false,
    machine_readable: true,
    text_order: "skills → certifications",
    contrast_safe: true,
    print_safe: true,
  },
  {
    id: "profile-sidebar",
    name: "Profile Sidebar",
    width_ratio: 0.32,
    position: "left",
    allowed_content: ["summary", "contact", "skills"],
    ats_safe: false,
    machine_readable: true,
    text_order: "summary → contact → skills",
    contrast_safe: true,
    print_safe: true,
  },
];

export function buildSidebarSystem() {
  return {
    version: DESIGN_SYSTEM_VERSION,
    widgets: SIDEBAR_WIDGETS,
    rules: [
      "Sidebar layouts are visual-tier only",
      "Main column must contain experience and education",
      "Copy-paste order must be verified for ATS QA",
    ],
    generated_at: new Date().toISOString(),
  };
}
