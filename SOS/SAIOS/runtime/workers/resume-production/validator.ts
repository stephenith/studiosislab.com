/**
 * Validation against VALIDATION_CHECKLIST + editor contract rules
 */
import type { BuiltTemplate } from "./template-builder.js";

const ATS_SAFE_FONTS = new Set([
  "Arial", "Calibri", "Helvetica", "Times New Roman", "Georgia", "Verdana", "Tahoma",
  "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "DM Sans", "Work Sans", "Nunito", "Arimo",
]);

const RESTRICTED_FONTS = new Set(["Material Icons", "Playfair Display", "Fjalla One", "Prompt", "BIZ UDPGothic"]);

const BLOCKED_NAMES = ["Google", "Amazon", "Microsoft", "Apple", "Meta", "NHS"];

export type ValidationItem = {
  id: string;
  severity: string;
  pass: boolean;
  detail: string;
};

export type ValidationReport = {
  pass: boolean;
  validated_at: string;
  prototype_id: string;
  tier: string;
  auto_checks_passed: number;
  auto_checks_total: number;
  items: ValidationItem[];
};

export function validateTemplate(template: BuiltTemplate): ValidationReport {
  const { json, tier, prototype_id } = template;
  const objects = json.objects ?? [];
  const textboxes = objects.filter((o) => String(o.type).toLowerCase() === "textbox");
  const images = objects.filter((o) => String(o.type).toLowerCase() === "image");
  const items: ValidationItem[] = [];

  const bg = objects[0];
  const canvasOk =
    (json.width === 794 && json.height === 1123) ||
    (Number(bg?.width) === 794 && Number(bg?.height) === 1123);
  items.push({
    id: "canvas-dimensions",
    severity: "required",
    pass: canvasOk,
    detail: canvasOk ? "794×1123 A4" : "Dimension mismatch",
  });

  items.push({
    id: "fabric-version",
    severity: "required",
    pass: json.version === "6.9.1",
    detail: `version=${json.version}`,
  });

  items.push({
    id: "objects-array",
    severity: "required",
    pass: Array.isArray(objects) && objects.length > 1,
    detail: `${objects.length} objects`,
  });

  items.push({
    id: "background-white",
    severity: "required",
    pass: String(bg?.fill).toLowerCase() === "#ffffff",
    detail: `background fill ${bg?.fill}`,
  });

  const neg = textboxes.filter((o) => Number(o.left) < 0 || Number(o.top) < 0);
  items.push({
    id: "no-negative-content-coords",
    severity: "required",
    pass: neg.length === 0,
    detail: neg.length ? `${neg.length} negative` : "ok",
  });

  const minLeft = Math.min(...textboxes.map((o) => Number(o.left ?? 999)));
  items.push({
    id: "safe-margins",
    severity: "recommended",
    pass: minLeft >= 40,
    detail: `min left ${minLeft}px`,
  });

  const corpus = textboxes.map((o) => String(o.text).toLowerCase()).join(" ");
  const hasSections =
    corpus.includes("summary") &&
    corpus.includes("experience") &&
    corpus.includes("education") &&
    corpus.includes("skill");
  items.push({
    id: "required-sections",
    severity: "required",
    pass: hasSections,
    detail: hasSections ? "All core sections present" : "Missing section keywords",
  });

  const badFonts = textboxes.filter(
    (o) => !ATS_SAFE_FONTS.has(String(o.fontFamily)) || RESTRICTED_FONTS.has(String(o.fontFamily)),
  );
  items.push({
    id: "ats-font-tier",
    severity: "required",
    pass: badFonts.length === 0,
    detail: badFonts.length ? `Invalid fonts: ${badFonts.map((o) => o.fontFamily).join(",")}` : "Inter approved",
  });

  const tiny = textboxes.filter((o) => Number(o.fontSize) < 10);
  items.push({
    id: "font-size-floor",
    severity: "required",
    pass: tiny.length === 0,
    detail: tiny.length ? `${tiny.length} below 10pt` : "ok",
  });

  items.push({
    id: "no-icon-fonts",
    severity: "required",
    pass: !textboxes.some((o) => RESTRICTED_FONTS.has(String(o.fontFamily))),
    detail: "ok",
  });

  const charBad = textboxes.filter((o) => Number(o.charSpacing ?? 0) > 120);
  items.push({
    id: "char-spacing-limit",
    severity: "recommended",
    pass: charBad.length === 0,
    detail: charBad.length ? "charSpacing > 120" : "ok",
  });

  items.push({
    id: "ats-no-images",
    severity: "required",
    pass: tier === "ats_safe" ? images.length === 0 : true,
    detail: `images=${images.length}`,
  });

  const blobSrc = JSON.stringify(json).includes('"src":"blob:');
  items.push({
    id: "editor-no-blob-src",
    severity: "required",
    pass: !blobSrc,
    detail: blobSrc ? "blob src found" : "ok",
  });

  const blocked = BLOCKED_NAMES.filter((n) => corpus.includes(n.toLowerCase()));
  items.push({
    id: "placeholder-fictional",
    severity: "required",
    pass: blocked.length === 0,
    detail: blocked.length ? `Blocked: ${blocked.join(",")}` : "Fictional employers used",
  });

  const jsonSize = Buffer.byteLength(JSON.stringify(json), "utf8");
  items.push({
    id: "file-size",
    severity: "recommended",
    pass: jsonSize < 500_000,
    detail: `${jsonSize} bytes`,
  });

  const required = items.filter((i) => i.severity === "required");
  const pass = required.every((i) => i.pass);

  return {
    pass,
    validated_at: new Date().toISOString(),
    prototype_id,
    tier,
    auto_checks_passed: items.filter((i) => i.pass).length,
    auto_checks_total: items.length,
    items,
  };
}
