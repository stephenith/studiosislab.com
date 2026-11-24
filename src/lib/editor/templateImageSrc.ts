/**
 * Catalog template image URL rewrites.
 * Iconify APIs use /{prefix}/{name}.svg; Fabric JSON stored colon-encoded paths that 404.
 */

const ICONIFY_COLON_PATH =
  /^https:\/\/api\.iconify\.design\/([^/:]+):([^/]+)\.svg(?:\?.*)?$/i;

export function rewriteTemplateImageSrc(src: string): string {
  const raw = String(src || "").trim();
  if (!raw) return raw;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  const match = decoded.match(ICONIFY_COLON_PATH);
  if (!match) return raw;
  const queryIndex = decoded.indexOf("?");
  const query = queryIndex >= 0 ? decoded.slice(queryIndex) : "";
  return `https://api.iconify.design/${match[1]}/${match[2]}.svg${query}`;
}
