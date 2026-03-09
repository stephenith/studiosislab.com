/**
 * Server-side only. Resolves path to original PDF for a given esign documentId.
 * Used by /api/esign/download and /api/esign/export.
 */
import fs from "fs";
import path from "path";

const BASE_DIR = "storage/esign";

export function getOriginalPdfPath(documentId: string): string | null {
  const projectRoot = process.cwd();
  const baseDir = path.join(projectRoot, BASE_DIR);
  const pdfPath = path.join(baseDir, `${documentId}.pdf`);
  if (fs.existsSync(pdfPath)) return pdfPath;
  return null;
}

/** Returns PDF bytes or null if not found. Call from API route only. */
export function getOriginalPdfBytes(documentId: string): Buffer | null {
  const pdfPath = getOriginalPdfPath(documentId);
  if (!pdfPath) return null;
  return fs.readFileSync(pdfPath);
}
