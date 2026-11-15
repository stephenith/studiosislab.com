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
  const height = viewport?.height ?? innerHeight;
  const top = viewport?.offsetTop ?? 0;
  root.style.position = "fixed";
  root.style.left = "0";
  root.style.right = "0";
  root.style.width = "100%";
  root.style.top = `${top}px`;
  root.style.height = `${Math.round(height)}px`;
  return {
    keyboardOpen: innerHeight - height > 80,
    height,
    top,
  };
}
