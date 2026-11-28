/**
 * Invoice tax types, split rounding, legacy load, preview/PDF captions.
 * Run: npx --yes tsx src/lib/invoice/invoiceTax.verify.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { computeInvoiceTotals, formatMinor, splitComponentRateMinors, taxRowCaption } from "./calculations";
import { readInvoice } from "./invoiceStore";
import { DEFAULT_TAX_LABEL, INVOICE_SCHEMA_VERSION, invoiceTaxTypePatch, type InvoiceData } from "./types";

function baseInvoice(over: Partial<InvoiceData> & Pick<InvoiceData, "taxLabel" | "taxRate">): InvoiceData {
  return {
    schemaVersion: INVOICE_SCHEMA_VERSION,
    id: "test-invoice",
    createdAt: "2026-11-28T00:00:00.000Z",
    updatedAt: "2026-11-28T00:00:00.000Z",
    from: { name: "Acme", email: "", address: "", phone: "" },
    to: { name: "Client", email: "", address: "", phone: "" },
    invoiceNumber: "INV-1",
    issueDate: "2026-11-28",
    dueDate: "2026-12-28",
    currency: "INR",
    accentColor: "#18181b",
    logoDataUrl: null,
    signatureDataUrl: null,
    signatureCaption: "Authorized Signature",
    sealDataUrl: null,
    sealCaption: "Company Seal",
    lineItems: [{ id: "line-1", description: "Work", quantity: "1", unitPrice: "1000.00" }],
    notes: "",
    paymentInstructions: "",
    ...over,
  };
}

const thousandEighteen = baseInvoice({ taxLabel: "Tax", taxRate: "18" });
const custom = computeInvoiceTotals(thousandEighteen);
assert.equal(custom.ok, true);
assert.equal(custom.taxRows.length, 1);
assert.equal(custom.taxRows[0]?.label, "Tax");
assert.equal(taxRowCaption(custom.taxRows[0]!), "Tax (18%)");
assert.equal(formatMinor(custom.taxMinor!, "INR"), "INR 180.00");
assert.equal(formatMinor(custom.totalMinor!, "INR"), "INR 1,180.00");

const gst = computeInvoiceTotals(baseInvoice({ taxType: "gst", taxLabel: "VAT", taxRate: "18" }));
assert.equal(gst.taxRows.length, 1);
assert.equal(gst.taxRows[0]?.label, "GST");
assert.equal(taxRowCaption(gst.taxRows[0]!), "GST (18%)");
assert.equal(formatMinor(gst.taxMinor!, "INR"), "INR 180.00");
assert.equal(gst.taxRows.some((row) => /CGST \+ SGST/.test(taxRowCaption(row))), false);

const split = computeInvoiceTotals(baseInvoice({ taxType: "cgst_sgst", taxLabel: "Tax", taxRate: "18" }));
assert.equal(split.taxRows.map((row) => row.label).join(","), "SGST,CGST");
assert.equal(taxRowCaption(split.taxRows[0]!), "SGST (9%)");
assert.equal(taxRowCaption(split.taxRows[1]!), "CGST (9%)");
assert.equal(formatMinor(split.taxRows[0]!.amountMinor, "INR"), "INR 90.00");
assert.equal(formatMinor(split.taxRows[1]!.amountMinor, "INR"), "INR 90.00");
assert.equal(formatMinor(split.totalMinor!, "INR"), "INR 1,180.00");
assert.equal(split.taxRows[0]!.amountMinor + split.taxRows[1]!.amountMinor, split.taxMinor);
assert.equal(split.taxRows.some((row) => row.label.includes("+")), false);

const halves = splitComponentRateMinors(BigInt(1751));
assert.equal(halves.sgstRateMinor + halves.cgstRateMinor, BigInt(1751));
assert.equal(halves.sgstRateMinor, BigInt(875));
assert.equal(halves.cgstRateMinor, BigInt(876));
const uneven = computeInvoiceTotals(baseInvoice({ taxType: "cgst_sgst", taxLabel: "Tax", taxRate: "17.51" }));
assert.equal(taxRowCaption(uneven.taxRows[0]!), "SGST (8.75%)");
assert.equal(taxRowCaption(uneven.taxRows[1]!), "CGST (8.76%)");
assert.equal(uneven.taxRows[0]!.amountMinor + uneven.taxRows[1]!.amountMinor, uneven.taxMinor);
const whole = computeInvoiceTotals(baseInvoice({ taxType: "custom", taxLabel: "Tax", taxRate: "17.51" }));
assert.equal(uneven.taxMinor, whole.taxMinor);
assert.equal(uneven.totalMinor, whole.totalMinor);

function legacyRecord(taxLabel: string) {
  return {
    schemaVersion: 1,
    id: "legacy-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    from: { name: "A", email: "", address: "", phone: "" },
    to: { name: "B", email: "", address: "", phone: "" },
    invoiceNumber: "INV-L",
    issueDate: "2026-01-01",
    dueDate: "2026-01-31",
    currency: "INR",
    taxLabel,
    taxRate: "18",
    accentColor: "#18181b",
    logoDataUrl: null,
    lineItems: [{ id: "l1", description: "Work", quantity: "1", unitPrice: "1000.00" }],
    notes: "",
    paymentInstructions: "",
  };
}

for (const label of ["Tax", "GST", "CGST + SGST"] as const) {
  const loaded = readInvoice(legacyRecord(label));
  assert.ok(loaded, `legacy ${label} must load`);
  assert.equal(loaded!.taxType, undefined);
  assert.equal(loaded!.taxLabel, label);
  assert.equal(loaded!.taxRate, "18");
  const totals = computeInvoiceTotals(loaded!);
  assert.equal(totals.taxRows.length, 1);
  assert.equal(totals.taxRows[0]?.label, label);
  assert.equal(taxRowCaption(totals.taxRows[0]!), `${label} (18%)`);
  assert.equal(formatMinor(totals.taxMinor!, "INR"), "INR 180.00");
}

const gstSaved = readInvoice({ ...legacyRecord("GST"), taxType: "gst" });
assert.equal(gstSaved?.taxType, "gst");
assert.equal(gstSaved?.taxLabel, "GST");
assert.equal(computeInvoiceTotals(gstSaved!).taxRows[0]?.label, "GST");

const vatLoaded = readInvoice(legacyRecord("VAT"));
assert.ok(vatLoaded);
assert.equal(vatLoaded!.taxType, undefined);
assert.equal(vatLoaded!.taxLabel, "VAT");
assert.equal(computeInvoiceTotals(vatLoaded!).taxRows[0]?.label, "VAT");
assert.deepEqual(invoiceTaxTypePatch("custom"), { taxType: "custom", taxLabel: DEFAULT_TAX_LABEL });
const afterExplicitTax = { ...vatLoaded!, ...invoiceTaxTypePatch("custom") };
assert.equal(afterExplicitTax.taxLabel, "Tax");
assert.equal(computeInvoiceTotals(afterExplicitTax).taxRows[0]?.label, "Tax");
assert.deepEqual(invoiceTaxTypePatch("gst"), { taxType: "gst" });
assert.equal({ ...vatLoaded!, ...invoiceTaxTypePatch("gst") }.taxLabel, "VAT");
assert.deepEqual(invoiceTaxTypePatch("cgst_sgst"), { taxType: "cgst_sgst" });

const emptyLabel = computeInvoiceTotals(baseInvoice({ taxLabel: "   ", taxRate: "18" }));
assert.equal(emptyLabel.ok, true);
assert.equal(emptyLabel.taxRows[0]?.label, "Tax");
assert.equal(taxRowCaption(emptyLabel.taxRows[0]!), "Tax (18%)");

const editor = fs.readFileSync(path.join(process.cwd(), "src/app/tools/invoice/InvoiceEditor.tsx"), "utf8");
assert.ok(editor.includes("totals.taxRows.map"));
assert.ok(editor.includes('option value="custom">Tax</option>'));
assert.ok(editor.includes('option value="gst">GST</option>'));
assert.ok(editor.includes('option value="cgst_sgst">CGST + SGST</option>'));
assert.ok(editor.includes("invoiceTaxTypePatch"));
assert.ok(editor.includes("sm:grid-cols-2"));
assert.ok(editor.includes("This page does not decide which tax applies"));
assert.equal(editor.includes("sm:grid-cols-4"), false);
assert.equal(editor.includes('id="tax-label"'), false);
assert.equal(editor.includes(">Custom<"), false);
assert.equal(editor.includes("SGST / CGST"), false);
const pdfSrc = fs.readFileSync(path.join(process.cwd(), "src/lib/invoice/generateInvoicePdf.ts"), "utf8");
assert.ok(pdfSrc.includes("for (const row of totals.taxRows)"));
assert.ok(pdfSrc.includes("taxRowCaption(row)"));

console.log("invoiceTax.verify: pass");
