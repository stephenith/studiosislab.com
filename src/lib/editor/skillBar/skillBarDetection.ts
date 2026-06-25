import { SKILL_BAR_ROLE } from "@/lib/editor/skillBar/skillBarModel";

export function isSkillBar(obj: any): boolean {
  if (!obj) return false;
  return String(obj?.data?.role || "").toLowerCase() === SKILL_BAR_ROLE;
}

/** Walk parent chain from a Fabric hit target to the owning skill-bar group. */
export function resolveSkillBarFromTarget(target: any): any | null {
  let node = target;
  while (node) {
    if (isSkillBar(node)) return node;
    node = node.group ?? node.parent ?? (node as any)._parent;
  }
  return null;
}
