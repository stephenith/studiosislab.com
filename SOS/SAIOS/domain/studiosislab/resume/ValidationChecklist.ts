import type { ValidationCheckItem } from "./types.js";

/**
 * Automated and manual validation checklist for generated resume templates.
 */
export const VALIDATION_CHECKLIST: readonly ValidationCheckItem[] = [
  {
    id: "canvas-dimensions",
    category: "structure",
    rule: "Canvas is 794×1123 A4",
    severity: "required",
    auto_checkable: true,
    check_hint: "json.width === 794 && json.height === 1123 OR first rect matches",
  },
  {
    id: "fabric-version",
    category: "structure",
    rule: "Fabric version field present",
    severity: "required",
    auto_checkable: true,
    check_hint: 'json.version matches product Fabric version (e.g. "6.9.1")',
  },
  {
    id: "objects-array",
    category: "structure",
    rule: "objects[] is non-empty array",
    severity: "required",
    auto_checkable: true,
    check_hint: "Array.isArray(json.objects) && json.objects.length > 0",
  },
  {
    id: "background-white",
    category: "design",
    rule: "White or near-white page background",
    severity: "required",
    auto_checkable: true,
    check_hint: "background #fff or first rect fill #ffffff",
  },
  {
    id: "no-negative-content-coords",
    category: "layout",
    rule: "No Textbox with left < 0 or top < 0",
    severity: "required",
    auto_checkable: true,
    check_hint: "Iterate textboxes; fail on negative left/top",
  },
  {
    id: "safe-margins",
    category: "layout",
    rule: "Primary content within 40px margins",
    severity: "recommended",
    auto_checkable: true,
    check_hint: "Min left/top of textboxes >= 40 except full-bleed locked rects",
  },
  {
    id: "required-sections",
    category: "content",
    rule: "Contact, Summary, Experience, Education, Skills present",
    severity: "required",
    auto_checkable: true,
    check_hint: "Text search for section heading keywords",
  },
  {
    id: "ats-font-tier",
    category: "typography",
    rule: "Fonts from ATS-safe or visual-approved tiers",
    severity: "required",
    auto_checkable: true,
    check_hint: "fontFamily in FONT_TIERS.ats_safe or visual_approved",
  },
  {
    id: "font-size-floor",
    category: "typography",
    rule: "No body text below 10pt",
    severity: "required",
    auto_checkable: true,
    check_hint: "Textbox fontSize >= 10 for non-heading text",
  },
  {
    id: "no-icon-fonts",
    category: "typography",
    rule: "No Material Icons or icon fonts in text",
    severity: "required",
    auto_checkable: true,
    check_hint: 'fontFamily not in FONT_TIERS.restrict',
  },
  {
    id: "char-spacing-limit",
    category: "typography",
    rule: "charSpacing ≤ 120 on any Textbox",
    severity: "recommended",
    auto_checkable: true,
    check_hint: "charSpacing undefined or <= 120",
  },
  {
    id: "ats-no-images",
    category: "ats",
    rule: "ATS tier has zero Image objects",
    severity: "required",
    auto_checkable: true,
    check_hint: "No type Image when tier === ats_safe",
  },
  {
    id: "plain-text-order",
    category: "ats",
    rule: "Copy-paste plain text preserves logical section order",
    severity: "required",
    auto_checkable: false,
    check_hint: "Manual: export text, verify Experience before Education etc.",
  },
  {
    id: "thumbnail-match",
    category: "export",
    rule: "Thumbnail matches first-page export",
    severity: "required",
    auto_checkable: false,
    check_hint: "Visual diff thumbnail vs exportPageDataUrl output",
  },
  {
    id: "pdf-text-selectable",
    category: "export",
    rule: "Exported PDF is text-selectable (ATS tier)",
    severity: "required",
    auto_checkable: false,
    check_hint: "Open PDF, select text across sections",
  },
  {
    id: "placeholder-fictional",
    category: "content",
    rule: "No real person names or companies in placeholders",
    severity: "required",
    auto_checkable: true,
    check_hint: "Match against blocklist; use SampleProfileStandards names",
  },
  {
    id: "accessibility-contrast",
    category: "accessibility",
    rule: "Text/background contrast ≥ 4.5:1",
    severity: "recommended",
    auto_checkable: true,
    check_hint: "Compute contrast for text fill vs nearest background",
  },
  {
    id: "file-size",
    category: "export",
    rule: "JSON file < 500KB; PDF < 500KB single page",
    severity: "recommended",
    auto_checkable: true,
    check_hint: "fs.stat size check",
  },
] as const;

export function getRequiredChecks(): ValidationCheckItem[] {
  return VALIDATION_CHECKLIST.filter((c) => c.severity === "required");
}

export function getAutoCheckableChecks(): ValidationCheckItem[] {
  return VALIDATION_CHECKLIST.filter((c) => c.auto_checkable);
}
