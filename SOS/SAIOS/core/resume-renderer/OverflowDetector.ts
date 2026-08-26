/**
 * OverflowDetector — page boundary check (deterministic).
 */
import type { OverflowReport, RenderNode, RenderTree } from "./types.js";

function collectLeaves(node: RenderNode, acc: RenderNode[]): void {
  if (!node.children || node.children.length === 0) {
    if (node.kind === "text" || node.kind === "rule" || node.kind === "block") {
      acc.push(node);
    }
    return;
  }
  for (const c of node.children) collectLeaves(c, acc);
}

export function detectOverflow(tree: RenderTree): OverflowReport {
  const leaves: RenderNode[] = [];
  collectLeaves(tree.root, leaves);
  // Agent #239 — printable safe bottom (48px) is the content limit
  const safeBottom = tree.page.height_px - 48;
  const limit = safeBottom;
  const offending = leaves
    .map((n) => ({ id: n.id, bottom: n.y + n.height }))
    .filter((n) => n.bottom > limit - 1);

  const content_bottom_y = tree.content_bottom_y;
  const overflow_px = Math.max(0, content_bottom_y - limit);
  return {
    overflow: overflow_px > 0 || offending.length > 0,
    page_height_px: tree.page.height_px,
    content_bottom_y,
    overflow_px,
    offending_nodes: offending.slice(0, 20),
  };
}
