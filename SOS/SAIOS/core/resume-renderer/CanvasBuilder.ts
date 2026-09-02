/**
 * CanvasBuilder — flatten RenderTree → StudiosisLab Fabric 6.9.1 Canvas JSON.
 */
import {
  FABRIC_VERSION,
  fabricAccentRule,
  fabricCircle,
  fabricPageBackground,
  fabricShapeRect,
  fabricTextbox,
} from "./FabricObjectFactory.js";
import type { RenderNode, RenderTree } from "./types.js";

export type StudiosisLabCanvasJson = {
  version: typeof FABRIC_VERSION;
  width: number;
  height: number;
  objects: Record<string, unknown>[];
  aios?: {
    dry_run: true;
    publication_allowed: false;
    template_generated: false;
    published: false;
    live_enabled: false;
    fabric_compat: "6.9.1";
    source_resume_json_version: string;
    brief_id: string | null;
    task_id: string | null;
    rendered_at: string;
    fictional_sample_only: true;
    schema: "studiosislab-fabric-canvas";
  };
};

export type CanvasJson = StudiosisLabCanvasJson;

function walk(node: RenderNode, out: Record<string, unknown>[]): void {
  if (node.kind === "page") {
    out.push(
      fabricPageBackground({
        id: node.id,
        width: node.width,
        height: node.height,
        fill: node.fill ?? "#ffffff",
      }),
    );
  } else if (node.kind === "rule") {
    out.push(
      fabricAccentRule({
        id: node.id,
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
        fill: node.fill ?? "#0a0a0a",
        section: node.section,
        component: node.component,
        role: node.role ?? "accent-bar",
      }),
    );
  } else if (node.kind === "rect") {
    out.push(
      fabricShapeRect({
        id: node.id,
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
        fill: node.fill ?? "#0a0a0a",
        rx: node.rx,
        ry: node.ry,
        role: node.role ?? "shape-rect",
        section: node.section,
        component: node.component,
      }),
    );
  } else if (node.kind === "circle") {
    out.push(
      fabricCircle({
        id: node.id,
        left: node.x,
        top: node.y,
        radius: Math.max(2, node.width / 2),
        fill: node.fill ?? "#0a0a0a",
        role: node.role ?? "shape-circle",
        section: node.section,
        component: node.component,
      }),
    );
  } else if (node.kind === "text") {
    out.push(
      fabricTextbox({
        id: node.id,
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
        text: node.text ?? "",
        fill: node.fill ?? "#0a0a0a",
        fontFamily: node.fontFamily ?? "Inter",
        fontSize: node.fontSize ?? 14,
        fontWeight: node.fontWeight ?? 400,
        lineHeight: node.lineHeight ?? 1.4,
        textAlign: node.textAlign ?? "left",
        section: node.section,
        component: node.component,
        role: node.role,
      }),
    );
  }

  for (const child of node.children ?? []) {
    walk(child, out);
  }
}

export function buildCanvasJson(input: {
  tree: RenderTree;
  source_version: string;
  brief_id: string | null;
  task_id: string | null;
}): StudiosisLabCanvasJson {
  const objects: Record<string, unknown>[] = [];
  walk(input.tree.root, objects);

  return {
    version: FABRIC_VERSION,
    width: input.tree.page.width_px,
    height: input.tree.page.height_px,
    objects,
    aios: {
      dry_run: true,
      publication_allowed: false,
      template_generated: false,
      published: false,
      live_enabled: false,
      fabric_compat: "6.9.1",
      source_resume_json_version: input.source_version,
      brief_id: input.brief_id,
      task_id: input.task_id,
      rendered_at: new Date().toISOString(),
      fictional_sample_only: true,
      schema: "studiosislab-fabric-canvas",
    },
  };
}
