/**
 * Agent #239 — Hardened ThumbnailDistinctnessCritic (calibrated bands).
 */
import { applyFindings } from "../resume-critic/CriticScore.js";
import {
  contentObjects,
  isPageBg,
  textObjects,
} from "../resume-critic/canvasHelpers.js";
import { measurePageBalance } from "../resume-renderer/pageBalance.js";
import type {
  CategoryReport,
  CriticFinding,
  CriticInput,
} from "../resume-critic/types.js";
import {
  buildVisualFingerprint,
  findNearestDuplicate,
  type VisualFingerprint,
  VISUAL_SIMILARITY_THRESHOLD,
} from "./visualFingerprint.js";

export type ThumbnailAppealResult = CategoryReport & {
  fingerprint: VisualFingerprint;
  nearest_similarity: number;
};

export function evaluateThumbnailAppeal(
  input: CriticInput & {
    batch_fingerprints?: VisualFingerprint[];
    family_id?: string;
    layout_architecture?: string;
    header_system?: string;
    section_title_system?: string;
    alignment_system?: string;
  },
): ThumbnailAppealResult {
  const findings: CriticFinding[] = [];
  const canvas = input.canvas;
  const content = contentObjects(canvas);
  const texts = textObjects(canvas);
  const vg = (input.resume_json as { visual_guidance?: Record<string, unknown> })
    ?.visual_guidance;

  const fingerprint = buildVisualFingerprint({
    canvas,
    family_id: String(input.family_id ?? vg?.design_family ?? "unknown"),
    layout_architecture: String(
      input.layout_architecture ?? vg?.layout_architecture ?? "unknown",
    ),
    header_system: String(input.header_system ?? vg?.header_system ?? "unknown"),
    section_title_system: String(
      input.section_title_system ?? vg?.section_title_system ?? "unknown",
    ),
    alignment_system: String(
      input.alignment_system ?? vg?.alignment_system ?? "unknown",
    ),
  });

  // Start below 100 — existence of a thumbnail is not excellence
  findings.push({
    code: "THUMB_BASELINE",
    severity: "info",
    message: "Calibrated thumbnail baseline (not auto-100)",
    points_deducted: 2,
  });

  const shapes = content.filter(
    (o) =>
      o.type === "Rect" &&
      !isPageBg(o) &&
      [
        "header-band",
        "sidebar-bg",
        "section-marker",
        "accent-rail",
        "filled-label",
        "pale-strip",
      ].includes(String(o.data?.role ?? "")),
  );

  const hasBand = shapes.some(
    (s) => s.data?.role === "header-band" || s.role === "header-band",
  );
  const hasSidebar = shapes.some(
    (s) => s.data?.role === "sidebar-bg" || s.role === "sidebar-bg",
  );
  const hasRail = shapes.some(
    (s) => s.data?.role === "accent-rail" || s.role === "accent-rail",
  );
  if (
    !hasBand &&
    !hasSidebar &&
    !hasRail &&
    shapes.length < 2 &&
    fingerprint.left_edge_clusters.length < 2
  ) {
    findings.push({
      code: "THUMB_SILHOUETTE_WEAK",
      severity: "warn",
      message: "Weak family silhouette at thumbnail scale",
      points_deducted: 14,
    });
  }

  const colorBlocks = shapes.length;
  if (!hasBand && !hasSidebar && !hasRail && colorBlocks < 2) {
    findings.push({
      code: "THUMB_COLOR_BLOCK",
      severity: "warn",
      message: "Insufficient color-block visibility at small size",
      points_deducted: 8,
    });
  }

  const name = [...texts].sort(
    (a, b) => Number(b.fontSize ?? 0) - Number(a.fontSize ?? 0),
  )[0];
  if (!hasBand && Number(name?.fontSize ?? 0) < 34) {
    findings.push({
      code: "THUMB_HEADER_ANCHOR",
      severity: "warn",
      message: "Weak header anchor at thumbnail scale",
      points_deducted: 12,
    });
  }

  const sizes = [
    ...new Set(texts.map((t) => Number(t.fontSize ?? 0)).filter((n) => n > 0)),
  ];
  if (sizes.length < 3) {
    findings.push({
      code: "THUMB_HIERARCHY",
      severity: "warn",
      message: "Hierarchy not readable at thumbnail scale",
      points_deducted: 10,
    });
  }

  const balance = measurePageBalance({
    canvas,
    safe_bottom_y: canvas.height - 48,
    max_gap_px: 140,
    min_fill: 0.85,
    min_lower_third: 0.16,
  });
  if (balance.major_lower_void) {
    findings.push({
      code: "THUMB_LOWER_VOID",
      severity: "warn",
      message: "Lower-page emptiness weakens thumbnail composition",
      points_deducted: hasBand || hasSidebar ? 8 : 12,
    });
  } else if (balance.meaningful_fill < 0.86) {
    findings.push({
      code: "THUMB_FILL",
      severity: "info",
      message: "Meaningful fill below strong thumbnail band",
      points_deducted: 4,
    });
  }

  const { similarity } = findNearestDuplicate(
    fingerprint,
    input.batch_fingerprints ?? [],
  );
  if (similarity >= VISUAL_SIMILARITY_THRESHOLD) {
    findings.push({
      code: "THUMB_NEAR_DUPLICATE",
      severity: "fail",
      message: `Near-identical thumbnail (sim ${similarity.toFixed(2)})`,
      points_deducted: 28,
    });
  } else if (similarity >= 0.72) {
    findings.push({
      code: "THUMB_SIBLING_SIMILAR",
      severity: "warn",
      message: `Elevated similarity to batch peer (${similarity.toFixed(2)})`,
      points_deducted: 14,
    });
  } else if (similarity >= 0.6) {
    findings.push({
      code: "THUMB_CROSS_FAMILY_CLOSE",
      severity: "info",
      message: `Thumbnail moderately close to peer (${similarity.toFixed(2)})`,
      points_deducted: 6,
    });
  }

  // Section rhythm: count heading-like uppercase shorts
  const headings = texts.filter((t) => {
    const s = String(t.text ?? "");
    return s === s.toUpperCase() && s.length > 2 && s.length < 22;
  });
  if (headings.length < 4) {
    findings.push({
      code: "THUMB_SECTION_RHYTHM",
      severity: "info",
      message: "Section rhythm weakly visible at small scale",
      points_deducted: 5,
    });
  }

  const score = applyFindings(100, findings);
  return {
    category: "visual",
    score,
    max: 100,
    findings,
    metrics: {
      calibrated_bands: {
        exceptional: "95-100",
        strong: "90-94",
        publishable: "85-89",
        refinement: "75-84",
        regenerate: "<75",
      },
      meaningful_fill: balance.meaningful_fill,
      lower_third: balance.lower_third_utilisation,
      shape_anchors: shapes.length,
      nearest_similarity: similarity,
      fingerprint_hash: fingerprint.fingerprint_hash,
    },
    fingerprint,
    nearest_similarity: similarity,
  };
}
