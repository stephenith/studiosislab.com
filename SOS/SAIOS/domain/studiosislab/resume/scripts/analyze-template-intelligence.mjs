#!/usr/bin/env node
/**
 * One-shot corpus analyzer for Resume Intelligence Engine (#054).
 * Reads templates.manifest.json + src/data/template-json/*.json (read-only).
 * Outputs JSON to stdout — used to author TemplateDNA.ts knowledge.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "../../../../../..");
const MANIFEST = join(REPO_ROOT, "templates.manifest.json");
const TEMPLATE_DIR = join(REPO_ROOT, "src/data/template-json");

const SECTION_KEYWORDS = [
  "contact", "summary", "profile", "objective", "experience", "work history",
  "education", "skills", "skill", "project", "certification", "award",
  "language", "reference", "volunteer", "publication",
];

const ROLE_CATEGORY_MAP = {
  executive: /executive|director|ceo|cfo|vp\b|chief/i,
  engineering: /engineer|developer|software|mechanical|cyber|it support|data scientist/i,
  healthcare: /nurse|medical|healthcare|therapist|caretaker|occupational/i,
  finance: /accountant|financial|bookkeeper|accounts payable/i,
  sales: /sales|account manager|business development/i,
  marketing: /marketing|social media|digital marketing|content writer/i,
  creative: /designer|graphic|ui\/ux|ux designer|creative/i,
  academic: /student|intern|entry.level|teacher/i,
  hospitality: /hotel|restaurant|flight|front desk/i,
  operations: /operations|supply chain|warehouse|logistics|project manager|product manager/i,
  admin: /administrative|receptionist|office assistant|customer service|customer support|customer success/i,
  legal: /legal|paralegal|attorney/i,
  government: /government|federal|public sector/i,
  hr: /human resources|hr manager/i,
};

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
  if (Array.isArray(node.objects)) {
    for (const child of node.objects) walkObjects(child, out);
  }
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
  const w = json.width ?? 794;
  const h = json.height ?? 1123;
  const objs = json.objects ?? [];
  const bg = objs.find((o) => isPageBg(o));
  if (bg) {
    return {
      w: bg.width ?? w,
      h: bg.height ?? h,
    };
  }
  return { w, h };
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
  const tops = [];
  let negCount = 0;
  let skillBars = 0;
  let starRatings = 0;
  let tables = 0;

  const sectionHits = {};
  for (const kw of SECTION_KEYWORDS) sectionHits[kw] = 0;

  for (const tb of textboxes) {
    if (tb.fontFamily) fonts.add(tb.fontFamily);
    if (typeof tb.fontSize === "number") sizes.push(tb.fontSize);
    const fill = String(tb.fill || "").toLowerCase();
    if (fill) fills.set(fill, (fills.get(fill) || 0) + 1);
    const left = Number(tb.left ?? 0);
    const top = Number(tb.top ?? 0);
    lefts.push(left);
    tops.push(top);
    if (left < 0 || top < 0) negCount++;
    const text = String(tb.text || "").toLowerCase();
    for (const kw of SECTION_KEYWORDS) {
      if (text.includes(kw.replace(" ", "")) || text.includes(kw)) {
        sectionHits[kw] = (sectionHits[kw] || 0) + 1;
      }
    }
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
  if (leftCol > 5 && rightCol > 5 && rightCol / (leftCol + rightCol) > 0.25) {
    columnStructure = rightCol > leftCol * 1.2 ? "sidebar-right" : leftCol > rightCol * 1.2 ? "sidebar-left" : "two-column-balanced";
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
      if (text.length < 40 && text.includes(kw) && !sectionOrder.includes(kw)) {
        sectionOrder.push(kw);
      }
    }
  }

  const avgSize = sizes.length ? sizes.reduce((a, b) => a + b, 0) / sizes.length : 14;
  const maxSize = sizes.length ? Math.max(...sizes) : 14;
  const minSize = sizes.length ? Math.min(...sizes) : 12;

  const topFills = [...fills.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c);
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
  atsScore -= fonts.size > 2 ? 8 : fonts.size > 3 ? 15 : 0;
  atsScore -= minSize < 10 ? 10 : 0;
  atsScore -= hasDarkSidebar ? 5 : 0;
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
    const prev = sortedByTop[i - 1];
    const curr = sortedByTop[i];
    const gap = Number(curr.top ?? 0) - Number(prev.top ?? 0);
    if (gap > 0 && gap < 200) spacingGaps.push(gap);
  }
  const medianGap = spacingGaps.length
    ? spacingGaps.sort((a, b) => a - b)[Math.floor(spacingGaps.length / 2)]
    : 24;

  let roleHint = categoryId || "business";
  for (const [role, re] of Object.entries(ROLE_CATEGORY_MAP)) {
    if (re.test(title)) {
      roleHint = role;
      break;
    }
  }

  let layoutFamily = "corporate-modern";
  if (atsScore >= 85 && columnStructure === "single" && decorationDensity < 0.15) layoutFamily = "minimal-ats";
  else if (atsScore >= 80 && decorationDensity < 0.2) layoutFamily = "executive-ats";
  else if (visualScore >= 75 && images.length > 0) layoutFamily = "creative-visual";
  else if (hasDarkSidebar) layoutFamily = "sidebar-accent";
  else if (roleHint === "healthcare") layoutFamily = "healthcare-professional";
  else if (roleHint === "engineering") layoutFamily = "engineering-technical";
  else if (roleHint === "academic") layoutFamily = "academic-entry";
  else if (roleHint === "finance") layoutFamily = "finance-conservative";
  else if (roleHint === "sales" || roleHint === "marketing") layoutFamily = "sales-marketing";
  else if (roleHint === "creative") layoutFamily = "designer-portfolio";
  else if (roleHint === "hospitality") layoutFamily = "hospitality-service";
  else if (roleHint === "admin") layoutFamily = "administrative-ats";
  else if (roleHint === "operations") layoutFamily = "operations-management";
  else if (roleHint === "hr") layoutFamily = "hr-people";
  else if (decorationDensity < 0.12 && columnStructure === "single") layoutFamily = "minimal-ats";

  return {
    id,
    title,
    categoryId: categoryId || "business",
    role_hint: roleHint,
    layout_family: layoutFamily,
    canvas: canvas,
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
    alignment_grid_hint: leftGutter % 20 === 0 ? 20 : leftGutter % 10 === 0 ? 10 : 8,
    ats_score: atsScore,
    visual_score: visualScore,
    object_counts: {
      textbox: textboxes.length,
      image: images.length,
      rect: rects.length,
      line: lines.length,
      group: groups.length,
    },
    reusable_patterns: detectPatterns({
      columnStructure,
      hasDarkSidebar,
      images,
      lines,
      skillBars,
      starRatings,
      decorationDensity,
    }),
  };
}

function detectPatterns(ctx) {
  const p = [];
  if (ctx.columnStructure === "sidebar-left" || ctx.columnStructure === "sidebar-right") p.push("two-column-layout");
  if (ctx.hasDarkSidebar) p.push("accent-sidebar");
  if (ctx.images.length > 0) p.push("headshot-or-hero-image");
  if (ctx.lines.length >= 3) p.push("horizontal-dividers");
  if (ctx.skillBars > 0) p.push("skill-progress-bars");
  if (ctx.starRatings > 0) p.push("star-ratings");
  if (ctx.decorationDensity < 0.1) p.push("minimal-decoration");
  if (ctx.decorationDensity > 0.35) p.push("heavy-decoration");
  return p;
}

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const published = manifest.templates.filter((t) => t.status === "published");
const results = [];

for (const t of published) {
  const path = join(TEMPLATE_DIR, `${t.id}.json`);
  let json;
  try {
    json = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    results.push({ id: t.id, error: "missing json" });
    continue;
  }
  results.push(analyzeTemplate(t.id, t.title, t.categoryId || t.category, json));
}

const families = {};
for (const r of results) {
  if (r.error) continue;
  const f = r.layout_family;
  if (!families[f]) families[f] = [];
  families[f].push(r.id);
}

console.log(JSON.stringify({ analyzed: results.length, families, templates: results }, null, 2));
