/**
 * Phone PDF share and download fallback.
 * Run: npx --yes tsx src/lib/invoice/invoicePdfShare.verify.ts
 */
import assert from "node:assert/strict";
import {
  PDF_OBJECT_URL_TTL_MS,
  canShareInvoicePdfFile,
  deliverInvoicePdf,
  isShareAbort,
  type InvoicePdfShareHost,
} from "./invoicePdfShare";

function host(over: Partial<InvoicePdfShareHost> = {}): InvoicePdfShareHost & {
  clicks: number;
  revoked: string[];
  delays: number[];
  appended: number;
} {
  const created = {
    clicks: 0,
    revoked: [] as string[],
    delays: [] as number[],
    appended: 0,
    createObjectURL: () => "blob:invoice-test",
    revokeObjectURL: (url: string) => {
      created.revoked.push(url);
    },
    createAnchor: () =>
      ({
        href: "",
        download: "",
        click() {
          created.clicks += 1;
        },
      }) as HTMLAnchorElement,
    appendAnchor: () => {
      created.appended += 1;
    },
    removeAnchor: () => undefined,
    delay: (ms: number, fn: () => void) => {
      created.delays.push(ms);
      fn();
    },
    ...over,
  };
  return created;
}

assert.equal(isShareAbort({ name: "AbortError" }), true);
assert.equal(isShareAbort({ name: "NotAllowedError" }), false);

const file = new File([new Uint8Array([1, 2, 3])], "INV.pdf", { type: "application/pdf" });
assert.equal(canShareInvoicePdfFile({}, file), false);
assert.equal(canShareInvoicePdfFile({ canShare: () => true }, file), true);

async function run() {
  const cancelled = host({
    canShare: () => true,
    share: async () => {
      const error = new Error("Share canceled");
      error.name = "AbortError";
      throw error;
    },
  });
  const cancelResult = await deliverInvoicePdf({
    blob: new Blob([file], { type: "application/pdf" }),
    filename: "INV.pdf",
    preferShare: true,
    host: cancelled,
  });
  assert.deepEqual(cancelResult, { method: "share", initiated: false, cancelled: true });
  assert.equal(cancelled.clicks, 0);
  assert.equal(cancelled.appended, 0);

  const shared = host({
    canShare: () => true,
    share: async () => undefined,
  });
  const shareResult = await deliverInvoicePdf({
    blob: new Blob([file], { type: "application/pdf" }),
    filename: "INV.pdf",
    preferShare: true,
    host: shared,
  });
  assert.deepEqual(shareResult, { method: "share", initiated: true });
  assert.equal(shared.clicks, 0);

  const fallback = host();
  const downloadResult = await deliverInvoicePdf({
    blob: new Blob([file], { type: "application/pdf" }),
    filename: "INV.pdf",
    preferShare: true,
    host: fallback,
  });
  assert.deepEqual(downloadResult, { method: "download", initiated: true });
  assert.equal(fallback.clicks, 1);
  assert.equal(fallback.appended, 1);
  assert.deepEqual(fallback.delays, [PDF_OBJECT_URL_TTL_MS]);
  assert.deepEqual(fallback.revoked, ["blob:invoice-test"]);

  const desktopLike = host();
  const desktopResult = await deliverInvoicePdf({
    blob: new Blob([file], { type: "application/pdf" }),
    filename: "INV.pdf",
    preferShare: false,
    host: desktopLike,
  });
  assert.equal(desktopResult.method, "download");
  assert.equal(desktopLike.clicks, 1);
}

void run().then(() => {
  console.log("invoicePdfShare.verify: pass");
});
