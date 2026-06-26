import { STAR_RATING_ROLE } from "@/lib/editor/starRating/starRatingModel";

export function isStarRating(obj: any): boolean {
  if (!obj) return false;
  return String(obj?.data?.role || "").toLowerCase() === STAR_RATING_ROLE;
}

/** Walk parent chain from a Fabric hit target to the owning star-rating group. */
export function resolveStarRatingFromTarget(target: any): any | null {
  let node = target;
  while (node) {
    if (isStarRating(node)) return node;
    node = node.group ?? node.parent ?? (node as any)._parent;
  }
  return null;
}
