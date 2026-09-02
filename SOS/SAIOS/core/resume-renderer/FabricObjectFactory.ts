/**
 * Fabric / StudiosisLab object helpers for CanvasBuilder.
 * Emits the same property surface as manually authored templates (e.g. t094).
 */

export const FABRIC_VERSION = "6.9.1";

export type FabricObjectBase = {
  version: string;
  originX: "left";
  originY: "top";
  left: number;
  top: number;
  scaleX: number;
  scaleY: number;
  angle: number;
  flipX: boolean;
  flipY: boolean;
  opacity: number;
  visible: boolean;
  fillRule: "nonzero";
  paintFirst: "fill";
  globalCompositeOperation: "source-over";
  skewX: number;
  skewY: number;
  type: string;
  width: number;
  height: number;
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
  shadow: null;
  backgroundColor: string;
  id: string;
  data: Record<string, unknown>;
  selectable: boolean;
  evented: boolean;
  hasControls: boolean;
  hasBorders: boolean;
  lockMovementX: boolean;
  lockMovementY: boolean;
};

function base(
  partial: Partial<FabricObjectBase> &
    Pick<FabricObjectBase, "type" | "left" | "top" | "width" | "height" | "id">,
): FabricObjectBase {
  return {
    version: FABRIC_VERSION,
    originX: "left",
    originY: "top",
    scaleX: 1,
    scaleY: 1,
    angle: 0,
    flipX: false,
    flipY: false,
    opacity: 1,
    visible: true,
    fillRule: "nonzero",
    paintFirst: "fill",
    globalCompositeOperation: "source-over",
    skewX: 0,
    skewY: 0,
    fill: "#000000",
    stroke: null,
    strokeWidth: 0,
    shadow: null,
    backgroundColor: "",
    selectable: true,
    evented: true,
    hasControls: true,
    hasBorders: true,
    lockMovementX: false,
    lockMovementY: false,
    data: {},
    ...partial,
  };
}

export function fabricPageBackground(input: {
  id: string;
  width: number;
  height: number;
  fill: string;
}): FabricObjectBase & {
  role: "pageBackground";
  name: string;
  isPageBg: true;
  rx: number;
  ry: number;
} {
  return {
    ...base({
      type: "Rect",
      id: input.id,
      left: 0,
      top: 0,
      width: input.width,
      height: input.height,
      fill: input.fill,
      stroke: "#e5e7eb",
      strokeWidth: 1,
      selectable: false,
      evented: false,
      hasControls: false,
      hasBorders: false,
      lockMovementX: true,
      lockMovementY: true,
      data: {
        role: "pageBackground",
        kind: "page-bg",
        system: true,
        id: input.id,
        dry_run: true,
        fictional_sample_only: true,
      },
    }),
    role: "pageBackground",
    name: "Page Background",
    isPageBg: true,
    rx: 0,
    ry: 0,
  };
}

export function fabricAccentRule(input: {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  fill: string;
  section?: string;
  component?: string;
  role?: string;
}): FabricObjectBase & { rx: number; ry: number; role: string } {
  const role = input.role ?? "accent-bar";
  return {
    ...base({
      type: "Rect",
      id: input.id,
      left: input.left,
      top: input.top,
      width: input.width,
      height: input.height,
      fill: input.fill,
      stroke: null,
      strokeWidth: 0,
      selectable: true,
      evented: true,
      hasControls: true,
      hasBorders: true,
      data: {
        id: input.id,
        role,
        section: input.section,
        component: input.component,
        fictional_sample_only: true,
      },
    }),
    rx: 0,
    ry: 0,
    role,
  };
}

export function fabricShapeRect(input: {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  fill: string;
  rx?: number;
  ry?: number;
  role?: string;
  section?: string;
  component?: string;
}): FabricObjectBase & { rx: number; ry: number; role: string } {
  const role = input.role ?? "shape-rect";
  return {
    ...base({
      type: "Rect",
      id: input.id,
      left: input.left,
      top: input.top,
      width: input.width,
      height: input.height,
      fill: input.fill,
      stroke: null,
      strokeWidth: 0,
      selectable: true,
      evented: true,
      hasControls: true,
      hasBorders: true,
      data: {
        id: input.id,
        role,
        section: input.section,
        component: input.component,
        fictional_sample_only: true,
      },
    }),
    rx: input.rx ?? 0,
    ry: input.ry ?? 0,
    role,
  };
}

export function fabricCircle(input: {
  id: string;
  left: number;
  top: number;
  radius: number;
  fill: string;
  role?: string;
  section?: string;
  component?: string;
}): FabricObjectBase & { radius: number; role: string } {
  const role = input.role ?? "shape-circle";
  const d = input.radius * 2;
  return {
    ...base({
      type: "Circle",
      id: input.id,
      left: input.left,
      top: input.top,
      width: d,
      height: d,
      fill: input.fill,
      stroke: null,
      strokeWidth: 0,
      selectable: true,
      evented: true,
      hasControls: true,
      hasBorders: true,
      data: {
        id: input.id,
        role,
        section: input.section,
        component: input.component,
        fictional_sample_only: true,
      },
    }),
    radius: input.radius,
    role,
  };
}

export function fabricTextbox(input: {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  text: string;
  fill: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number | string;
  lineHeight: number;
  textAlign?: "left" | "center" | "right";
  section?: string;
  component?: string;
  role?: string;
}): FabricObjectBase & {
  text: string;
  fontSize: number;
  fontWeight: number | string;
  fontFamily: string;
  fontStyle: "normal";
  lineHeight: number;
  charSpacing: number;
  textAlign: "left" | "center" | "right";
  underline: boolean;
  overline: boolean;
  linethrough: boolean;
  styles: unknown[];
  pathStartOffset: number;
  pathSide: "left";
  pathAlign: "baseline";
  textBackgroundColor: string;
  direction: "ltr";
  minWidth: number;
  splitByGrapheme: boolean;
} {
  return {
    ...base({
      type: "Textbox",
      id: input.id,
      left: input.left,
      top: input.top,
      width: input.width,
      height: input.height,
      fill: input.fill,
      stroke: null,
      strokeWidth: 1,
      selectable: true,
      evented: true,
      hasControls: true,
      hasBorders: true,
      data: {
        id: input.id,
        section: input.section,
        component: input.component,
        ...(input.role ? { role: input.role } : {}),
        fictional_sample_only: true,
      },
    }),
    text: input.text,
    fontSize: input.fontSize,
    fontWeight: input.fontWeight,
    fontFamily: input.fontFamily,
    fontStyle: "normal",
    lineHeight: input.lineHeight,
    charSpacing: 0,
    textAlign: input.textAlign ?? "left",
    underline: false,
    overline: false,
    linethrough: false,
    styles: [],
    pathStartOffset: 0,
    pathSide: "left",
    pathAlign: "baseline",
    textBackgroundColor: "",
    direction: "ltr",
    minWidth: 20,
    splitByGrapheme: false,
  };
}
