/**
 * Agent #239 — Meaningful page-fill / lower-third balance (not decorative height gaming).
 */

export type PageBalanceReport = {
  meaningful_bottom_y: number;
  safe_bottom_y: number;
  meaningful_fill: number;
  lower_third_utilisation: number;
  largest_vertical_gap: number;
  content_thirds: [number, number, number];
  major_lower_void: boolean;
  pass: boolean;
  reasons: string[];
};

type Obj = {
  type?: string;
  top?: number;
  left?: number;
  width?: number;
  height?: number;
  scaleY?: number;
  isPageBg?: boolean;
  data?: { role?: string };
  role?: string;
  text?: string;
};

const IGNORE_ROLES = new Set([
  "pageBackground",
  "header-band",
  "sidebar-bg",
  "accent-rail",
]);

function isMeaningful(o: Obj): boolean {
  if (o.isPageBg) return false;
  const role = String(o.data?.role ?? o.role ?? "");
  if (IGNORE_ROLES.has(role)) return false;
  if (["Textbox", "IText", "Text"].includes(String(o.type))) return true;
  // Small decorative markers/rules/labels count; full-page fillers do not
  const h = Number(o.height ?? 0) * Number(o.scaleY ?? 1);
  if (o.type === "Rect" || o.type === "Line" || o.type === "Circle") {
    return h > 0 && h < 80;
  }
  return false;
}

export function measurePageBalance(input: {
  canvas: { width: number; height: number; objects: Obj[] };
  safe_bottom_y: number;
  max_gap_px?: number;
  min_fill?: number;
  min_lower_third?: number;
}): PageBalanceReport {
  const h = input.canvas.height;
  const third = h / 3;
  const objects = (input.canvas.objects ?? []).filter(isMeaningful);
  const bottoms = objects.map(
    (o) => Number(o.top ?? 0) + Number(o.height ?? 0) * Number(o.scaleY ?? 1),
  );
  const tops = objects.map((o) => Number(o.top ?? 0)).sort((a, b) => a - b);
  const meaningful_bottom_y = bottoms.length ? Math.max(...bottoms) : 0;
  const safe_bottom_y = input.safe_bottom_y;
  const meaningful_fill =
    safe_bottom_y > 0 ? Math.min(1, meaningful_bottom_y / safe_bottom_y) : 0;

  const bands = [0, 0, 0] as [number, number, number];
  for (const o of objects) {
    const t = Number(o.top ?? 0);
    const b = t + Number(o.height ?? 0) * Number(o.scaleY ?? 1);
    const mid = (t + b) / 2;
    const idx = mid < third ? 0 : mid < third * 2 ? 1 : 2;
    bands[idx] += Math.max(1, b - t);
  }
  const bandSum = bands[0] + bands[1] + bands[2] || 1;
  const content_thirds: [number, number, number] = [
    bands[0] / bandSum,
    bands[1] / bandSum,
    bands[2] / bandSum,
  ];
  const lower_third_utilisation = content_thirds[2];

  let largest_vertical_gap = 0;
  const sorted = [...objects].sort(
    (a, b) => Number(a.top ?? 0) - Number(b.top ?? 0),
  );
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    const prevBottom =
      Number(prev.top ?? 0) +
      Number(prev.height ?? 0) * Number(prev.scaleY ?? 1);
    const gap = Number(cur.top ?? 0) - prevBottom;
    if (gap > largest_vertical_gap) largest_vertical_gap = gap;
  }
  // Gap from last content to safe bottom
  const tailGap = Math.max(0, safe_bottom_y - meaningful_bottom_y);
  if (tailGap > largest_vertical_gap) largest_vertical_gap = tailGap;

  const maxGap = input.max_gap_px ?? 160;
  const minFill = input.min_fill ?? 0.86;
  const minLower = input.min_lower_third ?? 0.14;
  const reasons: string[] = [];
  if (meaningful_fill < minFill) {
    reasons.push(`Meaningful fill ${Math.round(meaningful_fill * 100)}% below ${Math.round(minFill * 100)}%`);
  }
  if (lower_third_utilisation < minLower) {
    reasons.push(
      `Lower-third utilisation ${Math.round(lower_third_utilisation * 100)}% too low`,
    );
  }
  if (tailGap > maxGap) {
    reasons.push(`Lower-page void ${Math.round(tailGap)}px exceeds ${maxGap}px`);
  }
  if (largest_vertical_gap > maxGap + 40) {
    reasons.push(`Largest vertical gap ${Math.round(largest_vertical_gap)}px`);
  }

  const major_lower_void = tailGap > maxGap || lower_third_utilisation < minLower;
  return {
    meaningful_bottom_y,
    safe_bottom_y,
    meaningful_fill: Math.round(meaningful_fill * 1000) / 1000,
    lower_third_utilisation: Math.round(lower_third_utilisation * 1000) / 1000,
    largest_vertical_gap: Math.round(largest_vertical_gap),
    content_thirds,
    major_lower_void,
    pass: reasons.length === 0,
    reasons,
  };
}
