import type { Canvas } from "fabric";

/**
 * Assigns a stable id to a Fabric object if it doesn't have one yet and
 * mirrors it into common metadata fields. Pure helper, no React dependencies.
 */
export function ensureObjectId(obj: any): string | null {
  if (!obj) return null;
  if (!obj.id) {
    const generated =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : String(Date.now() + Math.random());
    obj.id = generated;
  }
  if (!obj.data) obj.data = {};
  obj.data.id = obj.id;
  (obj as any).uid = obj.id;
  return obj.id;
}

