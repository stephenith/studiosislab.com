"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { computeInvoiceTotals, formatMinor } from "@/lib/invoice/calculations";
import {
  createInvoice,
  deleteInvoice,
  duplicateInvoice,
  exportBackup,
  importBackup,
  listInvoices,
  migrateLegacyDraft,
  readBackup,
  saveInvoice,
  storeFailureMessage,
  type ImportResult,
} from "@/lib/invoice/invoiceStore";
import type { InvoiceData } from "@/lib/invoice/types";
import { InvoiceChrome, StorageNotice } from "./InvoiceChrome";

export default function InvoiceHistoryClient() {
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Checking this browser…");
  const [migrationNote, setMigrationNote] = useState<string | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);

  async function refresh(message?: string) {
    const rows = await listInvoices();
    setInvoices(rows);
    if (message) setStatus(message);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const migration = await migrateLegacyDraft();
        if (cancelled) return;
        if (migration === "invalid") {
          setMigrationNote("An older draft was found but could not be read. It was left in this browser.");
        }
        await refresh("Saved on this browser.");
      } catch (error) {
        if (!cancelled) setStatus(storeFailureMessage(error));
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return invoices;
    return invoices.filter((invoice) =>
      [invoice.invoiceNumber, invoice.from.name, invoice.to.name].join(" ").toLowerCase().includes(needle)
    );
  }, [invoices, query]);

  async function onExport() {
    try {
      const backup = await exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "studiosislab-invoice-backup.json";
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus("Saved on this browser.");
    } catch (error) {
      setStatus(storeFailureMessage(error));
    }
  }

  async function onImport(file: File | undefined) {
    if (!file) return;
    const raw = await file.text();
    const parsed = readBackup(raw);
    if (!parsed.ok) {
      setImportNote(parsed.errors[0] || "This backup could not be read.");
      return;
    }
    try {
      const result: ImportResult = await importBackup(parsed.backup, false);
      setImportNote(`Added ${result.added}. Skipped ${result.skipped} already on this browser.`);
      await refresh("Saved on this browser.");
    } catch (error) {
      setStatus(storeFailureMessage(error));
    }
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

  async function onDuplicate(invoice: InvoiceData) {
    try {
      const saved = await saveInvoice(duplicateInvoice(invoice), null);
      if (!saved.ok) {
        setStatus("That copy could not be saved.");
        return;
      }
      await refresh("Saved on this browser.");
    } catch (error) {
      setStatus(storeFailureMessage(error));
    }
  }

  async function onDelete(invoice: InvoiceData) {
    if (!window.confirm(`Delete invoice ${invoice.invoiceNumber || invoice.id} from this browser?`)) return;
    try {
      await deleteInvoice(invoice.id);
      await refresh("Saved on this browser.");
    } catch (error) {
      setStatus(storeFailureMessage(error));
    }
  }

  return (
    <InvoiceChrome showToolsLink={false}>
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">History</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600">Invoices saved on this device stay in this browser.</p>
      </div>
      <StorageNotice status={status} />
      {migrationNote ? (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {migrationNote}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="min-w-0 flex-1 text-sm">
          <span className="sr-only">Search invoices</span>
          <input
            id="invoice-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search invoices"
            className="min-h-11 w-full rounded-full border border-zinc-300 bg-white px-4 text-base"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void onExport()} className="min-h-11 rounded-full border border-zinc-300 bg-white px-4 text-sm font-medium">
            Export
          </button>
          <label className="min-h-11 cursor-pointer rounded-full border border-zinc-300 bg-white px-4 py-3 text-sm font-medium">
            Import
            <input className="sr-only" type="file" accept="application/json,.json" onChange={(event) => void onImport(event.target.files?.[0])} />
          </label>
          <button type="button" onClick={() => void startNew()} className="min-h-11 rounded-full bg-zinc-900 px-4 text-sm font-medium text-white">
            New invoice
          </button>
        </div>
      </div>
      {importNote ? (
        <p role="status" className="text-sm text-zinc-700">
          {importNote}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center">
          <p className="text-base font-medium text-zinc-900">No invoices found.</p>
          {invoices.length === 0 ? (
            <button type="button" onClick={() => void startNew()} className="mt-4 min-h-11 rounded-full bg-zinc-900 px-4 text-sm font-medium text-white">
              New invoice
            </button>
          ) : null}
        </div>
      ) : (
        <section className="space-y-3">
          {visible.map((invoice) => {
            const totals = computeInvoiceTotals(invoice);
            return (
              <article key={invoice.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold">{invoice.invoiceNumber || "Untitled invoice"}</h2>
                    <p className="truncate text-sm text-zinc-600">
                      {invoice.to.name || "No client"}
                      {invoice.from.name ? ` · ${invoice.from.name}` : ""} · {invoice.currency}
                    </p>
                    <p className="text-sm text-zinc-800">
                      {totals.ok && totals.totalMinor !== null ? formatMinor(totals.totalMinor, invoice.currency) : "Incomplete amounts"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/tools/invoice?id=${encodeURIComponent(invoice.id)}`} className="rounded-full border border-zinc-300 px-3 py-2 text-sm font-medium">
                      Open
                    </Link>
                    <button type="button" onClick={() => void onDuplicate(invoice)} className="rounded-full border border-zinc-300 px-3 py-2 text-sm font-medium">
                      Duplicate
                    </button>
                    <button type="button" onClick={() => void onDelete(invoice)} className="rounded-full border border-red-200 px-3 py-2 text-sm font-medium text-red-700">
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </InvoiceChrome>
  );
}
