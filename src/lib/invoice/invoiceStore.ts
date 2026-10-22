import {
  BACKUP_SCHEMA,
  CURRENCIES,
  DEFAULT_ACCENT,
  DEFAULT_NOTES,
  DEFAULT_SEAL_CAPTION,
  DEFAULT_SIGNATURE_CAPTION,
  DEFAULT_TAX_LABEL,
  emptyParty,
  INVOICE_SCHEMA_VERSION,
  isCurrencyCode,
  LEGACY_DRAFT_STORAGE_KEY,
  LEGACY_INVOICE_ID,
  newInvoiceId,
  PROFILE_ID,
  type BusinessProfile,
  type InvoiceData,
  type InvoiceLineItem,
  type InvoiceParty,
} from "./types";

const DB_NAME = "studiosislab-invoice";
const DB_VERSION = 1;
const INVOICE_STORE = "invoices";
const PROFILE_STORE = "profile";
const META_STORE = "meta";
const LEGACY_META_ID = "legacy-draft";
const LOGO_PATTERN = /^data:image\/(png|jpeg);base64,[a-z0-9+/=\s]+$/i;
const LOGO_MAX = 350_000;

export class InvoiceStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvoiceStoreError";
  }
}

export type InvoiceBackup = {
  schema: typeof BACKUP_SCHEMA;
  exportedAt: string;
  profile: BusinessProfile | null;
  invoices: InvoiceData[];
};

export type BackupRead = { ok: true; backup: InvoiceBackup } | { ok: false; errors: string[] };

