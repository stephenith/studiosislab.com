/**
 * Text tools: add textbox, update font/size/color/alignment/lineHeight.
 */

import type { Canvas } from "fabric";
import { Textbox } from "fabric";
import type { TextProps } from "@/types/editor";

export interface AddTextboxProps {
  text?: string;
  left: number;
  top: number;
  width: number;
  fontSize?: number;
  fontFamily?: string;
  fill?: string;
}

/**
 * Create a Fabric Textbox (caller adds to canvas and sets active).
 */
export function addTextbox(
  canvas: Canvas,
  props: AddTextboxProps
): any {
  const {
    text = "Text",
    left,
    top,
    width,
    fontSize = 32,
    fontFamily = "Poppins",
    fill = "#111827",
  } = props;
  const t = new Textbox(text, {
    left,
    top,
    width,
    fontSize,
    fontFamily,
    fill,
  }) as any;
  return t;
}

/**
 * Apply text lock and controls for no vertical stretch (width-only resize).
 */
export function applyTextBoxNoStretch(obj: any): void {
  if (!obj || obj.type !== "textbox") return;
  obj.lockScalingY = true;
  obj.lockUniScaling = false;
  if (typeof obj.setControlsVisibility === "function") {
    obj.setControlsVisibility({
      mt: false,
      mb: false,
      tl: false,
      tr: false,
      bl: false,
      br: false,
      ml: true,
      mr: true,
      mtr: true,
    });
  }
  obj.setCoords?.();
}

/**
 * Update text properties on a Fabric text object.
 */
export function updateTextProps(activeObject: any, props: Partial<TextProps>): void {
  if (!activeObject) return;
  const type = String(activeObject.type || "").toLowerCase();
  if (type !== "textbox" && type !== "i-text" && type !== "text") return;
  const patch: Record<string, any> = { ...props };
  if (patch.fontSize != null) patch.fontSize = Number(patch.fontSize);
  if (patch.lineHeight != null) patch.lineHeight = Number(patch.lineHeight);
  activeObject.set?.(patch);
  activeObject.setCoords?.();
}
