#!/usr/bin/env node
/**
 * Refined template intelligence analyzer — assigns design families with role + structure signals.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "../../../../../..");
const MANIFEST = join(REPO_ROOT, "templates.manifest.json");
const TEMPLATE_DIR = join(REPO_ROOT, "src/data/template-json");
const OUT_DIR = join(__dirname, "../intelligence/generated");

const SECTION_KEYWORDS = [
  "contact", "summary", "profile", "objective", "experience", "education", "skills",
  "skill", "project", "certification", "award", "language", "reference",
];

function normalizeJson(raw) {
  if (Array.isArray(raw)) return raw[0] ?? { objects: [] };
  if (raw?.canvas) return raw.canvas;
  return raw ?? { objects: [] };
}

function walkObjects(node, out = []) {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const item of node) walkObjects(item, out);
    return out;
  }
  if (node.type) out.push(node);
  if (Array.isArray(node.objects)) for (const child of node.objects) walkObjects(child, out);
  return out;
}

function isPageBg(o) {
  const r = o.role || o.data?.role || "";
  if (["pageBackground", "page-bg", "pageBg"].includes(r)) return true;
  if (o.isPageBg) return true;
  if (String(o.name || "").toLowerCase().includes("page background")) return true;
  return false;
}

function getCanvasSize(json) {
  const objs = json.objects ?? [];
  const bg = objs.find((o) => isPageBg(o));
  return { w: bg?.width ?? json.width ?? 794, h: bg?.height ?? json.height ?? 1123 };
}

function inferRole(title, categoryId) {
  const t = `${title} ${categoryId}`.toLowerCase();
  if (/executive|ceo|cfo|chief|vp\b/.test(t)) return "executive";
  if (/nurse|medical|healthcare|therapist|caretaker|occupational|physical/.test(t)) return "healthcare";
  if (/engineer|developer|software|mechanical|cyber|data scientist|it support/.test(t)) return "engineering";
  if (/accountant|financial|bookkeeper|accounts payable/.test(t)) return "finance";
  if (/sales|account manager|business development/.test(t)) return "sales";
  if (/marketing|social media|digital marketing|content writer/.test(t)) return "marketing";
  if (/designer|graphic|ui\/ux|ux designer|creative/.test(t)) return "creative";
  if (/student|intern|entry.level|teacher/.test(t)) return "academic";
  if (/hotel|restaurant|flight|front desk|hospitality/.test(t)) return "hospitality";
  if (/operations|supply chain|warehouse|logistics/.test(t)) return "operations";
  if (/project manager|product manager/.test(t)) return "operations";
  if (/administrative|receptionist|office assistant|customer service|customer support|customer success/.test(t)) return "admin";
  if (/human resources|hr manager/.test(t)) return "hr";
  if (/legal|attorney|paralegal/.test(t)) return "legal";
  if (/government|federal|public sector/.test(t)) return "government";
  if (/data analyst|business analyst/.test(t)) return "analytics";
  return "general-business";
}

function assignFamily(metrics) {
  const { role_hint, ats_score, visual_score, column_structure, visual_weight, typography, title } = metrics;
  const { decoration_density, image_count, has_dark_sidebar } = visual_weight;
  const isExecutive = role_hint === "executive" || /executive/i.test(title);

  if (role_hint === "healthcare") return "healthcare-professional";
  if (role_hint === "engineering") return "engineering-technical";
  if (role_hint === "finance") return "finance-conservative";
  if (role_hint === "academic") return "academic-entry";
  if (role_hint === "hospitality") return "hospitality-service";
  if (role_hint === "hr") return "hr-people-ops";
  if (role_hint === "legal") return "legal-formal";
  if (role_hint === "government") return "government-formal";

  if (role_hint === "creative" && visual_score >= 70) return "designer-portfolio";
  if (role_hint === "sales" || role_hint === "marketing") {
    return visual_score >= 80 ? "sales-marketing-visual" : "sales-marketing-ats";
  }

  if (isExecutive && ats_score >= 80) return "executive-ats";
  if (role_hint === "admin" && ats_score >= 85) return "administrative-ats";
  if (role_hint === "operations" && ats_score >= 85) return "operations-management";

  if (
    ats_score >= 90 &&
    decoration_density < 0.12 &&
    column_structure === "single" &&
    image_count === 0
  ) {
    return "minimal-ats";
  }

  if (has_dark_sidebar && column_structure !== "single") return "corporate-sidebar";
  if (has_dark_sidebar) return "corporate-sidebar";

  if (visual_score >= 85 && image_count > 0 && ats_score < 75) return "creative-visual";
  if (visual_score >= 80 && decoration_density > 0.25) return "creative-visual";

  if (ats_score >= 85 && decoration_density < 0.2) return "executive-ats";
  if (role_hint === "analytics") return "analytics-professional";

  return "corporate-modern";
}

function buildWeaknesses(m) {
  const w = [];
  if (m.visual_weight.image_count > 0 && m.ats_score < 80)
    w.push("Contains images that may reduce ATS parse reliability");
  if (m.spacing.negative_position_count > 0)
    w.push(`${m.spacing.negative_position_count} objects use negative coordinates`);
  if (m.typography.font_family_count > 2)
    w.push(`Uses ${m.typography.font_family_count} font families — exceeds two-family guideline`);
  if (m.typography.size_min < 10)
    w.push(`Body text as small as ${m.typography.size_min}pt — below readability floor`);
  if (m.visual_weight.decoration_density > 0.35)
    w.push("High decoration density may distract from content hierarchy");
  if (m.widgets.skill_bars > 0 || m.widgets.star_ratings > 0)
    w.push("Progress bars or star ratings are not ATS-safe widgets");
  if (m.visual_weight.group_count > 8)
    w.push("Heavy grouping may affect export reading order");
  if (m.column_structure !== "single" && m.ats_score < 85)
    w.push("Multi-column layout increases ATS reading-order risk");
  return w;
}

function buildImprovements(m) {
  const o = [];
  if (m.ats_score < 85) o.push("Offer ATS-safe variant with single column and no images");
  if (m.whitespace_ratio < 0.55) o.push("Increase vertical breathing room between sections");
  if (m.section_order.length < 4) o.push("Strengthen explicit section heading hierarchy");
  if (m.typography.font_family_count > 2) o.push("Consolidate to two font families maximum");
  if (m.spacing.median_vertical_gap_px < 18) o.push("Increase section gap to at least 24px");
  if (m.visual_score < 70 && m.role_hint === "creative")
    o.push("Add stronger visual identity for creative portfolio use case");
  return o;
}

function analyzeTemplate(id, title, categoryId, json) {
  const norm = normalizeJson(json);
  const canvas = getCanvasSize(norm);
  const all = walkObjects(norm);
  const content = all.filter((o) => !isPageBg(o) && o.role !== "grid");

  const textboxes = content.filter((o) => String(o.type).toLowerCase() === "textbox");
  const images = content.filter((o) => String(o.type).toLowerCase() === "image");
  const rects = content.filter((o) => String(o.type).toLowerCase() === "rect");
  const lines = content.filter((o) => String(o.type).toLowerCase() === "line");
  const groups = content.filter((o) => String(o.type).toLowerCase() === "group");
  const circles = content.filter((o) => String(o.type).toLowerCase() === "circle");

  const fonts = new Set();
  const sizes = [];
  const fills = new Map();
  const lefts = [];
  let negCount = 0;
  let skillBars = 0;
  let starRatings = 0;
  let tables = 0;

  for (const tb of textboxes) {
    if (tb.fontFamily) fonts.add(tb.fontFamily);
    if (typeof tb.fontSize === "number") sizes.push(tb.fontSize);
    const fill = String(tb.fill || "").toLowerCase();
    if (fill) fills.set(fill, (fills.get(fill) || 0) + 1);
    const left = Number(tb.left ?? 0);
    lefts.push(left);
    if (left < 0 || Number(tb.top ?? 0) < 0) negCount++;
  }

  for (const o of content) {
    const role = String(o.data?.role || o.role || "").toLowerCase();
    if (role === "skill-bar") skillBars++;
    if (role === "star-rating") starRatings++;
    if (role === "table") tables++;
    if (o.fill && !isPageBg(o)) {
      const f = String(o.fill).toLowerCase();
      fills.set(f, (fills.get(f) || 0) + 1);
    }
  }

  const gutterCandidates = lefts.filter((l) => l >= 0 && l < canvas.w * 0.45).sort((a, b) => a - b);
  const leftGutter = gutterCandidates.length
    ? Math.round(gutterCandidates[Math.floor(gutterCandidates.length * 0.1)] / 5) * 5
    : 40;

  const colThreshold = canvas.w * 0.38;
  const leftCol = lefts.filter((l) => l < colThreshold).length;
  const rightCol = lefts.filter((l) => l >= colThreshold).length;
  let columnStructure = "single";
  if (leftCol > 5 && rightCol > 5) {
    columnStructure =
      rightCol > leftCol * 1.2 ? "sidebar-right" : leftCol > rightCol * 1.2 ? "sidebar-left" : "two-column-balanced";
  }

  const decorationCount = rects.length + lines.length + circles.length;
  const decorationDensity = decorationCount / Math.max(1, textboxes.length);

  const contentArea = canvas.w * canvas.h * 0.85;
  const textAreaEst = textboxes.reduce((s, t) => s + (t.width || 100) * (t.fontSize || 12) * 1.4, 0);
  const whitespaceRatio = Math.max(0, Math.min(1, 1 - textAreaEst / contentArea));

  const sortedByTop = [...textboxes].sort((a, b) => (a.top ?? 0) - (b.top ?? 0));
  const sectionOrder = [];
  for (const tb of sortedByTop) {
    const text = String(tb.text || "").toLowerCase();
    for (const kw of ["contact", "summary", "profile", "objective", "experience", "education", "skills", "project", "certification"]) {
      if (text.length < 40 && text.includes(kw) && !sectionOrder.includes(kw)) sectionOrder.push(kw);
    }
  }

  const avgSize = sizes.length ? sizes.reduce((a, b) => a + b, 0) / sizes.length : 14;
  const maxSize = sizes.length ? Math.max(...sizes) : 14;
  const minSize = sizes.length ? Math.min(...sizes) : 12;
  const topFills = [...fills.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c]) => c);

  const hasDarkSidebar = rects.some((r) => {
    const left = Number(r.left ?? 0);
    const w = Number(r.width ?? 0) * Number(r.scaleX ?? 1);
    const fill = String(r.fill || "").toLowerCase();
    return left < canvas.w * 0.35 && w > canvas.w * 0.28 && fill !== "#ffffff" && fill !== "#fff" && fill !== "";
  });

  let atsScore = 100;
  atsScore -= images.length * 8;
  atsScore -= groups.length * 2;
  atsScore -= negCount * 3;
  atsScore -= skillBars * 5;
  atsScore -= starRatings * 5;
  atsScore -= tables * 3;
  atsScore -= decorationDensity > 0.4 ? 10 : decorationDensity > 0.2 ? 5 : 0;
  atsScore -= fonts.size > 2 ? 8 : 0;
  atsScore -= minSize < 10 ? 10 : 0;
  atsScore -= columnStructure !== "single" ? 5 : 0;
  atsScore = Math.max(20, Math.min(100, Math.round(atsScore)));

  let visualScore = 50;
  visualScore += Math.min(20, decorationCount * 0.5);
  visualScore += images.length > 0 ? 15 : 0;
  visualScore += fonts.size >= 2 ? 10 : 5;
  visualScore += maxSize >= 28 ? 10 : 0;
  visualScore += hasDarkSidebar ? 10 : 0;
  visualScore += columnStructure !== "single" ? 8 : 0;
  visualScore = Math.max(20, Math.min(100, Math.round(visualScore)));

  const spacingGaps = [];
  for (let i = 1; i < sortedByTop.length; i++) {
    const gap = Number(sortedByTop[i].top ?? 0) - Number(sortedByTop[i - 1].top ?? 0);
    if (gap > 0 && gap < 200) spacingGaps.push(gap);
  }
  const medianGap = spacingGaps.length
    ? spacingGaps.sort((a, b) => a - b)[Math.floor(spacingGaps.length / 2)]
    : 24;

  const roleHint = inferRole(title, categoryId);

  const metrics = {
    id,
    title,
    categoryId: categoryId || "business",
    role_hint: roleHint,
    canvas,
    column_structure: columnStructure,
    section_order: sectionOrder,
    spacing: {
      median_vertical_gap_px: Math.round(medianGap),
      left_gutter_px: leftGutter,
      negative_position_count: negCount,
    },
    typography: {
      font_families: [...fonts],
      font_family_count: fonts.size,
      size_min: Math.round(minSize * 10) / 10,
      size_max: Math.round(maxSize * 10) / 10,
      size_avg: Math.round(avgSize * 10) / 10,
    },
    color_palette: topFills,
    visual_weight: {
      decoration_count: decorationCount,
      decoration_density: Math.round(decorationDensity * 100) / 100,
      image_count: images.length,
      group_count: groups.length,
      has_dark_sidebar: hasDarkSidebar,
    },
    widgets: { skill_bars: skillBars, star_ratings: starRatings, tables },
    whitespace_ratio: Math.round(whitespaceRatio * 100) / 100,
    alignment_grid_hint: leftGutter % 20 === 0 ? 20 : 10,
    ats_score: atsScore,
    visual_score: visualScore,
    object_counts: {
      textbox: textboxes.length,
      image: images.length,
      rect: rects.length,
      line: lines.length,
      group: groups.length,
    },
    reusable_patterns: [],
    title,
  };

  metrics.reusable_patterns = detectPatterns(metrics, lines);
  metrics.layout_family = assignFamily(metrics);
  metrics.weaknesses = buildWeaknesses(metrics);
  metrics.improvement_opportunities = buildImprovements(metrics);

  return {
    id,
    family: metrics.layout_family,
    ats_score: metrics.ats_score,
    visual_score: metrics.visual_score,
    spacing_profile: metrics.spacing,
    typography_profile: metrics.typography,
    color_profile: {
      dominant_colors: metrics.color_palette,
      has_dark_sidebar: metrics.visual_weight.has_dark_sidebar,
    },
    section_profile: {
      detected_order: metrics.section_order,
      column_structure: metrics.column_structure,
    },
    reusable_components: metrics.reusable_patterns,
    weaknesses: metrics.weaknesses,
    improvement_opportunities: metrics.improvement_opportunities,
    _metrics: metrics,
  };
}

function detectPatterns(m, lines) {
  const p = [];
  const cs = m.column_structure;
  if (cs === "sidebar-left" || cs === "sidebar-right" || cs === "two-column-balanced") p.push("two-column-layout");
  if (m.visual_weight.has_dark_sidebar) p.push("accent-sidebar-block");
  if (m.visual_weight.image_count > 0) p.push("profile-image-slot");
  if (lines.length >= 3) p.push("section-divider-lines");
  if (m.widgets.skill_bars > 0) p.push("skill-progress-bars");
  if (m.widgets.star_ratings > 0) p.push("star-rating-widget");
  if (m.visual_weight.decoration_density < 0.1) p.push("minimal-decoration");
  if (m.typography.size_max >= 36) p.push("large-name-header");
  if (m.spacing.left_gutter_px >= 48) p.push("wide-left-margin");
  return p;
}

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const published = manifest.templates.filter((t) => t.status === "published");
const dna = [];

for (const t of published) {
  const path = join(TEMPLATE_DIR, `${t.id}.json`);
  const json = JSON.parse(readFileSync(path, "utf8"));
  dna.push(analyzeTemplate(t.id, t.title, t.categoryId || t.category, json));
}

const families = {};
for (const entry of dna) {
  if (!families[entry.family]) families[entry.family] = [];
  families[entry.family].push(entry.id);
}

mkdirSync(OUT_DIR, { recursive: true });
const outPath = join(OUT_DIR, "template-dna.raw.json");
writeFileSync(outPath, JSON.stringify({ analyzed_at: "2026-07-06", count: dna.length, families, template_dna: dna }, null, 2));
console.log("Wrote", outPath);
console.log("Families:", Object.entries(families).map(([k, v]) => `${k}:${v.length}`).join(", "));
