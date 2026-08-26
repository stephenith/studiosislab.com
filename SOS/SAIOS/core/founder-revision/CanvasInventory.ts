/**
 * Compact canvas inventory for Founder revision planner prompts.
 */
import type { CanvasInventoryObject } from "./revision-task-types.js";
import {
  effectiveTextHeightScaled,
  isFabricTextObject,
} from "./TextEffectiveHeight.js";

export type FabricCanvasDoc = {
  version?: string;
  width?: number;
  height?: number;
  objects?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

function asNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function asStr(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function objectId(o: Record<string, unknown>, index: number): string {
  if (typeof o.id === "string" && o.id.trim()) return o.id;
  const data = o.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const id = (data as { id?: unknown }).id;
    if (typeof id === "string" && id.trim()) return id;
  }
  return `obj-${index}`;
}

function dataField(o: Record<string, unknown>, key: string): string | null {
  const data = o.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const v = (data as Record<string, unknown>)[key];
  return typeof v === "string" ? v : null;
}

function isLocked(o: Record<string, unknown>): boolean {
  if (o.lockMovementX === true || o.lockMovementY === true) return true;
  if (o.selectable === false && o.evented === false) return true;
  const data = o.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const d = data as Record<string, unknown>;
    if (d.system === true || d.kind === "page-bg" || d.role === "pageBackground") {
      return true;
    }
  }
  return false;
}

function isSystem(o: Record<string, unknown>): boolean {
  const data = o.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const d = data as Record<string, unknown>;
    return d.system === true || d.kind === "page-bg" || d.role === "pageBackground";
  }
  return false;
}

export function ensureObjectIds(canvas: FabricCanvasDoc): FabricCanvasDoc {
  const clone = JSON.parse(JSON.stringify(canvas)) as FabricCanvasDoc;
  const objects = clone.objects ?? [];
  for (let i = 0; i < objects.length; i++) {
    const o = objects[i]!;
    const id = objectId(o, i);
    o.id = id;
    const data =
      o.data && typeof o.data === "object" && !Array.isArray(o.data)
        ? { ...(o.data as Record<string, unknown>) }
        : {};
    if (typeof data.id !== "string") data.id = id;
    o.data = data;
  }
  return clone;
}

export function buildCanvasInventory(
  canvas: FabricCanvasDoc,
): CanvasInventoryObject[] {
  const objects = canvas.objects ?? [];
  return objects.map((o, index) => {
    const text = asStr(o.text);
    const storedHeight = asNum(o.height);
    const top = asNum(o.top);
    const isText = isFabricTextObject(o);
    const effectiveHeight = isText
      ? effectiveTextHeightScaled(o)
      : storedHeight;
    const effectiveBottom =
      top != null && effectiveHeight != null
        ? top + effectiveHeight
        : null;
    return {
      id: objectId(o, index),
      index,
      type: asStr(o.type) ?? "unknown",
      text: text ? text.slice(0, 160) : null,
      left: asNum(o.left),
      top,
      width: asNum(o.width),
      height: storedHeight,
      stored_height: storedHeight,
      effective_height: isText ? effectiveHeight : null,
      effective_bottom: isText ? effectiveBottom : null,
      text_len: text != null ? text.length : null,
      fill: asStr(o.fill),
      stroke: asStr(o.stroke),
      fontSize: asNum(o.fontSize),
      fontFamily: asStr(o.fontFamily),
      fontWeight:
        typeof o.fontWeight === "string" || typeof o.fontWeight === "number"
          ? o.fontWeight
          : null,
      lineHeight: asNum(o.lineHeight),
      role: dataField(o, "role"),
      section: dataField(o, "section"),
      locked: isLocked(o),
      system: isSystem(o),
      group_id: asStr(o.groupId) ?? dataField(o, "group_id"),
    };
  });
}

export function inventorySummary(inventory: CanvasInventoryObject[]): string {
  return inventory
    .map((o) => {
      const bits = [
        `id=${o.id}`,
        `type=${o.type}`,
        `left=${o.left}`,
        `top=${o.top}`,
        `w=${o.width}`,
        `h=${o.height}`,
        `stored_height=${o.stored_height}`,
        o.effective_height != null
          ? `effective_height=${Number(o.effective_height.toFixed(2))}`
          : null,
        o.effective_bottom != null
          ? `effective_bottom=${Number(o.effective_bottom.toFixed(2))}`
          : null,
        o.text_len != null ? `text_len=${o.text_len}` : null,
        o.fill ? `fill=${o.fill}` : null,
        o.stroke ? `stroke=${o.stroke}` : null,
        o.fontSize != null ? `fontSize=${o.fontSize}` : null,
        o.fontFamily ? `fontFamily=${o.fontFamily}` : null,
        o.fontWeight != null ? `fontWeight=${o.fontWeight}` : null,
        o.lineHeight != null ? `lineHeight=${o.lineHeight}` : null,
        o.role ? `role=${o.role}` : null,
        o.section ? `section=${o.section}` : null,
        o.locked ? "locked=true" : null,
        o.system ? "system=true" : null,
        o.text ? `text=${JSON.stringify(o.text)}` : null,
      ].filter(Boolean);
      return `- ${bits.join(" ")}`;
    })
    .join("\n");
}
