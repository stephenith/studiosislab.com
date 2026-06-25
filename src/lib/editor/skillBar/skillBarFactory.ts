import { Group, Rect, Textbox } from "fabric";
import {
  DEFAULT_SKILL_BAR_MODEL,
  SKILL_BAR_CHILD_ROLES,
  SKILL_BAR_ROLE,
  clampSkillBarValue,
  normalizeSkillBarModel,
  type SkillBarModel,
} from "@/lib/editor/skillBar/skillBarModel";
import { isSkillBar } from "@/lib/editor/skillBar/skillBarDetection";

const LABEL_GAP = 8;

export function getSkillBarModel(group: any): SkillBarModel {
  const raw = group?.data?.model ?? group?.data ?? {};
  return normalizeSkillBarModel(raw);
}

export function applySkillBarInteractionLocks(group: any): void {
  if (!group) return;
  group.set?.({
    selectable: true,
    evented: true,
    subTargetCheck: false,
    interactive: false,
    hasControls: true,
    hasBorders: true,
    lockScalingFlip: true,
    objectCaching: false,
  });
  const children = group.getObjects?.() || group._objects || [];
  for (const child of children) {
    child?.set?.({
      selectable: false,
      evented: false,
      editable: false,
      hasControls: false,
      hasBorders: false,
    });
  }
  group.setCoords?.();
}

function computeLabelHeight(model: SkillBarModel): number {
  if (!model.showLabel || !model.label.trim()) return 0;
  return model.labelFontSize * 1.2;
}

export function buildSkillBarChildren(model: SkillBarModel): any[] {
  const children: any[] = [];
  const trackWidth = model.trackWidth;
  const trackHeight = model.trackHeight;
  let trackTop = 0;

  if (model.showLabel && model.label.trim()) {
    const label = new Textbox(model.label, {
      left: 0,
      top: 0,
      width: trackWidth,
      fontSize: model.labelFontSize,
      fill: model.labelColor,
      fontFamily: "Inter",
      fontWeight: "500",
      lineHeight: 1.2,
      selectable: false,
      evented: false,
      editable: false,
      lockMovementX: true,
      lockMovementY: true,
    }) as any;
    label.data = { role: SKILL_BAR_CHILD_ROLES.label };
    children.push(label);
    trackTop = computeLabelHeight(model) + LABEL_GAP;
  }

  const track = new Rect({
    left: 0,
    top: trackTop,
    width: trackWidth,
    height: trackHeight,
    fill: model.trackColor,
    rx: trackHeight / 2,
    ry: trackHeight / 2,
    selectable: false,
    evented: false,
  }) as any;
  track.data = { role: SKILL_BAR_CHILD_ROLES.track };

  const fillWidth = trackWidth * (model.value / model.max);
  const fill = new Rect({
    left: 0,
    top: trackTop,
    width: Math.max(0, fillWidth),
    height: trackHeight,
    fill: model.fillColor,
    rx: trackHeight / 2,
    ry: trackHeight / 2,
    selectable: false,
    evented: false,
  }) as any;
  fill.data = { role: SKILL_BAR_CHILD_ROLES.fill };

  children.push(track, fill);
  return children;
}

function replaceSkillBarOnCanvas(oldGroup: any, newGroup: any): void {
  const canvas = oldGroup?.canvas;
  if (!canvas) return;

  const zIndex = canvas.getObjects?.().indexOf(oldGroup) ?? -1;
  const wasActive = canvas.getActiveObject?.() === oldGroup;

  canvas.remove(oldGroup);
  if (zIndex >= 0 && typeof canvas.insertAt === "function") {
    canvas.insertAt(zIndex, newGroup);
  } else {
    canvas.add(newGroup);
  }

  if (wasActive) {
    canvas.setActiveObject?.(newGroup);
  }
  newGroup.setCoords?.();
}

export function renderSkillBarFromModel(group: any, modelPatch?: Partial<SkillBarModel>): void {
  const model = normalizeSkillBarModel({ ...getSkillBarModel(group), ...modelPatch });

  const left = Number(group.left ?? 0);
  const top = Number(group.top ?? 0);
  const scaleX = Number(group.scaleX ?? 1);
  const scaleY = Number(group.scaleY ?? 1);
  const angle = Number(group.angle ?? 0);
  const flipX = Boolean(group.flipX);
  const flipY = Boolean(group.flipY);
  const id = group.id;
  const role = group.role;
  const dataId = group.data?.id;

  const newGroup = createSkillBarGroup(model, { left, top });
  newGroup.set?.({ scaleX, scaleY, angle, flipX, flipY });
  if (id != null) newGroup.id = id;
  if (role != null) newGroup.role = role;
  newGroup.data = {
    role: SKILL_BAR_ROLE,
    model,
    ...(dataId != null ? { id: dataId } : {}),
  };
  applySkillBarInteractionLocks(newGroup);

  replaceSkillBarOnCanvas(group, newGroup);
}

export function setSkillBarValueOnGroup(group: any, value: number): SkillBarModel {
  const model = getSkillBarModel(group);
  const nextValue = clampSkillBarValue(value, model.max);
  model.value = nextValue;
  group.data = { role: SKILL_BAR_ROLE, model };

  const children = group.getObjects?.() || group._objects || [];
  const fill = children.find(
    (child: any) => String(child?.data?.role || "") === SKILL_BAR_CHILD_ROLES.fill
  );
  const fillWidth = model.trackWidth * (nextValue / model.max);
  if (fill) {
    fill.set?.({ width: Math.max(0, fillWidth) });
    fill.setCoords?.();
  }
  group.setCoords?.();
  return model;
}

export function createSkillBarGroup(
  modelInput?: Partial<SkillBarModel>,
  position?: { left: number; top: number }
): any {
  const model = normalizeSkillBarModel({ ...DEFAULT_SKILL_BAR_MODEL, ...modelInput });
  const children = buildSkillBarChildren(model);
  const group = new Group(children, {
    left: position?.left ?? 0,
    top: position?.top ?? 0,
    originX: "left",
    originY: "top",
    subTargetCheck: false,
    objectCaching: false,
  }) as any;
  group.data = { role: SKILL_BAR_ROLE, model };
  applySkillBarInteractionLocks(group);
  return group;
}

export function normalizeSkillBars(canvas: any): void {
  const objs = canvas?.getObjects?.() || [];
  for (const obj of objs) {
    if (!isSkillBar(obj)) continue;
    if (!obj.data?.model) {
      obj.data = { role: SKILL_BAR_ROLE, model: { ...DEFAULT_SKILL_BAR_MODEL } };
    }
    renderSkillBarFromModel(obj);
  }
}
