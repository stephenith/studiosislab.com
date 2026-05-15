/**
 * Client-side GA4 helpers. Never pass PII, document text, filenames, emails,
 * verification IDs, Firestore document IDs, or free-form user input as params.
 * Use coarse enums (surface, flow, outcome, format) and app-controlled paths only.
 */

export type AnalyticsEventName =
  | "dock_click"
  | "cta_click"
  | "sign_in_click"
  | "sign_in_success"
  | "template_open"
  | "resume_create_blank"
  | "export_attempt"
  | "export_success"
  | "esign_upload_start"
  | "esign_upload_success"
  | "verify_submit"
  | "verify_success"
  | "blog_article_click"
  | "blog_cta_click"
  | "contact_link_click";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const IS_PRODUCTION = process.env.NODE_ENV === "production";

function gtagReady(): boolean {
  return typeof window !== "undefined" && typeof window.gtag === "function";
}

/** Drop empty keys and trim oversized strings so events stay lightweight and safe. */
function sanitizeParams(
  params?: Record<string, string | number | boolean | undefined | null>
): Record<string, string | number | boolean> {
  if (!params) return {};
  const out: Record<string, string | number | boolean> = {};
  for (const [key, raw] of Object.entries(params)) {
    if (raw === undefined || raw === null) continue;
    if (typeof raw === "string") {
      const t = raw.trim();
      if (!t || t.length > 200) continue;
      out[key] = t;
    } else {
      out[key] = raw;
    }
  }
  return out;
}

/**
 * Fire a GA4 recommended event / custom event. No-ops on server, in non-production,
 * or when gtag is blocked. Never throws.
 */
export function trackEvent(
  name: AnalyticsEventName,
  params?: Record<string, string | number | boolean | undefined | null>
): void {
  if (!IS_PRODUCTION || !gtagReady()) return;
  try {
    window.gtag!("event", name, sanitizeParams(params));
  } catch {
    /* intentional no-op: ad blockers, race with script load */
  }
}

/**
 * SPA soft navigation page_view (initial load is handled by gtag config in GoogleAnalytics).
 * Never throws.
 */
export function sendSpaPageView(pagePath: string): void {
  if (!IS_PRODUCTION || !gtagReady()) return;
  try {
    window.gtag!("event", "page_view", {
      page_path: pagePath.slice(0, 500),
      page_location:
        typeof window.location !== "undefined" ? window.location.href.slice(0, 2000) : undefined,
      page_title: typeof document !== "undefined" ? document.title.slice(0, 300) : undefined,
    });
  } catch {
    /* no-op */
  }
}

/** Coarse file size bucket for uploads — not identifying. */
export function uploadSizeBucket(byteLength: number): string {
  if (!Number.isFinite(byteLength) || byteLength < 0) return "unknown";
  if (byteLength < 100_000) return "lt_100kb";
  if (byteLength < 1_000_000) return "lt_1mb";
  if (byteLength < 5_000_000) return "lt_5mb";
  return "gte_5mb";
}
