/**
 * Lightweight Fabric JSON utilities that are safe to import in client paths.
 * Do not import template registries/snapshots here.
 */
export function normalizeToFabricJson(snap: any): { objects: any[] } {
  if (!snap) return { objects: [] };
  if (typeof snap === "string") {
    try {
      return normalizeToFabricJson(JSON.parse(snap));
    } catch {
      return { objects: [] };
    }
  }
  if (snap?.canvas) return normalizeToFabricJson(snap.canvas);
  if (Array.isArray(snap?.objects)) return snap;
  return { objects: [] };
}
