import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { omitImageCropChromeFromSnapshot } from "./imageCrop";
import {
  canvasRectToSceneRect,
  clampMobileCropRect,
  isStandaloneMobileImage,
  MOBILE_CROP_MIN_WRAP_PX,
  moveMobileCropRect,
  resizeMobileCropRect,
  sceneRectToWrapRect,
} from "./mobileImageCrop";

const view = {
  canvasOffsetX: 4,
  canvasOffsetY: 6,
  scaleX: 0.5,
  scaleY: 0.5,
  panX: 12,
  panY: 20,
  zoom: 2,
};
const scene = { left: 80, top: 40, width: 200, height: 100 };
const wrap = sceneRectToWrapRect(scene, view);
assert.equal(wrap.left, 4 + (80 * 2 + 12) * 0.5);
assert.equal(wrap.top, 6 + (40 * 2 + 20) * 0.5);
assert.equal(wrap.width, 200 * 2 * 0.5);
assert.equal(wrap.height, 100 * 2 * 0.5);
const roundTrip = canvasRectToSceneRect(wrap, view);
assert.ok(Math.abs(roundTrip.left - scene.left) < 1e-9);
assert.ok(Math.abs(roundTrip.top - scene.top) < 1e-9);
assert.ok(Math.abs(roundTrip.width - scene.width) < 1e-9);
assert.ok(Math.abs(roundTrip.height - scene.height) < 1e-9);

const bounds = { left: 0, top: 0, width: 100, height: 80 };
const inside = clampMobileCropRect({ left: 10, top: 10, width: 40, height: 30 }, bounds, 24);
assert.deepEqual(inside, { left: 10, top: 10, width: 40, height: 30 });
const tooSmall = clampMobileCropRect({ left: 0, top: 0, width: 4, height: 4 }, bounds, 24);
assert.equal(tooSmall.width, 24);
assert.equal(tooSmall.height, 24);
const outside = moveMobileCropRect({ left: 80, top: 0, width: 40, height: 30 }, 50, 0, bounds);
assert.equal(outside.left + outside.width, 100);
const grown = resizeMobileCropRect({ left: 20, top: 20, width: 40, height: 30 }, "br", 10, 10, bounds, 24);
assert.equal(grown.width, 50);
assert.equal(grown.height, 40);

assert.equal(isStandaloneMobileImage({ type: "image" }), true);
assert.equal(isStandaloneMobileImage({ type: "textbox", text: "Hi" }), false);
assert.equal(isStandaloneMobileImage({ type: "rect", width: 40, height: 20 }), false);
assert.equal(isStandaloneMobileImage({ type: "image", data: { type: "image-frame" } }), false);
assert.equal(isStandaloneMobileImage({ type: "rect", role: "pageBackground" }), false);
assert.equal(
  isStandaloneMobileImage({ type: "image", group: { data: { type: "image-frame" } } }),
  false
);

const saved = omitImageCropChromeFromSnapshot({
  objects: [
    { type: "image", cropX: 20, cropY: 0, width: 40, height: 40, slbAssetId: "asset-1" },
    { type: "rect", role: "image-crop-rect" },
  ],
});
assert.equal(saved.objects.length, 1);
assert.equal(saved.objects[0].slbAssetId, "asset-1");
assert.equal(saved.objects[0].cropX, 20);

const shell = readFileSync(
  path.join(__dirname, "../../components/editor/mobile/MobileEditorShell.tsx"),
  "utf8"
);
assert.match(shell, /aria-label="Crop selection"/);
assert.match(shell, /aria-label="Done cropping"/);
assert.match(shell, /aria-label="Cancel crop"/);
assert.match(shell, /imageActions=\{editor.selectedIsImage/);
assert.match(shell, /!editor.imageCropping/);
assert.match(shell, /tool === "upload"/);
assert.doesNotMatch(shell, /toDataURL\(/);
assert.equal(MOBILE_CROP_MIN_WRAP_PX, 24);

const hook = readFileSync(
  path.join(__dirname, "../../components/editor/mobile/useMobileFabricEditor.ts"),
  "utf8"
);
assert.match(hook, /computeAxisAlignedImageCrop/);
assert.match(hook, /isStandaloneMobileImage/);
assert.match(hook, /isImageCropChrome/);
assert.match(hook, /filter: \(object\) => !isImageCropChrome\(object\)/);
assert.match(hook, /beginImageCrop/);
assert.match(hook, /applyImageCrop/);
assert.match(hook, /cancelImageCrop/);
assert.match(hook, /imageCroppingRef.current/);
assert.doesNotMatch(hook.slice(hook.indexOf("const applyImageCrop")), /toDataURL\(/);

const utils = readFileSync(path.join(__dirname, "mobileEditorUtils.ts"), "utf8");
assert.match(utils, /omitImageCropChromeFromSnapshot/);
assert.match(utils, /serializeCanvasForSave/);

console.log("mobileImageCrop.verify: PASS");
