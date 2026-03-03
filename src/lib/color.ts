export function toHexColor(
  value: string | undefined | null,
  fallback = "#000000"
): string {
  if (!value) return fallback;
  const v = String(value).trim();
  if (!v || v.toLowerCase() === "transparent") return fallback;

  const fullHex = /^#([0-9a-fA-F]{6})$/;
  const shortHex = /^#([0-9a-fA-F]{3})$/;
  const rgb = /^rgba?\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})(?:\s*,\s*([0-9.]+))?\s*\)$/i;

  if (fullHex.test(v)) return v.toLowerCase();
  const shortMatch = v.match(shortHex);
  if (shortMatch) {
    const [r, g, b] = shortMatch[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const rgbMatch = v.match(rgb);
  if (rgbMatch) {
    const r = Number(rgbMatch[1]);
    const g = Number(rgbMatch[2]);
    const b = Number(rgbMatch[3]);
    if ([r, g, b].every((n) => Number.isFinite(n) && n >= 0 && n <= 255)) {
      const toHex = (n: number) => n.toString(16).padStart(2, "0");
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toLowerCase();
    }
  }
  return fallback;
}
