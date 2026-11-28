"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Download, Eye, Plus } from "lucide-react";
import { formatMinor, taxRowCaption, type TotalsComputation } from "@/lib/invoice/calculations";
import {
  invoicePhoneViewportMatch,
  pinInvoiceShellToVisualViewport,
} from "@/lib/invoice/phoneLayout";
import { resolveTaxType, type InvoiceData } from "@/lib/invoice/types";
import { HOME_LOGOS_LIGHT } from "@/components/home/homeLogoAssets";

export function useInvoicePhoneLayout(): boolean {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const sync = () => setPhone(invoicePhoneViewportMatch());
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);
  return phone;
}

const dockBtn =
  "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[11px] font-medium leading-tight touch-manipulation";

export function InvoicePhoneShell({
  children,
  invoice,
  totals,
  previewOpen,
  onPreviewOpen,
  onPreviewClose,
  onNew,
  onDownload,
  currentLabel,
}: {
  children: ReactNode;
  invoice: InvoiceData;
  totals: TotalsComputation;
  previewOpen: boolean;
  onPreviewOpen: () => void;
  onPreviewClose: () => void;
  onNew: () => void;
  onDownload: () => void;
  currentLabel: string;
}) {
  const [shellEl, setShellEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!shellEl) return;
    const viewport = window.visualViewport;
    const sync = () => {
      pinInvoiceShellToVisualViewport(
        shellEl,
        viewport ? { height: viewport.height, offsetTop: viewport.offsetTop } : null,
        window.innerHeight,
      );
    };
    sync();
    viewport?.addEventListener("resize", sync);
    window.addEventListener("resize", sync);
    return () => {
      viewport?.removeEventListener("resize", sync);
      window.removeEventListener("resize", sync);
      shellEl.style.position = "";
      shellEl.style.left = "";
      shellEl.style.right = "";
      shellEl.style.width = "";
      shellEl.style.top = "";
      shellEl.style.height = "";
    };
  }, [shellEl]);

  return (
    <main
      ref={setShellEl}
      className="flex h-[100dvh] flex-col overflow-hidden bg-zinc-50 text-zinc-900"
    >
      <header
        className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200 bg-white px-3 py-2"
        style={{
          paddingTop: "max(0.5rem, env(safe-area-inset-top))",
          paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
          paddingRight: "max(0.75rem, env(safe-area-inset-right))",
        }}
      >
        <Link href="/" className="block min-w-0 shrink">
          <Image
            src={HOME_LOGOS_LIGHT.header}
            alt="StudiosisLab — home"
            width={180}
            height={33}
            className="h-8 w-auto object-contain object-left"
            priority
          />
        </Link>
        <nav className="flex shrink-0 items-center gap-1 text-sm">
          <Link href="/tools" className="rounded-full px-2 py-2 font-medium text-zinc-700">
            Tools
          </Link>
          <Link href="/tools/invoice/history" className="rounded-full bg-zinc-900 px-3 py-2 font-medium text-white">
            History
          </Link>
        </nav>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
        {children}
      </div>
      <nav
        className="grid shrink-0 grid-cols-3 gap-2 border-t border-zinc-200 bg-white px-3 pt-2"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        aria-label="Invoice actions"
      >
        <button type="button" onClick={onNew} className={`${dockBtn} border border-zinc-300 bg-white text-zinc-900`}>
          <Plus className="h-4 w-4" aria-hidden />
          New invoice
        </button>
        <button type="button" onClick={onPreviewOpen} className={`${dockBtn} border border-zinc-300 bg-white text-zinc-900`}>
          <Eye className="h-4 w-4" aria-hidden />
          Preview
        </button>
        <button type="button" onClick={onDownload} className={`${dockBtn} bg-zinc-900 text-white`}>
          <Download className="h-4 w-4" aria-hidden />
          Download PDF
        </button>
      </nav>
      {previewOpen ? (
        <InvoicePreviewSheet invoice={invoice} totals={totals} currentLabel={currentLabel} onClose={onPreviewClose} onDownload={onDownload} />
      ) : null}
    </main>
  );
}

function InvoicePreviewSheet({
  invoice,
  totals,
  currentLabel,
  onClose,
  onDownload,
}: {
  invoice: InvoiceData;
  totals: TotalsComputation;
  currentLabel: string;
  onClose: () => void;
  onDownload: () => void;
}) {
  const taxType = resolveTaxType(invoice);
  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-zinc-950/40">
      <div
        className="mt-auto flex max-h-[92%] min-h-0 flex-col rounded-t-2xl bg-white shadow-[0_-8px_24px_rgba(0,0,0,0.12)]"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        role="dialog"
        aria-labelledby="invoice-preview-title"
      >
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
          <div className="min-w-0">
            <h2 id="invoice-preview-title" className="font-heading text-lg font-semibold">
              Preview
            </h2>
            <p className="truncate text-sm text-zinc-600">{currentLabel}</p>
          </div>
          <button type="button" onClick={onClose} className="min-h-11 rounded-full px-3 text-sm font-medium text-zinc-700">
            Edit
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Invoice</p>
          <p className="mt-1 font-semibold">{invoice.invoiceNumber || "Untitled invoice"}</p>
          <p className="text-zinc-600">
            Issued {invoice.issueDate || "—"} · Due {invoice.dueDate || "—"} · {invoice.currency}
          </p>
          <div className="mt-4 grid gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">From</p>
              <p className="font-medium">{invoice.from.name || "—"}</p>
              {invoice.from.email ? <p>{invoice.from.email}</p> : null}
              {invoice.from.phone ? <p>{invoice.from.phone}</p> : null}
              {invoice.from.address ? <p className="whitespace-pre-wrap">{invoice.from.address}</p> : null}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Bill to</p>
              <p className="font-medium">{invoice.to.name || "—"}</p>
              {invoice.to.email ? <p>{invoice.to.email}</p> : null}
              {invoice.to.phone ? <p>{invoice.to.phone}</p> : null}
              {invoice.to.address ? <p className="whitespace-pre-wrap">{invoice.to.address}</p> : null}
            </div>
          </div>
          <ul className="mt-4 space-y-2">
            {invoice.lineItems.map((item, index) => {
              const line = totals.lines[index];
              if (line?.blank) return null;
              return (
                <li key={item.id} className="rounded-xl border border-zinc-200 px-3 py-2">
                  <p className="font-medium">{item.description || "Untitled item"}</p>
                  <p className="text-zinc-600">
                    {item.quantity || "0"} × {item.unitPrice || "—"}
                  </p>
                  <p className="text-right">
                    {line?.amountMinor !== null && line?.amountMinor !== undefined
                      ? formatMinor(line.amountMinor, invoice.currency)
                      : "—"}
                  </p>
                </li>
              );
            })}
          </ul>
          <dl className="mt-4 space-y-2">
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
        </div>
        <div className="flex gap-2 px-4 pt-2">
          <button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-full border border-zinc-300 text-sm font-medium">
            Edit
          </button>
          <button type="button" onClick={onDownload} className="min-h-11 flex-1 rounded-full bg-zinc-900 text-sm font-medium text-white">
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
