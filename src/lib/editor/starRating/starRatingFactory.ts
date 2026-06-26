import { Group, Polygon, Textbox, Point, util, type Canvas } from "fabric";
import {
  DEFAULT_STAR_RATING_MODEL,
  STAR_RATING_CHILD_ROLES,
  STAR_RATING_ROLE,
  clampStarRatingValue,
  normalizeStarRatingModel,
  type StarRatingModel,
} from "@/lib/editor/starRating/starRatingModel";
import { isStarRating } from "@/lib/editor/starRating/starRatingDetection";

const LABEL_FONT_SIZE = 12;
const LABEL_LINE_HEIGHT = 1.16;
const LABEL_COLOR = "#111827";
const LABEL_FONT_FAMILY = "Poppins";

/** Native polygon width before scale (matches t075 star asset). */
const STAR_POLYGON_WIDTH = 228.2536;

const STAR_POINTS = [
  { x: 120, y: 0 },
  { x: 155.2671151375484, y: 71.45898033750315 },
  { x: 234.12678195541844, y: 82.91796067500631 },
  { x: 177.06339097770922, y: 138.54101966249684 },
  { x: 190.53423027509675, y: 217.0820393249937 },
  { x: 120, y: 180 },
  { x: 49.46576972490324, y: 217.0820393249937 },
  { x: 62.93660902229079, y: 138.54101966249686 },
  { x: 5.873218044581563, y: 82.91796067500633 },
  { x: 84.73288486245161, y: 71.45898033750316 },
];

export type StarRatingLayout = {
  starRowLeft: number;
  starRowTop: number;
  starRowWidth: number;
  starRowHeight: number;
  groupWidth: number;
  groupHeight: number;
};

export function getStarRatingModel(group: any): StarRatingModel {
  const raw = group?.data?.model ?? group?.data ?? {};
  return normalizeStarRatingModel(raw);
}

export function computeStarRatingLayout(model: StarRatingModel): StarRatingLayout {
  const labelHeight =
    model.showLabel && model.label.trim() ? LABEL_FONT_SIZE * LABEL_LINE_HEIGHT : 0;
  const starRowTop = labelHeight > 0 ? labelHeight + model.labelGap : 0;
  const starRowLeft = 0;
  const starRowWidth = (model.max - 1) * model.starGap + model.starSize;
  const starRowHeight = model.starSize;
  const groupWidth = starRowWidth;
  const groupHeight = starRowTop + starRowHeight;
  return {
    starRowLeft,
    starRowTop,
    starRowWidth,
    starRowHeight,
    groupWidth,
    groupHeight,
  };
}

