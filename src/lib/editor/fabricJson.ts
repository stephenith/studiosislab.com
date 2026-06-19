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
  if (Array.isArray(snap)) {
    if (snap.length === 0) return { objects: [] };
    return normalizeToFabricJson(snap[0]);
  }
  if (Array.isArray(snap?.objects)) return snap;
  return { objects: [] };
}
