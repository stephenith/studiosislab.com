/**
 * GTM custom event for a successful invoice PDF download.
 * One plain dataLayer object so a Custom Event trigger can match `event`.
 * The payload is fixed. It does not accept invoice numbers, names, or addresses.
 */

export const INVOICE_DOWNLOAD_SUCCESS = "invoice_download_success";

export type InvoiceDownloadEvent = {
  event: typeof INVOICE_DOWNLOAD_SUCCESS;
  tool: "invoice";
  format: "pdf";
};

type DataLayerHost = { dataLayer?: unknown[] };

function browserHost(): DataLayerHost | null {
  if (typeof globalThis === "undefined") return null;
  const host = globalThis as typeof globalThis & { window?: DataLayerHost };
  return host.window ?? null;
}

/** Null unless the PDF was built and the download click returned. */
export function invoiceDownloadDataLayerEvent(input: {
  pdfGenerated: boolean;
  downloadInitiated: boolean;
}): InvoiceDownloadEvent | null {
  if (!input.pdfGenerated || !input.downloadInitiated) return null;
  return { event: INVOICE_DOWNLOAD_SUCCESS, tool: "invoice", format: "pdf" };
}

/** Push one object. Returns false when there is nothing to send. */
export function commitInvoiceDataLayerEvent(
  target: unknown[],
  event: InvoiceDownloadEvent | null
): boolean {
  if (!event) return false;
  target.push(event);
  return true;
}

/**
 * Production-only. One dataLayer push. Never throws.
 * This does not mean the file was saved to the device.
 */
export function deliverInvoiceDataLayerEvent(
  host: DataLayerHost | null,
  event: InvoiceDownloadEvent | null,
  nodeEnv: string | undefined = process.env.NODE_ENV
): void {
  if (nodeEnv !== "production" || !event || !host) return;
  try {
    const layer = (host.dataLayer = host.dataLayer || []);
    commitInvoiceDataLayerEvent(layer, event);
  } catch {
    /* tracking must not break the download that already started */
  }
}

export function trackInvoiceDataLayerEvent(event: InvoiceDownloadEvent | null): void {
  deliverInvoiceDataLayerEvent(browserHost(), event);
}

/**
 * Run the download click, then record one event. A failed PDF never clicks.
 * A thrown click records nothing. A thrown recorder cannot reject the click.
 */
export function completeInvoiceDownloadTracking(
  pdfGenerated: boolean,
  click: () => void,
  deliver: (event: InvoiceDownloadEvent) => void
): void {
  if (!pdfGenerated) return;
  click();
  try {
    const event = invoiceDownloadDataLayerEvent({
      pdfGenerated: true,
      downloadInitiated: true,
    });
    if (event) deliver(event);
  } catch {
    /* tracking must not break the download that already started */
  }
}
