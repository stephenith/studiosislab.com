import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { omitImageCropChromeFromSnapshot } from "./imageCrop";
import {
  canvasRectToSceneRect,
  clampMobileCropRect,
  isStandaloneMobileImage,
  MOBILE_CROP_MIN_WRAP_PX,
  MOBILE_PAGE_ACTION_GAP_PX,
  moveMobileCropRect,
  MOBILE_PAGE_ACTION_BUTTON_PX,
  pageActionRowStyle,
  pageActionWrapTop,
  pageFrameInWrap,
  resizeMobileCropRect,
  sceneRectToWrapRect,
} from "./mobileImageCrop";
import {
  deleteMobilePage,
  insertMobilePage,
  MOBILE_A4_HEIGHT,
  MOBILE_A4_WIDTH,
  MOBILE_PAGE_GAP,
  stackMobilePages,
} from "./mobilePageStack";

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
assert.match(shell, /pageActionRowStyle\(frame\)/);
assert.match(shell, /pointer-events-none absolute z-20 flex w-max items-center justify-center gap-3/);
assert.match(shell, /pointer-events-auto inline-flex h-11 w-11 shrink-0[\s\S]*aria-label="Duplicate page"/);
assert.match(shell, /shrink-0[\s\S]*aria-label="Delete page"/);
assert.match(shell, /shrink-0[\s\S]*aria-label="Add page"/);
assert.doesNotMatch(
  shell.slice(shell.indexOf('aria-label="Page controls"'), shell.indexOf('aria-label="Duplicate page"')),
  /width: frame\.width/
);
assert.match(shell, /ref=\{editor.canvasWrapRef\}[\s\S]*editor.pageFrames.map/);
assert.doesNotMatch(shell, /toDataURL\(/);
assert.equal(MOBILE_CROP_MIN_WRAP_PX, 24);

const a4 = { w: MOBILE_A4_WIDTH, h: MOBILE_A4_HEIGHT };
const fitView = { canvasOffsetX: 0, canvasOffsetY: 0, scaleX: 1, scaleY: 1, panX: 40, panY: 16, zoom: 0.3 };
const page0 = pageFrameInWrap(0, 0, a4, fitView);
assert.equal(page0.index, 0);
assert.deepEqual(
  { left: page0.left, top: page0.top, width: page0.width, height: page0.height },
  sceneRectToWrapRect({ left: 0, top: 0, width: a4.w, height: a4.h }, fitView)
);
const scrolled = { ...fitView, panY: fitView.panY - 400 };
const page1Top = MOBILE_A4_HEIGHT + MOBILE_PAGE_GAP;
const page1Fit = pageFrameInWrap(1, page1Top, a4, fitView);
const page1Scrolled = pageFrameInWrap(1, page1Top, a4, scrolled);
assert.equal(page1Scrolled.top, page1Fit.top - 400);
assert.equal(page1Scrolled.left, page1Fit.left);
assert.equal(pageActionWrapTop(page1Scrolled) - page1Scrolled.top, page1Scrolled.height + MOBILE_PAGE_ACTION_GAP_PX);
const fitRow = pageActionRowStyle(page0);
assert.equal(fitRow.left, page0.left + page0.width / 2);
assert.equal(fitRow.top, pageActionWrapTop(page0));
assert.equal(fitRow.width, "max-content");
assert.equal(fitRow.transform, "translateX(-50%)");
assert.equal(MOBILE_PAGE_ACTION_BUTTON_PX, 44);
const pinched = { ...scrolled, zoom: 0.9, panX: -80 };
const page0Pinch = pageFrameInWrap(0, 0, a4, pinched);
assert.equal(page0Pinch.width, a4.w * 0.9);
assert.equal(page0Pinch.left, sceneRectToWrapRect({ left: 0, top: 0, width: a4.w, height: a4.h }, pinched).left);
const pinchRow = pageActionRowStyle(page0Pinch);
assert.equal(pinchRow.left, page0Pinch.left + page0Pinch.width / 2);
assert.equal(pinchRow.width, "max-content");
const narrow = pageActionRowStyle({ ...page0, width: 80 });
assert.equal(narrow.width, "max-content");
assert.equal(narrow.left, page0.left + 40);
const resized = { ...pinched, scaleX: 0.5, scaleY: 0.5, canvasOffsetX: 3, canvasOffsetY: 5 };
const page0Resize = pageFrameInWrap(0, 0, a4, resized);
assert.deepEqual(page0Resize, { index: 0, ...sceneRectToWrapRect({ left: 0, top: 0, width: a4.w, height: a4.h }, resized) });

const blank = {
  objects: [{ type: "rect", role: "pageBackground", left: 0, top: 0, width: a4.w, height: a4.h }],
};
const twoPages = [blank, blank];
const added = insertMobilePage(twoPages, 0, blank);
const stackedAdded = stackMobilePages(added.pages);
assert.equal(stackedAdded.pageTops.length, 3);
stackedAdded.pageTops.forEach((top, index) => {
  const frame = pageFrameInWrap(index, top, stackedAdded.pageSizes[index], scrolled);
  assert.equal(frame.top, sceneRectToWrapRect({ left: 0, top, width: a4.w, height: a4.h }, scrolled).top);
  assert.ok(pageActionWrapTop(frame) > frame.top + frame.height);
});
const duplicated = insertMobilePage(twoPages, 0, twoPages[0]);
const stackedDup = stackMobilePages(duplicated.pages);
assert.equal(stackedDup.pageTops[1], MOBILE_A4_HEIGHT + MOBILE_PAGE_GAP);
const removed = deleteMobilePage(duplicated.pages, 1);
assert.ok(removed);
const stackedRemoved = stackMobilePages(removed.pages);
assert.equal(stackedRemoved.pageTops.length, 2);
assert.equal(pageFrameInWrap(1, stackedRemoved.pageTops[1], a4, scrolled).index, 1);

const hook = readFileSync(
  path.join(__dirname, "../../components/editor/mobile/useMobileFabricEditor.ts"),
  "utf8"
);
assert.match(hook, /computeAxisAlignedImageCrop/);
assert.match(hook, /isStandaloneMobileImage/);
assert.match(hook, /beginImageCrop/);
assert.match(hook, /applyImageCrop/);
assert.match(hook, /cancelImageCrop/);
assert.match(hook, /imageCroppingRef.current/);
assert.match(hook, /pageFrameInWrap/);
assert.match(hook, /rasterMobileExportPage\(/);
assert.match(hook, /PHONE_EXPORT_MISSING_PHOTO_NOTICE/);
assert.match(hook, /PHONE_EXPORT_LOCAL_IMAGE_FAILED/);
assert.doesNotMatch(hook.slice(hook.indexOf("const applyImageCrop")), /toDataURL\(/);

const utils = readFileSync(path.join(__dirname, "mobileEditorUtils.ts"), "utf8");
assert.match(utils, /omitImageCropChromeFromSnapshot/);
assert.match(utils, /serializeCanvasForSave/);
assert.match(utils, /toObject\(\[\.\.\.FABRIC_JSON_PROPS\]\)/);
assert.doesNotMatch(utils, /toJSON\(\[\.\.\.FABRIC_JSON_PROPS\]\)/);
assert.match(utils, /"id"/);

const exportOwner = readFileSync(path.join(__dirname, "mobilePhoneExport.ts"), "utf8");
assert.match(exportOwner, /filter: \(object\) => !isImageCropChrome\(object\)/);
assert.match(exportOwner, /finalizePhoneExportImages\(liveCanvas, exportCanvas\)/);
assert.match(exportOwner, /exportToDataURL\(exportCanvas/);

console.log("mobileImageCrop.verify: PASS");
