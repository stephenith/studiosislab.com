/**
 * Agent #239 — Shared WCAG contrast utility for Fabric text on tinted grounds.
 */

export type Rgb = { r: number; g: number; b: number };

export function parseColor(input: string | undefined | null): Rgb | null {
  if (!input) return null;
  const s = String(input).trim().toLowerCase();
  if (s === "transparent" || s === "none") return null;
  if (s.startsWith("#")) {
    const h = s.slice(1);
    if (h.length === 3) {
      return {
        r: parseInt(h[0]! + h[0]!, 16),
        g: parseInt(h[1]! + h[1]!, 16),
        b: parseInt(h[2]! + h[2]!, 16),
      };
    }
    if (h.length >= 6) {
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
      };
    }
  }
  const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) {
    return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
  }
  return null;
}

function channel(c: number): number {
  const x = c / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(rgb: Rgb): number {
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

export function contrastRatio(fg: Rgb, bg: Rgb): number {
  const L1 = relativeLuminance(fg);
  const L2 = relativeLuminance(bg);
  const light = Math.max(L1, L2);
  const dark = Math.min(L1, L2);
  return (light + 0.05) / (dark + 0.05);
}

const LIGHT = { r: 255, g: 255, b: 255 };
const NEAR_WHITE = { r: 248, g: 250, b: 252 };
const CHARCOAL = { r: 15, g: 23, b: 42 };
const NEAR_BLACK = { r: 10, g: 10, b: 10 };

function toHex(rgb: Rgb): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(rgb.r)}${h(rgb.g)}${h(rgb.b)}`;
}

/**
 * Pick an accessible foreground for a given background.
 * Prefer white on dark, charcoal on pale; re-check against AA.
 */
export function pickAccessibleTextColor(
  background: string | undefined,
  opts?: { largeText?: boolean; preferred?: string },
): { color: string; ratio: number; background: string } {
  const bg = parseColor(background) ?? { r: 255, g: 255, b: 255 };
  const min = opts?.largeText ? 3 : 4.5;
  const candidates: Rgb[] = [];
  if (opts?.preferred) {
    const p = parseColor(opts.preferred);
    if (p) candidates.push(p);
  }
  candidates.push(NEAR_BLACK, CHARCOAL, LIGHT, NEAR_WHITE, {
    r: 226,
    g: 232,
    b: 240,
  });

  let best = candidates[0]!;
  let bestRatio = contrastRatio(best, bg);
  for (const c of candidates) {
    const r = contrastRatio(c, bg);
    if (r > bestRatio) {
      best = c;
      bestRatio = r;
    }
  }

  // If still below min, force pure black or white by luminance
  if (bestRatio < min) {
    best = relativeLuminance(bg) > 0.5 ? NEAR_BLACK : LIGHT;
    bestRatio = contrastRatio(best, bg);
  }

  return {
    color: toHex(best),
    ratio: Math.round(bestRatio * 100) / 100,
    background: toHex(bg),
  };
}

export function meetsContrast(
  foreground: string | undefined,
  background: string | undefined,
  largeText = false,
): { pass: boolean; ratio: number } {
  const fg = parseColor(foreground);
  const bg = parseColor(background) ?? { r: 255, g: 255, b: 255 };
  if (!fg) return { pass: false, ratio: 0 };
  const ratio = contrastRatio(fg, bg);
  return { pass: ratio >= (largeText ? 3 : 4.5), ratio: Math.round(ratio * 100) / 100 };
}
