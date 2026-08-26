/**
 * Typography validation — fonts, hierarchy, sizes, line height, contrast
 */
import type { QAModuleReport, QATemplateContext } from "./types.js";

const ATS_SAFE_FONTS = new Set([
  "Arial",
  "Calibri",
  "Helvetica",
  "Times New Roman",
  "Georgia",
  "Verdana",
  "Tahoma",
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "DM Sans",
  "Work Sans",
  "Nunito",
  "Arimo",
]);

const RESTRICTED_FONTS = new Set([
  "Material Icons",
  "Playfair Display",
  "Fjalla One",
  "Prompt",
  "BIZ UDPGothic",
]);

const MAX_FONT_FAMILIES = 2;
const BODY_MIN_PT = 10.5;
const LINE_HEIGHT_MIN = 1.1;
const LINE_HEIGHT_MAX = 1.8;

function isTextbox(o: Record<string, unknown>): boolean {
  return String(o.type ?? "").toLowerCase() === "textbox";
}

function isHeading(text: string): boolean {
  return /^[A-Z][A-Z\s/&-]{3,}$/.test(text.trim());
}

function luminance(hex: string): number {
  const c = hex.replace("#", "");
  if (c.length !== 6) return 1;
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function runTypographyCheck(ctx: QATemplateContext): QAModuleReport {
  const textboxes = ctx.json.objects.filter(isTextbox);
  const checks = [];

  const badFonts = textboxes.filter(
    (o) =>
      !ATS_SAFE_FONTS.has(String(o.fontFamily)) ||
      RESTRICTED_FONTS.has(String(o.fontFamily)),
  );
  checks.push({
    id: "ats-safe-fonts",
    pass: badFonts.length === 0,
    detail:
      badFonts.length === 0
        ? "All fonts ATS-safe"
        : `Non-ATS fonts: ${[...new Set(badFonts.map((o) => o.fontFamily))].join(", ")}`,
    severity: "required" as const,
  });

  const families = new Set(textboxes.map((o) => String(o.fontFamily || "unknown")));
  checks.push({
    id: "max-font-families",
    pass: families.size <= MAX_FONT_FAMILIES,
    detail: `${families.size} families: ${[...families].join(", ")} (max ${MAX_FONT_FAMILIES})`,
    severity: "required" as const,
  });

  const headings = textboxes.filter((o) => isHeading(String(o.text)));
  const bodies = textboxes.filter((o) => !isHeading(String(o.text)));
  const headSizes = headings.map((o) => Number(o.fontSize ?? 0)).filter((s) => s > 0);
  const bodySizes = bodies.map((o) => Number(o.fontSize ?? 0)).filter((s) => s > 0);
  const maxSize = Math.max(...textboxes.map((o) => Number(o.fontSize ?? 0)));
  const hasNameHierarchy = textboxes.some(
    (o) => Number(o.fontSize) === maxSize && maxSize >= 20,
  );
  const sectionHeadCount = headings.length;
  const hierarchyOk = hasNameHierarchy && sectionHeadCount >= 3;
  checks.push({
    id: "heading-hierarchy",
    pass: hierarchyOk,
    detail: `Name scale ${maxSize}pt; ${sectionHeadCount} section headings`,
    severity: "required" as const,
  });

  const smallBody = bodies.filter((o) => Number(o.fontSize) < BODY_MIN_PT);
  checks.push({
    id: "body-font-size",
    pass: smallBody.length === 0,
    detail:
      smallBody.length === 0
        ? `All body text ≥ ${BODY_MIN_PT}pt`
        : `${smallBody.length} body boxes below ${BODY_MIN_PT}pt`,
    severity: "required" as const,
  });

  const badLineHeight = textboxes.filter((o) => {
    const lh = Number(o.lineHeight ?? 1.35);
    return lh < LINE_HEIGHT_MIN || lh > LINE_HEIGHT_MAX;
  });
  checks.push({
    id: "line-height",
    pass: badLineHeight.length === 0,
    detail:
      badLineHeight.length === 0
        ? "Line heights within 1.1–1.8"
        : `${badLineHeight.length} boxes outside line-height range`,
    severity: "recommended" as const,
  });

  const lowContrastBody: typeof textboxes = [];
  const lowContrastAccent: typeof textboxes = [];
  for (const o of textboxes) {
    const fg = String(o.fill ?? "#111827");
    if (!fg.startsWith("#")) continue;
    const ratio = contrastRatio(fg, "#ffffff");
    const text = String(o.text);
    if (isHeading(text)) {
      if (ratio < 2.4) lowContrastAccent.push(o);
    } else if (text.includes("@") || text.includes("|")) {
      if (ratio < 2.0) lowContrastAccent.push(o);
    } else if (Number(o.fontSize) >= 14) {
      if (ratio < 2.7) lowContrastAccent.push(o);
    } else if (Number(o.fontSize) >= 12 && Number(o.fontWeight ?? 400) < 600) {
      if (ratio < 2.7) lowContrastAccent.push(o);
    } else if (ratio < 4.5) {
      lowContrastBody.push(o);
    }
  }
  checks.push({
    id: "contrast",
    pass: lowContrastBody.length === 0 && lowContrastAccent.length === 0,
    detail:
      lowContrastBody.length || lowContrastAccent.length
        ? `${lowContrastBody.length} body + ${lowContrastAccent.length} accent/meta below contrast floor`
        : "Body, accent heading, and meta contrast OK",
    severity: "required" as const,
  });

  const pass = checks.filter((c) => c.severity === "required").every((c) => c.pass);
  return {
    module: "typography",
    pass,
    checked_at: new Date().toISOString(),
    checks,
  };
}
