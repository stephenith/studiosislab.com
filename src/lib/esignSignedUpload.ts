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
  uploadUrl: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", "application/pdf");
    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable || event.total <= 0) return;
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(
        new Error(`Storage upload failed (${xhr.status}). Please try again.`)
      );
    };
    xhr.onerror = () => {
      reject(new Error("Storage upload failed. Please try again."));
    };
    xhr.send(file);
  });
}
