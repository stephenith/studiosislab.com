/**
 * Agent #237 — Visual fingerprint + diversity comparison.
 * Compares geometry/silhouette — not content text.
 */
import { createHash } from "node:crypto";
import type { CanvasObject } from "../resume-critic/types.js";

export type VisualFingerprint = {
  version: "1.0.0";
  family_id: string;
  layout_architecture: string;
  header_system: string;
  section_title_system: string;
  alignment_system: string;
  header_geometry: {
    band: boolean;
    band_height: number;
    name_left: number;
    name_width: number;
    contact_left_cluster: number;
  };
  shape_counts: {
    rect: number;
    circle: number;
    line: number;
    accent_bar: number;
  };
  color_distribution: string[];
  typography_scale: number[];
  left_edge_clusters: number[];
  sidebar_present: boolean;
  page_silhouette: string;
  fingerprint_hash: string;
};

function round(n: number, step = 4): number {
  return Math.round(n / step) * step;
}

export function buildVisualFingerprint(input: {
  canvas: { width: number; height: number; objects: CanvasObject[] };
  family_id?: string;
  layout_architecture?: string;
  header_system?: string;
  section_title_system?: string;
  alignment_system?: string;
}): VisualFingerprint {
  const objects = input.canvas.objects ?? [];
  const texts = objects.filter((o) =>
    ["Textbox", "IText", "Text"].includes(String(o.type)),
  );
  const rects = objects.filter(
    (o) => o.type === "Rect" && !o.isPageBg && o.data?.role !== "pageBackground",
  );
  const circles = objects.filter((o) => o.type === "Circle");
  const lines = objects.filter(
    (o) => o.type === "Line" || o.data?.role === "accent-bar",
  );
  const accentBars = objects.filter(
    (o) => o.role === "accent-bar" || o.data?.role === "accent-bar",
  );
  const bands = rects.filter(
    (o) =>
      o.data?.role === "header-band" ||
      o.data?.role === "sidebar-bg" ||
      Number(o.width) >= input.canvas.width * 0.85,
  );
  const band = bands[0];
  const name = [...texts].sort(
    (a, b) => Number(b.fontSize ?? 0) - Number(a.fontSize ?? 0),
  )[0];
  const lefts = [
    ...new Set(texts.map((t) => round(Number(t.left ?? 0), 8))),
  ].sort((a, b) => a - b);
  const colors = [
    ...new Set(
      objects
        .map((o) => String(o.fill ?? "").toLowerCase())
        .filter((c) => c && c !== "#ffffff" && c !== "#fff"),
    ),
  ].slice(0, 8);
  const sizes = [
    ...new Set(texts.map((t) => Number(t.fontSize ?? 0)).filter((n) => n > 0)),
  ]
    .sort((a, b) => b - a)
    .slice(0, 6);

  const sidebar_present =
    lefts.length >= 2 && lefts[1]! - lefts[0]! >= 120;

  const silhouetteParts = [
    input.family_id ?? "unknown",
    input.layout_architecture ?? "unknown",
    band ? `band:${round(Number(band.height ?? 0), 8)}` : "noband",
    `lefts:${lefts.join("|")}`,
    `shapes:${rects.length}-${circles.length}-${accentBars.length}`,
    `colors:${colors.slice(0, 3).join("|")}`,
  ];

  const core = {
    family_id: input.family_id ?? "unknown",
    layout_architecture: input.layout_architecture ?? "unknown",
    header_system: input.header_system ?? "unknown",
    section_title_system: input.section_title_system ?? "unknown",
    alignment_system: input.alignment_system ?? "unknown",
    header_geometry: {
      band: Boolean(band),
      band_height: round(Number(band?.height ?? 0), 8),
      name_left: round(Number(name?.left ?? 0), 8),
      name_width: round(Number(name?.width ?? 0), 16),
      contact_left_cluster: lefts[lefts.length - 1] ?? 0,
    },
    shape_counts: {
      rect: rects.length,
      circle: circles.length,
      line: lines.length,
      accent_bar: accentBars.length,
    },
    color_distribution: colors,
    typography_scale: sizes,
    left_edge_clusters: lefts,
    sidebar_present,
    page_silhouette: silhouetteParts.join(";"),
  };

  const fingerprint_hash = createHash("sha256")
    .update(JSON.stringify(core))
    .digest("hex")
    .slice(0, 16);

  return { version: "1.0.0", ...core, fingerprint_hash };
}

/** Similarity 0–1 (1 = near-identical geometry). Content ignored. */
export function visualSimilarity(
  a: VisualFingerprint,
  b: VisualFingerprint,
): number {
  let score = 0;
  let weight = 0;
  const add = (cond: boolean, w: number) => {
    weight += w;
    if (cond) score += w;
  };
  add(a.family_id === b.family_id, 0.15);
  add(a.layout_architecture === b.layout_architecture, 0.15);
  add(a.header_system === b.header_system, 0.12);
  add(a.section_title_system === b.section_title_system, 0.12);
  add(a.alignment_system === b.alignment_system, 0.1);
  add(a.header_geometry.band === b.header_geometry.band, 0.08);
  add(
    Math.abs(a.header_geometry.band_height - b.header_geometry.band_height) <= 8,
    0.05,
  );
  add(
    a.left_edge_clusters.join(",") === b.left_edge_clusters.join(","),
    0.12,
  );
  add(
    a.shape_counts.rect === b.shape_counts.rect &&
      a.shape_counts.circle === b.shape_counts.circle,
    0.06,
  );
  const colorOverlap =
    a.color_distribution.filter((c) => b.color_distribution.includes(c))
      .length /
    Math.max(
      1,
      Math.max(a.color_distribution.length, b.color_distribution.length),
    );
  weight += 0.05;
  score += colorOverlap * 0.05;
  return weight > 0 ? score / weight : 0;
}

export const VISUAL_SIMILARITY_THRESHOLD = 0.82;

export function findNearestDuplicate(
  candidate: VisualFingerprint,
  others: VisualFingerprint[],
): { nearest: VisualFingerprint | null; similarity: number } {
  let nearest: VisualFingerprint | null = null;
  let similarity = 0;
  for (const o of others) {
    const s = visualSimilarity(candidate, o);
    if (s > similarity) {
      similarity = s;
      nearest = o;
    }
  }
  return { nearest, similarity };
}
