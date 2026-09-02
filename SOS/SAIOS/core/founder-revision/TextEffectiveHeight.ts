/**
 * Deterministic wrap-aware text height for Founder revision geometry.
 *
 * Node has no Fabric canvas measureText. This is a conservative width-aware
 * estimate — not pixel-perfect browser parity — used so undersized stored
 * `textbox.height` cannot hide rendered wrap overlap from acceptance and
 * layout normalization.
 *
 * Policy: effective height = max(stored scaled height, estimated wrap height).
 */

export type TextGeomProps = {
  type?: unknown;
  text?: unknown;
  width?: unknown;
  height?: unknown;
  fontSize?: unknown;
  fontFamily?: unknown;
  fontWeight?: unknown;
  lineHeight?: unknown;
  charSpacing?: unknown;
  scaleX?: unknown;
  scaleY?: unknown;
  splitByGrapheme?: unknown;
};

/**
 * Average glyph width as a fraction of fontSize.
 * Slightly wide so line capacity is underestimated → taller wrap estimate
 * (fail-closed for under-height stored bboxes), without over-wrapping
 * typical single-line sidebar bullets used in legal fixtures.
 */
export const AVG_CHAR_WIDTH_RATIO = 0.5;

/** Fabric Textbox default lineHeight when omitted. */
export const DEFAULT_TEXT_LINE_HEIGHT = 1.16;

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function isFabricTextObject(o: { type?: unknown }): boolean {
  const t = String(o.type ?? "").toLowerCase();
  return t === "textbox" || t === "text" || t === "i-text";
}

export function estimateAverageCharWidthPx(o: TextGeomProps): number {
  const fontSize = Math.max(1, num(o.fontSize, 10));
  const weight = String(o.fontWeight ?? "normal").toLowerCase();
  const bold =
    weight === "bold" ||
    weight === "700" ||
    weight === "600" ||
    weight === "800" ||
    weight === "900";
  const charSpacing = num(o.charSpacing, 0); // Fabric: 1/1000 em
  const base = fontSize * AVG_CHAR_WIDTH_RATIO * (bold ? 1.06 : 1);
  return Math.max(0.5, base + (charSpacing / 1000) * fontSize);
}

/**
 * Word-aware (or grapheme) line count for one paragraph (no embedded newlines).
 */
export function estimateParagraphLineCount(
  paragraph: string,
  maxWidthPx: number,
  avgCharWidthPx: number,
  splitByGrapheme: boolean,
): number {
  if (paragraph.length === 0) return 1;
  const capacity = Math.max(1, Math.floor(maxWidthPx / Math.max(0.5, avgCharWidthPx)));

  if (splitByGrapheme || paragraph.length <= capacity) {
    return Math.max(1, Math.ceil(paragraph.length / capacity));
  }

  const tokens = paragraph.split(/(\s+)/).filter((t) => t.length > 0);
  let lines = 1;
  let col = 0;
  for (const token of tokens) {
    const w = token.length;
    if (col === 0) {
      if (w <= capacity) {
        col = w;
      } else {
        const pieces = Math.ceil(w / capacity);
        lines += pieces - 1;
        col = w % capacity;
      }
      continue;
    }
    if (col + w <= capacity) {
      col += w;
      continue;
    }
    lines += 1;
    if (w <= capacity) {
      col = w;
    } else {
      const pieces = Math.ceil(w / capacity);
      lines += pieces - 1;
      col = w % capacity;
    }
  }
  return Math.max(1, lines);
}

/**
 * Full-text wrapped line count using the object's unscaled textbox width.
 * Uses the complete `text` string from the canvas object (not inventory truncations).
 */
export function estimateWrappedLineCount(o: TextGeomProps): number {
  const text = typeof o.text === "string" ? o.text : "";
  if (!text) return 1;
  const width = Math.max(1, num(o.width, 1));
  const avg = estimateAverageCharWidthPx(o);
  const splitByGrapheme = o.splitByGrapheme === true;
  const paragraphs = text.split("\n");
  let lines = 0;
  for (const p of paragraphs) {
    lines += estimateParagraphLineCount(p, width, avg, splitByGrapheme);
  }
  return Math.max(1, lines);
}

/** Unscaled content height implied by wrap (before scaleY). */
export function estimateUnscaledTextContentHeight(o: TextGeomProps): number {
  const fontSize = Math.max(1, num(o.fontSize, 10));
  const lineHeight = Math.max(0.5, num(o.lineHeight, DEFAULT_TEXT_LINE_HEIGHT));
  return estimateWrappedLineCount(o) * fontSize * lineHeight;
}

/** Stored Fabric height scaled by scaleY (may under-represent wrap). */
export function storedTextHeightScaled(o: TextGeomProps): number {
  return Math.max(0, num(o.height, 0) * num(o.scaleY, 1));
}

/**
 * Effective text height in canvas space: never trust an undersized stored
 * height when width-aware wrap requires more vertical room.
 */
export function effectiveTextHeightScaled(o: TextGeomProps): number {
  const stored = storedTextHeightScaled(o);
  if (!isFabricTextObject(o)) return stored;
  const estimated = estimateUnscaledTextContentHeight(o) * num(o.scaleY, 1);
  return Math.max(stored, estimated);
}

/**
 * Phase 5Z — Visual *content* height for Founder spacing intent.
 *
 * Persisted Fabric JSON has no `textLines` / `calcTextHeight`. Use the same
 * width-aware wrap estimate as collision geometry, but do NOT inflate with an
 * oversized stored textbox height — empty allocated box space is visual gap.
 *
 * Collision/overlap continues to use {@link effectiveTextHeightScaled}.
 */
export function visualTextContentHeightScaled(o: TextGeomProps): number {
  if (!isFabricTextObject(o)) return storedTextHeightScaled(o);
  return estimateUnscaledTextContentHeight(o) * num(o.scaleY, 1);
}

/** Top + visual content height (ink bottom), not allocated textbox bottom. */
export function visualTextContentBottom(
  o: TextGeomProps & { top?: unknown },
): number {
  return num(o.top, 0) + visualTextContentHeightScaled(o);
}

/**
 * Axis-aligned bbox using effective text height for text objects and stored
 * geometry for everything else. Shared by acceptance + normalizer.
 */
export function effectiveObjectBBox(o: TextGeomProps & {
  left?: unknown;
  top?: unknown;
}): {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
} {
  const left = num(o.left, 0);
  const top = num(o.top, 0);
  const width = Math.max(0, num(o.width, 0) * num(o.scaleX, 1));
  const height = isFabricTextObject(o)
    ? effectiveTextHeightScaled(o)
    : Math.max(0, num(o.height, 0) * num(o.scaleY, 1));
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
  };
}
