export const INVOICE_SCHEMA_VERSION = 1 as const;
export const BACKUP_SCHEMA = "studiosislab-invoice-backup-v1" as const;
export const LEGACY_DRAFT_STORAGE_KEY = "studiosislab-invoice-draft-v1";
export const LEGACY_INVOICE_ID = "legacy-draft-v1";
export const PROFILE_ID = "current";

export const CURRENCIES = [
  { code: "USD", minorDigits: 2 },
  { code: "INR", minorDigits: 2 },
  { code: "EUR", minorDigits: 2 },
  { code: "GBP", minorDigits: 2 },
  { code: "CAD", minorDigits: 2 },
  { code: "AUD", minorDigits: 2 },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

export const DEFAULT_ACCENT = "#18181b";
export const DEFAULT_TAX_LABEL = "Tax";
export const DEFAULT_NOTES = "Thank you for your business.";
export const DEFAULT_SIGNATURE_CAPTION = "Authorized Signature";
export const DEFAULT_SEAL_CAPTION = "Company Seal";

export type InvoiceParty = {
  name: string;
  email: string;
  address: string;
  phone: string;
};

export type InvoiceLineItem = {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

export type InvoiceData = {
  schemaVersion: typeof INVOICE_SCHEMA_VERSION;
  id: string;
  createdAt: string;
  updatedAt: string;
  from: InvoiceParty;
  to: InvoiceParty;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  taxLabel: string;
  taxRate: string;
  accentColor: string;
  logoDataUrl: string | null;
  signatureDataUrl: string | null;
  signatureCaption: string;
  sealDataUrl: string | null;
  sealCaption: string;
  lineItems: InvoiceLineItem[];
  notes: string;
  paymentInstructions: string;
};

export type BusinessProfile = {
  schemaVersion: typeof INVOICE_SCHEMA_VERSION;
  id: typeof PROFILE_ID;
  from: InvoiceParty;
  currency: string;
  taxLabel: string;
  accentColor: string;
  logoDataUrl: string | null;
  defaultNotes: string;
  defaultPaymentInstructions: string;
};

export function emptyParty(): InvoiceParty {
  return { name: "", email: "", address: "", phone: "" };
}

export function newInvoiceId(): string {
  return crypto.randomUUID();
}

export function currencyMinorDigits(code: string): number | null {
  const found = CURRENCIES.find((item) => item.code === code);
  return found ? found.minorDigits : null;
}

export function isCurrencyCode(code: string): code is CurrencyCode {
  return currencyMinorDigits(code) !== null;
}
