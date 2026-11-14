/**
 * Invoice GTM conversion gates.
 * Run: node -e "require('ts-node').register({transpileOnly:true,compilerOptions:{module:'commonjs',moduleResolution:'node'}}); require('./src/lib/invoiceGtmEvents.verify.ts')"
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  INVOICE_DOWNLOAD_SUCCESS,
  commitInvoiceDataLayerEvent,
  completeInvoiceDownloadTracking,
  deliverInvoiceDataLayerEvent,
  invoiceDownloadDataLayerEvent,
} from "./invoiceGtmEvents";

const editor = fs.readFileSync(
  path.join(process.cwd(), "src/app/tools/invoice/InvoiceEditor.tsx"),
  "utf8"
);
const downloadStart = editor.indexOf("function download()");
const downloadEnd = editor.indexOf("const taxParsed", downloadStart);
assert.ok(downloadStart !== -1 && downloadEnd > downloadStart);
const downloadFn = editor.slice(downloadStart, downloadEnd);
assert.ok(downloadFn.indexOf("invoicePdfBlob(invoice)") < downloadFn.indexOf("if (!result.ok)"));
assert.ok(downloadFn.indexOf("if (!result.ok)") < downloadFn.indexOf("completeInvoiceDownloadTracking"));
assert.ok(downloadFn.indexOf("completeInvoiceDownloadTracking") < downloadFn.indexOf("anchor.click()"));
assert.equal(downloadFn.includes("invoice_download_success"), false);
assert.equal(downloadFn.includes("trackInvoiceDataLayerEvent"), true);
assert.equal(downloadFn.includes("invoice.invoiceNumber"), true);

const sent = invoiceDownloadDataLayerEvent({ pdfGenerated: true, downloadInitiated: true });
assert.deepEqual(sent, {
  event: INVOICE_DOWNLOAD_SUCCESS,
  tool: "invoice",
  format: "pdf",
});
assert.equal(invoiceDownloadDataLayerEvent({ pdfGenerated: false, downloadInitiated: true }), null);
assert.equal(invoiceDownloadDataLayerEvent({ pdfGenerated: true, downloadInitiated: false }), null);

const layer: unknown[] = [];
let clicks = 0;
completeInvoiceDownloadTracking(false, () => {
  clicks += 1;
}, () => {
  commitInvoiceDataLayerEvent(layer, sent);
});
assert.equal(clicks, 0);
assert.equal(layer.length, 0);

assert.throws(() =>
  completeInvoiceDownloadTracking(true, () => {
    throw new Error("download click failed");
  }, () => {
    commitInvoiceDataLayerEvent(layer, sent);
  })
);
assert.equal(layer.length, 0);

completeInvoiceDownloadTracking(true, () => {
  clicks += 1;
}, (event) => {
  commitInvoiceDataLayerEvent(layer, event);
});
assert.equal(clicks, 1);
assert.equal(layer.length, 1);
assert.deepEqual(layer[0], {
  event: "invoice_download_success",
  tool: "invoice",
  format: "pdf",
});
assert.equal(JSON.stringify(layer[0]).includes("invoiceNumber"), false);

const devHost: { dataLayer?: unknown[] } = {};
deliverInvoiceDataLayerEvent(devHost, sent, "development");
assert.equal(devHost.dataLayer, undefined);

const failedHost: { dataLayer?: unknown[] } = {};
deliverInvoiceDataLayerEvent(failedHost, null, "production");
assert.equal(failedHost.dataLayer, undefined);

const prodHost: { dataLayer?: unknown[] } = { dataLayer: [] };
deliverInvoiceDataLayerEvent(prodHost, sent, "production");
deliverInvoiceDataLayerEvent(prodHost, sent, "production");
const pushed = prodHost.dataLayer;
assert.ok(pushed);
assert.equal(pushed.length, 2);
assert.deepEqual(pushed[0], sent);
assert.deepEqual(pushed[1], sent);

console.log("invoiceGtmEvents.verify: pass");