export function applyStarRatingInteractionLocks(group: any): void {
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

function starPolygonScale(model: StarRatingModel): number {
  return model.starSize / STAR_POLYGON_WIDTH;
}

function buildStarRatingChildren(model: StarRatingModel): any[] {
  const children: any[] = [];
  const layout = computeStarRatingLayout(model);
  const scale = starPolygonScale(model);

  if (model.showLabel && model.label.trim()) {
    const label = new Textbox(model.label, {
      left: 0,
      top: 0,
      width: layout.groupWidth,
      fontSize: LABEL_FONT_SIZE,
      fill: LABEL_COLOR,
      fontFamily: LABEL_FONT_FAMILY,
      fontWeight: "500",
      lineHeight: LABEL_LINE_HEIGHT,
      selectable: false,
      evented: false,
      editable: false,
      lockMovementX: true,
      lockMovementY: true,
    }) as any;
    label.data = { role: STAR_RATING_CHILD_ROLES.label };
    children.push(label);
  }

  for (let i = 0; i < model.max; i += 1) {
    const filled = i < model.value;
    const star = new Polygon(
      STAR_POINTS.map((p) => ({ x: p.x, y: p.y })),
      {
        left: layout.starRowLeft + i * model.starGap,
        top: layout.starRowTop,
        scaleX: scale,
        scaleY: scale,
        fill: filled ? model.filledColor : model.emptyColor,
        originX: "left",
        originY: "top",
        strokeUniform: true,
        selectable: false,
        evented: false,
      }
    ) as any;
    star.data = { role: STAR_RATING_CHILD_ROLES.star, index: i };
    children.push(star);
  }

  return children;
}

function replaceStarRatingOnCanvas(oldGroup: any, newGroup: any): void {
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

export function createStarRatingGroup(
  modelInput?: Partial<StarRatingModel>,
  position?: { left: number; top: number }
): any {
  const model = normalizeStarRatingModel({ ...DEFAULT_STAR_RATING_MODEL, ...modelInput });
  const children = buildStarRatingChildren(model);
  const group = new Group(children, {
    left: position?.left ?? 0,
    top: position?.top ?? 0,
    originX: "left",
    originY: "top",
    subTargetCheck: false,
    objectCaching: false,
  }) as any;
  group.data = { role: STAR_RATING_ROLE, model };
  applyStarRatingInteractionLocks(group);
  return group;
}

export function renderStarRatingFromModel(
  group: any,
  modelPatch?: Partial<StarRatingModel>
): void {
  const model = normalizeStarRatingModel({ ...getStarRatingModel(group), ...modelPatch });

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

  const newGroup = createStarRatingGroup(model, { left, top });
  newGroup.set?.({ scaleX, scaleY, angle, flipX, flipY });
  if (id != null) newGroup.id = id;
  if (role != null) newGroup.role = role;
  newGroup.data = {
    role: STAR_RATING_ROLE,
    model,
    ...(dataId != null ? { id: dataId } : {}),
  };
  applyStarRatingInteractionLocks(newGroup);

  replaceStarRatingOnCanvas(group, newGroup);
}

export function setStarRatingValueOnGroup(group: any, value: number): StarRatingModel {
  const model = getStarRatingModel(group);
  const nextValue = clampStarRatingValue(value, model.max);
  model.value = nextValue;
  group.data = { role: STAR_RATING_ROLE, model };

  const children = group.getObjects?.() || group._objects || [];
  for (const child of children) {
    if (String(child?.data?.role || "") !== STAR_RATING_CHILD_ROLES.star) continue;
    const index = Number(child.data?.index ?? 0);
    const filled = index < nextValue;
    child.set?.({ fill: filled ? model.filledColor : model.emptyColor });
    child.setCoords?.();
  }
  group.setCoords?.();
  return model;
}

/** Map a screen-space pointer to a star rating value (1..max), or null if outside the star row. */
export function resolveStarRatingValueFromPointer(
  canvas: Canvas,
  group: any,
  clientX: number,
  clientY: number
): number | null {
  if (!isStarRating(group)) return null;

  (canvas as any)._resetTransformEventData?.();

  const synthetic = {
    clientX,
    clientY,
    touches: [{ clientX, clientY }],
    target: (canvas as any).upperCanvasEl,
  };

  const scenePoint = (canvas as any).getScenePoint?.(synthetic);
  if (!scenePoint) return null;

  const localPoint = util.sendPointToPlane(
    new Point(scenePoint.x, scenePoint.y),
    undefined,
    group.calcTransformMatrix()
  );

  const model = getStarRatingModel(group);
  const layout = computeStarRatingLayout(model);

  if (
    localPoint.y < layout.starRowTop ||
    localPoint.y > layout.starRowTop + layout.starRowHeight
  ) {
    return null;
  }

  const slot = Math.floor((localPoint.x - layout.starRowLeft) / model.starGap);
  const index = Math.max(0, Math.min(model.max - 1, slot));
  return index + 1;
}

export function normalizeStarRatings(canvas: any): void {
  const objs = canvas?.getObjects?.() || [];
  for (const obj of objs) {
    if (!isStarRating(obj)) continue;
    if (!obj.data?.model) {
      obj.data = { role: STAR_RATING_ROLE, model: { ...DEFAULT_STAR_RATING_MODEL } };
    }
    renderStarRatingFromModel(obj);
  }
}
