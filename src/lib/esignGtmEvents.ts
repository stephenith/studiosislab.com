/**
 * GTM custom events for two E-sign outcomes.
 * One plain dataLayer object per call so a Custom Event trigger can match `event`.
 * Payloads are fixed. They do not accept document text, emails, tokens, or URLs.
 */

export const ESIGN_PDF_DOWNLOAD_SUCCESS = "esign_pdf_download_success";
export const ESIGN_COUNTERSIGN_SHARE_SUCCESS = "esign_countersign_share_success";

export type EsignPdfDownloadEvent = {
  event: typeof ESIGN_PDF_DOWNLOAD_SUCCESS;
  tool: "esign";
  format: "pdf";
};

export type EsignCountersignShareEvent = {
  event: typeof ESIGN_COUNTERSIGN_SHARE_SUCCESS;
  tool: "esign";
  action: "countersign_invite";
};

export type EsignGtmEvent = EsignPdfDownloadEvent | EsignCountersignShareEvent;

type DataLayerHost = { dataLayer?: unknown[] };

function browserHost(): DataLayerHost | null {
  if (typeof globalThis === "undefined") return null;
  const host = globalThis as typeof globalThis & { window?: DataLayerHost };
  return host.window ?? null;
}

/** Null unless the export response succeeded and the download click ran. */
export function esignPdfDownloadDataLayerEvent(input: {
  exportSucceeded: boolean;
  downloadInitiated: boolean;
}): EsignPdfDownloadEvent | null {
  if (!input.exportSucceeded || !input.downloadInitiated) return null;
  return { event: ESIGN_PDF_DOWNLOAD_SUCCESS, tool: "esign", format: "pdf" };
}

/** Null unless the invite API reported success. */
export function esignCountersignShareDataLayerEvent(input: {
  inviteSucceeded: boolean;
}): EsignCountersignShareEvent | null {
  if (!input.inviteSucceeded) return null;
  return {
    event: ESIGN_COUNTERSIGN_SHARE_SUCCESS,
    tool: "esign",
    action: "countersign_invite",
  };
}

/** Push one object. Returns false when there is nothing to send. */
export function commitEsignDataLayerEvent(target: unknown[], event: EsignGtmEvent | null): boolean {
  if (!event) return false;
  target.push(event);
  return true;
}

/**
 * Production-only. One dataLayer push. Never throws, so a tracking failure
 * cannot change download or invite behavior. This does not mean the file was saved.
 */
export function deliverEsignDataLayerEvent(
  host: DataLayerHost | null,
  event: EsignGtmEvent | null,
  nodeEnv: string | undefined = process.env.NODE_ENV
): void {
  if (nodeEnv !== "production" || !event || !host) return;
  try {
    const layer = (host.dataLayer = host.dataLayer || []);
    commitEsignDataLayerEvent(layer, event);
  } catch {
    /* tracking must not break the download or invite that already succeeded */
  }
}

export function trackEsignDataLayerEvent(event: EsignGtmEvent | null): void {
  deliverEsignDataLayerEvent(browserHost(), event);
}
