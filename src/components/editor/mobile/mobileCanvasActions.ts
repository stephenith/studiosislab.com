import { FabricImage, type Canvas } from "fabric";
import { shapeCatalog } from "@/data/shapes/catalog";
import { createFrameCreate } from "@/components/editor/editor/frames/frameCreate";
import { ensureObjectId } from "@/components/editor/editor/utils/fabricHelpers";
import { createShapeFromDefinition } from "@/lib/editor/shapeFactory";
import { renderTableFromModel } from "@/lib/editor/tableFactory";
import { createTableModel, type TableModel } from "@/lib/editor/tableModel";
import { addTextbox, applyTextBoxNoStretch, updateTextProps } from "@/lib/editor/textTools";
import { applyMobileInteractionLocks } from "@/lib/editor/mobileEditorUtils";
import type { TextProps } from "@/types/editor";

export const MOBILE_SHAPE_CHOICES = shapeCatalog.map((shape) => ({
  id: shape.id,
  label: shape.label,
}));

export const MOBILE_TEXT_FONTS = ["Poppins", "Inter"] as const;

export function readTextStyle(obj: any) {
  return {
    fontFamily: String(obj?.fontFamily || "Poppins"),
    fontSize: Number(obj?.fontSize || 16),
    fontWeight: Number(obj?.fontWeight || 400),
    fontStyle: (obj?.fontStyle === "italic" ? "italic" : "normal") as "normal" | "italic",
    underline: Boolean(obj?.underline),
    textAlign: (["left", "center", "right"].includes(obj?.textAlign) ? obj.textAlign : "left") as
      | "left"
      | "center"
      | "right",
    fill: typeof obj?.fill === "string" ? obj.fill : "#111827",
  };
}

/** Keep Fabric's hidden textarea on the visible phone viewport so iOS can focus it without scrolling the resume away. */
export function holdPhoneTextCaret(obj: any) {
  const area = obj?.hiddenTextarea as HTMLTextAreaElement | undefined;
  if (!area || typeof window === "undefined") return;
  const viewport = window.visualViewport;
  const top = Math.max(0, viewport?.offsetTop ?? 0);
  area.style.position = "fixed";
  area.style.left = "0px";
  area.style.top = `${top}px`;
  area.style.width = "1px";
  area.style.height = "1px";
  area.style.fontSize = "16px";
  area.style.lineHeight = "16px";
  area.style.opacity = "0";
  area.style.padding = "0";
  area.style.margin = "0";
  area.style.border = "0";
  area.style.zIndex = "60";
  area.style.transform = "none";
  area.style.caretColor = "transparent";
}

function placePhoneTextCaret(obj: any, pointerEvent?: Event) {
  try {
    let index: number | null = null;
    if (pointerEvent && typeof obj.getSelectionStartFromPointer === "function") {
      const next = obj.getSelectionStartFromPointer(pointerEvent);
      if (typeof next === "number" && Number.isFinite(next)) index = next;
    }
    if (index == null) index = String(obj.text ?? "").length;
    obj.selectionStart = index;
    obj.selectionEnd = index;
    if (obj.hiddenTextarea) {
      obj.hiddenTextarea.selectionStart = index;
      obj.hiddenTextarea.selectionEnd = index;
    }
  } catch {
    /* Fabric keeps its own caret if the pointer cannot be mapped. */
  }
}

export function focusCanvasText(canvas: Canvas, obj: any, pointerEvent?: Event): boolean {
  if (!canvas || !obj || typeof obj.enterEditing !== "function") return false;
  const scrollX = typeof window !== "undefined" ? window.scrollX : 0;
  const scrollY = typeof window !== "undefined" ? window.scrollY : 0;
  try {
    obj.set?.({ editable: true });
    canvas.setActiveObject?.(obj);
    obj.enterEditing();
    if (!obj.isEditing) return false;
    placePhoneTextCaret(obj, pointerEvent);
    holdPhoneTextCaret(obj);
    obj.hiddenTextarea?.focus?.({ preventScroll: true });
    if (typeof window !== "undefined" && (window.scrollX !== scrollX || window.scrollY !== scrollY)) {
      window.scrollTo(scrollX, scrollY);
    }
    canvas.requestRenderAll?.();
    return true;
  } catch {
    return false;
  }
}

export function exitCanvasText(obj: any) {
  try {
    obj?.exitEditing?.();
  } catch {
    /* ignore */
  }
}

function finishAdded(canvas: Canvas, obj: any, pageW: number, pageH: number) {
  applyTextBoxNoStretch(obj);
  applyMobileInteractionLocks(canvas, pageW, pageH);
  canvas.requestRenderAll();
  return obj;
}

export function addMobileText(canvas: Canvas, page: { w: number; h: number }) {
  const obj = addTextbox(canvas, {
    text: "Text",
    left: page.w / 2 - 140,
    top: page.h / 2 - 24,
    width: 280,
    fontSize: 28,
    fontFamily: "Poppins",
    fill: "#111827",
  });
  ensureObjectId(obj);
  canvas.add(obj);
  return finishAdded(canvas, obj, page.w, page.h);
}

export function addMobileShape(canvas: Canvas, shapeId: string, page: { w: number; h: number }) {
  const def = shapeCatalog.find((shape) => shape.id === shapeId);
  if (!def) return null;
  const obj = createShapeFromDefinition(def, page);
  ensureObjectId(obj);
  canvas.add(obj);
  return finishAdded(canvas, obj, page.w, page.h);
}

