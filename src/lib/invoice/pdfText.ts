import type { InvoiceData } from "./types";

const WIN_ANSI_EXTRA = new Set<number>([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160,
  0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

export function isWinAnsiCharacter(code: number): boolean {
  if (code === 0x09 || code === 0x0a || code === 0x0d) return true;
  if (code >= 0x20 && code <= 0x7e) return true;
  if (code >= 0xa0 && code <= 0xff) return true;
  return WIN_ANSI_EXTRA.has(code);
}

export function unsupportedCharacters(text: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const character of text) {
    const code = character.codePointAt(0);
    if (code === undefined || isWinAnsiCharacter(code) || seen.has(character)) continue;
    seen.add(character);
    found.push(character);
  }
  return found;
}

export function pdfTextErrors(data: InvoiceData): string[] {
  const fields: Array<[string, string]> = [
    ["Business name", data.from.name],
    ["Business email", data.from.email],
    ["Business phone", data.from.phone],
    ["Business address", data.from.address],
    ["Client name", data.to.name],
    ["Client email", data.to.email],
    ["Client phone", data.to.phone],
    ["Client address", data.to.address],
    ["Invoice number", data.invoiceNumber],
    ["Tax label", data.taxLabel],
    ["Notes", data.notes],
    ["Payment instructions", data.paymentInstructions],
    ["Signature caption", data.signatureCaption],
    ["Seal caption", data.sealCaption],
    ...data.lineItems.map((item, index) => [`Item ${index + 1} description`, item.description] as [string, string]),
  ];
  return fields.flatMap(([label, value]) => {
    const characters = unsupportedCharacters(value);
    if (!characters.length) return [];
    return [`${label} contains characters the PDF font cannot draw: ${characters.join(" ")}`];
  });
}