export type ImportResult = {
  added: number;
  skipped: number;
  profile: "replaced" | "unchanged";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactText(value: unknown, max: number): string | null {
  if (typeof value !== "string" || value.length > max) return null;
  return value;
}

function party(value: unknown): InvoiceParty | null {
  if (!isRecord(value)) return null;
  const name = exactText(value.name, 160);
  const email = exactText(value.email, 160);
  const address = exactText(value.address, 500);
  const phone = exactText(value.phone, 40);
  if (name === null || email === null || address === null || phone === null) return null;
  return { name, email, address, phone };
}

function lineItem(value: unknown): InvoiceLineItem | null {
  if (!isRecord(value)) return null;
  const id = exactText(value.id, 80);
  const description = exactText(value.description, 500);
  const quantity = exactText(value.quantity, 24);
  const unitPrice = exactText(value.unitPrice, 24);
  if (!id?.trim() || description === null || quantity === null || unitPrice === null) return null;
  return { id, description, quantity, unitPrice };
}

function logo(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string" || value.length > LOGO_MAX || !LOGO_PATTERN.test(value)) return undefined;
  return value;
}

function accent(value: unknown): string | null {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : null;
}

export function readInvoice(value: unknown): InvoiceData | null {
  if (!isRecord(value) || value.schemaVersion !== INVOICE_SCHEMA_VERSION) return null;
  const id = exactText(value.id, 80);
  const createdAt = exactText(value.createdAt, 40);
  const updatedAt = exactText(value.updatedAt, 40);
  const invoiceNumber = exactText(value.invoiceNumber, 40);
  const issueDate = exactText(value.issueDate, 10);
  const dueDate = exactText(value.dueDate, 10);
  const currency = exactText(value.currency, 3);
  const taxLabel = exactText(value.taxLabel, 40);
  const taxRate = exactText(value.taxRate, 16);
  const notes = exactText(value.notes, 4000);
  const paymentInstructions = exactText(value.paymentInstructions, 4000);
  const from = party(value.from);
  const to = party(value.to);
  const color = accent(value.accentColor);
  const image = logo(value.logoDataUrl);
  const signature = value.signatureDataUrl === undefined ? null : logo(value.signatureDataUrl);
  const seal = value.sealDataUrl === undefined ? null : logo(value.sealDataUrl);
  const signatureCaption = value.signatureCaption === undefined ? DEFAULT_SIGNATURE_CAPTION : exactText(value.signatureCaption, 80);
  const sealCaption = value.sealCaption === undefined ? DEFAULT_SEAL_CAPTION : exactText(value.sealCaption, 80);
  if (
    !id?.trim() ||
    !createdAt ||
    !updatedAt ||
    invoiceNumber === null ||
    issueDate === null ||
    dueDate === null ||
    !currency ||
    !isCurrencyCode(currency) ||
    taxLabel === null ||
    taxRate === null ||
    notes === null ||
    paymentInstructions === null ||
    !from ||
    !to ||
    !color ||
    image === undefined ||
    signature === undefined ||
    seal === undefined ||
    signatureCaption === null ||
    sealCaption === null ||
    !Array.isArray(value.lineItems) ||
    value.lineItems.length < 1 ||
    value.lineItems.length > 200
  ) {
    return null;
  }
  const lineItems: InvoiceLineItem[] = [];
  for (const item of value.lineItems) {
    const parsed = lineItem(item);
    if (!parsed) return null;
    lineItems.push(parsed);
  }
  return {
    schemaVersion: INVOICE_SCHEMA_VERSION,
    id,
    createdAt,
    updatedAt,
    from,
    to,
    invoiceNumber,
    issueDate,
    dueDate,
    currency,
    taxLabel,
    taxRate,
    accentColor: color,
    logoDataUrl: image,
    signatureDataUrl: signature,
    signatureCaption,
    sealDataUrl: seal,
    sealCaption,
    lineItems,
    notes,
    paymentInstructions,
  };
}

export function readProfile(value: unknown): BusinessProfile | null {
  if (!isRecord(value) || value.schemaVersion !== INVOICE_SCHEMA_VERSION || value.id !== PROFILE_ID) return null;
  const from = party(value.from);
  const currency = exactText(value.currency, 3);
  const taxLabel = exactText(value.taxLabel, 40);
  const color = accent(value.accentColor);
  const image = logo(value.logoDataUrl);
  const defaultNotes = exactText(value.defaultNotes, 4000);
  const defaultPaymentInstructions = exactText(value.defaultPaymentInstructions, 4000);
  if (!from || !currency || !isCurrencyCode(currency) || taxLabel === null || !color || image === undefined || defaultNotes === null || defaultPaymentInstructions === null) {
    return null;
  }
  return {
    schemaVersion: INVOICE_SCHEMA_VERSION,
    id: PROFILE_ID,
    from,
    currency,
    taxLabel,
    accentColor: color,
    logoDataUrl: image,
    defaultNotes,
    defaultPaymentInstructions,
  };
}

function legacyNumber(value: unknown, scale: number): string | null {
  if (typeof value === "string") return value.length <= 24 ? value : null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1_000_000_000) return null;
  const factor = 10 ** scale;
  const minor = Math.round(value * factor);
  const whole = Math.trunc(minor / factor);
  const fraction = String(Math.abs(minor % factor)).padStart(scale, "0");
  return scale === 0 ? String(whole) : `${whole}.${fraction}`;
}

