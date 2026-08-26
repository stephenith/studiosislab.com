/**
 * Trend scorer — score principles across quality dimensions.
 */
import type { PrincipleCategory, QualityMetrics } from "./types.js";

export function scorePrinciple(input: {
  category: PrincipleCategory;
  principle: string;
}): QualityMetrics {
  const base = categoryBase(input.category);
  const boost = keywordBoost(input.principle);

  const metrics: Omit<QualityMetrics, "composite_score"> = {
    popularity: clamp(base.popularity + boost.popularity),
    professionalism: clamp(base.professionalism + boost.professionalism),
    visual_appeal: clamp(base.visual_appeal + boost.visual),
    modernity: clamp(base.modernity + boost.modern),
    ats_compatibility: clamp(base.ats + boost.ats),
    accessibility: clamp(base.accessibility + boost.a11y),
    readability: clamp(base.readability + boost.readability),
    premium_perception: clamp(base.premium + boost.premium),
    originality: clamp(base.originality + boost.originality),
    industry_fit: clamp(base.industry + boost.industry),
    longevity: clamp(base.longevity + boost.longevity),
    confidence: clamp(base.confidence + boost.confidence),
  };

  const values = Object.values(metrics);
  const composite_score = Math.round(values.reduce((a, b) => a + b, 0) / values.length);

  return { ...metrics, composite_score };
}

function categoryBase(category: PrincipleCategory) {
  const bases: Record<PrincipleCategory, Record<string, number>> = {
    layout: { popularity: 88, professionalism: 90, visual_appeal: 85, modernity: 82, ats: 92, accessibility: 85, readability: 88, premium: 86, originality: 75, industry: 85, longevity: 88, confidence: 90 },
    typography: { popularity: 90, professionalism: 92, visual_appeal: 84, modernity: 86, ats: 94, accessibility: 90, readability: 95, premium: 88, originality: 70, industry: 88, longevity: 92, confidence: 91 },
    spacing: { popularity: 85, professionalism: 91, visual_appeal: 88, modernity: 87, ats: 88, accessibility: 88, readability: 92, premium: 90, originality: 72, industry: 86, longevity: 90, confidence: 89 },
    color: { popularity: 86, professionalism: 90, visual_appeal: 90, modernity: 85, ats: 82, accessibility: 92, readability: 86, premium: 88, originality: 78, industry: 84, longevity: 85, confidence: 88 },
    hierarchy: { popularity: 87, professionalism: 91, visual_appeal: 89, modernity: 84, ats: 90, accessibility: 87, readability: 93, premium: 87, originality: 74, industry: 87, longevity: 89, confidence: 90 },
    industry: { popularity: 82, professionalism: 93, visual_appeal: 83, modernity: 80, ats: 88, accessibility: 85, readability: 87, premium: 85, originality: 76, industry: 95, longevity: 87, confidence: 88 },
    ats: { popularity: 92, professionalism: 88, visual_appeal: 78, modernity: 80, ats: 98, accessibility: 90, readability: 94, premium: 80, originality: 70, industry: 90, longevity: 95, confidence: 93 },
    accessibility: { popularity: 80, professionalism: 90, visual_appeal: 82, modernity: 85, ats: 88, accessibility: 98, readability: 95, premium: 84, originality: 72, industry: 86, longevity: 93, confidence: 92 },
    trend: { popularity: 75, professionalism: 82, visual_appeal: 88, modernity: 95, ats: 78, accessibility: 82, readability: 84, premium: 86, originality: 88, industry: 80, longevity: 70, confidence: 80 },
  };
  const b = bases[category];
  return {
    popularity: b.popularity,
    professionalism: b.professionalism,
    visual_appeal: b.visual_appeal,
    modernity: b.modernity,
    ats: b.ats,
    accessibility: b.accessibility,
    readability: b.readability,
    premium: b.premium,
    originality: b.originality,
    industry: b.industry,
    longevity: b.longevity,
    confidence: b.confidence,
  };
}

function keywordBoost(text: string) {
  const lower = text.toLowerCase();
  return {
    popularity: lower.includes("dominate") ? 3 : 0,
    professionalism: lower.includes("corporate") || lower.includes("professional") ? 4 : 0,
    visual: lower.includes("premium") || lower.includes("hierarchy") ? 3 : 0,
    modern: lower.includes("modern") || lower.includes("trending") ? 5 : 0,
    ats: lower.includes("ats") || lower.includes("parse") ? 4 : 0,
    a11y: lower.includes("contrast") || lower.includes("access") ? 4 : 0,
    readability: lower.includes("readab") || lower.includes("scan") ? 3 : 0,
    premium: lower.includes("premium") || lower.includes("whitespace") ? 4 : 0,
    originality: lower.includes("innovation") ? 3 : 0,
    industry: lower.includes("finance") || lower.includes("healthcare") ? 3 : 0,
    longevity: lower.includes("standard") ? 3 : 0,
    confidence: 2,
  };
}

function clamp(n: number): number {
  return Math.min(100, Math.max(50, Math.round(n)));
}
