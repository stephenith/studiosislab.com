import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  clampMobileViewport,
  isFitZoom,
  MOBILE_PAGE_CONTROL_CLEARANCE,
  MOBILE_VIEWPORT_PADDING,
  MOBILE_ZOOM_PERCENT_MAX,
  shouldForceFitOnStageResize,
  zoomFromPercent,
  zoomPercentFromState,
} from "./mobileEditorUtils";

const a4 = { w: 794, h: 1123 };
const viewport = { viewportWidth: 390, viewportHeight: 520, baseZoom: 0.3 };
const fit = clampMobileViewport(
  { zoom: 0.3, panX: 80, panY: 40 },
  { ...viewport, stack: { pageTops: [0], pageSizes: [a4] } }
);
assert.equal(fit.zoom, 0.3);
assert.equal(fit.panX, (390 - Math.round(794 * 0.3)) / 2);
assert.equal(isFitZoom(fit.zoom, 0.3), true);
const dragged = clampMobileViewport(
  { zoom: 0.3, panX: fit.panX + 120, panY: fit.panY - 80 },
  { ...viewport, stack: { pageTops: [0], pageSizes: [a4] } }
);
assert.equal(dragged.panX, fit.panX);
assert.equal(dragged.panY, fit.panY);

const twoPages = {
  pageTops: [0, 1303],
  pageSizes: [a4, a4],
};
const page0 = clampMobileViewport(
  { zoom: 0.3, panX: 0, panY: 0 },
  { ...viewport, stack: twoPages }
);
const page1 = clampMobileViewport(
  { zoom: 0.3, panX: page0.panX, panY: page0.panY - 400 },
  { ...viewport, stack: twoPages }
);
assert.equal(page1.panX, page0.panX);
assert.ok(page1.panY < page0.panY);
const tooFar = clampMobileViewport(
  { zoom: 0.3, panX: page0.panX, panY: page0.panY - 8000 },
  { ...viewport, stack: twoPages }
);
const farther = clampMobileViewport(
  { zoom: 0.3, panX: page0.panX, panY: page0.panY - 20000 },
  { ...viewport, stack: twoPages }
);
assert.equal(tooFar.panY, farther.panY);
assert.ok(tooFar.panY <= page1.panY);
assert.equal(tooFar.panX, page0.panX);

const zoomed = clampMobileViewport(
  { zoom: 0.9, panX: -200, panY: -150 },
  { ...viewport, stack: { pageTops: [0], pageSizes: [a4] } }
);
assert.equal(isFitZoom(zoomed.zoom, 0.3), false);
assert.ok(zoomed.panX <= 0);
assert.ok(zoomed.panX + 794 * 0.9 >= 390);
assert.ok(zoomed.panY + 1123 * 0.9 > MOBILE_VIEWPORT_PADDING);

assert.equal(zoomPercentFromState(0.3, 0.3), 100);
assert.equal(zoomPercentFromState(0.6, 0.3), 200);
assert.equal(zoomPercentFromState(1.2, 0.3), MOBILE_ZOOM_PERCENT_MAX);
assert.equal(zoomFromPercent(100, 0.3), 0.3);
assert.equal(zoomFromPercent(200, 0.3), 0.6);
assert.equal(zoomPercentFromState(zoomFromPercent(400, 0.3), 0.3), 300);

const hook = readFileSync(
  path.join(__dirname, "../../components/editor/mobile/useMobileFabricEditor.ts"),
  "utf8"
);
assert.match(hook, /clampMobileViewport/);
assert.match(hook, /setZoomPercent: applyZoomPercent/);
assert.match(hook, /zoomPercentFromState/);
assert.match(hook, /shouldForceFitOnStageResize/);
assert.match(hook, /resetView/);
assert.equal(hook.includes("else userAdjustedViewRef.current = false"), false);
assert.equal(MOBILE_PAGE_CONTROL_CLEARANCE > 0, true);

assert.equal(
  shouldForceFitOnStageResize({ lastWidth: 0, nextWidth: 390, nextHeight: 520, userAdjusted: false }),
  true
);
assert.equal(
  shouldForceFitOnStageResize({ lastWidth: 390, nextWidth: 844, nextHeight: 390, userAdjusted: false }),
  true
);
assert.equal(
  shouldForceFitOnStageResize({ lastWidth: 390, nextWidth: 844, nextHeight: 390, userAdjusted: true }),
  false
);
assert.equal(
  shouldForceFitOnStageResize({ lastWidth: 390, nextWidth: 390, nextHeight: 400, userAdjusted: true }),
  false
);
assert.equal(
  shouldForceFitOnStageResize({ lastWidth: 390, nextWidth: 392, nextHeight: 520, userAdjusted: false }),
  false
);

console.log("mobileViewport.verify: PASS");
