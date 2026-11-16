/**
 * Offline checks for phone PDF backing-store metrics. No Firebase or PDF bytes.
 */
import assert from "node:assert/strict";
import {
  nearbyEsignPdfPages,
  phonePdfCanvasMetrics,
  phonePdfPaintNeeded,
  phonePdfPreviewOutputScale,
  phonePdfSharpOutputScale,
} from "./esignPdfRender";

function main() {
  assert.equal(phonePdfPreviewOutputScale(3), 2);
  assert.equal(phonePdfPreviewOutputScale(1), 1);
  assert.equal(phonePdfSharpOutputScale(2, 2), 4);
  assert.equal(phonePdfSharpOutputScale(3, 8), 9);

  const preview = phonePdfCanvasMetrics({
    cssWidth: 390,
    cssHeight: 550,
    outputScale: phonePdfPreviewOutputScale(3),
  });
  assert.equal(preview.cssWidth, 390);
  assert.equal(preview.cssHeight, 550);
  assert.equal(preview.canvasWidth, 780);
  assert.equal(preview.canvasHeight, 1100);
  assert.equal(preview.canvasWidth / preview.cssWidth, preview.canvasHeight / preview.cssHeight);

  const sharp = phonePdfCanvasMetrics({
    cssWidth: 390,
    cssHeight: 550,
    outputScale: phonePdfSharpOutputScale(2, 2),
  });
  assert.equal(sharp.cssWidth, 390);
  assert.equal(sharp.canvasWidth, 1560);
  assert.ok(sharp.canvasWidth > preview.canvasWidth);

  const clamped = phonePdfCanvasMetrics({
    cssWidth: 390,
    cssHeight: 550,
    outputScale: 40,
  });
  assert.ok(clamped.canvasWidth <= 4096);
  assert.ok(clamped.canvasHeight <= 4096);

  assert.deepEqual(nearbyEsignPdfPages(1, 2), [1, 2]);
  assert.deepEqual(nearbyEsignPdfPages(2, 4), [1, 2, 3]);
  assert.equal(phonePdfPaintNeeded(2, 2.02), false);
  assert.equal(phonePdfPaintNeeded(2, 4), true);

  console.log("esignPdfRender.verify.ts: pass");
}

main();
