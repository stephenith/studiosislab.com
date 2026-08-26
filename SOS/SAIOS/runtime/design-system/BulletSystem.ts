/**
 * Bullet system — list markers and timeline bullets.
 */
import type { ATSComponentFlags } from "./types.js";
import { DESIGN_SYSTEM_VERSION } from "./types.js";

export type BulletSpec = {
  id: string;
  character: string;
  indent_px: number;
  line_height_px: number;
  tier: "ats" | "visual";
} & ATSComponentFlags;

const BULLETS: BulletSpec[] = [
  {
    id: "disc",
    character: "•",
    indent_px: 16,
    line_height_px: 20,
    tier: "ats",
    ats_safe: true,
    machine_readable: true,
    text_order: "bullet → text",
    contrast_safe: true,
    print_safe: true,
  },
  {
    id: "circle",
    character: "○",
    indent_px: 16,
    line_height_px: 20,
    tier: "ats",
    ats_safe: true,
    machine_readable: true,
    text_order: "bullet → text",
    contrast_safe: true,
    print_safe: true,
  },
  {
    id: "hyphen",
    character: "–",
    indent_px: 12,
    line_height_px: 18,
    tier: "ats",
    ats_safe: true,
    machine_readable: true,
    text_order: "bullet → text",
    contrast_safe: true,
    print_safe: true,
  },
  {
    id: "timeline-dot",
    character: "●",
    indent_px: 20,
    line_height_px: 22,
    tier: "visual",
    ats_safe: true,
    machine_readable: true,
    text_order: "date → title → bullets",
    contrast_safe: true,
    print_safe: true,
  },
];

export function buildBulletSystem() {
  return {
    version: DESIGN_SYSTEM_VERSION,
    bullets: BULLETS,
    rules: [
      "ATS tier: disc, circle, or hyphen only",
      "No custom icon bullets in ATS tier",
      "Bullet indent must be multiple of 4px",
    ],
    generated_at: new Date().toISOString(),
  };
}
