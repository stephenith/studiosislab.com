/**
 * Phone invoice accordion progress and initial open state.
 * Run: npx --yes tsx src/lib/invoice/phoneSectionProgress.verify.ts
 */
import assert from "node:assert/strict";
import { computeInvoiceTotals } from "./calculations";
import { createInvoice } from "./invoiceStore";
import {
  initialPhoneFormOpen,
  invoiceDetailsProgress,
  itemProgress,
  itemsSectionProgress,
  moreOptionsProgress,
  partiesProgress,
  phoneSectionProgress,
  taxProgress,
} from "./phoneSectionProgress";
import { INVOICE_SCHEMA_VERSION, type InvoiceData } from "./types";

function invoice(over: Partial<InvoiceData> = {}): InvoiceData {
  return {
    schemaVersion: INVOICE_SCHEMA_VERSION,
    id: "inv-a",
    createdAt: "2026-11-28T00:00:00.000Z",
    updatedAt: "2026-11-28T00:00:00.000Z",
    from: { name: "", email: "", address: "", phone: "" },
    to: { name: "", email: "", address: "", phone: "" },
    invoiceNumber: "",
    issueDate: "",
    dueDate: "",
    currency: "USD",
    taxLabel: "Tax",
    taxRate: "0",
    accentColor: "#18181b",
    logoDataUrl: null,
    signatureDataUrl: null,
    signatureCaption: "Authorized Signature",
    sealDataUrl: null,
    sealCaption: "Company Seal",
    lineItems: [{ id: "line-1", description: "", quantity: "1", unitPrice: "" }],
    notes: "Thank you for your business.",
    paymentInstructions: "",
    ...over,
  };
}

const empty = invoice();
assert.equal(invoiceDetailsProgress(empty), 0);
assert.equal(partiesProgress(empty), 0);
assert.equal(itemProgress(empty.lineItems[0]!, empty.currency, true), 0);
assert.equal(itemsSectionProgress(empty, computeInvoiceTotals(empty)), 0);
assert.equal(taxProgress(empty), 3);
assert.equal(moreOptionsProgress(), 3);

const created = createInvoice(null);
const createdTotals = computeInvoiceTotals(created);
assert.equal(invoiceDetailsProgress(created), 3);
assert.equal(partiesProgress(created), 0);
assert.equal(itemsSectionProgress(created, createdTotals), 0);
assert.equal(taxProgress(created), 3);
const createdOpen = initialPhoneFormOpen(created, createdTotals);
assert.equal(createdOpen.details, false);
assert.equal(createdOpen.parties, true);
assert.equal(createdOpen.items, true);
assert.equal(createdOpen.tax, false);
assert.equal(createdOpen.more, false);
assert.equal(createdOpen.itemsOpen[created.lineItems[0]!.id], true);

const detailsPartial = invoice({ invoiceNumber: "INV-1", issueDate: "2026-11-28" });
assert.equal(invoiceDetailsProgress(detailsPartial), 2);

const fromOnly = invoice({ from: { name: "Acme", email: "a@b.c", address: "1 Road", phone: "1" } });
assert.equal(partiesProgress(fromOnly), 1);
const bothNames = invoice({
  from: { name: "Acme", email: "", address: "", phone: "" },
  to: { name: "Client", email: "x@y.z", address: "Addr", phone: "9" },
});
assert.equal(partiesProgress(bothNames), 3);
const unsafeName = invoice({
  from: { name: "Acme", email: "", address: "", phone: "" },
  to: { name: "客户", email: "", address: "", phone: "" },
});
assert.equal(partiesProgress(unsafeName), 2);

const descOnly = invoice({ lineItems: [{ id: "line-1", description: "Design", quantity: "1", unitPrice: "" }] });
assert.equal(itemProgress(descOnly.lineItems[0]!, "USD", false), 2);
assert.equal(itemsSectionProgress(descOnly, computeInvoiceTotals(descOnly)), 1);

const completeLine = invoice({
  invoiceNumber: "INV-1",
  issueDate: "2026-11-28",
  dueDate: "2026-12-28",
  from: { name: "Acme", email: "", address: "", phone: "" },
  to: { name: "Client", email: "", address: "", phone: "" },
  lineItems: [{ id: "line-1", description: "Design", quantity: "1", unitPrice: "100.00" }],
  notes: "Optional notes",
  paymentInstructions: "Pay later",
  logoDataUrl: null,
});
const completeTotals = computeInvoiceTotals(completeLine);
assert.equal(itemProgress(completeLine.lineItems[0]!, "USD", false), 3);
assert.equal(itemsSectionProgress(completeLine, completeTotals), 3);
assert.equal(phoneSectionProgress(completeLine, completeTotals).more, 3);
const completeOpen = initialPhoneFormOpen(completeLine, completeTotals);
assert.equal(completeOpen.details, false);
assert.equal(completeOpen.parties, false);
assert.equal(completeOpen.items, false);
assert.equal(completeOpen.tax, false);
assert.equal(completeOpen.itemsOpen["line-1"], false);

const extraBad = invoice({
  from: { name: "Acme", email: "", address: "", phone: "" },
  to: { name: "Client", email: "", address: "", phone: "" },
  invoiceNumber: "INV-1",
  issueDate: "2026-11-28",
  dueDate: "2026-12-28",
  lineItems: [
    { id: "line-1", description: "Design", quantity: "1", unitPrice: "100.00" },
    { id: "line-2", description: "Broken", quantity: "abc", unitPrice: "10.00" },
  ],
});
const extraTotals = computeInvoiceTotals(extraBad);
assert.equal(itemsSectionProgress(extraBad, extraTotals), 2);
assert.equal(itemProgress(extraBad.lineItems[1]!, "USD", false), 2);
const extraOpen = initialPhoneFormOpen(extraBad, extraTotals);
assert.equal(extraOpen.items, true);
assert.equal(extraOpen.itemsOpen["line-2"], true);
assert.equal(extraOpen.itemsOpen["line-1"], false);

const gst = invoice({ taxType: "gst", taxRate: "18", currency: "INR" });
assert.equal(taxProgress(gst), 3);
const badRate = invoice({ taxRate: "101" });
assert.equal(taxProgress(badRate), 2);
const badCurrency = invoice({ currency: "XXX" });
assert.equal(taxProgress(badCurrency), 2);

const switched = { ...completeLine, id: "inv-b" };
const switchedOpen = initialPhoneFormOpen(switched, computeInvoiceTotals(switched));
assert.equal(switched.id, "inv-b");
assert.equal(switched.invoiceNumber, completeLine.invoiceNumber);
assert.equal(switchedOpen.details, false);
assert.deepEqual(switched.lineItems, completeLine.lineItems);

console.log("phoneSectionProgress.verify: pass");
