/**
 * Public origin for absolute links in emails and server-side redirects.
 * Production must never use localhost unless NODE_ENV is not production.
 */

function isLocalHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h.endsWith(".localhost");
}

function assertNonLocalInProduction(url: string): void {
  if (process.env.NODE_ENV !== "production") return;
  try {
    const { hostname } = new URL(url);
    if (isLocalHostname(hostname)) {
      throw new Error("Public app URL cannot point to localhost in production.");
    }
  } catch (e) {
    if (e instanceof TypeError) {
      throw new Error("Invalid NEXT_PUBLIC_APP_URL (could not parse as URL).");
    }
    throw e;
  }
}

/**
 * @throws Error if production cannot resolve a non-local public origin
 */
export function getPublicAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    let normalized = explicit.replace(/\/+$/, "");
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = `https://${normalized.replace(/^\/+/, "")}`;
    }
    if (process.env.NODE_ENV === "production" && /^http:\/\//i.test(normalized)) {
      normalized = normalized.replace(/^http:/i, "https:");
    }
    assertNonLocalInProduction(normalized);
    return normalized;
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    if (host) {
      const out = `https://${host}`;
      assertNonLocalInProduction(out);
      return out;
    }
  }

  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3000";
  }

  throw new Error(
    "Missing public app URL: set NEXT_PUBLIC_APP_URL (e.g. https://studiosislab.com) in production."
  );
}