export function addMobileTable(canvas: Canvas, rows: number, cols: number, page: { w: number; h: number }) {
  const model = createTableModel(Math.min(8, Math.max(1, rows)), Math.min(6, Math.max(1, cols)));
  const group = renderTableFromModel(model) as any;
  const tableWidth = model.colWidths.reduce((sum, value) => sum + value, 0);
  const tableHeight = model.rowHeights.reduce((sum, value) => sum + value, 0);
  group.set({
    left: page.w / 2 - tableWidth / 2,
    top: page.h / 2 - tableHeight / 2,
    subTargetCheck: true,
    lockScalingFlip: true,
  });
  group.data = { ...model, role: "table", tableId: model.tableId };
  const children = group.getObjects?.() || group._objects || [];
  children.forEach((child: any) => {
    if (String(child?.data?.role || "") !== "table-cell-text") return;
    const syncCellContent = () => {
      const tableData = group.data as TableModel | undefined;
      if (!tableData?.cells) return;
      const row = Number(child?.data?.row);
      const col = Number(child?.data?.col);
      const cell = tableData.cells.find((entry) => entry.row === row && entry.col === col);
      if (!cell) return;
      cell.text = String(child?.text || "");
    };
    child.on?.("changed", syncCellContent);
    child.on?.("editing:exited", syncCellContent);
  });
  ensureObjectId(group);
  canvas.add(group);
  return finishAdded(canvas, group, page.w, page.h);
}

export function addMobileFrame(canvas: Canvas, type: "square" | "circle", page: { w: number; h: number }) {
  const before = new Set(canvas.getObjects());
  const { addImageFrame } = createFrameCreate({
    getCanvas: () => canvas,
    getPageSizePx: () => page,
    ensureObjectId,
    pushHistory: () => undefined,
    updateLayers: () => undefined,
  });
  addImageFrame(type);
  const created = canvas.getObjects().find((obj) => !before.has(obj));
  if (!created) return null;
  return finishAdded(canvas, created, page.w, page.h);
}

export async function addMobileImage(
  canvas: Canvas,
  url: string,
  page: { w: number; h: number },
  meta?: { slbAssetId?: string; slbSource?: "local" | "cloud" | "template" }
) {
  const img = await FabricImage.fromURL(url, { crossOrigin: "anonymous" } as any);
  const maxW = page.w * 0.55;
  const maxH = page.h * 0.55;
  const baseW = img.width || 200;
  const baseH = img.height || 200;
  const scale = Math.min(maxW / baseW, maxH / baseH, 1);
  img.set({
    left: page.w / 2 - (baseW * scale) / 2,
    top: page.h / 2 - (baseH * scale) / 2,
    scaleX: scale,
    scaleY: scale,
  });
  if (meta?.slbAssetId) {
    img.set("slbAssetId", meta.slbAssetId);
    (img as any).slbAssetId = meta.slbAssetId;
  }
  if (meta?.slbSource) {
    img.set("slbSource", meta.slbSource);
    (img as any).slbSource = meta.slbSource;
  }
  if (meta?.slbAssetId || meta?.slbSource) {
    const existing = (img as any).data && typeof (img as any).data === "object" ? (img as any).data : {};
    (img as any).data = {
      ...existing,
      ...(meta.slbAssetId ? { slbAssetId: meta.slbAssetId } : {}),
      ...(meta.slbSource ? { slbSource: meta.slbSource } : {}),
    };
  }
  ensureObjectId(img);
  canvas.add(img);
  return finishAdded(canvas, img, page.w, page.h);
}

export function applyMobileTextStyle(obj: any, props: Partial<TextProps>) {
  updateTextProps(obj, props);
  obj?.initDimensions?.();
  obj?.setCoords?.();
  holdPhoneTextCaret(obj);
  obj?.canvas?.requestRenderAll?.();
}

export async function duplicateMobileObject(canvas: Canvas, obj: any, page: { w: number; h: number }) {
  if (!obj || typeof obj.clone !== "function") return null;
  const cloned = await obj.clone();
  cloned.set?.({
    left: (obj.left || 0) + 18,
    top: (obj.top || 0) + 18,
  });
  delete cloned.id;
  if (cloned.data && typeof cloned.data === "object") {
    cloned.data = { ...cloned.data };
    delete cloned.data.id;
  }
  ensureObjectId(cloned);
  canvas.add(cloned);
  return finishAdded(canvas, cloned, page.w, page.h);
}

export function deleteMobileObject(canvas: Canvas, obj: any, page: { w: number; h: number }) {
  if (!obj) return;
  canvas.remove(obj);
  applyMobileInteractionLocks(canvas, page.w, page.h);
  canvas.requestRenderAll();
}

export function resizeMobileObject(obj: any, factor: number) {
  if (!obj) return;
  const type = String(obj.type || "").toLowerCase();
  if (type === "textbox" || type === "i-text" || type === "text") {
    const next = Math.max(8, Math.round(Number(obj.fontSize || 16) * factor));
    updateTextProps(obj, { fontSize: next });
  } else {
    obj.set?.({
      scaleX: Math.max(0.05, Number(obj.scaleX || 1) * factor),
      scaleY: Math.max(0.05, Number(obj.scaleY || 1) * factor),
    });
    obj.setCoords?.();
  }
  obj.canvas?.requestRenderAll?.();
}
