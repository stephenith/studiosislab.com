/**
 * ATS compliance validation
 */
import type { QAModuleReport, QATemplateContext } from "./types.js";

const FORBIDDEN_WIDGETS = ["path", "circle", "polygon", "ellipse", "triangle"];
const SECTION_ORDER = ["summary", "experience", "skill", "education", "certification"];
const REQUIRED_SECTIONS = ["summary", "experience", "education", "skill"];

function objType(o: Record<string, unknown>): string {
  return String(o.type ?? "").toLowerCase();
}

export function runAtsCheck(ctx: QATemplateContext): QAModuleReport {
  const objects = ctx.json.objects;
  const textboxes = objects.filter((o) => objType(o) === "textbox");
  const images = objects.filter((o) => objType(o) === "image");
  const groups = objects.filter((o) => objType(o) === "group");
  const checks = [];

  const nonEmptyTextboxes = textboxes.filter((o) => String(o.text ?? "").trim().length > 0);
  const emptySpacers = textboxes.length - nonEmptyTextboxes.length;
  checks.push({
    id: "readable-textbox-objects",
    pass: nonEmptyTextboxes.length > 0 && emptySpacers <= 1,
    detail: `${nonEmptyTextboxes.length} readable Textbox objects (${emptySpacers} layout spacer allowed)`,
    severity: "required" as const,
  });

  const rasterText = images.filter((o) => {
    const src = String((o as { src?: string }).src ?? "");
    return src.length > 0;
  });
  checks.push({
    id: "no-rasterized-text",
    pass: ctx.tier !== "ats_safe" || rasterText.length === 0,
    detail:
      rasterText.length === 0 ? "No text-as-image" : `${rasterText.length} image objects (ATS risk)`,
    severity: "required" as const,
  });

  const atsSafeIdentityRoles = new Set([
    "pageBackground",
    "accent-bar",
    "section-marker",
    "section-rule",
  ]);

  const decorative = objects.filter((o) => {
    const role = String((o.data as Record<string, unknown>)?.role ?? "");
    if (atsSafeIdentityRoles.has(role)) return false;
    const t = objType(o);
    if (t === "line") return true;
    if (t === "rect" && !o.isPageBg) {
      return (o.data as Record<string, unknown>)?.decorative === true;
    }
    return false;
  });
  const decoRatio = decorative.length / Math.max(1, textboxes.length);
  checks.push({
    id: "no-decorative-ats-blockers",
    pass: decoRatio < 0.2,
    detail: `Decoration ratio ${decoRatio.toFixed(3)} (max 0.20)`,
    severity: "required" as const,
  });

  const widgets = objects.filter((o) => FORBIDDEN_WIDGETS.includes(objType(o)));
  checks.push({
    id: "no-forbidden-widgets",
    pass: widgets.length === 0,
    detail: widgets.length ? `Forbidden: ${widgets.map((o) => o.type).join(", ")}` : "ok",
    severity: "required" as const,
  });

  const corpus = textboxes.map((o) => String(o.text).toLowerCase()).join(" ");
  const missing = REQUIRED_SECTIONS.filter((s) => !corpus.includes(s));
  checks.push({
    id: "required-ats-sections",
    pass: missing.length === 0,
    detail:
      missing.length === 0
        ? "summary, experience, education, skills present"
        : `Missing: ${missing.join(", ")}`,
    severity: "required" as const,
  });

  const sectionHeadings = textboxes
    .filter((o) =>
      /^(PROFESSIONAL SUMMARY|WORK EXPERIENCE|TECHNICAL SKILLS|SKILLS|EDUCATION|CERTIFICATIONS)$/.test(
        String(o.text),
      ),
    )
    .sort((a, b) => Number(a.top) - Number(b.top));
  const headingKeys = sectionHeadings.map((o) => {
    const t = String(o.text).toLowerCase();
    if (t.includes("summary")) return "summary";
    if (t.includes("experience")) return "experience";
    if (t.includes("skills")) return "skill";
    if (t.includes("education")) return "education";
    if (t.includes("certification")) return "certification";
    return "";
  });
  const orderOk =
    headingKeys.includes("summary") &&
    headingKeys.includes("experience") &&
    headingKeys.indexOf("summary") < headingKeys.indexOf("experience") &&
    (headingKeys.includes("skill")
      ? headingKeys.indexOf("experience") < headingKeys.indexOf("skill")
      : true) &&
    (headingKeys.includes("education")
      ? headingKeys.indexOf("skill") < headingKeys.indexOf("education")
      : true);
  checks.push({
    id: "proper-section-order",
    pass: orderOk && sectionHeadings.length >= 4,
    detail: `Order: ${headingKeys.join(" → ")}`,
    severity: "required" as const,
  });

  checks.push({
    id: "ats-no-groups",
    pass: ctx.tier !== "ats_safe" || groups.length === 0,
    detail: `Groups: ${groups.length}`,
    severity: "required" as const,
  });

  checks.push({
    id: "ats-no-images",
    pass: ctx.tier !== "ats_safe" || images.length === 0,
    detail: `Images: ${images.length}`,
    severity: "required" as const,
  });

  const pass = checks.every((c) => c.pass);
  return {
    module: "ats",
    pass,
    checked_at: new Date().toISOString(),
    checks,
  };
}
