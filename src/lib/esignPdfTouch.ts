/**
 * Phone PDF gestures for the existing e-sign viewer.
 * Pure geometry only. Does not change signing APIs or PDF bytes.
 */

export type EsignResizeCorner = "tl" | "tr" | "bl" | "br";

export const ESIGN_PHONE_PINCH_MIN = 1;
export const ESIGN_PHONE_PINCH_MAX = 3;
export const ESIGN_PHONE_SIGNATURE_MIN = 32;

export type EsignBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function touchDistance(
  a: { clientX: number; clientY: number },
  b: { clientX: number; clientY: number }
): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

export function clampPhonePinchScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(ESIGN_PHONE_PINCH_MAX, Math.max(ESIGN_PHONE_PINCH_MIN, scale));
}

export function pinchScaleFromDistance(
  startDistance: number,
  currentDistance: number,
  originScale: number
): number {
  if (!(startDistance > 0) || !(currentDistance > 0)) {
    return clampPhonePinchScale(originScale);
  }
  return clampPhonePinchScale((originScale * currentDistance) / startDistance);
}

export function pointerDeltaInPageSpace(
  dx: number,
  dy: number,
  scale: number
): { dx: number; dy: number } {
  const safe = scale > 0.01 ? scale : 1;
  return { dx: dx / safe, dy: dy / safe };
}

export function dragSignatureBox(input: {
  start: EsignBox;
  dx: number;
  dy: number;
  overlayWidth: number;
  overlayHeight: number;
  scale?: number;
  clampRect?: EsignBox | null;
}): EsignBox {
  const { dx, dy } = pointerDeltaInPageSpace(input.dx, input.dy, input.scale ?? 1);
  const bounds = input.clampRect ?? {
    left: 0,
    top: 0,
    width: input.overlayWidth,
    height: input.overlayHeight,
  };
  const maxLeft = bounds.left + Math.max(0, bounds.width - input.start.width);
  const maxTop = bounds.top + Math.max(0, bounds.height - input.start.height);
  return {
    left: Math.max(bounds.left, Math.min(input.start.left + dx, maxLeft)),
    top: Math.max(bounds.top, Math.min(input.start.top + dy, maxTop)),
    width: input.start.width,
    height: input.start.height,
  };
}

export function resizeSignatureBox(input: {
  corner: EsignResizeCorner;
  start: EsignBox;
  dx: number;
  dy: number;
  overlayWidth: number;
  overlayHeight: number;
  aspect: number;
  scale?: number;
  minSize?: number;
  clampRect?: EsignBox | null;
}): EsignBox {
  const { dx } = pointerDeltaInPageSpace(input.dx, input.dy, input.scale ?? 1);
  const aspect = input.aspect > 0.05 ? input.aspect : input.start.width / Math.max(input.start.height, 1);
  const minSize = input.minSize ?? ESIGN_PHONE_SIGNATURE_MIN;
  const bounds = input.clampRect ?? {
    left: 0,
    top: 0,
    width: input.overlayWidth,
    height: input.overlayHeight,
  };
  const right = input.start.left + input.start.width;
  const bottom = input.start.top + input.start.height;
  const growRight = input.corner === "tr" || input.corner === "br";
  let width = growRight ? input.start.width + dx : input.start.width - dx;
  width = Math.max(minSize, width);
  let height = width / aspect;

  if (growRight) {
    const maxWidth = bounds.left + bounds.width - input.start.left;
    if (width > maxWidth) {
      width = Math.max(minSize, maxWidth);
      height = width / aspect;
    }
  } else {
    const maxWidth = right - bounds.left;
    if (width > maxWidth) {
      width = Math.max(minSize, maxWidth);
      height = width / aspect;
    }
  }

  const growDown = input.corner === "bl" || input.corner === "br";
  if (growDown) {
    const maxHeight = bounds.top + bounds.height - input.start.top;
    if (height > maxHeight) {
      height = Math.max(minSize / aspect, maxHeight);
      width = height * aspect;
    }
  } else {
    const maxHeight = bottom - bounds.top;
    if (height > maxHeight) {
      height = Math.max(minSize / aspect, maxHeight);
      width = height * aspect;
    }
  }

  const left = growRight ? input.start.left : right - width;
  const top = growDown ? input.start.top : bottom - height;
  return { left, top, width, height };
}

