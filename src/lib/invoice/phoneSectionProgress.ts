import { computeInvoiceTotals, parseDecimal, QUANTITY_SCALE, type TotalsComputation } from "./calculations";
import { unsupportedCharacters } from "./pdfText";
import { currencyMinorDigits, isCurrencyCode, isTaxType, resolveTaxType, type InvoiceData, type InvoiceLineItem } from "./types";

export type Thirds = 0 | 1 | 2 | 3;

export type PhoneFormOpen = {
  details: boolean;
  parties: boolean;
  items: boolean;
  tax: boolean;
  more: boolean;
  itemsOpen: Record<string, boolean>;
};

function thirds(flags: boolean[]): Thirds {
  const n = flags.filter(Boolean).length;
  return (n > 3 ? 3 : n) as Thirds;
}

function namesPdfSafe(fromName: string, toName: string): boolean {
  return Boolean(fromName.trim() && toName.trim()) && unsupportedCharacters(fromName).length === 0 && unsupportedCharacters(toName).length === 0;
}

export function invoiceDetailsProgress(invoice: InvoiceData): Thirds {
  return thirds([Boolean(invoice.invoiceNumber.trim()), Boolean(invoice.issueDate.trim()), Boolean(invoice.dueDate.trim())]);
}

export function partiesProgress(invoice: InvoiceData): Thirds {
  const fromName = invoice.from.name.trim();
  const toName = invoice.to.name.trim();
  return thirds([Boolean(fromName), Boolean(toName), namesPdfSafe(invoice.from.name, invoice.to.name)]);
}

export function itemProgress(item: InvoiceLineItem, currency: string, lineBlank: boolean): Thirds {
  if (lineBlank) return 0;
  const digits = currencyMinorDigits(currency);
  const quantityOk = parseDecimal(item.quantity, QUANTITY_SCALE).ok;
  const priceOk = digits !== null && parseDecimal(item.unitPrice, digits).ok;
  return thirds([Boolean(item.description.trim()), quantityOk, priceOk]);
}

export function itemsSectionProgress(invoice: InvoiceData, totals: TotalsComputation): Thirds {
  const hasNonblank = totals.lines.some((line) => !line.blank);
  const hasValidAmount = totals.lines.some((line) => line.amountMinor !== null);
  const hasPdfComplete = invoice.lineItems.some((item, index) => {
    const line = totals.lines[index];
    return Boolean(line && !line.blank && item.description.trim() && line.amountMinor !== null);
  });
  const noBrokenNonblank = totals.lines.every((line) => line.blank || line.amountMinor !== null);
  return thirds([hasNonblank, hasValidAmount, hasPdfComplete && noBrokenNonblank]);
}

export function taxProgress(invoice: InvoiceData): Thirds {
  const taxParsed = parseDecimal(invoice.taxRate, 2);
  const taxRateOk = taxParsed.ok && taxParsed.minor <= BigInt(10000);
  return thirds([isCurrencyCode(invoice.currency), isTaxType(resolveTaxType(invoice)), taxRateOk]);
}

export function moreOptionsProgress(): Thirds {
  return 3;
}

export function phoneSectionProgress(invoice: InvoiceData, totals = computeInvoiceTotals(invoice)) {
  return {
    details: invoiceDetailsProgress(invoice),
    parties: partiesProgress(invoice),
    items: itemsSectionProgress(invoice, totals),
    itemCards: invoice.lineItems.map((item, index) => itemProgress(item, invoice.currency, Boolean(totals.lines[index]?.blank))),
    tax: taxProgress(invoice),
    more: moreOptionsProgress(),
  };
}

function looksLikeNewInvoice(invoice: InvoiceData, totals: TotalsComputation): boolean {
  return !invoice.from.name.trim() && !invoice.to.name.trim() && totals.lines.every((line) => line.blank);
}

function firstIncompleteItemId(invoice: InvoiceData, totals: TotalsComputation): string | null {
  for (let index = 0; index < invoice.lineItems.length; index += 1) {
    const item = invoice.lineItems[index];
    if (!item) continue;
    if (itemProgress(item, invoice.currency, Boolean(totals.lines[index]?.blank)) < 3) return item.id;
  }
  return invoice.lineItems[0]?.id ?? null;
}

export function initialPhoneFormOpen(invoice: InvoiceData, totals = computeInvoiceTotals(invoice)): PhoneFormOpen {
  const closed: PhoneFormOpen = {
    details: false,
    parties: false,
    items: false,
    tax: false,
    more: false,
    itemsOpen: Object.fromEntries(invoice.lineItems.map((item) => [item.id, false])),
  };
  if (looksLikeNewInvoice(invoice, totals)) {
    const first = invoice.lineItems[0]?.id;
    return {
      ...closed,
      parties: true,
      items: true,
      itemsOpen: first ? { ...closed.itemsOpen, [first]: true } : closed.itemsOpen,
    };
  }
  const progress = phoneSectionProgress(invoice, totals);
  const order = ["details", "parties", "items", "tax"] as const;
  const firstIncomplete = order.find((key) => progress[key] < 3);
  if (!firstIncomplete) return closed;
  const next = { ...closed, [firstIncomplete]: true };
  if (firstIncomplete === "items") {
    const id = firstIncompleteItemId(invoice, totals);
    if (id) next.itemsOpen = { ...closed.itemsOpen, [id]: true };
  }
  return next;
}
