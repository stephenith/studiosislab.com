/**
 * Icon system — decorative icons (visual tier).
 */
import type { ATSComponentFlags } from "./types.js";
import { DESIGN_SYSTEM_VERSION } from "./types.js";

export type IconSpec = {
  id: string;
  usage: string;
  max_size_px: number;
  tier: "ats" | "visual";
} & ATSComponentFlags;

const ICONS: IconSpec[] = [
  {
    id: "contact-email",
    usage: "Email indicator in contact block",
    max_size_px: 14,
    tier: "visual",
    ats_safe: false,
    machine_readable: false,
    text_order: "icon decorative; text carries meaning",
    contrast_safe: true,
    print_safe: true,
  },
  {
    id: "contact-phone",
    usage: "Phone indicator in contact block",
    max_size_px: 14,
    tier: "visual",
    ats_safe: false,
    machine_readable: false,
    text_order: "icon decorative; text carries meaning",
    contrast_safe: true,
    print_safe: true,
  },
  {
    id: "skill-badge",
    usage: "Skill chip accent",
    max_size_px: 0,
    tier: "visual",
    ats_safe: false,
    machine_readable: false,
    text_order: "skill text only for parsers",
    contrast_safe: true,
    print_safe: true,
  },
];

export function buildIconSystem() {
  return {
    version: DESIGN_SYSTEM_VERSION,
    icons: ICONS,
    rules: [
      "ATS tier: no icons — plain text contact lines",
      "Icons never replace text content",
      "Icons must not appear inside bullet text",
    ],
    generated_at: new Date().toISOString(),
  };
}
