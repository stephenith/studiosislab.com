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
    thumb: "",
  },
  {
    id: "t002",
    title: "Creative Designer",
    category: "Designer",
    tags: ["creative", "portfolio"],
    thumb: "",
  },
  {
    id: "t003",
    title: "Professional Manager",
    category: "Manager",
    tags: ["corporate", "leadership"],
    thumb: "",
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

export const TEMPLATE_EDITOR_CONFIG: Record<string, EditorTemplateConfig> = {
  t001: { titleAlign: "center", titleFontSize: 48, bodyFontSize: 22, defaultThemeId: "classic", allowedThemes: ["classic"],},
  t002: { titleAlign: "left", titleFontSize: 42, bodyFontSize: 20, hasSidebar: true, defaultThemeId: "charcoal", allowedThemes: ["charcoal", "classic"],},
  t003: { titleAlign: "left", titleFontSize: 42, bodyFontSize: 20, hasSidebar: false, defaultThemeId: "soft", allowedThemes: ["soft", "classic"],},
};