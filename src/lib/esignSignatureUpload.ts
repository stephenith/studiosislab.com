export const SIGNATURE_UPLOAD_ACCEPT = "image/png,image/jpeg";

export const SIGNATURE_UPLOAD_REJECTED_MESSAGE =
  "Signature image must be a PNG or JPEG";

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
]);

/** Selection-time check. The server still rejects malformed bytes. */
export function isPngOrJpegSignatureFile(file: {
  type?: string;
  name?: string;
}): boolean {
  const type = (file.type || "").trim().toLowerCase();
  if (ALLOWED_TYPES.has(type)) return true;
  if (type) return false;
  const name = (file.name || "").trim().toLowerCase();
  return name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg");
}
