/**
 * Offline checks for phone PDF pinch, drag, and corner resize.
 * No Firebase, mail, or PDF bytes.
 */
import assert from "node:assert/strict";
import {
  clampPhonePinchScale,
  dragSignatureBox,
  phoneZoomPercent,
  pinchMidpointInScroller,
  pinchScaleFromDistance,
  pointerDeltaInPageSpace,
  resizeSignatureBox,
  phonePinchStageSize,
  scaledContentSize,
  scrollToKeepPinchMidpoint,
  visualClientPointToLayout,
  visualRectToLayoutBox,
  resolveCountersignLock,
  COUNTERSIGN_LOCK_ERRORS,
} from "./esignPdfTouch";

function main() {
  assert.equal(clampPhonePinchScale(0.2), 1);
  assert.equal(clampPhonePinchScale(8), 3);
  assert.equal(pinchScaleFromDistance(100, 200, 1), 2);
  assert.deepEqual(pointerDeltaInPageSpace(40, 20, 2), { dx: 20, dy: 10 });

  const dragged = dragSignatureBox({
    start: { left: 10, top: 10, width: 80, height: 40 },
    dx: 30,
    dy: 10,
    overlayWidth: 200,
    overlayHeight: 200,
    scale: 1,
  });
  assert.equal(dragged.left, 40);
  assert.equal(dragged.top, 20);

  const clamped = dragSignatureBox({
    start: { left: 10, top: 10, width: 80, height: 40 },
    dx: 400,
    dy: 400,
    overlayWidth: 200,
    overlayHeight: 200,
  });
  assert.equal(clamped.left, 120);
  assert.equal(clamped.top, 160);

  const br = resizeSignatureBox({
    corner: "br",
    start: { left: 10, top: 10, width: 80, height: 40 },
    dx: 80,
    dy: 0,
    overlayWidth: 400,
    overlayHeight: 400,
    aspect: 2,
  });
  assert.equal(br.left, 10);
  assert.equal(br.top, 10);
  assert.equal(br.width, 160);
  assert.equal(br.height, 80);

  const tl = resizeSignatureBox({
    corner: "tl",
    start: { left: 80, top: 80, width: 80, height: 40 },
    dx: -40,
    dy: 0,
    overlayWidth: 400,
    overlayHeight: 400,
    aspect: 2,
  });
  assert.equal(tl.width, 120);
  assert.equal(tl.height, 60);
  assert.equal(tl.left, 40);
  assert.equal(tl.top, 60);

  const pages = scaledContentSize(300, 800, 2);
  assert.equal(pages.width, 600);
  assert.equal(pages.height, 1600);
  const stageAtFit = phonePinchStageSize(300, 800, 1, 300);
  assert.equal(stageAtFit.width, 300);
  assert.equal(stageAtFit.height, 800);
  const stageZoomed = phonePinchStageSize(300, 800, 2, 300);
  assert.equal(stageZoomed.width, 600);
  assert.equal(stageZoomed.height, 1600);
  const noFeedback = phonePinchStageSize(300, 800, 2, 300);
  assert.equal(noFeedback.width, 600);
  assert.notEqual(phonePinchStageSize(600, 1600, 2, 300).width, 600);

  assert.equal(phoneZoomPercent(1.25), 125);
  const mid = pinchMidpointInScroller(
    { clientX: 10, clientY: 20 },
    { clientX: 50, clientY: 80 },
    { left: 0, top: 10 }
  );
  assert.equal(mid.x, 30);
  assert.equal(mid.y, 40);
  const kept = scrollToKeepPinchMidpoint({
    previousScale: 1,
    nextScale: 2,
    scrollLeft: 0,
    scrollTop: 0,
    midpointX: 100,
    midpointY: 80,
  });
  assert.equal(kept.scrollLeft, 100);
  assert.equal(kept.scrollTop, 80);

  const layout = visualRectToLayoutBox(
    { left: 80, top: 60, width: 120, height: 40 },
    { left: 40, top: 20, width: 400, height: 600 },
    2
  );
  assert.equal(layout?.left, 20);
  assert.equal(layout?.top, 20);
  assert.equal(layout?.width, 60);
  assert.equal(layout?.height, 20);

  const point = visualClientPointToLayout(80, 60, { left: 40, top: 20, width: 400, height: 600 }, 2);
  assert.equal(point?.x, 20);
  assert.equal(point?.y, 20);

  assert.equal(
    resolveCountersignLock({
      invitationAlreadySent: false,
      hasPlaceholder: true,
      alreadyLocked: false,
    }).action,
    "lock"
  );
  assert.equal(
    resolveCountersignLock({
      invitationAlreadySent: false,
      hasPlaceholder: true,
      alreadyLocked: true,
    }).action,
    "already_locked"
  );
  const missing = resolveCountersignLock({
    invitationAlreadySent: false,
    hasPlaceholder: false,
    alreadyLocked: false,
  });
  assert.equal(missing.action, "error");
  if (missing.action === "error") assert.equal(missing.error, COUNTERSIGN_LOCK_ERRORS.missing);
  const sent = resolveCountersignLock({
    invitationAlreadySent: true,
    hasPlaceholder: true,
    alreadyLocked: false,
  });
  assert.equal(sent.action, "error");
  if (sent.action === "error") assert.equal(sent.error, COUNTERSIGN_LOCK_ERRORS.alreadySent);

  console.log("esignPdfTouch.verify.ts: pass");
}

main();
