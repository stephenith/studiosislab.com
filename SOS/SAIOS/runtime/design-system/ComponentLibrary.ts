/**
 * Component library — compositional building blocks.
 */
import type { ATSComponentFlags, ComponentId } from "./types.js";
import { DESIGN_SYSTEM_VERSION } from "./types.js";

export type DesignComponent = {
  id: ComponentId;
  name: string;
  category: "header" | "content" | "layout" | "list" | "card";
  variants: string[];
} & ATSComponentFlags;

const BASE_CONTENT: ATSComponentFlags = {
  ats_safe: true,
  machine_readable: true,
  text_order: "linear",
  contrast_safe: true,
  print_safe: true,
};

const COMPONENTS: DesignComponent[] = [
  {
    id: "header",
    name: "Header",
    category: "header",
    variants: ["executive", "corporate", "minimal", "technical", "creative"],
    text_order: "name → title → contact",
    ...BASE_CONTENT,
  },
  {
    id: "contact-block",
    name: "Contact Block",
    category: "content",
    variants: ["inline", "stacked", "split-row"],
    text_order: "email → phone → location → linkedin",
    ...BASE_CONTENT,
  },
  {
    id: "timeline",
    name: "Timeline",
    category: "content",
    variants: ["standard", "compact"],
    text_order: "date → title → company → bullets",
    ...BASE_CONTENT,
  },
  {
    id: "skill-chips",
    name: "Skill Chips",
    category: "list",
    variants: ["rounded", "flat"],
    ats_safe: false,
    machine_readable: true,
    text_order: "chip text linear when exported",
    contrast_safe: true,
    print_safe: true,
  },
  {
    id: "skill-lists",
    name: "Skill Lists",
    category: "list",
    variants: ["comma", "bullet", "grouped"],
    text_order: "category → skills",
    ...BASE_CONTENT,
  },
  {
    id: "section-header",
    name: "Section Header",
    category: "layout",
    variants: ["rule", "plain", "uppercase"],
    text_order: "heading above section body",
    ...BASE_CONTENT,
  },
  {
    id: "horizontal-divider",
    name: "Horizontal Divider",
    category: "layout",
    variants: ["thin", "thick", "spacing-only"],
    ats_safe: true,
    machine_readable: false,
    text_order: "decorative separator",
    contrast_safe: true,
    print_safe: true,
  },
  {
    id: "vertical-divider",
    name: "Vertical Divider",
    category: "layout",
    variants: ["sidebar"],
    ats_safe: false,
    machine_readable: false,
    text_order: "decorative separator",
    contrast_safe: true,
    print_safe: true,
  },
  {
    id: "timeline-bullet",
    name: "Timeline Bullet",
    category: "list",
    variants: ["dot", "line"],
    text_order: "bullet → entry text",
    ...BASE_CONTENT,
  },
  {
    id: "achievement-card",
    name: "Achievement Card",
    category: "card",
    variants: ["inline", "boxed"],
    ats_safe: false,
    machine_readable: true,
    text_order: "title → description",
    contrast_safe: true,
    print_safe: true,
  },
  {
    id: "sidebar-widget",
    name: "Sidebar Widget",
    category: "layout",
    variants: ["contact", "skills", "profile"],
    ats_safe: false,
    machine_readable: true,
    text_order: "sidebar content after main column in export QA",
    contrast_safe: true,
    print_safe: true,
  },
  {
    id: "language-block",
    name: "Language Block",
    category: "content",
    variants: ["list", "inline"],
    text_order: "language → proficiency",
    ...BASE_CONTENT,
  },
  {
    id: "certification-block",
    name: "Certification Block",
    category: "content",
    variants: ["list", "timeline"],
    text_order: "cert name → issuer → year",
    ...BASE_CONTENT,
  },
  {
    id: "project-card",
    name: "Project Card",
    category: "card",
    variants: ["standard", "compact"],
    text_order: "name → tech → outcome",
    ...BASE_CONTENT,
  },
  {
    id: "education-layout",
    name: "Education Layout",
    category: "content",
    variants: ["standard", "student"],
    text_order: "degree → institution → year",
    ...BASE_CONTENT,
  },
  {
    id: "experience-layout",
    name: "Experience Layout",
    category: "content",
    variants: ["standard", "timeline", "compact"],
    text_order: "title → company → dates → bullets",
    ...BASE_CONTENT,
  },
];

export function buildComponentLibrary() {
  return {
    version: DESIGN_SYSTEM_VERSION,
    components: COMPONENTS,
    required_ats_flags: ["ats_safe", "machine_readable", "text_order", "contrast_safe", "print_safe"],
    generated_at: new Date().toISOString(),
  };
}

export function getComponent(id: ComponentId): DesignComponent | undefined {
  return COMPONENTS.find((c) => c.id === id);
}
