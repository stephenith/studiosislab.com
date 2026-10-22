import { computeInvoiceTotals, formatMinor, formatTaxPercent, parseDecimal } from "./calculations";
import { pdfTextErrors } from "./pdfText";
import {
  currencyMinorDigits,
  DEFAULT_ACCENT,
  type InvoiceData,
  type InvoiceLineItem,
} from "./types";
import { jsPDF } from "jspdf";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_BOTTOM = PAGE_H - 48;
const CONTENT_W = PAGE_W - MARGIN * 2;

export type PdfBuild =
  | { ok: true; bytes: Uint8Array; pageCount: number }
  | { ok: false; errors: string[] };

type Rgb = { r: number; g: number; b: number };

function accentRgb(hex: string): Rgb | null {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

function linesOf(doc: jsPDF, text: string, width: number): string[] {
  const value = text.trim() ? text : "";
  const raw = doc.splitTextToSize(value, width) as string | string[];
  if (Array.isArray(raw)) return raw.length ? raw : [""];
  return [raw];
}

export function buildInvoicePdf(data: InvoiceData): PdfBuild {
  const errors = [...pdfTextErrors(data)];
  const accent = accentRgb(data.accentColor);
  if (!accent) errors.push("Choose an accent colour as a #RRGGBB value.");
  if (currencyMinorDigits(data.currency) === null) errors.push("Choose a supported currency.");
  const totals = computeInvoiceTotals(data);
  if (!totals.ok || totals.totalMinor === null || totals.subtotalMinor === null || totals.taxMinor === null) {
    errors.push("Fix the highlighted amounts before downloading.");
  }
  if (!data.from.name.trim()) errors.push("Enter a business name before downloading.");
  if (!data.to.name.trim()) errors.push("Enter a client name before downloading.");
  const completeLines = data.lineItems.filter((item, index) => {
    const line = totals.lines[index];
    return line && !line.blank && item.description.trim() && line.amountMinor !== null;
  });
  if (!completeLines.length) errors.push("Add at least one described line with a quantity and price.");
  if (data.logoDataUrl && !/^data:image\/(png|jpeg);base64,[a-z0-9+/=\s]+$/i.test(data.logoDataUrl)) {
    errors.push("Use a PNG or JPEG logo.");
  }
  if (data.signatureDataUrl && !/^data:image\/(png|jpeg);base64,[a-z0-9+/=\s]+$/i.test(data.signatureDataUrl)) {
    errors.push("Use a PNG or JPEG signature.");
  }
  if (data.sealDataUrl && !/^data:image\/(png|jpeg);base64,[a-z0-9+/=\s]+$/i.test(data.sealDataUrl)) {
    errors.push("Use a PNG or JPEG seal.");
  }
  if (errors.length || !accent || !totals.ok || totals.totalMinor === null || totals.subtotalMinor === null || totals.taxMinor === null) {
    return { ok: false, errors };
  }

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4", compress: false });
  let y = MARGIN;
  let inTable = false;

  const paintChrome = () => {
    doc.setFillColor(accent.r, accent.g, accent.b);
    doc.rect(0, 0, PAGE_W, 8, "F");
  };

  const startPage = (continued: boolean) => {
    if (continued) doc.addPage();
    paintChrome();
    y = 28;
    if (continued) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(82, 82, 91);
      doc.text(`Invoice ${data.invoiceNumber || ""}`.trim(), MARGIN, y);
      y += 18;
      if (inTable) drawTableHeader();
    }
  };

  const ensure = (height: number) => {
    if (y + height <= CONTENT_BOTTOM) return;
    startPage(true);
  };

  const drawWrapped = (text: string, x: number, width: number, fontSize: number, color: Rgb, style: "normal" | "bold" = "normal") => {
    doc.setFont("helvetica", style);
    doc.setFontSize(fontSize);
    doc.setTextColor(color.r, color.g, color.b);
    const leading = fontSize + 3;
    for (const line of linesOf(doc, text, width)) {
      ensure(leading);
      doc.text(line, x, y);
      y += leading;
    }
  };

  const colDesc = CONTENT_W * 0.5;
  const colQty = CONTENT_W * 0.12;
  const colRate = CONTENT_W * 0.18;

  const drawTableHeader = () => {
    ensure(22);
    doc.setFillColor(244, 244, 245);
    doc.rect(MARGIN, y - 12, CONTENT_W, 20, "F");
    doc.setDrawColor(accent.r, accent.g, accent.b);
    doc.setLineWidth(1);
    doc.line(MARGIN, y + 8, PAGE_W - MARGIN, y + 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(82, 82, 91);
    doc.text("Description", MARGIN + 4, y);
    doc.text("Qty", MARGIN + colDesc + 4, y);
    doc.text("Rate", MARGIN + colDesc + colQty + 4, y);
    doc.text("Amount", PAGE_W - MARGIN - 4, y, { align: "right" });
    y += 18;
  };

  startPage(false);
  let logoBottom = 28;
  if (data.logoDataUrl) {
    try {
      const properties = doc.getImageProperties(data.logoDataUrl);
      const format = properties.fileType === "JPEG" || properties.fileType === "JPG" ? "JPEG" : "PNG";
      const previous = Math.min(140 / properties.width, 52 / properties.height, 1);
      const maxW = 256;
      const maxH = 112;
      const scale = Math.min(previous * 2, maxW / properties.width, maxH / properties.height);
      const width = properties.width * scale;
      const height = properties.height * scale;
      doc.addImage(data.logoDataUrl, format, MARGIN, 20, width, height);
      logoBottom = 20 + height;
    } catch {
      return { ok: false, errors: ["The logo could not be read. Upload a PNG or JPEG."] };
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(accent.r, accent.g, accent.b);
  doc.text("INVOICE", PAGE_W - MARGIN, 36, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(63, 63, 70);
  doc.text(data.invoiceNumber || "—", PAGE_W - MARGIN, 54, { align: "right" });
  doc.text(`Issued ${data.issueDate || "—"}`, PAGE_W - MARGIN, 68, { align: "right" });
  doc.text(`Due ${data.dueDate || "—"}`, PAGE_W - MARGIN, 82, { align: "right" });
  doc.text(data.currency, PAGE_W - MARGIN, 96, { align: "right" });

  y = Math.max(logoBottom + 18, 118);
  const columnGap = 24;
  const columnW = (CONTENT_W - columnGap) / 2;
  const leftX = MARGIN;
  const rightX = MARGIN + columnW + columnGap;
  const partyTop = y;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(113, 113, 122);
  doc.text("FROM", leftX, y);
  doc.text("BILL TO", rightX, y);
  y += 16;
  const fromStart = y;
  drawWrapped(data.from.name, leftX, columnW, 12, { r: 24, g: 24, b: 27 }, "bold");
  for (const line of [data.from.email, data.from.phone, data.from.address].filter(Boolean)) {
    drawWrapped(line, leftX, columnW, 10, { r: 63, g: 63, b: 70 });
  }
  const fromEnd = y;
  y = fromStart;
  drawWrapped(data.to.name, rightX, columnW, 12, { r: 24, g: 24, b: 27 }, "bold");
  for (const line of [data.to.email, data.to.phone, data.to.address].filter(Boolean)) {
    drawWrapped(line, rightX, columnW, 10, { r: 63, g: 63, b: 70 });
  }
  y = Math.max(fromEnd, y, partyTop + 36) + 18;

  inTable = true;
  drawTableHeader();
  data.lineItems.forEach((item, index) => {
    const line = totals.lines[index];
    if (!line || line.blank || line.amountMinor === null) return;
    drawItem(doc, item, formatMinor(line.amountMinor, data.currency), data.currency);
  });
  inTable = false;
  y += 8;

  const totalsHeight = 62;
  if (y + totalsHeight > CONTENT_BOTTOM) startPage(true);
  const labelX = PAGE_W - MARGIN - 180;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(82, 82, 91);
  doc.text("Subtotal", labelX, y);
  doc.text(formatMinor(totals.subtotalMinor, data.currency), PAGE_W - MARGIN, y, { align: "right" });
  y += 16;
  const taxParsed = parseDecimal(data.taxRate, 2);
  const taxPercent = taxParsed.ok ? formatTaxPercent(taxParsed.minor) : data.taxRate.trim();
  doc.text(`${data.taxLabel.trim()} (${taxPercent}%)`, labelX, y);
  doc.text(formatMinor(totals.taxMinor, data.currency), PAGE_W - MARGIN, y, { align: "right" });
  y += 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(accent.r, accent.g, accent.b);
  doc.text("Total", labelX, y);
  doc.text(formatMinor(totals.totalMinor, data.currency), PAGE_W - MARGIN, y, { align: "right" });
  y += 28;

  drawSection("Notes", data.notes);
  drawSection("Payment instructions", data.paymentInstructions);
  const markError = drawMarks();
  if (markError) return { ok: false, errors: [markError] };

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(161, 161, 170);
    doc.text(`${page} / ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 22, { align: "right" });
  }

  const bytes = new Uint8Array(doc.output("arraybuffer"));
  return { ok: true, bytes, pageCount };

  function drawItem(pdf: jsPDF, item: InvoiceLineItem, amount: string, currency: string) {
    const leading = 13;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    const description = linesOf(pdf, item.description, colDesc - 8);
    const rowHeight = Math.max(description.length, 1) * leading;
    if (y + rowHeight > CONTENT_BOTTOM) startPage(true);
    const rowTop = y;
    pdf.setTextColor(39, 39, 42);
    pdf.text(item.quantity.trim() || "0", MARGIN + colDesc + 4, rowTop);
    pdf.text(formatMinor(parsePrice(item.unitPrice, currency), currency), MARGIN + colDesc + colQty + 4, rowTop);
    pdf.text(amount, PAGE_W - MARGIN - 4, rowTop, { align: "right" });
    let continued = false;
    description.forEach((line, lineIndex) => {
      if (y + leading > CONTENT_BOTTOM && lineIndex > 0) {
        startPage(true);
        continued = true;
      }
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(39, 39, 42);
      pdf.text(line, MARGIN + 4, y);
      y += leading;
    });
    if (!continued) y = Math.max(y, rowTop + leading);
    pdf.setDrawColor(228, 228, 231);
    pdf.setLineWidth(0.4);
    pdf.line(MARGIN, y + 2, PAGE_W - MARGIN, y + 2);
    y += 10;
  }

  function drawSection(title: string, body: string) {
    if (!body.trim()) return;
    ensure(32);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(113, 113, 122);
    doc.text(title.toUpperCase(), MARGIN, y);
    y += 14;
    drawWrapped(body.trim(), MARGIN, CONTENT_W, 10, { r: 63, g: 63, b: 70 });
    y += 10;
  }

  function drawMarks(): string | null {
    const signature = data.signatureDataUrl;
    const seal = data.sealDataUrl;
    if (!signature && !seal) return null;
    const gap = 28;
    const both = Boolean(signature && seal);
    const columnW = both ? (CONTENT_W - gap) / 2 : Math.min(240, CONTENT_W);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const signatureCaption = signature && data.signatureCaption.trim() ? linesOf(doc, data.signatureCaption.trim(), columnW) : [];
    const sealCaption = seal && data.sealCaption.trim() ? linesOf(doc, data.sealCaption.trim(), columnW) : [];
    const signatureMark = signature ? readMark(signature, "signature", columnW) : null;
    const sealMark = seal ? readMark(seal, "seal", columnW) : null;
    if (typeof signatureMark === "string") return signatureMark;
    if (typeof sealMark === "string") return sealMark;
    const leading = 12;
    const columnHeight = (mark: { height: number } | null, caption: string[]) =>
      mark ? mark.height + (caption.length ? 8 + caption.length * leading : 0) : 0;
    const blockHeight = 12 + Math.max(columnHeight(signatureMark, signatureCaption), columnHeight(sealMark, sealCaption));
    if (y + blockHeight > CONTENT_BOTTOM) startPage(true);
    const top = y + 12;
    if (signatureMark) paintMark(signatureMark, signatureCaption, MARGIN, top);
    if (sealMark) paintMark(sealMark, sealCaption, both ? MARGIN + columnW + gap : MARGIN, top);
    y += blockHeight;
    return null;
  }

  function readMark(dataUrl: string, label: "signature" | "seal", maxW: number): { dataUrl: string; format: "PNG" | "JPEG"; width: number; height: number } | string {
    try {
      const properties = doc.getImageProperties(dataUrl);
      const format = properties.fileType === "JPEG" || properties.fileType === "JPG" ? "JPEG" : "PNG";
      const scale = Math.min(maxW / properties.width, 72 / properties.height, 1);
      return {
        dataUrl,
        format,
        width: properties.width * scale,
        height: properties.height * scale,
      };
    } catch {
      return `The ${label} could not be read. Upload a PNG or JPEG.`;
    }
  }

  function paintMark(
    mark: { dataUrl: string; format: "PNG" | "JPEG"; width: number; height: number },
    caption: string[],
    x: number,
    top: number,
  ) {
    doc.addImage(mark.dataUrl, mark.format, x, top, mark.width, mark.height);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(82, 82, 91);
    caption.forEach((line, index) => {
      doc.text(line, x, top + mark.height + 12 + index * 12);
    });
  }
}

function parsePrice(raw: string, currency: string): bigint {
  const digits = currencyMinorDigits(currency) ?? 2;
  const [whole, fraction = ""] = raw.trim().split(".");
  const padded = fraction.padEnd(digits, "0").slice(0, digits);
  return BigInt(whole || "0") * BigInt(10) ** BigInt(digits) + BigInt(padded || "0");
}

export function invoicePdfBlob(data: InvoiceData): { ok: true; blob: Blob; pageCount: number } | { ok: false; errors: string[] } {
  const built = buildInvoicePdf(data);
  if (!built.ok) return built;
  const copy = new Uint8Array(built.bytes.byteLength);
  copy.set(built.bytes);
  return { ok: true, blob: new Blob([copy], { type: "application/pdf" }), pageCount: built.pageCount };
}
