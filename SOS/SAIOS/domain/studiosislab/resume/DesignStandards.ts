import type { DesignStandard } from "./types.js";

/**
 * StudiosisLab reusable resume design standards extracted from corpus analysis.
 */
export const DESIGN_STANDARDS: readonly DesignStandard[] = [
  {
    id: "canvas-standard",
    name: "Canvas Standard",
    description: "Canonical Fabric canvas dimensions for all new resume templates",
    requirements: [
      "Use A4 canvas: 794 × 1123 px (matches PAGE_SIZES.A4 in product)",
      "Include Fabric version metadata (6.9.1 or current product version)",
      "White background (#ffffff) on page root or background rect",
      "Single-page default; multi-page only when content requires",
    ],
  },
  {
    id: "visual-hierarchy",
    name: "Visual Hierarchy",
    description: "Consistent information hierarchy across StudiosisLab templates",
    requirements: [
      "Name is largest text element (18–28pt equivalent)",
      "Section headings visually distinct from body (bold, 12–16pt)",
      "Job titles bold; company names and dates secondary weight",
      "One accent color maximum per template (navy, charcoal, or brand teal)",
      "Decorative shapes must not obscure text or mimic section headers",
    ],
  },
  {
    id: "spacing-rhythm",
    name: "Spacing Rhythm",
    description: "Whitespace and vertical rhythm standards",
    requirements: [
      "Section gap: 24–48px between major sections",
      "Bullet spacing: 4–8px between items",
      "Line height: 1.1–1.25 for body textboxes",
      "Minimum 40px content margin from canvas edge (safe area)",
      "Avoid crowding below 10pt effective body size",
    ],
  },
  {
    id: "alignment",
    name: "Alignment",
    description: "Alignment conventions observed in high-performing corpus templates",
    requirements: [
      "Primary text left-aligned for ATS linear reading",
      "Contact block may be centered in header band only",
      "Dates right-aligned within experience rows when using two-column row layout",
      "Icons and images aligned to grid; never overlap body text",
    ],
  },
  {
    id: "brand-consistency",
    name: "Brand Consistency",
    description: "StudiosisLab marketplace visual identity",
    requirements: [
      "Thumbnail must reflect exported PDF first page faithfully",
      "Category-appropriate tone: conservative for finance/legal, modern for tech/creative",
      "Placeholder copy uses fictional names and employers only",
      "Consistent section order within category families",
    ],
  },
] as const;

export function getDesignStandardById(id: string): DesignStandard | undefined {
  return DESIGN_STANDARDS.find((s) => s.id === id);
}
