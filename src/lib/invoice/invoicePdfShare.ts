/**
 * Phone PDF share/download. Desktop invoice download stays on the editor's
 * existing <a download> path. A share-sheet cancel is not a download.
 * Tracking "initiated" is not proof the file was saved to the device.
 */

export const PDF_OBJECT_URL_TTL_MS = 2000;

export type InvoicePdfShareHost = {
  canShare?: (data?: { files?: File[] }) => boolean;
  share?: (data: { files: File[]; title?: string }) => Promise<void>;
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
  createAnchor: () => HTMLAnchorElement;
  appendAnchor: (anchor: HTMLAnchorElement) => void;
  removeAnchor: (anchor: HTMLAnchorElement) => void;
  delay: (ms: number, fn: () => void) => void;
};

export type InvoicePdfDelivery =
  | { method: "share"; initiated: true }
  | { method: "share"; initiated: false; cancelled: true }
  | { method: "download"; initiated: true };

export function isShareAbort(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String((error as { name?: string }).name) : "";
  return name === "AbortError";
}

export function canShareInvoicePdfFile(host: Pick<InvoicePdfShareHost, "canShare">, file: File): boolean {
  try {
    if (typeof host.canShare !== "function") return false;
    return host.canShare({ files: [file] }) === true;
  } catch {
    return false;
  }
}

export function triggerInvoicePdfDownload(
  blob: Blob,
  filename: string,
  host: InvoicePdfShareHost,
): void {
  const url = host.createObjectURL(blob);
  const anchor = host.createAnchor();
  anchor.href = url;
  anchor.download = filename;
  host.appendAnchor(anchor);
  anchor.click();
  host.removeAnchor(anchor);
  host.delay(PDF_OBJECT_URL_TTL_MS, () => {
    host.revokeObjectURL(url);
  });
}

export async function deliverInvoicePdf(input: {
  blob: Blob;
  filename: string;
  preferShare: boolean;
  host: InvoicePdfShareHost;
}): Promise<InvoicePdfDelivery> {
  const file = new File([input.blob], input.filename, { type: "application/pdf" });
  if (input.preferShare && input.host.share && canShareInvoicePdfFile(input.host, file)) {
    try {
      await input.host.share({ files: [file], title: input.filename });
      return { method: "share", initiated: true };
    } catch (error) {
      if (isShareAbort(error)) return { method: "share", initiated: false, cancelled: true };
    }
  }
  triggerInvoicePdfDownload(input.blob, input.filename, input.host);
  return { method: "download", initiated: true };
}

export function browserInvoicePdfShareHost(): InvoicePdfShareHost | null {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  const nav = window.navigator;
  return {
    canShare: typeof nav.canShare === "function" ? (data) => nav.canShare(data) : undefined,
    share: typeof nav.share === "function" ? (data) => nav.share(data) : undefined,
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
    createAnchor: () => document.createElement("a"),
    appendAnchor: (anchor) => {
      document.body.appendChild(anchor);
    },
    removeAnchor: (anchor) => {
      anchor.remove();
    },
    delay: (ms, fn) => {
      window.setTimeout(fn, ms);
    },
  };
}
