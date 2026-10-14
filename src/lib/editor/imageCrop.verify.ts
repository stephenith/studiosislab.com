/**
 * Geometry checks for desktop image crop. No Firestore and no user documents.
 * Run: node --import tsx src/lib/editor/imageCrop.verify.ts
 */
import assert from "node:assert/strict";
import { Rect } from "fabric";
import {
  IMAGE_CROP_CALC_MESSAGE,
  IMAGE_CROP_ROTATION_MESSAGE,
  computeAxisAlignedImageCrop,
  isImageCropChrome,
  omitImageCropChromeFromSnapshot,
} from "./imageCrop";

function makeImage(overrides: Record<string, unknown> = {}) {
  const image = new Rect({
    left: 100,
    top: 50,
    width: 200,
    height: 100,
    scaleX: 0.5,
    scaleY: 0.5,
    originX: "left",
    originY: "top",
    strokeWidth: 0,
    fill: "#fff",
    ...overrides,
  }) as any;
  image.cropX = overrides.cropX ?? 0;
  image.cropY = overrides.cropY ?? 0;
  image.getOriginalSize = () => ({
    width: Number(overrides.originalWidth ?? 200),
    height: Number(overrides.originalHeight ?? 100),
  });
  return image;
}

const image = makeImage();
assert.equal(typeof image.toLocalPoint, "undefined");

const full = computeAxisAlignedImageCrop(image, {
  left: 100,
  top: 50,
  width: 100,
  height: 50,
});
assert.equal(full.ok, true);
if (full.ok) {
  assert.ok(Math.abs(full.patch.cropX) < 0.6, `full cropX ${full.patch.cropX}`);
  assert.ok(Math.abs(full.patch.cropY) < 0.6, `full cropY ${full.patch.cropY}`);
  assert.ok(Math.abs(full.patch.width - 200) < 0.6);
  assert.ok(Math.abs(full.patch.height - 100) < 0.6);
  assert.equal(full.patch.scaleX, 0.5);
  assert.equal(full.patch.left, 100);
  assert.equal(full.patch.top, 50);
  assert.equal(full.patch.originX, "left");
}

const rightHalf = computeAxisAlignedImageCrop(image, {
  left: 150,
  top: 50,
  width: 50,
  height: 50,
});
assert.equal(rightHalf.ok, true);
if (rightHalf.ok) {
  assert.ok(Math.abs(rightHalf.patch.cropX - 100) < 0.6, `cropX ${rightHalf.patch.cropX}`);
  assert.ok(Math.abs(rightHalf.patch.cropY) < 0.6);
  assert.ok(Math.abs(rightHalf.patch.width - 100) < 0.6);
  assert.ok(Math.abs(rightHalf.patch.height - 100) < 0.6);
  assert.equal(rightHalf.patch.scaleX, 0.5);
  assert.equal(rightHalf.patch.scaleY, 0.5);
  assert.equal(rightHalf.patch.left, 150);
  assert.equal(rightHalf.patch.top, 50);
}

const zoomedCrop = computeAxisAlignedImageCrop(image, {
  left: 150,
  top: 50,
  width: 50,
  height: 50,
});
assert.equal(zoomedCrop.ok, true);
if (zoomedCrop.ok && rightHalf.ok) {
  assert.ok(Math.abs(zoomedCrop.patch.cropX - rightHalf.patch.cropX) < 0.01);
  assert.equal(zoomedCrop.patch.left, rightHalf.patch.left);
}

image.set(rightHalf.ok ? rightHalf.patch : {});
image.cropX = rightHalf.ok ? rightHalf.patch.cropX : 0;
image.cropY = rightHalf.ok ? rightHalf.patch.cropY : 0;
const second = computeAxisAlignedImageCrop(image, {
  left: 150,
  top: 50,
  width: 25,
  height: 50,
});
assert.equal(second.ok, true);
if (second.ok) {
  assert.ok(Math.abs(second.patch.cropX - 100) < 0.6, `second cropX ${second.patch.cropX}`);
  assert.ok(Math.abs(second.patch.width - 50) < 0.6, `second width ${second.patch.width}`);
  assert.equal(second.patch.scaleX, 0.5);
}

const centered = makeImage({ originX: "center", originY: "center", left: 150, top: 75 });
const centeredCrop = computeAxisAlignedImageCrop(centered, {
  left: 150,
  top: 50,
  width: 50,
  height: 50,
});
assert.equal(centeredCrop.ok, true);
if (centeredCrop.ok) {
  assert.equal(centeredCrop.patch.originX, "center");
  assert.ok(Math.abs(centeredCrop.patch.left - 175) < 0.6);
  assert.ok(Math.abs(centeredCrop.patch.top - 75) < 0.6);
  assert.ok(Math.abs(centeredCrop.patch.cropX - 100) < 0.6);
}

const flipped = makeImage({ flipX: true });
const flippedCrop = computeAxisAlignedImageCrop(flipped, {
  left: 100,
  top: 50,
  width: 50,
  height: 50,
});
assert.equal(flippedCrop.ok, true);
if (flippedCrop.ok) {
  assert.ok(Math.abs(flippedCrop.patch.cropX - 100) < 0.6, `flip cropX ${flippedCrop.patch.cropX}`);
  assert.ok(Math.abs(flippedCrop.patch.width - 100) < 0.6);
  assert.equal(flippedCrop.patch.scaleX, 0.5);
  assert.equal(flippedCrop.patch.left, 100);
  flipped.set(flippedCrop.patch);
  assert.equal(flipped.flipX, true);
  assert.equal(flipped.slbAssetId, undefined);
}

const rotated = makeImage({ angle: 15 });
const rotatedCrop = computeAxisAlignedImageCrop(rotated, {
  left: 100,
  top: 50,
  width: 40,
  height: 40,
});
assert.equal(rotatedCrop.ok, false);
if (!rotatedCrop.ok) assert.equal(rotatedCrop.error, IMAGE_CROP_ROTATION_MESSAGE);

const skewed = makeImage({ skewX: 10 });
const skewedCrop = computeAxisAlignedImageCrop(skewed, {
  left: 100,
  top: 50,
  width: 40,
  height: 40,
});
assert.equal(skewedCrop.ok, false);

const missed = computeAxisAlignedImageCrop(makeImage(), {
  left: 800,
  top: 800,
  width: 20,
  height: 20,
});
assert.equal(missed.ok, false);
if (!missed.ok) assert.equal(missed.error, IMAGE_CROP_CALC_MESSAGE);

const snapshot = omitImageCropChromeFromSnapshot({
  objects: [
    { type: "image", cropX: 12, slbAssetId: "asset-1" },
    { type: "rect", role: "image-crop-rect", excludeFromExport: false },
    { type: "rect", data: { role: "image-crop-dim" } },
    { type: "rect", role: "grid" },
  ],
});
assert.equal(snapshot.objects.length, 2);
assert.equal(snapshot.objects[0].slbAssetId, "asset-1");
assert.equal(snapshot.objects[0].cropX, 12);
assert.equal(isImageCropChrome({ role: "image-crop-rect" }), true);
assert.equal(snapshot.objects.some((obj: any) => obj.role === "image-crop-rect"), false);

console.log("imageCrop.verify: PASS");
