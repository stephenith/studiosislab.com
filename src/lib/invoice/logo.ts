const LOGO_MAX = 350_000;

export async function readLogoFile(file: File, kind: "logo" | "signature" | "seal" = "logo"): Promise<{ ok: true; dataUrl: string } | { ok: false; error: string }> {
  const type = file.type === "image/jpg" ? "image/jpeg" : file.type;
  const label = kind === "signature" ? "signature" : kind === "seal" ? "seal" : "logo";
  if (type !== "image/png" && type !== "image/jpeg") {
    return { ok: false, error: `Upload a PNG or JPEG ${label}.` };
  }
  if (file.size <= 0 || file.size > 8_000_000) {
    return { ok: false, error: `Choose a ${label} smaller than 8 MB.` };
  }
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return { ok: false, error: `That ${label} could not be read.` };
  const scale = Math.min(1, 480 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return { ok: false, error: `This browser could not resize the ${label}.` };
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const dataUrl = type === "image/png" ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.85);
  if (dataUrl.length > LOGO_MAX) {
    return { ok: false, error: `That ${label} is still too large after resizing.` };
  }
  return { ok: true, dataUrl };
}
