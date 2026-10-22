"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import { computeInvoiceTotals, formatMinor, formatTaxPercent, parseDecimal } from "@/lib/invoice/calculations";
import { invoicePdfBlob } from "@/lib/invoice/generateInvoicePdf";
import { readLogoFile } from "@/lib/invoice/logo";
import {
  createInvoice,
  deleteInvoice,
  duplicateInvoice,
  getInvoice,
  listInvoices,
  migrateLegacyDraft,
  saveInvoice,
  storeFailureMessage,
  type InvoiceSaveResult,
} from "@/lib/invoice/invoiceStore";
import { CURRENCIES, newInvoiceId, type InvoiceData, type InvoiceLineItem } from "@/lib/invoice/types";
import { InvoiceChrome, StorageNotice } from "./InvoiceChrome";

function fieldClass(invalid = false) {
  return `min-h-11 w-full rounded-lg border bg-white px-3 py-2 text-base text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10 ${invalid ? "border-red-400" : "border-zinc-300"}`;
}

function paperField(invalid = false) {
  return `min-h-11 w-full rounded-md border bg-transparent px-2 py-1 text-base text-zinc-900 outline-none focus:bg-white focus:ring-2 focus:ring-zinc-900/10 ${invalid ? "border-red-400" : "border-transparent hover:border-zinc-200"}`;
}

