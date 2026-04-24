/**
 * Shared editor types and constants.
 * Used by useFabricEditor and lib/editor modules.
 */

export type EditorMode = "new" | "template";
export type PageSize = "A4" | "Letter" | "Custom";

export type SelectionType = "none" | "text" | "shape" | "image" | "frame" | "table";
export type AlignAction =
  | "left"
  | "centerX"
  | "right"
  | "top"
  | "middle"
  | "bottom";

export type TextProps = {
  fontFamily: string;
  fontSize: number;
  fill: string;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  fontVariantId?: string;
  underline: boolean;
  textAlign: "left" | "center" | "right" | "justify";
  lineHeight: number;
  charSpacing: number;
  opacity?: number;
  uppercaseEnabled?: boolean;
  listMode?: "none" | "bullet" | "number";
};

export type ShapeProps = {
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  cornerRadius: number;
};

export type ImageAdjustments = {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  sharpen: number;
};

export type ImageProps = {
  opacity: number;
  scaleX: number;
  scaleY: number;
  angle: number;
  flipX: boolean;
  flipY: boolean;
  width: number;
  height: number;
  isCropping: boolean;
  adjustments: ImageAdjustments;
};

export type TableProps = {
  borderColor: string;
  borderWidth: number;
};

export type LayerItem = {
  id: string;
  type: string;
  visible: boolean;
  locked: boolean;
  displayName: string;
  index: number;
  objectRef: any;
};

export const CANVAS_BG = "#f3f4f6";

export const PAGE_SIZES: Record<PageSize, { w: number; h: number }> = {
  A4: { w: 794, h: 1123 },
  Letter: { w: 816, h: 1056 },
  Custom: { w: 794, h: 1123 },
};

export const FIT_MARGIN_RATIO = 0.95;
export const FIT_MIN_ZOOM = 0.25;
export const FIT_MAX_ZOOM = 1.25;
export const FIT_RESIZE_DEBOUNCE_MS = 120;
export const FIT_PAD = 24;
export const FIT_RESERVED_BOTTOM = 48;
