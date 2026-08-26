/**
 * Pre-generation Design QA gate
 */
import type { BuiltTemplate } from "./template-builder.js";

export type DesignQACheck = {
  id: string;
  category: string;
  pass: boolean;
  detail: string;
};

export type DesignQAReport = {
  pass: boolean;
  checked_at: string;
  checks: DesignQACheck[];
};

const MARGIN_MIN = 40;

export function runDesignQA(plan: {
  template: BuiltTemplate;
  tier: "ats_safe" | "visual";
  family_id: string;
}): DesignQAReport {
  const { template, tier } = plan;
  const objects = template.json.objects;
  const textboxes = objects.filter((o) => String(o.type).toLowerCase() === "textbox");
  const images = objects.filter((o) => String(o.type).toLowerCase() === "image");
  const groups = objects.filter((o) => String(o.type).toLowerCase() === "group");

  const checks: DesignQACheck[] = [];

  const negCoords = textboxes.filter(
    (o) => Number(o.left) < 0 || Number(o.top) < 0,
  );
  checks.push({
    id: "no-negative-coords",
    category: "alignment",
    pass: negCoords.length === 0,
    detail: negCoords.length ? `${negCoords.length} textboxes with negative coords` : "All textboxes ≥ 0",
  });

  const minLeft = Math.min(...textboxes.map((o) => Number(o.left ?? 0)));
  checks.push({
    id: "left-gutter",
    category: "spacing",
    pass: minLeft >= MARGIN_MIN,
    detail: `Min left = ${minLeft}px (required ≥ ${MARGIN_MIN})`,
  });

  const gaps: number[] = [];
  const sorted = [...textboxes].sort((a, b) => Number(a.top) - Number(b.top));
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    const prevBottom =
      Number(prev.top ?? 0) + Number(prev.height ?? 0) * Number(prev.scaleY ?? 1);
    const gap = Number(curr.top ?? 0) - prevBottom;
    if (gap > -4 && gap < 120) gaps.push(gap);
  }
  const smallGaps = gaps.filter((g) => g < 4);
  checks.push({
    id: "section-breathing",
    category: "spacing",
    pass: smallGaps.length === 0,
    detail: smallGaps.length ? `${smallGaps.length} vertical gaps below 4px` : "All textbox vertical gaps ≥ 4px",
  });

  const fonts = new Set(textboxes.map((o) => String(o.fontFamily || "")));
  checks.push({
    id: "font-family-count",
    category: "typography",
    pass: fonts.size <= 2,
    detail: `Font families: ${[...fonts].join(", ")} (${fonts.size})`,
  });

  const smallBody = textboxes.filter(
    (o) => Number(o.fontSize) < 10.5 && !String(o.text).match(/^[A-Z\s]+$/),
  );
  checks.push({
    id: "body-size-floor",
    category: "typography",
    pass: smallBody.length === 0,
    detail: smallBody.length ? `${smallBody.length} boxes below 10.5pt` : "All body text ≥ 10.5pt",
  });

  const nameBox = textboxes.reduce<{ box: (typeof textboxes)[0] | null; size: number }>(
    (best, o) => {
      const size = Number(o.fontSize ?? 0);
      return size > best.size ? { box: o, size } : best;
    },
    { box: null, size: 0 },
  ).box;
  const sectionHeads = textboxes.filter((o) =>
    /^(PROFESSIONAL SUMMARY|WORK EXPERIENCE|TECHNICAL SKILLS|SKILLS|EDUCATION|CERTIFICATIONS)$/.test(
      String(o.text),
    ),
  );
  checks.push({
    id: "hierarchy",
    category: "hierarchy",
    pass: Boolean(nameBox) && Number(nameBox?.fontSize) >= 22 && sectionHeads.length >= 5,
    detail: `Name present (${nameBox ? `${nameBox.fontSize}pt` : "missing"}); section headings: ${sectionHeads.length}/5`,
  });

  const decoration = objects.filter((o) =>
    ["rect", "line"].includes(String(o.type).toLowerCase()),
  ).filter(
    (o) =>
      !o.isPageBg &&
      o.data?.role !== "pageBackground" &&
      o.data?.role !== "accent-bar" &&
      o.data?.role !== "section-marker" &&
      o.data?.role !== "section-rule",
  );
  const density = decoration.length / Math.max(1, textboxes.length);
  checks.push({
    id: "decoration-balance",
    category: "balance",
    pass: density < 0.15,
    detail: `Decoration density ${density.toFixed(3)} (target < 0.15)`,
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
    if (t.includes("skills")) return "skills";
    if (t.includes("education")) return "education";
    if (t.includes("certification")) return "certification";
    return "";
  });
  const orderOk =
    headingKeys.includes("summary") &&
    headingKeys.includes("experience") &&
    headingKeys.indexOf("summary") < headingKeys.indexOf("experience") &&
    (headingKeys.includes("skills")
      ? headingKeys.indexOf("experience") < headingKeys.indexOf("skills")
      : true) &&
    (headingKeys.includes("education")
      ? headingKeys.indexOf("skills") < headingKeys.indexOf("education")
      : true) &&
    (headingKeys.includes("certification")
      ? headingKeys.indexOf("education") < headingKeys.indexOf("certification")
      : true);
  checks.push({
    id: "section-order",
    category: "sections",
    pass: orderOk && sectionHeadings.length >= 4,
    detail: `Heading order: ${headingKeys.join(" → ")}`,
  });

  checks.push({
    id: "ats-no-images",
    category: "ats",
    pass: tier === "ats_safe" ? images.length === 0 : true,
    detail: `Images: ${images.length}`,
  });

  checks.push({
    id: "ats-no-groups",
    category: "ats",
    pass: tier === "ats_safe" ? groups.length === 0 : true,
    detail: `Groups: ${groups.length}`,
  });

  const bg = objects[0];
  checks.push({
    id: "editor-page-background",
    category: "editor",
    pass:
      String(bg?.type).toLowerCase() === "rect" &&
      (bg?.role === "pageBackground" || bg?.isPageBg === true) &&
      Number(bg?.width) === 794 &&
      Number(bg?.height) === 1123,
    detail: "Page background rect at index 0, 794×1123, role pageBackground",
  });

  checks.push({
    id: "editor-version",
    category: "editor",
    pass: template.json.version === "6.9.1",
    detail: `Fabric version ${template.json.version}`,
  });

  const pass = checks.every((c) => c.pass);

  return {
    pass,
    checked_at: new Date().toISOString(),
    checks,
  };
}
