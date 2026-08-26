/**
 * Monotonic catalogue ID reservations — Agent #243.
 * Never gap-fills. Never writes live website files.
 */
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  openSync,
  closeSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { CatalogueReservation, ReservationStatus } from "./types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
export const EXPORT_ROOT = join(REPO, "SOS/07_LOGS/saios/export");
export const RESERVATIONS_PATH = join(
  EXPORT_ROOT,
  "catalogue-id-reservations.json",
);
const LOCK_PATH = join(EXPORT_ROOT, "reservations.lock");

type ReservationsDoc = {
  schema_version: 1;
  policy: "monotonic_highest_used_plus_one";
  reservations: CatalogueReservation[];
};

function atomicWriteJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

function withLock<T>(fn: () => T): T {
  mkdirSync(EXPORT_ROOT, { recursive: true });
  let fd: number | null = null;
  try {
    fd = openSync(LOCK_PATH, "wx");
    writeFileSync(LOCK_PATH, `${process.pid}\n${new Date().toISOString()}\n`);
  } catch {
    throw new Error(
      "Catalogue reservation lock held — another export allocation is in progress",
    );
  }
  try {
    return fn();
  } finally {
    if (fd != null) {
      try {
        closeSync(fd);
      } catch {
        /* ignore */
      }
    }
    try {
      unlinkSync(LOCK_PATH);
    } catch {
      /* ignore */
    }
  }
}

function loadDoc(): ReservationsDoc {
  if (!existsSync(RESERVATIONS_PATH)) {
    return {
      schema_version: 1,
      policy: "monotonic_highest_used_plus_one",
      reservations: [],
    };
  }
  return JSON.parse(readFileSync(RESERVATIONS_PATH, "utf8")) as ReservationsDoc;
}

function saveDoc(doc: ReservationsDoc): void {
  atomicWriteJson(RESERVATIONS_PATH, doc);
}

function parseTNum(id: string): number | null {
  const m = String(id).trim().toLowerCase().match(/^t(\d+)$/);
  if (!m) return null;
  return Number(m[1]);
}

function formatCatalogueId(n: number): string {
  return `t${String(n).padStart(3, "0")}`;
}

/** Highest live / package / reservation numeric ID (monotonic base). */
export function computeHighestUsedCatalogueNumber(): {
  highest_live: number;
  highest_package: number;
  highest_reservation: number;
  highest_used: number;
  next_id: string;
} {
  let highest_live = 0;
  const manifestPath = join(REPO, "templates.manifest.json");
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      templates?: Array<{ id?: string }>;
    };
    for (const t of manifest.templates ?? []) {
      const n = parseTNum(String(t.id ?? ""));
      if (n != null) highest_live = Math.max(highest_live, n);
    }
  }

  let highest_package = 0;
  const packagesDir = join(REPO, "SOS/07_LOGS/saios/publication/packages");
  if (existsSync(packagesDir)) {
    for (const name of readdirSync(packagesDir)) {
      const n = parseTNum(name);
      if (n != null) highest_package = Math.max(highest_package, n);
    }
  }

  let highest_reservation = 0;
  const doc = loadDoc();
  for (const r of doc.reservations) {
    // CANCELLED / FAILED / ROLLED_BACK still consume the number (no reuse)
    const n = parseTNum(r.reserved_catalogue_id);
    if (n != null) highest_reservation = Math.max(highest_reservation, n);
  }

  const highest_used = Math.max(
    highest_live,
    highest_package,
    highest_reservation,
  );
  return {
    highest_live,
    highest_package,
    highest_reservation,
    highest_used,
    next_id: formatCatalogueId(highest_used + 1),
  };
}

function reservationChecksum(input: {
  reservation_id: string;
  reserved_catalogue_id: string;
  generation_id: string;
  candidate_id: string;
  staging_package_id: string;
  status: ReservationStatus;
}): string {
  return createHash("sha256")
    .update(
      [
        input.reservation_id,
        input.reserved_catalogue_id,
        input.generation_id,
        input.candidate_id,
        input.staging_package_id,
        input.status,
      ].join("|"),
    )
    .digest("hex");
}

