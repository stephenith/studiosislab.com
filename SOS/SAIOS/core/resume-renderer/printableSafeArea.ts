/**
 * Agent #239 — Canonical printable safe-area for A4 resume templates.
 * Single source of truth for outer margins / printable bounds.
 */

export const A4_PAGE = {
  width_px: 794,
  height_px: 1123,
  size: "A4" as const,
};

/** Canonical outer safe margins (px @ 96dpi). Balanced L/R and T/B. */
export const CANONICAL_SAFE_MARGINS_PX = {
  top: 48,
  right: 48,
  bottom: 48,
  left: 48,
} as const;

export type PrintableSafeArea = {
  version: "1.0.0";
  page_size: "A4";
  page_width_px: number;
  page_height_px: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
  printable_width: number;
  printable_height: number;
  printable_x: number;
  printable_y: number;
  printable_bottom: number;
  printable_right: number;
  /** Family may inset body further; never shrink outer safe area. */
  family_inset_x: number;
  family_inset_y: number;
  allow_edge_to_edge_decoration: boolean;
};

export type SafeAreaViolation = {
  code: string;
  message: string;
  object_id?: string;
};

export function buildPrintableSafeArea(input?: {
  page_width_px?: number;
  page_height_px?: number;
  family_inset_x?: number;
  family_inset_y?: number;
  allow_edge_to_edge_decoration?: boolean;
}): PrintableSafeArea {
  const page_width_px = input?.page_width_px ?? A4_PAGE.width_px;
  const page_height_px = input?.page_height_px ?? A4_PAGE.height_px;
  const m = CANONICAL_SAFE_MARGINS_PX;
  return {
    version: "1.0.0",
    page_size: "A4",
    page_width_px,
    page_height_px,
    top: m.top,
    right: m.right,
    bottom: m.bottom,
    left: m.left,
    printable_width: page_width_px - m.left - m.right,
    printable_height: page_height_px - m.top - m.bottom,
    printable_x: m.left,
    printable_y: m.top,
    printable_bottom: page_height_px - m.bottom,
    printable_right: page_width_px - m.right,
    family_inset_x: Math.max(0, Number(input?.family_inset_x ?? 0)),
    family_inset_y: Math.max(0, Number(input?.family_inset_y ?? 0)),
    allow_edge_to_edge_decoration: Boolean(input?.allow_edge_to_edge_decoration),
  };
}

export function contentSafeRect(safe: PrintableSafeArea): {
  x: number;
  y: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
} {
  const x = safe.printable_x + safe.family_inset_x;
  const y = safe.printable_y + safe.family_inset_y;
  const right = safe.printable_right - safe.family_inset_x;
  const bottom = safe.printable_bottom;
  return {
    x,
    y,
    width: Math.max(0, right - x),
    height: Math.max(0, bottom - y),
    bottom,
    right,
  };
}

const EDGE_DECOR_ROLES = new Set([
  "header-band",
  "pageBackground",
  "accent-rail",
  "sidebar-bg",
]);

export function validateSafeAreaGeometry(input: {
  safe: PrintableSafeArea;
  objects: Array<{
    id?: string;
    type?: string;
    left?: number;
    top?: number;
    width?: number;
    height?: number;
    scaleX?: number;
    scaleY?: number;
    isPageBg?: boolean;
    data?: { role?: string };
    role?: string;
  }>;
}): { pass: boolean; violations: SafeAreaViolation[] } {
  const violations: SafeAreaViolation[] = [];
  const safe = input.safe;
  const tol = 1.5;

  // Outer margin balance
  if (Math.abs(safe.left - safe.right) > 0.5) {
    violations.push({
      code: "SAFE_MARGIN_LR_IMBALANCE",
      message: "Left/right outer safe margins are not balanced",
    });
  }
  if (Math.abs(safe.top - safe.bottom) > 0.5) {
    violations.push({
      code: "SAFE_MARGIN_TB_IMBALANCE",
      message: "Top/bottom outer safe margins are not balanced",
    });
  }

  for (const o of input.objects) {
    if (o.isPageBg || o.data?.role === "pageBackground") continue;
    const role = String(o.data?.role ?? o.role ?? "");
    const left = Number(o.left ?? 0);
    const top = Number(o.top ?? 0);
    const w = Number(o.width ?? 0) * Number(o.scaleX ?? 1);
    const h = Number(o.height ?? 0) * Number(o.scaleY ?? 1);
    const right = left + w;
    const bottom = top + h;
    const isDecor = EDGE_DECOR_ROLES.has(role) || o.type === "Rect" && role.includes("band");

    if (isDecor && safe.allow_edge_to_edge_decoration) {
      // Decorative edge bands may touch page edges; content text checked separately
      if (bottom > safe.page_height_px + tol || right > safe.page_width_px + tol) {
        violations.push({
          code: "SAFE_DECOR_CLIP",
          message: `Decorative object clipped outside page`,
          object_id: o.id,
        });
      }
      continue;
    }

    const isText = ["Textbox", "IText", "Text"].includes(String(o.type));
    if (isText || !isDecor) {
      if (left < safe.left - tol) {
        violations.push({
          code: "SAFE_LEFT_OVERFLOW",
          message: "Content outside left safe margin",
          object_id: o.id,
        });
      }
      if (right > safe.printable_right + tol) {
        violations.push({
          code: "SAFE_RIGHT_OVERFLOW",
          message: "Content outside right safe margin",
          object_id: o.id,
        });
      }
      if (isText && top < safe.top - tol && role !== "header-band-text") {
        // Allow header text only inside band if band is edge-to-edge but text must still be inset
        if (top < 8) {
          violations.push({
            code: "SAFE_TOP_OVERFLOW",
            message: "Text too close to page top edge",
            object_id: o.id,
          });
        }
      }
      if (bottom > safe.printable_bottom + tol) {
        violations.push({
          code: "SAFE_BOTTOM_OVERFLOW",
          message: "Content outside bottom safe margin",
          object_id: o.id,
        });
      }
    }
  }

  return { pass: violations.length === 0, violations: violations.slice(0, 40) };
}