export function invoiceFromLegacy(value: unknown, nowIso: string): InvoiceData | null {
  if (!isRecord(value) || !Array.isArray(value.lineItems) || value.lineItems.length < 1) return null;
  const from = isRecord(value.from) ? value.from : null;
  const to = isRecord(value.to) ? value.to : null;
  if (!from || !to) return null;
  const currency = typeof value.currency === "string" && isCurrencyCode(value.currency) ? value.currency : null;
  if (!currency) return null;
  const digits = CURRENCIES.find((item) => item.code === currency)?.minorDigits ?? 2;
  const lineItems: InvoiceLineItem[] = [];
  for (const item of value.lineItems) {
    if (!isRecord(item)) return null;
    const quantity = legacyNumber(item.quantity, 4);
    const unitPrice = legacyNumber(item.unitPrice, digits);
    const description = typeof item.description === "string" ? item.description.slice(0, 500) : null;
    const id = typeof item.id === "string" && item.id.trim() ? item.id.slice(0, 80) : null;
    if (!id || description === null || quantity === null || unitPrice === null) return null;
    lineItems.push({ id, description, quantity, unitPrice });
  }
  const taxRate = legacyNumber(value.taxRate, 2);
  if (taxRate === null) return null;
  const draft: InvoiceData = {
    schemaVersion: INVOICE_SCHEMA_VERSION,
    id: LEGACY_INVOICE_ID,
    createdAt: nowIso,
    updatedAt: nowIso,
    from: {
      name: typeof from.name === "string" ? from.name.slice(0, 160) : "",
      email: typeof from.email === "string" ? from.email.slice(0, 160) : "",
      address: typeof from.address === "string" ? from.address.slice(0, 500) : "",
      phone: typeof from.phone === "string" ? from.phone.slice(0, 40) : "",
    },
    to: {
      name: typeof to.name === "string" ? to.name.slice(0, 160) : "",
      email: typeof to.email === "string" ? to.email.slice(0, 160) : "",
      address: typeof to.address === "string" ? to.address.slice(0, 500) : "",
      phone: "",
    },
    invoiceNumber: typeof value.invoiceNumber === "string" ? value.invoiceNumber.slice(0, 40) : "",
    issueDate: typeof value.issueDate === "string" ? value.issueDate.slice(0, 10) : "",
    dueDate: typeof value.dueDate === "string" ? value.dueDate.slice(0, 10) : "",
    currency,
    taxLabel: DEFAULT_TAX_LABEL,
    taxRate,
    accentColor: DEFAULT_ACCENT,
    logoDataUrl: null,
    signatureDataUrl: null,
    signatureCaption: DEFAULT_SIGNATURE_CAPTION,
    sealDataUrl: null,
    sealCaption: DEFAULT_SEAL_CAPTION,
    lineItems,
    notes: typeof value.notes === "string" ? value.notes.slice(0, 4000) : "",
    paymentInstructions: "",
  };
  return readInvoice(draft);
}

export function profileFromInvoice(invoice: InvoiceData): BusinessProfile {
  return {
    schemaVersion: INVOICE_SCHEMA_VERSION,
    id: PROFILE_ID,
    from: { ...invoice.from },
    currency: invoice.currency,
    taxLabel: invoice.taxLabel,
    accentColor: invoice.accentColor,
    logoDataUrl: invoice.logoDataUrl,
    defaultNotes: invoice.notes,
    defaultPaymentInstructions: invoice.paymentInstructions,
  };
}

