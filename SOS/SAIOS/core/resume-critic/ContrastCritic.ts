/**
 * Agent #239 — ContrastCritic with object-level evidence.
 */
import {
  meetsContrast,
  parseColor,
  pickAccessibleTextColor,
} from "../resume-renderer/contrast.js";
import { applyFindings } from "./CriticScore.js";
import { contentObjects, isPageBg, textObjects } from "./canvasHelpers.js";
import type { CategoryReport, CriticFinding, CriticInput } from "./types.js";

function bgAtPoint(
  objects: ReturnType<typeof contentObjects>,
  pageBg: string,
  left: number,
  top: number,
): string {
  // Prefer header-band / filled-label / pale-strip / sidebar when covering point
  let best: { z: number; fill: string; priority: number } | null = null;
  let i = 0;
  for (const o of objects) {
    if (o.type !== "Rect" || isPageBg(o)) continue;
    const l = Number(o.left ?? 0);
    const t = Number(o.top ?? 0);
    const w = Number(o.width ?? 0) * Number(o.scaleX ?? 1);
    const h = Number(o.height ?? 0) * Number(o.scaleY ?? 1);
    if (left >= l && left <= l + w && top >= t && top <= t + h) {
      const fill = String(o.fill ?? "");
      if (!parseColor(fill)) continue;
      const role = String(o.data?.role ?? "");
      const priority =
        role === "header-band"
          ? 40
          : role === "filled-label"
            ? 30
            : role === "pale-strip"
              ? 20
              : role === "sidebar-bg"
                ? 10
                : 1;
      if (!best || priority >= best.priority) {
        best = { z: i, fill, priority };
      }
    }
    i += 1;
  }
  return best?.fill ?? pageBg ?? "#ffffff";
}

export function evaluateContrast(input: CriticInput): CategoryReport {
  const findings: CriticFinding[] = [];
  const canvas = input.canvas;
  const texts = textObjects(canvas);
  const content = contentObjects(canvas);
  const pageBg = String(canvas.background ?? "#ffffff");
  let fails = 0;
  const samples: Array<Record<string, unknown>> = [];

  for (const t of texts) {
    const size = Number(t.fontSize ?? 11);
    const large = size >= 18;
    const fg = String(t.fill ?? "#000000");
    const bg = bgAtPoint(
      content,
      pageBg,
      Number(t.left ?? 0) + 4,
      Number(t.top ?? 0) + 4,
    );
    const check = meetsContrast(fg, bg, large);
    if (!check.pass) {
      fails += 1;
      const fix = pickAccessibleTextColor(bg, { largeText: large });
      samples.push({
        id: t.id,
        text: String(t.text ?? "").slice(0, 24),
        fg,
        bg,
        ratio: check.ratio,
        suggested: fix.color,
      });
    }
  }

  if (fails > 0) {
    findings.push({
      code: "CTR_FAIL",
      severity: "fail",
      message: `${fails} text object(s) below WCAG AA contrast`,
      points_deducted: Math.min(40, 8 + fails * 4),
    });
  } else {
    findings.push({
      code: "CTR_PASS",
      severity: "info",
      message: "All sampled text meets AA contrast on local backgrounds",
      points_deducted: 0,
    });
  }

  const score = applyFindings(100, findings);
  return {
    category: "visual",
    score,
    max: 100,
    findings,
    metrics: {
      failing_objects: fails,
      samples: samples.slice(0, 12),
      contrast_pass: fails === 0,
    },
  };
}