export default function InvoiceEditor() {
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [status, setStatus] = useState("Checking this browser…");
  const [migrationNote, setMigrationNote] = useState<string | null>(null);
  const [pdfErrors, setPdfErrors] = useState<string[]>([]);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [markError, setMarkError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [conflict, setConflict] = useState<Extract<InvoiceSaveResult, { ok: false }> | null>(null);
  const baseUpdatedAtRef = useRef<string | null>(null);
  const conflictRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const migration = await migrateLegacyDraft();
        const params = new URLSearchParams(window.location.search);
        const requested = params.get("id");
        let next = requested ? await getInvoice(requested) : null;
        if (!requested) {
          next = (await listInvoices())[0] ?? null;
          if (!next) {
            next = createInvoice(null);
            const saved = await saveInvoice(next, null);
            if (!saved.ok) throw new Error("A new invoice could not be stored.");
            next = saved.invoice;
          }
          window.history.replaceState(null, "", `/tools/invoice?id=${encodeURIComponent(next.id)}`);
        }
        if (cancelled) return;
        baseUpdatedAtRef.current = next ? next.updatedAt : null;
        conflictRef.current = false;
        setConflict(null);
        setInvoice(next);
        if (migration === "invalid") {
          setMigrationNote("An older draft was found but could not be read. It was left in this browser.");
        }
        setStatus("Saved on this browser.");
        setReady(true);
      } catch (error) {
        if (!cancelled) setStatus(storeFailureMessage(error));
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const invoiceRef = useRef(invoice);
  const readyRef = useRef(ready);
  const saveChain = useRef(Promise.resolve());
  invoiceRef.current = invoice;
  readyRef.current = ready;

  useEffect(() => {
    if (!ready || !invoice || conflictRef.current) return;
    const snapshot = invoice;
    const handle = window.setTimeout(() => {
      enqueueSave(snapshot);
    }, 350);
    return () => window.clearTimeout(handle);
  }, [invoice, ready]);

  useEffect(() => {
    return () => {
      if (!readyRef.current || !invoiceRef.current) return;
      enqueueSave(invoiceRef.current);
    };
  }, []);

  function enqueueSave(snapshot: InvoiceData) {
    saveChain.current = saveChain.current
      .then(async () => {
        if (conflictRef.current) return;
        const saved = await saveInvoice({ ...snapshot, updatedAt: new Date().toISOString() }, baseUpdatedAtRef.current);
        if (!saved.ok) {
          conflictRef.current = true;
          setConflict(saved);
          if (invoiceRef.current?.id === snapshot.id) {
            setStatus(saved.current ? "This invoice was saved in another tab. Your edits are still on this page." : "This invoice was removed in another tab. Your edits are still on this page.");
          }
          return;
        }
        baseUpdatedAtRef.current = saved.invoice.updatedAt;
        if (invoiceRef.current?.id === snapshot.id) setStatus("Saved on this browser.");
      })
      .catch((error: unknown) => {
        if (invoiceRef.current?.id === snapshot.id) setStatus(storeFailureMessage(error));
      });
  }

  const totals = useMemo(() => (invoice ? computeInvoiceTotals(invoice) : null), [invoice]);

  function update(patch: Partial<InvoiceData>) {
    setInvoice((current) => (current ? { ...current, ...patch, updatedAt: new Date().toISOString() } : current));
  }

  function updateLine(id: string, patch: Partial<InvoiceLineItem>) {
    if (!invoice) return;
    update({
      lineItems: invoice.lineItems.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  }

  async function onLogo(file: File | undefined) {
    if (!file) return;
    const result = await readLogoFile(file);
    if (!result.ok) {
      setLogoError(result.error);
      return;
    }
    setLogoError(null);
    update({ logoDataUrl: result.dataUrl });
  }

  async function onMark(kind: "signature" | "seal", file: File | undefined) {
    if (!file) return;
    const result = await readLogoFile(file, kind);
    if (!result.ok) {
      setMarkError(result.error);
      return;
    }
    setMarkError(null);
    update(kind === "signature" ? { signatureDataUrl: result.dataUrl } : { sealDataUrl: result.dataUrl });
  }

  async function startNew() {
    try {
      const created = createInvoice(null);
      const saved = await saveInvoice(created, null);
      if (!saved.ok) {
        setStatus("A new invoice could not be stored.");
        return;
      }
      window.location.assign(`/tools/invoice?id=${encodeURIComponent(saved.invoice.id)}`);
    } catch (error) {
      setStatus(storeFailureMessage(error));
    }
  }

  async function keepEditsAsNewInvoice() {
    if (!invoice) return;
    try {
      const saved = await saveInvoice(duplicateInvoice(invoice), null);
      if (!saved.ok) {
        setStatus("Your edits could not be saved as a new invoice.");
        return;
      }
      baseUpdatedAtRef.current = saved.invoice.updatedAt;
      conflictRef.current = false;
      setConflict(null);
      setInvoice(saved.invoice);
      window.history.replaceState(null, "", `/tools/invoice?id=${encodeURIComponent(saved.invoice.id)}`);
      setStatus("Your edits were saved as a new invoice. The other copy was left unchanged.");
    } catch (error) {
      setStatus(storeFailureMessage(error));
    }
  }

  function loadNewerInvoice() {
    if (!conflict || !conflict.current) return;
    baseUpdatedAtRef.current = conflict.current.updatedAt;
    conflictRef.current = false;
    setInvoice(conflict.current);
    setConflict(null);
    setStatus("Loaded the newer invoice from this browser. The edits on this page were replaced by that copy.");
  }

  async function removeInvoice() {
    if (!invoice) return;
    if (!window.confirm("Delete this invoice from this browser?")) return;
    try {
      await deleteInvoice(invoice.id);
      window.location.assign("/tools/invoice/history");
    } catch (error) {
      setStatus(storeFailureMessage(error));
    }
  }

  function download() {
    if (!invoice || !totals) return;
    const result = invoicePdfBlob(invoice);
    if (!result.ok) {
      setPdfErrors(result.errors);
      return;
    }
    setPdfErrors([]);
    const url = URL.createObjectURL(result.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${invoice.invoiceNumber.replace(/[^A-Za-z0-9._-]+/g, "_") || "invoice"}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!invoice || !totals) {
    return (
      <InvoiceChrome>
        <StorageNotice status={status} />
        {migrationNote ? (
          <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {migrationNote}
          </p>
        ) : null}
      </InvoiceChrome>
    );
  }

  const taxParsed = parseDecimal(invoice.taxRate, 2);

  return (
    <InvoiceChrome>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Tools</p>
          <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">Invoice</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void startNew()} className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium">
            New invoice
          </button>
          <button type="button" onClick={download} className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
            <Download className="h-4 w-4" aria-hidden />
            Download PDF
          </button>
        </div>
      </div>
      <StorageNotice status={status} />
      {conflict ? (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p>
            {conflict.current
              ? "This invoice was saved in another tab. Your edits are still on this page and were not written over that copy."
              : "This invoice was removed in another tab. Your edits are still on this page."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void keepEditsAsNewInvoice()} className="rounded-full bg-zinc-900 px-3 py-2 text-sm font-medium text-white">
              Save my edits as a new invoice
            </button>
            {conflict.current ? (
              <button type="button" onClick={loadNewerInvoice} className="rounded-full border border-amber-300 bg-white px-3 py-2 text-sm font-medium">
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

      <div className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-4">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-zinc-700">Currency</span>
          <select id="currency" className={fieldClass()} value={invoice.currency} onChange={(event) => update({ currency: event.target.value })}>
            {CURRENCIES.map((item) => (
              <option key={item.code} value={item.code}>
                {item.code}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-zinc-700">Tax label</span>
          <input id="tax-label" className={fieldClass(Boolean(totals.taxLabelMessage))} maxLength={40} value={invoice.taxLabel} onChange={(event) => update({ taxLabel: event.target.value })} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-zinc-700">Tax rate (%)</span>
          <input id="tax-rate" inputMode="decimal" className={fieldClass(Boolean(totals.taxRateMessage))} maxLength={16} value={invoice.taxRate} onChange={(event) => update({ taxRate: event.target.value })} />
          {totals.taxRateMessage ? <span className="mt-1 block text-xs text-red-700">{totals.taxRateMessage}</span> : null}
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-zinc-700">Accent colour</span>
          <input id="accent-color" type="color" className="h-11 w-full cursor-pointer rounded-lg border border-zinc-300 bg-white" value={invoice.accentColor} onChange={(event) => update({ accentColor: event.target.value })} />
        </label>
      </div>

      <article className="overflow-hidden rounded-sm bg-white shadow-lg ring-1 ring-zinc-200" style={{ borderTop: `8px solid ${invoice.accentColor}` }}>
        <div className="grid gap-6 p-4 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 w-full sm:max-w-[58%]">
              {invoice.logoDataUrl ? (
                <img src={invoice.logoDataUrl} alt="Business logo" className="mb-3 block h-auto w-[min(100%,22.5rem)] max-w-full object-contain object-left" style={{ maxHeight: "8rem" }} />
              ) : null}
              <label className="inline-flex cursor-pointer rounded-full border border-zinc-300 px-3 py-2 text-sm font-medium">
                {invoice.logoDataUrl ? "Replace logo" : "Add logo"}
                <input id="logo" className="sr-only" type="file" accept="image/png,image/jpeg" onChange={(event) => void onLogo(event.target.files?.[0])} />
              </label>
              {invoice.logoDataUrl ? (
                <button type="button" className="ml-2 text-sm font-medium text-zinc-600 underline" onClick={() => update({ logoDataUrl: null })}>
                  Remove
                </button>
              ) : null}
              {logoError ? <p className="mt-2 text-sm text-red-700">{logoError}</p> : null}
            </div>
            <div className="sm:text-right">
              <h2 className="font-heading text-3xl font-semibold tracking-tight" style={{ color: invoice.accentColor }}>
                Invoice
              </h2>
              <label className="mt-3 block text-sm">
                <span className="text-xs font-medium text-zinc-500">Invoice number</span>
                <input id="invoice-number" className={paperField()} maxLength={40} value={invoice.invoiceNumber} onChange={(event) => update({ invoiceNumber: event.target.value })} />
              </label>
              <label className="mt-2 block text-sm">
                <span className="text-xs font-medium text-zinc-500">Issued</span>
                <input id="issue-date" type="date" className={paperField()} value={invoice.issueDate} onChange={(event) => update({ issueDate: event.target.value })} />
              </label>
              <label className="mt-2 block text-sm">
                <span className="text-xs font-medium text-zinc-500">Due</span>
                <input id="due-date" type="date" className={paperField()} value={invoice.dueDate} onChange={(event) => update({ dueDate: event.target.value })} />
              </label>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <PartyFields title="From" side="from" invoice={invoice} onChange={(party) => update({ from: party })} />
            <PartyFields title="Bill to" side="to" invoice={invoice} onChange={(party) => update({ to: party })} />
          </div>

          <div className="space-y-3">
            <div className="hidden grid-cols-[minmax(0,1.4fr)_6rem_8rem_6rem] gap-2 text-xs font-medium text-zinc-500 sm:grid">
              <span>Description</span>
              <span>Qty</span>
              <span>Rate</span>
              <span className="text-right">Amount</span>
            </div>
            {invoice.lineItems.map((item, index) => {
              const line = totals.lines[index];
              return (
                <div key={item.id} className="grid gap-2 border-b border-zinc-100 pb-3 sm:grid-cols-[minmax(0,1.4fr)_6rem_8rem_6rem] sm:items-start">
                  <label>
                    <span className="mb-1 block text-xs text-zinc-500 sm:sr-only">Description</span>
                    <input id={`desc-${item.id}`} className={paperField()} maxLength={500} value={item.description} onChange={(event) => updateLine(item.id, { description: event.target.value })} />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs text-zinc-500 sm:sr-only">Qty</span>
                    <input id={`qty-${item.id}`} inputMode="decimal" className={paperField(Boolean(line?.issues.quantity))} maxLength={24} value={item.quantity} onChange={(event) => updateLine(item.id, { quantity: event.target.value })} />
                    {line?.issues.quantity ? <span className="mt-1 block text-xs text-red-700">{line.issues.quantity}</span> : null}
                  </label>
                  <label>
                    <span className="mb-1 block text-xs text-zinc-500 sm:sr-only">Rate</span>
                    <input id={`rate-${item.id}`} inputMode="decimal" className={paperField(Boolean(line?.issues.unitPrice))} maxLength={24} value={item.unitPrice} onChange={(event) => updateLine(item.id, { unitPrice: event.target.value })} />
                    {line?.issues.unitPrice ? <span className="mt-1 block text-xs text-red-700">{line.issues.unitPrice}</span> : null}
                  </label>
                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <span className="text-sm text-zinc-800">{line?.amountMinor !== null && line?.amountMinor !== undefined ? formatMinor(line.amountMinor, invoice.currency) : "—"}</span>
                    <button type="button" className="text-red-700 disabled:opacity-40" disabled={invoice.lineItems.length <= 1} onClick={() => update({ lineItems: invoice.lineItems.filter((entry) => entry.id !== item.id) })}>
                      <Trash2 className="h-4 w-4" aria-label={`Remove item ${index + 1}`} />
                    </button>
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              className="inline-flex items-center gap-1 text-sm font-medium"
              onClick={() => update({ lineItems: [...invoice.lineItems, { id: newInvoiceId(), description: "", quantity: "1", unitPrice: "" }] })}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add item
            </button>
          </div>

          <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_16rem]">
            <div className="space-y-4">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">Notes</span>
                <textarea id="notes" rows={4} maxLength={4000} className={paperField()} value={invoice.notes} onChange={(event) => update({ notes: event.target.value })} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">Payment instructions</span>
                <textarea id="payment-instructions" rows={4} maxLength={4000} className={paperField()} value={invoice.paymentInstructions} onChange={(event) => update({ paymentInstructions: event.target.value })} />
              </label>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt>Subtotal</dt>
                <dd>{totals.subtotalMinor === null ? "—" : formatMinor(totals.subtotalMinor, invoice.currency)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>
                  {invoice.taxLabel.trim() || "Tax"}
                  {taxParsed.ok ? ` (${formatTaxPercent(taxParsed.minor)}%)` : ""}
                </dt>
                <dd>{totals.taxMinor === null ? "—" : formatMinor(totals.taxMinor, invoice.currency)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-zinc-200 pt-2 text-base font-semibold" style={{ color: invoice.accentColor }}>
                <dt>Total</dt>
                <dd>{totals.totalMinor === null ? "—" : formatMinor(totals.totalMinor, invoice.currency)}</dd>
              </div>
            </dl>
          </div>
          <section className="border-t border-zinc-200 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Signature & seal</h3>
            <p className="mt-1 max-w-xl text-sm text-zinc-600">
              Optional images. PNG or JPEG. A PNG keeps a transparent background, which is the better choice for a signature. These are pictures on the invoice, not a cryptographic or legal signature.
            </p>
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              <MarkField
                kind="signature"
                label="Signature"
                captionLabel="Signature caption"
                image={invoice.signatureDataUrl}
                caption={invoice.signatureCaption}
                onFile={(file) => void onMark("signature", file)}
                onCaption={(signatureCaption) => update({ signatureCaption })}
                onRemove={() => update({ signatureDataUrl: null })}
              />
              <MarkField
                kind="seal"
                label="Company seal"
                captionLabel="Seal caption"
                image={invoice.sealDataUrl}
                caption={invoice.sealCaption}
                onFile={(file) => void onMark("seal", file)}
                onCaption={(sealCaption) => update({ sealCaption })}
                onRemove={() => update({ sealDataUrl: null })}
              />
            </div>
            {markError ? <p className="mt-2 text-sm text-red-700">{markError}</p> : null}
          </section>
        </div>
      </article>
      <button type="button" onClick={() => void removeInvoice()} className="self-start text-sm font-medium text-red-700">
        Delete this invoice
      </button>
    </InvoiceChrome>
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
  function set(field: keyof InvoiceData["from"], value: string) {
    onChange({ ...party, [field]: value });
  }
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</h3>
      <label className="mt-2 block">
        <span className="sr-only">{title} name</span>
        <input id={`${side}-name`} className={`${paperField()} font-semibold`} maxLength={160} placeholder="Name" value={party.name} onChange={(event) => set("name", event.target.value)} />
      </label>
      <label className="mt-1 block">
        <span className="sr-only">{title} email</span>
        <input id={`${side}-email`} className={paperField()} maxLength={160} placeholder="Email" value={party.email} onChange={(event) => set("email", event.target.value)} />
      </label>
      <label className="mt-1 block">
        <span className="sr-only">{title} phone</span>
        <input id={`${side}-phone`} className={paperField()} maxLength={40} placeholder="Phone" value={party.phone} onChange={(event) => set("phone", event.target.value)} />
      </label>
      <label className="mt-1 block">
        <span className="sr-only">{title} address</span>
        <textarea id={`${side}-address`} rows={3} maxLength={500} className={paperField()} placeholder="Address" value={party.address} onChange={(event) => set("address", event.target.value)} />
      </label>
    </section>
  );
}

function MarkField({
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
      <label className="inline-flex cursor-pointer rounded-full border border-zinc-300 px-3 py-2 text-sm font-medium">
        {image ? `Replace ${label.toLowerCase()}` : `Add ${label.toLowerCase()}`}
        <input id={`${kind}-file`} className="sr-only" type="file" accept="image/png,image/jpeg" onChange={(event) => onFile(event.target.files?.[0])} />
      </label>
      {image ? (
        <button type="button" className="ml-2 text-sm font-medium text-zinc-600 underline" onClick={onRemove}>
          Remove
        </button>
      ) : null}
      {image ? (
        <label className="mt-3 block text-sm">
          <span className="mb-1 block text-xs font-medium text-zinc-500">{captionLabel}</span>
          <input id={`${kind}-caption`} className={paperField()} maxLength={80} value={caption} onChange={(event) => onCaption(event.target.value)} />
        </label>
      ) : null}
    </div>
  );
}
