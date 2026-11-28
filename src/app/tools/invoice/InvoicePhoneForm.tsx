"use client";

import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { formatMinor, taxRowCaption, type TotalsComputation } from "@/lib/invoice/calculations";
import {
  initialPhoneFormOpen,
  phoneSectionProgress,
  type PhoneFormOpen,
  type Thirds,
} from "@/lib/invoice/phoneSectionProgress";
import { CURRENCIES, invoiceTaxTypePatch, newInvoiceId, resolveTaxType, type InvoiceData, type InvoiceLineItem, type TaxType } from "@/lib/invoice/types";
import { StorageNotice } from "./InvoiceChrome";

function field(invalid = false) {
  return `min-h-11 w-full rounded-lg border bg-white px-3 py-2 text-base text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10 ${invalid ? "border-red-400" : "border-zinc-300"}`;
}

function arcPath(startDeg: number, endDeg: number): string {
  const polar = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: 12 + 9 * Math.cos(rad), y: 12 + 9 * Math.sin(rad) };
  };
  const start = polar(startDeg);
  const end = polar(endDeg);
  return `M ${start.x} ${start.y} A 9 9 0 0 1 ${end.x} ${end.y}`;
}

function SectionProgressIcon({ filled }: { filled: Thirds }) {
  const empty = "#86efac";
  const active = "#22c55e";
  if (filled === 3) {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill={active} />
        <path d="M7.5 12.5 10.5 15.5 16.5 9" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  const spans: Array<[number, number]> = [
    [4, 112],
    [124, 232],
    [244, 352],
  ];
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#fff" />
      {spans.map(([start, end], index) => (
        <path
          key={start}
          d={arcPath(start, end)}
          fill="none"
          stroke={index < filled ? active : empty}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

function Accordion({
  id,
  title,
  filled,
  open,
  onToggle,
  hint,
  children,
}: {
  id: string;
  title: string;
  filled: Thirds;
  open: boolean;
  onToggle: () => void;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4">
      <button
        type="button"
        className="flex min-h-11 w-full items-center gap-3 text-left"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`${title}, ${filled} of 3 complete`}
        onClick={onToggle}
      >
        <SectionProgressIcon filled={filled} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-zinc-900">{title}</span>
          {hint ? <span className="mt-0.5 block text-xs leading-snug text-zinc-600">{hint}</span> : null}
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-zinc-700 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      <div id={id} hidden={!open} className="mt-3">
        {children}
      </div>
    </section>
  );
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
  const progress = useMemo(() => phoneSectionProgress(invoice, totals), [invoice, totals]);
  const [open, setOpen] = useState<PhoneFormOpen>(() => initialPhoneFormOpen(invoice, totals));

  useEffect(() => {
    setOpen(initialPhoneFormOpen(invoice, totals));
    // Recompute chrome when switching invoices; do not reset on field edits.
  }, [invoice.id]);

  function toggle(key: Exclude<keyof PhoneFormOpen, "itemsOpen">) {
    setOpen((current) => ({ ...current, [key]: !current[key] }));
  }

  function toggleItem(id: string) {
    setOpen((current) => ({
      ...current,
      itemsOpen: { ...current.itemsOpen, [id]: !current.itemsOpen[id] },
    }));
  }

  function addItem() {
    const id = newInvoiceId();
    onUpdate({ lineItems: [...invoice.lineItems, { id, description: "", quantity: "1", unitPrice: "" }] });
    setOpen((current) => ({
      ...current,
      items: true,
      itemsOpen: { ...current.itemsOpen, [id]: true },
    }));
  }

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

      <Accordion id="invoice-section-details" title="Invoice details" filled={progress.details} open={open.details} onToggle={() => toggle("details")}>
        <div className="space-y-3">
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
        </div>
      </Accordion>

      <Accordion id="invoice-section-parties" title="From & Bill To" filled={progress.parties} open={open.parties} onToggle={() => toggle("parties")}>
        <div className="space-y-4">
          <PartyFields title="From" side="from" invoice={invoice} onChange={(from) => onUpdate({ from })} />
          <div className="border-t border-zinc-200 pt-4">
            <PartyFields title="Bill to" side="to" invoice={invoice} onChange={(to) => onUpdate({ to })} />
          </div>
        </div>
      </Accordion>

      <div className="border-t border-zinc-200 pt-1">
        <p className="px-1 pb-2 text-sm text-zinc-600">Add your items</p>
        <Accordion id="invoice-section-items" title="Items" filled={progress.items} open={open.items} onToggle={() => toggle("items")}>
          <div className="space-y-3">
            {invoice.lineItems.map((item, index) => {
              const line = totals.lines[index];
              const itemOpen = Boolean(open.itemsOpen[item.id]);
              const itemId = `invoice-item-${item.id}`;
              const collapsedTitle = item.description.trim() || `Item ${index + 1} — Enter item details`;
              return (
                <div key={item.id} className="rounded-xl border border-zinc-200 p-3">
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center gap-3 text-left"
                    aria-expanded={itemOpen}
                    aria-controls={itemId}
                    aria-label={`${collapsedTitle}, ${progress.itemCards[index] ?? 0} of 3 complete`}
                    onClick={() => toggleItem(item.id)}
                  >
                    <SectionProgressIcon filled={progress.itemCards[index] ?? 0} />
                    <span className="min-w-0 flex-1 text-sm font-semibold text-zinc-900">{collapsedTitle}</span>
                    <ChevronDown className={`h-5 w-5 shrink-0 text-zinc-700 ${itemOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                  <div id={itemId} hidden={!itemOpen} className="mt-3 space-y-2">
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
                </div>
              );
            })}
            <button type="button" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium" onClick={addItem}>
              <Plus className="h-4 w-4" aria-hidden />
              Add item
            </button>
          </div>
        </Accordion>
      </div>

      <Accordion id="invoice-section-tax" title="Tax & currency" filled={progress.tax} open={open.tax} onToggle={() => toggle("tax")}>
        <div className="space-y-3">
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
        </div>
      </Accordion>

      <section className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-4" aria-label="Totals">
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

      <Accordion
        id="invoice-more-options"
        title="More options"
        filled={progress.more}
        open={open.more}
        onToggle={() => toggle("more")}
        hint="Logo, colour, notes, payment & signature"
      >
        <div className="space-y-4">
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
      </Accordion>

      <p className="text-xs leading-relaxed text-zinc-500">
        No account. Saved in this browser on this device. This page does not decide which tax applies.
      </p>
      <button type="button" onClick={onDelete} className="self-start min-h-11 text-sm font-medium text-red-700">
        Delete this invoice
      </button>
    </div>
  );
}

function PartyFields({
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
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
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
    </div>
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