export function createInvoice(_profile: BusinessProfile | null, now = new Date()): InvoiceData {
  const today = localDate(now);
  const due = new Date(now);
  due.setDate(due.getDate() + 30);
  const stamp = today.replaceAll("-", "");
  return {
    schemaVersion: INVOICE_SCHEMA_VERSION,
    id: newInvoiceId(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    from: emptyParty(),
    to: emptyParty(),
    invoiceNumber: `INV-${stamp}-001`,
    issueDate: today,
    dueDate: localDate(due),
    currency: "USD",
    taxLabel: DEFAULT_TAX_LABEL,
    taxRate: "0",
    accentColor: DEFAULT_ACCENT,
    logoDataUrl: null,
    signatureDataUrl: null,
    signatureCaption: DEFAULT_SIGNATURE_CAPTION,
    sealDataUrl: null,
    sealCaption: DEFAULT_SEAL_CAPTION,
    lineItems: [{ id: newInvoiceId(), description: "", quantity: "1", unitPrice: "" }],
    notes: DEFAULT_NOTES,
    paymentInstructions: "",
  };
}

export function duplicateInvoice(invoice: InvoiceData, now = new Date()): InvoiceData {
  const copy = readInvoice(structuredClone(invoice));
  if (!copy) throw new InvoiceStoreError("This invoice could not be duplicated.");
  copy.id = newInvoiceId();
  copy.createdAt = now.toISOString();
  copy.updatedAt = now.toISOString();
  const suffix = "-copy";
  copy.invoiceNumber = `${copy.invoiceNumber.slice(0, 40 - suffix.length)}${suffix}`;
  copy.lineItems = copy.lineItems.map((item) => ({ ...item, id: newInvoiceId() }));
  return copy;
}

export function readBackup(raw: string): BackupRead {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, errors: ["That file is not valid JSON."] };
  }
  if (!isRecord(parsed)) return { ok: false, errors: ["The backup must be a JSON object."] };
  if (parsed.schema !== BACKUP_SCHEMA) {
    return { ok: false, errors: ["This backup version is not supported."] };
  }
  if (!Array.isArray(parsed.invoices)) return { ok: false, errors: ["The backup has no invoice list."] };
  if (parsed.invoices.length > 500) return { ok: false, errors: ["The backup has too many invoices."] };
  const errors: string[] = [];
  const invoices: InvoiceData[] = [];
  const seen = new Set<string>();
  parsed.invoices.forEach((item, index) => {
    const invoice = readInvoice(item);
    if (!invoice) {
      errors.push(`Invoice ${index + 1} is not a valid StudiosisLab invoice.`);
      return;
    }
    if (seen.has(invoice.id)) errors.push(`Invoice ${index + 1} repeats id ${invoice.id}.`);
    seen.add(invoice.id);
    invoices.push(invoice);
  });
  let profile: BusinessProfile | null = null;
  if (parsed.profile !== null && parsed.profile !== undefined) {
    profile = readProfile(parsed.profile);
    if (!profile) errors.push("The remembered business details in the backup are invalid.");
  }
  if (typeof parsed.exportedAt !== "string" || parsed.exportedAt.length > 40) {
    errors.push("The backup is missing its export time.");
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, backup: { schema: BACKUP_SCHEMA, exportedAt: parsed.exportedAt as string, profile, invoices } };
}

export function storeFailureMessage(error: unknown): string {
  if (error instanceof InvoiceStoreError) return error.message;
  const name = error instanceof DOMException ? error.name : "";
  if (name === "QuotaExceededError") {
    return "This browser is out of space for invoices. Remove an old invoice or a smaller logo and try again.";
  }
  if (name === "SecurityError" || name === "InvalidStateError") {
    return "This browser blocked invoice storage. Nothing new was saved.";
  }
  return "Could not save on this browser. This change was not stored.";
}

function localDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new InvoiceStoreError("Invoice storage failed."));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new InvoiceStoreError("Invoice storage failed."));
    tx.onabort = () => reject(tx.error || new InvoiceStoreError("Invoice storage was interrupted."));
  });
}

async function readStore<T>(storeName: string, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  const tx = db.transaction(storeName, "readonly");
  const done = transactionDone(tx);
  const result = await requestToPromise(run(tx.objectStore(storeName)));
  await done;
  return result;
}

async function writeStore(storeName: string, run: (store: IDBObjectStore) => void): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(storeName, "readwrite");
  const done = transactionDone(tx);
  run(tx.objectStore(storeName));
  await done;
}

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new InvoiceStoreError("This browser cannot store invoices."));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(INVOICE_STORE)) db.createObjectStore(INVOICE_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(PROFILE_STORE)) db.createObjectStore(PROFILE_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new InvoiceStoreError("This browser could not open invoice storage."));
  });
}

