"use client";

import { ChevronDown, Ellipsis, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { formatMinor, taxRowCaption, type TotalsComputation } from "@/lib/invoice/calculations";
import { CURRENCIES, invoiceTaxTypePatch, newInvoiceId, resolveTaxType, type InvoiceData, type InvoiceLineItem, type TaxType } from "@/lib/invoice/types";
import { StorageNotice } from "./InvoiceChrome";

function field(invalid = false) {
  return `min-h-11 w-full rounded-lg border bg-white px-3 py-2 text-base text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10 ${invalid ? "border-red-400" : "border-zinc-300"}`;
}

export function InvoicePhoneForm({
  invoice,
  totals,
  status,
  openedLatest,
  pdfErrors,
  logoError,
  markError,
  conflict,
  migrationNote,
  onUpdate,
  onUpdateLine,
  onLogo,
  onMark,
  onKeepEdits,
  onLoadNewer,
  onDelete,
}: {
  invoice: InvoiceData;
  totals: TotalsComputation;
  status: string;
  openedLatest: boolean;
  pdfErrors: string[];
  logoError: string | null;
  markError: string | null;
  conflict: { current: InvoiceData | null } | null;
  migrationNote: string | null;
  onUpdate: (patch: Partial<InvoiceData>) => void;
  onUpdateLine: (id: string, patch: Partial<InvoiceLineItem>) => void;
  onLogo: (file: File | undefined) => void;
  onMark: (kind: "signature" | "seal", file: File | undefined) => void;
  onKeepEdits: () => void;
  onLoadNewer: () => void;
  onDelete: () => void;
}) {
  const taxType = resolveTaxType(invoice);
  const title = invoice.invoiceNumber.trim() || "Untitled invoice";
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {openedLatest ? "Current invoice" : "Invoice"}
        </p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{title}</h1>
        {openedLatest ? (
          <p className="mt-1 text-sm text-zinc-600">This is the invoice last saved in this browser. Use New invoice for a blank one.</p>
        ) : null}
      </div>
      <StorageNotice status={status} />
      {conflict ? (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p>
            {conflict.current
              ? "This invoice was saved in another tab. Your edits are still on this page and were not written over that copy."
              : "This invoice was removed in another tab. Your edits are still on this page."}
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <button type="button" onClick={onKeepEdits} className="min-h-11 rounded-full bg-zinc-900 px-3 text-sm font-medium text-white">
              Save my edits as a new invoice
            </button>
            {conflict.current ? (
              <button type="button" onClick={onLoadNewer} className="min-h-11 rounded-full border border-amber-300 bg-white px-3 text-sm font-medium">
                Load the newer invoice
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {migrationNote ? (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {migrationNote}
        </p>
      ) : null}
      {pdfErrors.length ? (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {pdfErrors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}

      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold">Invoice details</h2>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-zinc-700">Invoice number</span>
          <input id="phone-invoice-number" className={field()} maxLength={40} value={invoice.invoiceNumber} onChange={(event) => onUpdate({ invoiceNumber: event.target.value })} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-zinc-700">Issued</span>
          <input id="phone-issue-date" type="date" className={field()} value={invoice.issueDate} onChange={(event) => onUpdate({ issueDate: event.target.value })} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-zinc-700">Due</span>
          <input id="phone-due-date" type="date" className={field()} value={invoice.dueDate} onChange={(event) => onUpdate({ dueDate: event.target.value })} />
        </label>
      </section>

      <PartyCard title="From" side="from" invoice={invoice} onChange={(from) => onUpdate({ from })} />
      <PartyCard title="Bill to" side="to" invoice={invoice} onChange={(to) => onUpdate({ to })} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Line items</h2>
        {invoice.lineItems.map((item, index) => {
          const line = totals.lines[index];
          return (
            <div key={item.id} className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-4">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-zinc-700">Description</span>
                <input id={`phone-desc-${item.id}`} className={field()} maxLength={500} value={item.description} onChange={(event) => onUpdateLine(item.id, { description: event.target.value })} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-zinc-700">Qty</span>
                  <input id={`phone-qty-${item.id}`} inputMode="decimal" className={field(Boolean(line?.issues.quantity))} maxLength={24} value={item.quantity} onChange={(event) => onUpdateLine(item.id, { quantity: event.target.value })} />
                  {line?.issues.quantity ? <span className="mt-1 block text-xs text-red-700">{line.issues.quantity}</span> : null}
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-zinc-700">Rate</span>
                  <input id={`phone-rate-${item.id}`} inputMode="decimal" className={field(Boolean(line?.issues.unitPrice))} maxLength={24} value={item.unitPrice} onChange={(event) => onUpdateLine(item.id, { unitPrice: event.target.value })} />
                  {line?.issues.unitPrice ? <span className="mt-1 block text-xs text-red-700">{line.issues.unitPrice}</span> : null}
                </label>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  {line?.amountMinor !== null && line?.amountMinor !== undefined
                    ? formatMinor(line.amountMinor, invoice.currency)
                    : "—"}
                </p>
                <button
                  type="button"
                  className="min-h-11 rounded-full px-3 text-sm font-medium text-red-700 disabled:opacity-40"
                  disabled={invoice.lineItems.length <= 1}
                  onClick={() => onUpdate({ lineItems: invoice.lineItems.filter((entry) => entry.id !== item.id) })}
                >
                  <Trash2 className="mr-1 inline h-4 w-4" aria-hidden />
                  Remove
                </button>
              </div>
            </div>
          );
        })}
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium"
          onClick={() => onUpdate({ lineItems: [...invoice.lineItems, { id: newInvoiceId(), description: "", quantity: "1", unitPrice: "" }] })}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add item
        </button>
      </section>

      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold">Tax</h2>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-zinc-700">Currency</span>
          <select id="phone-currency" className={field()} value={invoice.currency} onChange={(event) => onUpdate({ currency: event.target.value })}>
            {CURRENCIES.map((item) => (
              <option key={item.code} value={item.code}>
                {item.code}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-zinc-700">Tax type</span>
          <select
            id="phone-tax-type"
            className={field()}
            value={taxType}
            onChange={(event) => onUpdate(invoiceTaxTypePatch(event.target.value as TaxType))}
          >
            <option value="custom">Tax</option>
            <option value="gst">GST</option>
            <option value="cgst_sgst">CGST + SGST</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-zinc-700">Tax rate (%)</span>
          <input id="phone-tax-rate" inputMode="decimal" className={field(Boolean(totals.taxRateMessage))} maxLength={16} value={invoice.taxRate} onChange={(event) => onUpdate({ taxRate: event.target.value })} />
          {totals.taxRateMessage ? <span className="mt-1 block text-xs text-red-700">{totals.taxRateMessage}</span> : null}
        </label>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt>Subtotal</dt>
            <dd>{totals.subtotalMinor === null ? "—" : formatMinor(totals.subtotalMinor, invoice.currency)}</dd>
          </div>
          {totals.taxRows.length ? (
            totals.taxRows.map((row) => (
              <div key={row.label} className="flex justify-between gap-3">
                <dt>{taxRowCaption(row)}</dt>
                <dd>{formatMinor(row.amountMinor, invoice.currency)}</dd>
              </div>
            ))
          ) : taxType === "cgst_sgst" ? (
            <>
              <div className="flex justify-between gap-3">
                <dt>SGST</dt>
                <dd>—</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>CGST</dt>
                <dd>—</dd>
              </div>
            </>
          ) : (
            <div className="flex justify-between gap-3">
              <dt>{taxType === "gst" ? "GST" : invoice.taxLabel.trim() || "Tax"}</dt>
              <dd>—</dd>
            </div>
          )}
          <div className="flex justify-between gap-3 border-t border-zinc-200 pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd>{totals.totalMinor === null ? "—" : formatMinor(totals.totalMinor, invoice.currency)}</dd>
          </div>
        </dl>
      </section>

      <details className="rounded-2xl border border-zinc-200 bg-white p-4" onToggle={(event) => setMoreOptionsOpen(event.currentTarget.open)}>
        <summary
          className="flex min-h-11 cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden"
          aria-expanded={moreOptionsOpen}
          aria-controls="invoice-more-options"
        >
          <Ellipsis className="h-5 w-5 shrink-0 text-zinc-700" aria-hidden="true" />
          <span className="min-w-0 flex-1 text-left">
            <span className="block text-sm font-semibold text-zinc-900">More options</span>
            <span className="mt-0.5 block text-xs leading-snug text-zinc-600">Logo, colour, notes, payment & signature</span>
          </span>
          <ChevronDown className={`h-5 w-5 shrink-0 text-zinc-700 transition-transform ${moreOptionsOpen ? "rotate-180" : ""}`} aria-hidden="true" />
        </summary>
        <div id="invoice-more-options" className="mt-3 space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-700">Accent colour</span>
            <input id="phone-accent-color" type="color" className="h-11 w-full cursor-pointer rounded-lg border border-zinc-300 bg-white" value={invoice.accentColor} onChange={(event) => onUpdate({ accentColor: event.target.value })} />
          </label>
          <div>
            {invoice.logoDataUrl ? (
              <img src={invoice.logoDataUrl} alt="Business logo" className="mb-3 block h-auto max-h-24 max-w-full object-contain object-left" />
            ) : null}
            <label className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-zinc-300 px-3 text-sm font-medium">
              {invoice.logoDataUrl ? "Replace logo" : "Add logo"}
              <input id="phone-logo" className="sr-only" type="file" accept="image/png,image/jpeg" onChange={(event) => onLogo(event.target.files?.[0])} />
            </label>
            {invoice.logoDataUrl ? (
              <button type="button" className="ml-2 min-h-11 text-sm font-medium text-zinc-600 underline" onClick={() => onUpdate({ logoDataUrl: null })}>
                Remove
              </button>
            ) : null}
            {logoError ? <p className="mt-2 text-sm text-red-700">{logoError}</p> : null}
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-700">Notes</span>
            <textarea id="phone-notes" rows={4} maxLength={4000} className={field()} value={invoice.notes} onChange={(event) => onUpdate({ notes: event.target.value })} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-700">Payment instructions</span>
            <textarea id="phone-payment-instructions" rows={4} maxLength={4000} className={field()} value={invoice.paymentInstructions} onChange={(event) => onUpdate({ paymentInstructions: event.target.value })} />
          </label>
          <p className="text-sm text-zinc-600">
            Optional signature and seal images. PNG or JPEG. These are pictures on the invoice, not a cryptographic or legal signature.
          </p>
          <MarkCard
            kind="signature"
            label="Signature"
            captionLabel="Signature caption"
            image={invoice.signatureDataUrl}
            caption={invoice.signatureCaption}
            onFile={(file) => onMark("signature", file)}
            onCaption={(signatureCaption) => onUpdate({ signatureCaption })}
            onRemove={() => onUpdate({ signatureDataUrl: null })}
          />
          <MarkCard
            kind="seal"
            label="Company seal"
            captionLabel="Seal caption"
            image={invoice.sealDataUrl}
            caption={invoice.sealCaption}
            onFile={(file) => onMark("seal", file)}
            onCaption={(sealCaption) => onUpdate({ sealCaption })}
            onRemove={() => onUpdate({ sealDataUrl: null })}
          />
          {markError ? <p className="text-sm text-red-700">{markError}</p> : null}
        </div>
      </details>

      <p className="text-xs leading-relaxed text-zinc-500">
        No account. Saved in this browser on this device. This page does not decide which tax applies.
      </p>
      <button type="button" onClick={onDelete} className="self-start min-h-11 text-sm font-medium text-red-700">
        Delete this invoice
      </button>
    </div>
  );
}

function PartyCard({
  title,
  side,
  invoice,
  onChange,
}: {
  title: string;
  side: "from" | "to";
  invoice: InvoiceData;
  onChange: (party: InvoiceData["from"]) => void;
}) {
  const party = invoice[side];
  function set(fieldName: keyof InvoiceData["from"], value: string) {
    onChange({ ...party, [fieldName]: value });
  }
  return (
    <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-zinc-700">Name</span>
        <input id={`phone-${side}-name`} className={field()} maxLength={160} value={party.name} onChange={(event) => set("name", event.target.value)} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-zinc-700">Email</span>
        <input id={`phone-${side}-email`} className={field()} maxLength={160} value={party.email} onChange={(event) => set("email", event.target.value)} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-zinc-700">Phone</span>
        <input id={`phone-${side}-phone`} className={field()} maxLength={40} value={party.phone} onChange={(event) => set("phone", event.target.value)} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-zinc-700">Address</span>
        <textarea id={`phone-${side}-address`} rows={3} maxLength={500} className={field()} value={party.address} onChange={(event) => set("address", event.target.value)} />
      </label>
    </section>
  );
}

function MarkCard({
  kind,
  label,
  captionLabel,
  image,
  caption,
  onFile,
  onCaption,
  onRemove,
}: {
  kind: "signature" | "seal";
  label: string;
  captionLabel: string;
  image: string | null;
  caption: string;
  onFile: (file: File | undefined) => void;
  onCaption: (value: string) => void;
  onRemove: () => void;
}) {
  return (
    <div>
      {image ? <img src={image} alt={label} className="mb-3 block h-auto max-h-24 max-w-full object-contain object-left" /> : null}
      <label className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-zinc-300 px-3 text-sm font-medium">
        {image ? `Replace ${label.toLowerCase()}` : `Add ${label.toLowerCase()}`}
        <input id={`phone-${kind}-file`} className="sr-only" type="file" accept="image/png,image/jpeg" onChange={(event) => onFile(event.target.files?.[0])} />
      </label>
      {image ? (
        <button type="button" className="ml-2 min-h-11 text-sm font-medium text-zinc-600 underline" onClick={onRemove}>
          Remove
        </button>
      ) : null}
      {image ? (
        <label className="mt-3 block text-sm">
          <span className="mb-1 block text-xs font-medium text-zinc-700">{captionLabel}</span>
          <input id={`phone-${kind}-caption`} className={field()} maxLength={80} value={caption} onChange={(event) => onCaption(event.target.value)} />
        </label>
      ) : null}
    </div>
  );
}
