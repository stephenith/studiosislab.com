import { PDFDocument, PDFImage } from "pdf-lib";
import { SIGNATURE_UPLOAD_REJECTED_MESSAGE } from "./esignSignatureUpload";

export type SignaturePlacement = {
  page: number;
  xNorm: number;
  yNorm: number;
  wNorm: number;
  hNorm: number;
  imageDataUrl: string;
  locked?: boolean;
};

export type SignatureImageFailureReason =
  | "missing_signature_image"
  | "unsupported_signature_image"
  | "corrupt_signature_image";

const CLIENT_MESSAGES: Record<SignatureImageFailureReason, string> = {
  missing_signature_image: "Signature image data is missing",
  unsupported_signature_image: SIGNATURE_UPLOAD_REJECTED_MESSAGE,
  corrupt_signature_image: "Signature image could not be read",
};

export class EsignSignatureImageError extends Error {
  readonly reason: SignatureImageFailureReason;

  constructor(reason: SignatureImageFailureReason) {
    super(CLIENT_MESSAGES[reason]);
    this.name = "EsignSignatureImageError";
    this.reason = reason;
  }
}

export type SafeExportFailure = {
  reason: SignatureImageFailureReason | "export_failed";
  clientMessage: string;
};

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function isPng(bytes: Uint8Array): boolean {
  if (bytes.length < PNG_MAGIC.length) return false;
  return PNG_MAGIC.every((byte, index) => bytes[index] === byte);
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/** Decode a data-URL payload. Format is decided from the bytes, not the MIME label. */
export function signatureImageBytes(dataUrl: string): Uint8Array {
  if (typeof dataUrl !== "string") {
    throw new EsignSignatureImageError("missing_signature_image");
  }
  const comma = dataUrl.indexOf(",");
  if (comma < 0) {
    throw new EsignSignatureImageError("missing_signature_image");
  }
  const payload = dataUrl.slice(comma + 1).replace(/\s/g, "");
  if (!payload) {
    throw new EsignSignatureImageError("missing_signature_image");
  }
  const bytes = Buffer.from(payload, "base64");
  if (bytes.length === 0) {
    throw new EsignSignatureImageError("missing_signature_image");
  }
  return bytes;
}

export function detectSignatureImageFormat(bytes: Uint8Array): "png" | "jpeg" {
  if (isPng(bytes)) return "png";
  if (isJpeg(bytes)) return "jpeg";
  throw new EsignSignatureImageError("unsupported_signature_image");
}

export async function embedSignatureImage(
  pdfDoc: PDFDocument,
  dataUrl: string
): Promise<PDFImage> {
  const bytes = signatureImageBytes(dataUrl);
  const format = detectSignatureImageFormat(bytes);
  // Copy into a dedicated buffer. pdf-lib's JPEG parser reads the whole
  // underlying ArrayBuffer, and a Node Buffer may be a view into a larger pool.
  const imageBytes = new Uint8Array(bytes);
  try {
    if (format === "png") return await pdfDoc.embedPng(imageBytes);
    return await pdfDoc.embedJpg(imageBytes);
  } catch (error) {
    if (error instanceof EsignSignatureImageError) throw error;
    throw new EsignSignatureImageError("corrupt_signature_image");
  }
}

function normToPdf(
  pageWidthPts: number,
  pageHeightPts: number,
  xNorm: number,
  yNorm: number,
  wNorm: number,
  hNorm: number
) {
  const wPts = wNorm * pageWidthPts;
  const hPts = hNorm * pageHeightPts;
  const xPts = xNorm * pageWidthPts;
  const yPts = pageHeightPts - yNorm * pageHeightPts - hPts;
  return { x: xPts, y: yPts, width: wPts, height: hPts };
}

/**
 * Draw every placement. A missing, unsupported, or unreadable image throws
 * before the PDF is saved, so callers cannot return a partial document.
 */
export async function buildSignedPdf(
  originalBytes: Uint8Array,
  placements: SignaturePlacement[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalBytes);
  const numPages = pdfDoc.getPageCount();

  for (const placement of placements) {
    if (!placement || typeof placement.imageDataUrl !== "string" || placement.imageDataUrl.length === 0) {
      throw new EsignSignatureImageError("missing_signature_image");
    }

    const pageNumber = Math.max(1, Math.min(numPages, Number(placement.page) || 1));
    const page = pdfDoc.getPage(pageNumber - 1);
    const image = await embedSignatureImage(pdfDoc, placement.imageDataUrl);
    const { x, y, width, height } = normToPdf(
      page.getWidth(),
      page.getHeight(),
      Number(placement.xNorm ?? 0),
      Number(placement.yNorm ?? 0),
      Number(placement.wNorm ?? 0.2),
      Number(placement.hNorm ?? 0.08)
    );
    page.drawImage(image, { x, y, width, height });
  }

  return pdfDoc.save();
}

/** Client and log text for an export failure. Never forwards a raw thrown value. */
export function safeEsignExportFailure(error: unknown): SafeExportFailure {
  if (error instanceof EsignSignatureImageError) {
    return { reason: error.reason, clientMessage: error.message };
  }
  return {
    reason: "export_failed",
    clientMessage: "Failed to export signed PDF",
  };
}
