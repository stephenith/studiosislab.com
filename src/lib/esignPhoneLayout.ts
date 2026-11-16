/**
 * Phone presentation for the existing e-sign viewer.
 * Detection matches the resume phone editor signals so iPhone Safari
 * inflated layout viewports still get the phone chrome. This module does
 * not change signing APIs, tokens, or document lifecycle.
 */

export const ESIGN_PHONE_MEDIA_QUERY =
  "(max-width: 767px), ((pointer: coarse) and (hover: none) and (max-width: 1000px) and (max-height: 520px))";

export const ESIGN_SIGNATURE_METHODS = ["draw", "upload", "mobile"] as const;

export const ESIGN_PHONE_HEADER_BG = "#1f1f28";
export const ESIGN_PHONE_STAGE_BG = "#ebecf0";

/** Native one-finger pan plus pinch; do not use touch-action:none on the scroller. */
export const ESIGN_PHONE_STAGE_TOUCH_CLASS =
  "overflow-auto overscroll-contain bg-[#ebecf0] pt-3 touch-pan-x touch-pan-y touch-pinch-zoom";

export const ESIGN_PHONE_PAGE_TOUCH_ACTION = "pan-x pan-y pinch-zoom";

/** 16px so iOS does not zoom; keep padding compact like the share sheet screenshot. */
export const ESIGN_PHONE_CONTROL_CLASS =
  "min-h-10 w-full cursor-text touch-manipulation rounded border border-zinc-300 bg-white px-2 py-1.5 text-[16px] leading-5 text-zinc-900";

export const ESIGN_PHONE_TAP_SLOP_PX = 12;

export function shouldCommitPhonePointerTap(
  start: { x: number; y: number } | null | undefined,
  end: { x: number; y: number },
  slopPx = ESIGN_PHONE_TAP_SLOP_PX
): boolean {
  if (!start) return false;
  return Math.hypot(end.x - start.x, end.y - start.y) <= slopPx;
}

export const ESIGN_PHONE_DOCUMENT_SHEET_CLASS =
  "pointer-events-auto absolute inset-x-0 bottom-0 z-50 isolate flex max-h-[min(52vh,24rem)] min-h-0 flex-col overflow-hidden rounded-t-2xl border-t bg-white shadow-[0_-8px_24px_rgba(0,0,0,0.12)] touch-manipulation [transform:translateZ(0)]";

export type EsignPhoneSignals = {
  match: (query: string) => boolean;
  userAgent?: string;
  screenWidth?: number;
  screenHeight?: number;
  maxTouchPoints?: number;
};

function asSignals(
  input: ((query: string) => boolean) | EsignPhoneSignals
): EsignPhoneSignals {
  return typeof input === "function" ? { match: input } : input;
}

function isPhoneUserAgent(userAgent: string): boolean {
  if (/iPhone|iPod/i.test(userAgent)) return true;
  return /Android/i.test(userAgent) && /Mobile/i.test(userAgent);
}

function phoneSizedTouchScreen(signals: EsignPhoneSignals): boolean {
  const width = Number(signals.screenWidth) || 0;
  const height = Number(signals.screenHeight) || 0;
  if (width <= 0 || height <= 0) return false;
  if (Math.min(width, height) > 767) return false;
  const coarse =
    signals.match("(pointer: coarse)") && signals.match("(hover: none)");
  return coarse || (signals.maxTouchPoints ?? 0) > 0;
}

export function wantsEsignPhoneLayout(
  input: ((query: string) => boolean) | EsignPhoneSignals
): boolean {
  const signals = asSignals(input);
  if (isPhoneUserAgent(signals.userAgent || "")) return true;
  if (phoneSizedTouchScreen(signals)) return true;
  return signals.match(ESIGN_PHONE_MEDIA_QUERY);
}

export function pinEsignShellToVisualViewport(
  root: HTMLElement,
  viewport: { height: number; offsetTop: number } | null | undefined,
  innerHeight: number
): { keyboardOpen: boolean; height: number; top: number } {
  const vvHeight = viewport?.height ?? innerHeight;
  const keyboardOpen = innerHeight - vvHeight > 80;
  const height = Math.round(keyboardOpen ? vvHeight : innerHeight);
  const top = 0;
  const next = {
    position: "fixed",
    left: "0",
    right: "0",
    width: "100%",
    top: `${top}px`,
    height: `${height}px`,
  };
  if (root.style.position !== next.position) root.style.position = next.position;
  if (root.style.left !== next.left) root.style.left = next.left;
  if (root.style.right !== next.right) root.style.right = next.right;
  if (root.style.width !== next.width) root.style.width = next.width;
  if (root.style.top !== next.top) root.style.top = next.top;
  if (root.style.height !== next.height) root.style.height = next.height;
  return {
    keyboardOpen,
    height,
    top,
  };
}