export function listReservations(): CatalogueReservation[] {
  return loadDoc().reservations;
}

export function findReservationByStaging(
  stagingPackageId: string,
): CatalogueReservation | null {
  const list = loadDoc().reservations.filter(
    (r) => r.staging_package_id === stagingPackageId,
  );
  if (list.length === 0) return null;
  // Prefer active / built
  const active = list.find((r) =>
    [
      "RESERVED",
      "EXPORT_BUILT",
      "ASSETS_READY",
      "READY_FOR_RELEASE",
      "RELEASE_REQUESTED",
      "FOUNDER_RELEASE_APPROVED",
      "RELEASE_EXECUTING",
      "RELEASE_COMPLETED",
      "COMMITTED",
    ].includes(r.status),
  );
  return active ?? list[list.length - 1] ?? null;
}

export function findReservationByCandidate(
  candidateId: string,
): CatalogueReservation | null {
  const list = loadDoc().reservations.filter(
    (r) => r.candidate_id === candidateId,
  );
  if (list.length === 0) return null;
  const active = list.find((r) =>
    [
      "RESERVED",
      "EXPORT_BUILT",
      "ASSETS_READY",
      "READY_FOR_RELEASE",
      "RELEASE_REQUESTED",
      "FOUNDER_RELEASE_APPROVED",
      "RELEASE_EXECUTING",
      "RELEASE_COMPLETED",
      "COMMITTED",
    ].includes(r.status),
  );
  return active ?? list[list.length - 1] ?? null;
}

export function getReservation(
  reservationId: string,
): CatalogueReservation | null {
  return (
    loadDoc().reservations.find((r) => r.reservation_id === reservationId) ??
    null
  );
}

/**
 * Atomically reserve next monotonic catalogue ID.
 * Idempotent for same staging_package_id when prior reservation is RESERVED/EXPORT_BUILT.
 */
