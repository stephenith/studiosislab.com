import t001 from "@/data/template-json/t001.json";
import t002 from "@/data/template-json/t002.json";
import t003 from "@/data/template-json/t003.json";

export type ThemeId = "classic" | "charcoal" | "soft" | "cream";
export type Template = {
  id: string;
  title: string;
  category: string;
  tags: string[];
  thumb: string;
};

export const TEMPLATES: Template[] = [
  {
    id: "t001",
    title: "Modern Minimal",
    category: "Fresher",
    tags: ["clean", "ATS"],
    thumb: "/templates/t001.png",
  },
  {
    id: "t002",
    title: "Creative Designer",
    category: "Designer",
    tags: ["creative", "portfolio"],
    thumb: "/templates/t002.png",
  },
  {
    id: "t003",
    title: "Professional Manager",
    category: "Manager",
    tags: ["corporate", "leadership"],
    thumb: "/templates/t003.png",
  },
];

export const CATEGORIES = [
  "All",
  "Fresher",
  "Designer",
  "Manager",
  "Developer",
  "Marketing",
] as const;

// ✅ Editor config (ONLY ONE MAP)
export type EditorTemplateConfig = {
  titleAlign: "left" | "center";
  titleFontSize: number;
  bodyFontSize: number;
  hasSidebar?: boolean; // only true for t002
  defaultThemeId?: ThemeId;
  allowedThemes?: ThemeId[];
};

export type TemplateSnapshot = {
  objects: any[];
};

export const TEMPLATE_EDITOR_CONFIG: Record<string, EditorTemplateConfig> = {
  blank: { titleAlign: "left", titleFontSize: 42, bodyFontSize: 20, hasSidebar: false, defaultThemeId: "classic", allowedThemes: ["classic"],},
  t001: { titleAlign: "center", titleFontSize: 48, bodyFontSize: 22, defaultThemeId: "classic", allowedThemes: ["classic"],},
  t002: { titleAlign: "left", titleFontSize: 42, bodyFontSize: 20, hasSidebar: true, defaultThemeId: "charcoal", allowedThemes: ["charcoal", "classic"],},
  t003: { titleAlign: "left", titleFontSize: 42, bodyFontSize: 20, hasSidebar: false, defaultThemeId: "soft", allowedThemes: ["soft", "classic"],},
};

export const TEMPLATE_SNAPSHOTS: Record<string, TemplateSnapshot> = {
  t001: t001 as TemplateSnapshot,
  t002: t002 as TemplateSnapshot,
  t003: t003 as TemplateSnapshot,
};
