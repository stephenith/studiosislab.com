/**
 * Shape tools: add rect/circle/line, update fill/stroke/radius/opacity.
 */

import type { Canvas } from "fabric";
import { Rect, Circle, Line } from "fabric";
import type { ShapeProps } from "@/types/editor";

export interface AddRectProps {
  left: number;
  top: number;
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  rx?: number;
  ry?: number;
}

export interface AddCircleProps {
  left: number;
  top: number;
  radius: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface AddLineProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  left: number;
  top: number;
  stroke?: string;
  strokeWidth?: number;
}

/**
 * Create a Fabric Rect (caller adds to canvas and sets active).
 */
export function addRect(canvas: Canvas, props: AddRectProps): any {
  const {
    left,
    top,
    width,
    height,
    fill = "rgba(17,24,39,0.1)",
    stroke = "#111827",
    strokeWidth = 2,
    rx = 0,
    ry = 0,
  } = props;
  return new Rect({
    left,
    top,
    width,
    height,
    fill,
    stroke,
    strokeWidth,
    strokeUniform: true,
    rx,
    ry,
  }) as any;
}

/**
 * Create a Fabric Circle (caller adds to canvas and sets active).
 */
export function addCircle(canvas: Canvas, props: AddCircleProps): any {
  const {
    left,
    top,
    radius,
    fill = "rgba(17,24,39,0.1)",
    stroke = "#111827",
    strokeWidth = 2,
  } = props;
  return new Circle({
    left,
    top,
    radius,
    fill,
    stroke,
    strokeWidth,
    strokeUniform: true,
  }) as any;
}

/**
 * Create a Fabric Line (caller adds to canvas and sets active).
 */
export function addLine(canvas: Canvas, props: AddLineProps): any {
  const { x1, y1, x2, y2, left, top, stroke = "#111827", strokeWidth = 2 } = props;
  return new Line([x1, y1, x2, y2], {
    left,
    top,
    stroke,
    strokeWidth,
    strokeUniform: true,
  }) as any;
}

/**
 * Update shape properties (fill, stroke, opacity, cornerRadius).
 */
export function updateShapeProps(
  activeObject: any,
  props: Partial<ShapeProps>
): void {
  if (!activeObject) return;
  const type = String(activeObject.type || "").toLowerCase();
  if (type !== "rect" && type !== "circle" && type !== "triangle" && type !== "line") return;
  const patch: any = { ...props, strokeUniform: true };
  if (props.cornerRadius != null && type === "rect") {
    patch.rx = props.cornerRadius;
    patch.ry = props.cornerRadius;
  }
  activeObject.set?.(patch);
  activeObject.setCoords?.();
}