export function reserveCatalogueId(input: {
  generation_id: string;
  candidate_id: string;
  staging_package_id: string;
  reason?: string;
}): { reservation: CatalogueReservation; created: boolean } {
  return withLock(() => {
    const doc = loadDoc();
    const existing = doc.reservations.find(
      (r) =>
        r.staging_package_id === input.staging_package_id &&
        [
          "RESERVED",
          "EXPORT_BUILT",
          "ASSETS_READY",
          "READY_FOR_RELEASE",
          "RELEASE_REQUESTED",
          "FOUNDER_RELEASE_APPROVED",
          "RELEASE_EXECUTING",
          "RELEASE_COMPLETED",
          "COMMITTED",
        ].includes(r.status),
    );
    if (existing) {
      return { reservation: existing, created: false };
    }

    const { next_id } = computeHighestUsedCatalogueNumber();
    // Collision guard: ensure next_id not already reserved (should be impossible under lock)
    if (
      doc.reservations.some(
        (r) =>
          r.reserved_catalogue_id === next_id &&
          [
            "RESERVED",
            "EXPORT_BUILT",
            "ASSETS_READY",
            "READY_FOR_RELEASE",
            "RELEASE_REQUESTED",
            "FOUNDER_RELEASE_APPROVED",
            "RELEASE_EXECUTING",
            "RELEASE_COMPLETED",
            "COMMITTED",
          ].includes(r.status),
      )
    ) {
      throw new Error(`Reservation collision on ${next_id}`);
    }

    const reservation_id = `rsv-${new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "")}-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const reservation: CatalogueReservation = {
      reservation_id,
      reserved_catalogue_id: next_id,
      generation_id: input.generation_id,
      candidate_id: input.candidate_id,
      staging_package_id: input.staging_package_id,
      reserved_at: now,
      status: "RESERVED",
      reason: input.reason ?? "AIOS export reservation (monotonic)",
      checksum: "",
      export_package_id: null,
      updated_at: now,
      publication_allowed: false,
    };
    reservation.checksum = reservationChecksum(reservation);
    doc.reservations.push(reservation);
    saveDoc(doc);
    return { reservation, created: true };
  });
}

export function updateReservationStatus(input: {
  reservation_id: string;
  status: ReservationStatus;
  export_package_id?: string | null;
  reason?: string;
}): CatalogueReservation {
  return withLock(() => {
    const doc = loadDoc();
    const idx = doc.reservations.findIndex(
      (r) => r.reservation_id === input.reservation_id,
    );
    if (idx < 0) throw new Error(`Reservation not found: ${input.reservation_id}`);
    const prev = doc.reservations[idx]!;
    const next: CatalogueReservation = {
      ...prev,
      status: input.status,
      export_package_id:
        input.export_package_id !== undefined
          ? input.export_package_id
          : prev.export_package_id,
      reason: input.reason ?? prev.reason,
      updated_at: new Date().toISOString(),
      publication_allowed: false,
    };
    next.checksum = reservationChecksum(next);
    doc.reservations[idx] = next;
    saveDoc(doc);
    return next;
  });
}

const ACTIVE_STATUSES = [
  "RESERVED",
  "EXPORT_BUILT",
  "ASSETS_READY",
  "READY_FOR_RELEASE",
  "RELEASE_REQUESTED",
  "FOUNDER_RELEASE_APPROVED",
  "RELEASE_EXECUTING",
  "RELEASE_COMPLETED",
  "COMMITTED",
] as const;

/**
 * Reserve an explicit catalogue ID (plan-bound). Idempotent for same staging package.
 * Collision with another candidate/plan fails closed.
 */
export function reserveSpecificCatalogueId(input: {
  catalogue_id: string;
  generation_id: string;
  candidate_id: string;
  staging_package_id: string;
  plan_id: string;
  execution_id: string;
  reason?: string;
}): { reservation: CatalogueReservation; created: boolean } {
  const catalogue_id = input.catalogue_id.toLowerCase();
  if (!/^t\d{3,}$/.test(catalogue_id)) {
    throw new Error(`Invalid catalogue_id: ${catalogue_id}`);
  }
  if (catalogue_id === "t094" || catalogue_id === "t099") {
    throw new Error(`Quarantined catalogue_id: ${catalogue_id}`);
  }

  return withLock(() => {
    const doc = loadDoc();
    const existingForStaging = doc.reservations.find(
      (r) =>
        r.staging_package_id === input.staging_package_id &&
        (ACTIVE_STATUSES as readonly string[]).includes(r.status),
    );
    if (existingForStaging) {
      if (existingForStaging.reserved_catalogue_id.toLowerCase() !== catalogue_id) {
        throw new Error(
          `Staging ${input.staging_package_id} already reserved as ${existingForStaging.reserved_catalogue_id}, cannot bind ${catalogue_id}`,
        );
      }
      return { reservation: existingForStaging, created: false };
    }

    const collision = doc.reservations.find(
      (r) =>
        r.reserved_catalogue_id.toLowerCase() === catalogue_id &&
        (ACTIVE_STATUSES as readonly string[]).includes(r.status),
    );
    if (collision) {
      throw new Error(
        `Catalogue ${catalogue_id} already reserved by ${collision.candidate_id} (${collision.reservation_id})`,
      );
    }

    const manifestPath = join(REPO, "templates.manifest.json");
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        templates?: Array<{ id?: string }>;
      };
      if (
        (manifest.templates ?? []).some(
          (t) => String(t.id ?? "").toLowerCase() === catalogue_id,
        )
      ) {
        throw new Error(`Catalogue ${catalogue_id} already in live templates.manifest.json`);
      }
    }

    const reservation_id = `rsv-${new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "")}-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const reservation: CatalogueReservation = {
      reservation_id,
      reserved_catalogue_id: catalogue_id,
      generation_id: input.generation_id,
      candidate_id: input.candidate_id,
      staging_package_id: input.staging_package_id,
      reserved_at: now,
      status: "RESERVED",
      reason:
        input.reason ??
        `Plan ${input.plan_id} exec ${input.execution_id} pinned ${catalogue_id}`,
      checksum: "",
      export_package_id: null,
      updated_at: now,
      publication_allowed: false,
    };
    reservation.checksum = reservationChecksum(reservation);
    doc.reservations.push(reservation);
    saveDoc(doc);
    return { reservation, created: true };
  });
}
