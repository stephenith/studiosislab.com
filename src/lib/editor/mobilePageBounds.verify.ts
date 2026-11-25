import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  clampMobileObjectToPage,
  constrainMobileResizeToPage,
  mobileAabbFitsInPage,
  mobileObjectSceneAabb,
  translationToKeepAabbOnPage,
} from "./mobileEditorUtils";
import { MOBILE_A4_HEIGHT, MOBILE_PAGE_GAP, stackedMobilePageRect } from "./mobilePageStack";

const page = { left: 0, top: 0, width: 200, height: 100 };
const later = stackedMobilePageRect([0, MOBILE_A4_HEIGHT + MOBILE_PAGE_GAP], [{ w: 794, h: 1123 }, { w: 794, h: 1123 }], 1);
assert.equal(later?.index, 1);
assert.equal(later?.left, 0);
assert.equal(later?.top, MOBILE_A4_HEIGHT + MOBILE_PAGE_GAP);

function fakeObject(input: {
  left: number;
  top: number;
  width: number;
  height: number;
  scaleX?: number;
  scaleY?: number;
  role?: string;
  aCoords?: { tl: { x: number; y: number }; tr: { x: number; y: number }; bl: { x: number; y: number }; br: { x: number; y: number } };
}) {
  const obj: any = {
    left: input.left,
    top: input.top,
    width: input.width,
    height: input.height,
    scaleX: input.scaleX ?? 1,
    scaleY: input.scaleY ?? 1,
    role: input.role,
    aCoords: input.aCoords,
    set(patch: Record<string, number>) {
      Object.assign(obj, patch);
    },
    setCoords() {
      /* tests supply aCoords */
    },
  };
  return obj;
}

const inside = fakeObject({ left: 20, top: 10, width: 40, height: 20 });
assert.equal(clampMobileObjectToPage(inside, page), false);
assert.equal(inside.left, 20);

const draggedOff = fakeObject({ left: 180, top: 10, width: 40, height: 20 });
assert.equal(clampMobileObjectToPage(draggedOff, page), true);
assert.equal(draggedOff.left, 160);
assert.equal(draggedOff.top, 10);

const laterPage = { left: 0, top: later!.top, width: 794, height: 1123 };
const laterDrag = fakeObject({ left: 10, top: later!.top + 1100, width: 80, height: 80 });
clampMobileObjectToPage(laterDrag, laterPage);
assert.equal(laterDrag.top, later!.top + 1123 - 80);
assert.equal(laterDrag.left, 10);

const rotated = fakeObject({
  left: 190,
  top: 40,
  width: 40,
  height: 20,
  aCoords: { tl: { x: 170, y: 30 }, tr: { x: 210, y: 50 }, br: { x: 190, y: 70 }, bl: { x: 150, y: 50 } },
});
const rotatedBox = mobileObjectSceneAabb(rotated);
assert.deepEqual(rotatedBox, { left: 150, top: 30, width: 60, height: 40 });
clampMobileObjectToPage(rotated, page);
assert.equal(rotated.left, 190 - 10);
assert.equal(rotated.top, 40);

const oversized = fakeObject({ left: -40, top: 10, width: 260, height: 20 });
const beforeScaleX = oversized.scaleX;
clampMobileObjectToPage(oversized, page);
assert.equal(oversized.left, 0);
assert.equal(oversized.scaleX, beforeScaleX);
assert.equal(mobileAabbFitsInPage(mobileObjectSceneAabb(oversized)!, page), false);

const group = fakeObject({
  left: 180,
  top: 80,
  width: 50,
  height: 40,
  aCoords: { tl: { x: 180, y: 80 }, tr: { x: 230, y: 80 }, br: { x: 230, y: 120 }, bl: { x: 180, y: 120 } },
});
clampMobileObjectToPage(group, page);
assert.equal(group.left, 150);
assert.equal(group.top, 60);

const grow = fakeObject({ left: 160, top: 10, width: 80, height: 20, scaleX: 2, scaleY: 1 });
grow.width = 40;
constrainMobileResizeToPage(grow, page, "free", true);
assert.ok(mobileAabbFitsInPage(mobileObjectSceneAabb(grow)!, page));

const keepHuge = fakeObject({ left: -20, top: 0, width: 240, height: 40, scaleX: 3, scaleY: 1 });
keepHuge.width = 80;
constrainMobileResizeToPage(keepHuge, page, "uniform", false);
assert.equal(keepHuge.scaleX, 3);

const surface = fakeObject({ left: -10, top: 0, width: 200, height: 100, role: "pageBackground" });
assert.equal(clampMobileObjectToPage(surface, page), false);
assert.equal(surface.left, -10);

const delta = translationToKeepAabbOnPage({ left: -8, top: -4, width: 30, height: 20 }, page);
assert.deepEqual(delta, { dx: 8, dy: 4 });

const hook = readFileSync(path.join(__dirname, "../../components/editor/mobile/useMobileFabricEditor.ts"), "utf8");
assert.match(hook, /clampMobileObjectToPage/);
assert.match(hook, /constrainMobileResizeToPage/);
assert.match(hook, /gesturePageRectRef/);
assert.match(hook, /startFitted/);
const renderStacked = hook.slice(hook.indexOf("const renderStackedPages"), hook.indexOf("const showPage"));
assert.doesNotMatch(renderStacked, /clampMobileObjectToPage/);
const loadEffect = hook.slice(hook.indexOf("const source = phoneResumeLoadSource"), hook.indexOf("const run = async"));
assert.doesNotMatch(loadEffect, /clampMobileObjectToPage/);

const shell = readFileSync(path.join(__dirname, "../../components/editor/mobile/MobileEditorShell.tsx"), "utf8");
assert.match(shell, /data-slb-active-page-outline="true"/);
assert.match(shell, /pointer-events-none absolute z-10[\s\S]*ring-2 ring-blue-500/);
assert.match(shell, /editor\.pageFrames\[editor\.pageIndex\]/);
assert.doesNotMatch(shell, /toDataURL\(/);

console.log("mobilePageBounds.verify: PASS");
