type FontVariant = {
  weight: number;
  style: "normal" | "italic";
  fileUrl?: string;
};

const fontCache = new Map<string, boolean>();

export const ensureFontLoaded = async (
  family: string,
  variant: FontVariant
) => {
  if (typeof document === "undefined") return;

  const key = `${family}-${variant.weight}-${variant.style}`;
  if (fontCache.has(key)) return;

  try {
    if (variant.fileUrl) {
      const font = new FontFace(family, `url(${variant.fileUrl})`, {
        weight: String(variant.weight),
        style: variant.style,
      });
      await font.load();
      document.fonts.add(font);
    } else {
      await document.fonts.load(`${variant.weight} 16px "${family}"`);
    }

    fontCache.set(key, true);
  } catch {
    console.warn("Font load failed:", family, variant);
  }
};
