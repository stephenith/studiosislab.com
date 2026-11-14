/**
 * E-sign GTM conversion gates.
 * Run: node -e "require('ts-node/register/transpile-only'); require('./src/lib/esignGtmEvents.verify.ts')"
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  ESIGN_COUNTERSIGN_SHARE_SUCCESS,
  ESIGN_PDF_DOWNLOAD_SUCCESS,
  commitEsignDataLayerEvent,
  deliverEsignDataLayerEvent,
  esignCountersignShareDataLayerEvent,
  esignPdfDownloadDataLayerEvent,
} from "./esignGtmEvents";

const viewer = fs.readFileSync(
  path.join(process.cwd(), "src/app/tools/esign/[documentId]/EsignViewerClient.tsx"),
  "utf8"
);

function sliceBetween(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from !== -1 && to !== -1, `missing markers ${start} … ${end}`);
  return source.slice(from, to);
}

const downloadHandler = sliceBetween(viewer, 'fetch("/api/esign/export"', "Download signed document");
const downloadClick = downloadHandler.indexOf("a.click()");
const downloadTrack = downloadHandler.indexOf("esignPdfDownloadDataLayerEvent");
const downloadFailure = downloadHandler.indexOf("if (!res.ok)");
assert.ok(downloadFailure !== -1 && downloadFailure < downloadClick);
assert.ok(downloadClick !== -1 && downloadClick < downloadTrack);
assert.equal(downloadHandler.includes("esign_pdf_download_success"), false);
assert.equal(downloadHandler.includes("clientEmail"), false);
assert.equal(downloadHandler.includes("token"), false);

const shareHandler = sliceBetween(viewer, 'fetch("/api/esign/invite"', "Share for countersign");
const shareFailure = shareHandler.indexOf("if (!res.ok || !json?.ok)");
const shareTrack = shareHandler.indexOf("esignCountersignShareDataLayerEvent");
const shareUrl = shareHandler.indexOf("json.url");
assert.ok(shareFailure !== -1 && shareFailure < shareTrack);
assert.ok(shareTrack !== -1 && shareTrack < shareUrl);
assert.equal(shareHandler.includes("clientEmail"), true);
assert.equal(shareHandler.slice(shareTrack).includes("clientEmail"), false);
assert.equal(shareHandler.slice(shareTrack).includes("json.url"), true);

const sent = esignPdfDownloadDataLayerEvent({ exportSucceeded: true, downloadInitiated: true });
assert.deepEqual(sent, {
  event: ESIGN_PDF_DOWNLOAD_SUCCESS,
  tool: "esign",
  format: "pdf",
});
assert.equal(
  esignPdfDownloadDataLayerEvent({ exportSucceeded: false, downloadInitiated: true }),
  null
);
assert.equal(
  esignPdfDownloadDataLayerEvent({ exportSucceeded: true, downloadInitiated: false }),
  null
);

const shared = esignCountersignShareDataLayerEvent({ inviteSucceeded: true });
assert.deepEqual(shared, {
  event: ESIGN_COUNTERSIGN_SHARE_SUCCESS,
  tool: "esign",
  action: "countersign_invite",
});
assert.equal(esignCountersignShareDataLayerEvent({ inviteSucceeded: false }), null);

const layer: unknown[] = [];
assert.equal(commitEsignDataLayerEvent(layer, sent), true);
assert.equal(commitEsignDataLayerEvent(layer, null), false);
assert.equal(layer.length, 1);
assert.deepEqual(layer[0], sent);
assert.equal(JSON.stringify(layer[0]).includes("@"), false);
assert.equal(JSON.stringify(layer[0]).includes("token"), false);

const devHost: { dataLayer?: unknown[] } = {};
deliverEsignDataLayerEvent(devHost, sent, "development");
assert.equal(devHost.dataLayer, undefined);

const failedHost: { dataLayer?: unknown[] } = {};
deliverEsignDataLayerEvent(
  failedHost,
  esignPdfDownloadDataLayerEvent({ exportSucceeded: false, downloadInitiated: false }),
  "production"
);
assert.equal(failedHost.dataLayer, undefined);

const prodHost: { dataLayer?: unknown[] } = { dataLayer: [] };
deliverEsignDataLayerEvent(prodHost, sent, "production");
deliverEsignDataLayerEvent(prodHost, shared, "production");
const pushed = prodHost.dataLayer;
assert.ok(pushed);
assert.equal(pushed.length, 2);
assert.deepEqual(pushed[0], sent);
assert.deepEqual(pushed[1], shared);
assert.equal(Object.prototype.hasOwnProperty.call(pushed[0], "event"), true);

console.log("esignGtmEvents.verify: pass");
