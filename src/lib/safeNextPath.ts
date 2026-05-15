/**
 * Validates `next` after login: same-origin relative paths only (no open redirects).
 */

export function isSafeInternalNextPath(path: string): boolean {
  const t = path.trim();
  if (!t.startsWith("/")) return false;
  if (t.startsWith("//")) return false;
  if (t.includes("://")) return false;
  if (t.includes("\\")) return false;
  const q = t.indexOf("?");
  const pathOnly = q === -1 ? t : t.slice(0, q);
  if (pathOnly.includes("//")) return false;
  if (pathOnly.includes("@")) return false;
  return true;
}

/** Client-only: current path for `next` query param. */
export function getLoginRedirectUrl(): string {
  if (typeof window === "undefined") return "/login";
  const path = `${window.location.pathname}${window.location.search}`;
  if (!isSafeInternalNextPath(path)) return "/login";
  return `/login?next=${encodeURIComponent(path)}`;
}