export function scaledContentSize(
  unscaledWidth: number,
  unscaledHeight: number,
  scale: number
): { width: number; height: number } {
  const safe = clampPhonePinchScale(scale);
  return {
    width: Math.max(0, unscaledWidth * safe),
    height: Math.max(0, unscaledHeight * safe),
  };
}

/**
 * Scrollport size for a CSS-scaled page stack. `unscaledWidth` / `unscaledHeight`
 * must be the pre-transform layout size. Feeding a width that already grew with
 * the spacer stretches pages and can scroll them off the stage.
 */
export function phonePinchStageSize(
  unscaledWidth: number,
  unscaledHeight: number,
  scale: number,
  viewportWidth: number
): { width: number; height: number } {
  const scaled = scaledContentSize(unscaledWidth, unscaledHeight, scale);
  return {
    width: Math.max(Math.max(0, viewportWidth), scaled.width),
    height: scaled.height,
  };
}

export function phoneZoomPercent(scale: number): number {
  return Math.round(clampPhonePinchScale(scale) * 100);
}

export function pinchMidpointInScroller(
  a: { clientX: number; clientY: number },
  b: { clientX: number; clientY: number },
  scroller: { left: number; top: number }
): { x: number; y: number } {
  return {
    x: (a.clientX + b.clientX) / 2 - scroller.left,
    y: (a.clientY + b.clientY) / 2 - scroller.top,
  };
}

export function scrollToKeepPinchMidpoint(input: {
  previousScale: number;
  nextScale: number;
  scrollLeft: number;
  scrollTop: number;
  midpointX: number;
  midpointY: number;
}): { scrollLeft: number; scrollTop: number } {
  const previous = input.previousScale > 0.01 ? input.previousScale : 1;
  const contentX = (input.scrollLeft + input.midpointX) / previous;
  const contentY = (input.scrollTop + input.midpointY) / previous;
  return {
    scrollLeft: contentX * input.nextScale - input.midpointX,
    scrollTop: contentY * input.nextScale - input.midpointY,
  };
}

export function isEsignSignatureTouchTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest("[data-esign-sig-id], [data-esign-resize-handle], [data-esign-countersign-box]")
  );
}

export function visualRectToLayoutBox(
  box: { left: number; top: number; width: number; height: number },
  overlay: { left: number; top: number; width: number; height: number },
  scale: number
): EsignBox | null {
  const safe = scale > 0.01 ? scale : 1;
  if (!(overlay.width > 0) || !(overlay.height > 0)) return null;
  const width = box.width / safe;
  const height = box.height / safe;
  if (!(width > 0) || !(height > 0)) return null;
  return {
    left: (box.left - overlay.left) / safe,
    top: (box.top - overlay.top) / safe,
    width,
    height,
  };
}

export function visualClientPointToLayout(
  clientX: number,
  clientY: number,
  overlay: { left: number; top: number; width: number; height: number },
  scale: number
): { x: number; y: number } | null {
  const safe = scale > 0.01 ? scale : 1;
  if (!(overlay.width > 0) || !(overlay.height > 0)) return null;
  return {
    x: (clientX - overlay.left) / safe,
    y: (clientY - overlay.top) / safe,
  };
}

export const COUNTERSIGN_LOCK_ERRORS = {
  missing:
    "Place the countersign box on a page first, then tap Lock countersign position to continue.",
  alreadySent:
    "This countersign position is already shared and stays in place.",
} as const;

export function resolveCountersignLock(input: {
  invitationAlreadySent: boolean;
  hasPlaceholder: boolean;
  alreadyLocked: boolean;
}):
  | { action: "lock" }
  | { action: "already_locked" }
  | { action: "error"; error: string } {
  if (input.invitationAlreadySent) {
    return { action: "error", error: COUNTERSIGN_LOCK_ERRORS.alreadySent };
  }
  if (!input.hasPlaceholder) {
    return { action: "error", error: COUNTERSIGN_LOCK_ERRORS.missing };
  }
  if (input.alreadyLocked) return { action: "already_locked" };
  return { action: "lock" };
}
