/** Maximum PDF upload size for e-sign originals (bytes). */
export const MAX_ESIGN_PDF_BYTES = 50 * 1024 * 1024;

function isPdfFile(file: File): boolean {
  const lower = (file.name || "").toLowerCase();
  return lower.endsWith(".pdf") || file.type === "application/pdf";
}

export function validateEsignPdfFile(file: File): string | null {
  if (!isPdfFile(file)) {
    return "Only PDF files are currently supported for e-signing.";
  }
  if (file.size <= 0) {
    return "Selected file is empty.";
  }
  if (file.size > MAX_ESIGN_PDF_BYTES) {
    return "This PDF is too large. Please upload a PDF under 50 MB.";
  }
  return null;
}

export async function putPdfToSignedUrl(
  file: File,
  uploadUrl: string
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": "application/pdf" },
  });

  if (!res.ok) {
    throw new Error(
      `Storage upload failed (${res.status}). Please try again.`
    );
  }
}