export async function listInvoices(): Promise<InvoiceData[]> {
  const rows = await readStore<unknown[]>(INVOICE_STORE, (store) => store.getAll());
  return rows.map(readInvoice).filter((item): item is InvoiceData => item !== null).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getInvoice(id: string): Promise<InvoiceData | null> {
  const row = await readStore<unknown>(INVOICE_STORE, (store) => store.get(id));
  return readInvoice(row);
}

export type InvoiceSaveResult =
  | { ok: true; invoice: InvoiceData }
  | { ok: false; reason: "conflict"; current: InvoiceData | null };

export async function saveInvoice(invoice: InvoiceData, baseUpdatedAt: string | null): Promise<InvoiceSaveResult> {
  const clean = readInvoice(invoice);
  if (!clean) throw new InvoiceStoreError("This invoice could not be saved because it is incomplete.");
  const db = await openDb();
  const tx = db.transaction(INVOICE_STORE, "readwrite");
  const store = tx.objectStore(INVOICE_STORE);
  const done = transactionDone(tx);
  let result: InvoiceSaveResult = { ok: false, reason: "conflict", current: null };
  const request = store.get(clean.id);
  request.onsuccess = () => {
    const current = readInvoice(request.result);
    const conflict = current ? current.updatedAt !== baseUpdatedAt : baseUpdatedAt !== null;
    if (conflict) {
      result = { ok: false, reason: "conflict", current };
      return;
    }
    store.put(clean);
    result = { ok: true, invoice: clean };
  };
  await done;
  return result;
}

export async function deleteInvoice(id: string): Promise<void> {
  await writeStore(INVOICE_STORE, (store) => {
    store.delete(id);
  });
}

export async function getProfile(): Promise<BusinessProfile | null> {
  const row = await readStore<unknown>(PROFILE_STORE, (store) => store.get(PROFILE_ID));
  return readProfile(row);
}

export async function saveProfile(profile: BusinessProfile): Promise<void> {
  const clean = readProfile(profile);
  if (!clean) throw new InvoiceStoreError("The remembered business details could not be saved.");
  await writeStore(PROFILE_STORE, (store) => {
    store.put(clean);
  });
}

export async function exportBackup(now = new Date()): Promise<InvoiceBackup> {
  const [invoices, profile] = await Promise.all([listInvoices(), getProfile()]);
  return { schema: BACKUP_SCHEMA, exportedAt: now.toISOString(), profile, invoices };
}

export async function importBackup(backup: InvoiceBackup, replaceProfile: boolean): Promise<ImportResult> {
  const existing = new Set((await listInvoices()).map((invoice) => invoice.id));
  let added = 0;
  let skipped = 0;
  for (const invoice of backup.invoices) {
    if (existing.has(invoice.id)) {
      skipped += 1;
      continue;
    }
    const saved = await saveInvoice(invoice, null);
    if (!saved.ok) {
      skipped += 1;
      continue;
    }
    added += 1;
  }
  if (replaceProfile && backup.profile) {
    await saveProfile(backup.profile);
    return { added, skipped, profile: "replaced" };
  }
  return { added, skipped, profile: "unchanged" };
}

export async function migrateLegacyDraft(now = new Date()): Promise<"absent" | "invalid" | "saved" | "already"> {
  const meta = await readStore<unknown>(META_STORE, (store) => store.get(LEGACY_META_ID));
  if (isRecord(meta) && meta.saved === true) {
    if (typeof localStorage !== "undefined" && localStorage.getItem(LEGACY_DRAFT_STORAGE_KEY)) {
      localStorage.removeItem(LEGACY_DRAFT_STORAGE_KEY);
    }
    return "already";
  }
  let raw: string | null = null;
  try {
    raw = typeof localStorage === "undefined" ? null : localStorage.getItem(LEGACY_DRAFT_STORAGE_KEY);
  } catch {
    return "invalid";
  }
  if (!raw) return "absent";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return "invalid";
  }
  const invoice = invoiceFromLegacy(parsed, now.toISOString());
  if (!invoice) return "invalid";
  if (await getInvoice(invoice.id)) {
    await writeStore(META_STORE, (store) => {
      store.put({ id: LEGACY_META_ID, saved: true, invoiceId: invoice.id });
    });
    if (typeof localStorage !== "undefined") localStorage.removeItem(LEGACY_DRAFT_STORAGE_KEY);
    return "already";
  }
  const saved = await saveInvoice(invoice, null);
  if (!saved.ok) return "invalid";
  if (!(await getProfile())) await saveProfile(profileFromInvoice(invoice));
  await writeStore(META_STORE, (store) => {
    store.put({ id: LEGACY_META_ID, saved: true, invoiceId: invoice.id });
  });
  localStorage.removeItem(LEGACY_DRAFT_STORAGE_KEY);
  return "saved";
}
