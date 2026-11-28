/**
 * Phone layout for the invoice tool.
 * Matches the resume/e-sign phone signals so iPhone Safari inflated layout
 * viewports still get the phone chrome. A narrow desktop window with a mouse
 * keeps the desktop invoice.
 */

export const INVOICE_PHONE_MEDIA_QUERY =
  "((max-width: 767px) and (pointer: coarse) and (hover: none)), ((pointer: coarse) and (hover: none) and (max-width: 1000px) and (max-height: 520px))";

export type InvoicePhoneSignals = {
  match: (query: string) => boolean;
  userAgent?: string;
  screenWidth?: number;
  screenHeight?: number;
  maxTouchPoints?: number;
};

function asSignals(input: ((query: string) => boolean) | InvoicePhoneSignals): InvoicePhoneSignals {
  return typeof input === "function" ? { match: input } : input;
}

function isPhoneUserAgent(userAgent: string): boolean {
  if (/iPhone|iPod/i.test(userAgent)) return true;
  return /Android/i.test(userAgent) && /Mobile/i.test(userAgent);
}

function phoneSizedTouchScreen(signals: InvoicePhoneSignals): boolean {
  const width = Number(signals.screenWidth) || 0;
  const height = Number(signals.screenHeight) || 0;
  if (width <= 0 || height <= 0) return false;
  if (Math.min(width, height) > 767) return false;
  const coarse = signals.match("(pointer: coarse)") && signals.match("(hover: none)");
  return coarse || (signals.maxTouchPoints ?? 0) > 0;
}

export function wantsInvoicePhoneLayout(
  input: ((query: string) => boolean) | InvoicePhoneSignals,
): boolean {
  const signals = asSignals(input);
  if (isPhoneUserAgent(signals.userAgent || "")) return true;
  if (phoneSizedTouchScreen(signals)) return true;
  return signals.match(INVOICE_PHONE_MEDIA_QUERY);
}

export function invoicePhoneViewportMatch(): boolean {
  if (typeof window === "undefined") return false;
  return wantsInvoicePhoneLayout({
    match: (query) => window.matchMedia(query).matches,
    userAgent: navigator.userAgent,
    screenWidth: window.screen?.width,
    screenHeight: window.screen?.height,
    maxTouchPoints: navigator.maxTouchPoints,
  });
}

export function pinInvoiceShellToVisualViewport(
  root: HTMLElement,
  viewport: { height: number; offsetTop: number } | null | undefined,
  innerHeight: number,
): { keyboardOpen: boolean; height: number } {
  const vvHeight = viewport?.height ?? innerHeight;
  const keyboardOpen = innerHeight - vvHeight > 80;
  const height = Math.round(keyboardOpen ? vvHeight : innerHeight);
  const next = {
    position: "fixed",
    left: "0",
    right: "0",
    width: "100%",
    top: "0",
    height: `${height}px`,
  };
  if (root.style.position !== next.position) root.style.position = next.position;
  if (root.style.left !== next.left) root.style.left = next.left;
  if (root.style.right !== next.right) root.style.right = next.right;
  if (root.style.width !== next.width) root.style.width = next.width;
  if (root.style.top !== next.top) root.style.top = next.top;
  if (root.style.height !== next.height) root.style.height = next.height;
  return { keyboardOpen, height };
}
