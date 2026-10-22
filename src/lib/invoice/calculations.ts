import { currencyMinorDigits, type InvoiceData, type InvoiceLineItem } from "./types";

export const QUANTITY_SCALE = 4;
const MAX_INTEGER_DIGITS = 12;

export type DecimalParse =
  | { ok: true; minor: bigint }
  | { ok: false; message: string };

export type LineComputation = {
  id: string;
  blank: boolean;
  issues: { quantity?: string; unitPrice?: string };
  amountMinor: bigint | null;
};

export type TotalsComputation = {
  lines: LineComputation[];
  taxRateMessage?: string;
  taxLabelMessage?: string;
  currencyMessage?: string;
  subtotalMinor: bigint | null;
  taxMinor: bigint | null;
  totalMinor: bigint | null;
  ok: boolean;
};

export function parseDecimal(raw: string, scale: number): DecimalParse {
  const text = raw.trim();
  if (!text) return { ok: false, message: "Enter a number." };
  if (text.includes("-")) return { ok: false, message: "Negative amounts are not allowed." };
  if (!/^\d+(\.\d+)?$/.test(text)) {
    return { ok: false, message: "Enter a plain decimal number." };
  }
  const [whole, fraction = ""] = text.split(".");
  if (whole.length > MAX_INTEGER_DIGITS) {
    return { ok: false, message: "That number is too large." };
  }
  if (fraction.length > scale) {
    return { ok: false, message: `Use at most ${scale} decimal places.` };
  }
  const padded = fraction.padEnd(scale, "0");
  const minor = BigInt(whole) * BigInt(10) ** BigInt(scale) + BigInt(padded || "0");
  return { ok: true, minor };
}

export function roundDivHalfUp(numerator: bigint, divisor: bigint): bigint {
  if (numerator < BigInt(0) || divisor <= BigInt(0)) {
    throw new Error("roundDivHalfUp expects non-negative values.");
  }
  return (numerator + divisor / BigInt(2)) / divisor;
}

export function formatMinor(minor: bigint, currency: string): string {
  const digits = currencyMinorDigits(currency) ?? 2;
  const sign = minor < BigInt(0) ? "-" : "";
  const absolute = minor < BigInt(0) ? -minor : minor;
  const scale = BigInt(10) ** BigInt(digits);
  const whole = absolute / scale;
  const fraction = (absolute % scale).toString().padStart(digits, "0");
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const amount = digits === 0 ? grouped : `${grouped}.${fraction}`;
  return `${sign}${currency} ${amount}`;
}

export function formatTaxPercent(minor: bigint): string {
  const whole = minor / BigInt(100);
  const fraction = (minor % BigInt(100)).toString().padStart(2, "0").replace(/0+$/, "");
  return fraction ? `${whole.toString()}.${fraction}` : whole.toString();
}

function isBlankLine(item: InvoiceLineItem): boolean {
  const quantity = item.quantity.trim();
  return item.description.trim() === "" && item.unitPrice.trim() === "" && (quantity === "" || quantity === "1");
}

export function lineAmountMinor(quantityMinor: bigint, priceMinor: bigint): bigint {
  return roundDivHalfUp(quantityMinor * priceMinor, BigInt(10) ** BigInt(QUANTITY_SCALE));
}

export function taxMinorFromSubtotal(subtotalMinor: bigint, taxRateMinor: bigint): bigint {
  return roundDivHalfUp(subtotalMinor * taxRateMinor, BigInt(10000));
}

export function computeInvoiceTotals(data: Pick<InvoiceData, "currency" | "taxLabel" | "taxRate" | "lineItems">): TotalsComputation {
  const digits = currencyMinorDigits(data.currency);
  const currencyMessage = digits === null ? "Choose a supported currency." : undefined;
  const taxLabel = data.taxLabel.trim();
  const taxLabelMessage = taxLabel ? undefined : "Enter a tax label.";
  const taxParsed = parseDecimal(data.taxRate, 2);
  let taxRateMessage: string | undefined;
  let taxRateMinor: bigint | null = null;
  if (!taxParsed.ok) taxRateMessage = taxParsed.message;
  else if (taxParsed.minor > BigInt(10000)) taxRateMessage = "Enter a tax rate from 0 to 100.";
  else taxRateMinor = taxParsed.minor;

  const lines: LineComputation[] = data.lineItems.map((item) => {
    if (isBlankLine(item)) {
      return { id: item.id, blank: true, issues: {}, amountMinor: null };
    }
    const issues: LineComputation["issues"] = {};
    const quantity = parseDecimal(item.quantity, QUANTITY_SCALE);
    const price = digits === null ? ({ ok: false, message: "Choose a supported currency." } as const) : parseDecimal(item.unitPrice, digits);
    if (!quantity.ok) issues.quantity = quantity.message;
    if (!price.ok) issues.unitPrice = price.message;
    const amountMinor = quantity.ok && price.ok ? lineAmountMinor(quantity.minor, price.minor) : null;
    return { id: item.id, blank: false, issues, amountMinor };
  });

  const included = lines.filter((line) => !line.blank);
  const lineProblems = included.some((line) => line.amountMinor === null);
  const blocked = Boolean(currencyMessage || taxLabelMessage || taxRateMessage || lineProblems);
  if (blocked || digits === null || taxRateMinor === null) {
    return {
      lines,
      currencyMessage,
      taxLabelMessage,
      taxRateMessage,
      subtotalMinor: null,
      taxMinor: null,
      totalMinor: null,
      ok: false,
    };
  }

  const subtotalMinor = included.reduce((sum, line) => sum + (line.amountMinor ?? BigInt(0)), BigInt(0));
  const taxMinor = taxMinorFromSubtotal(subtotalMinor, taxRateMinor);
  return {
    lines,
    subtotalMinor,
    taxMinor,
    totalMinor: subtotalMinor + taxMinor,
    ok: true,
  };
}
